"use strict";
const mapAnswers = readStored("prelims-atlas-map-recall-v1", {});

function recallCases(p) {
  return atlas.maps.filter(
    (q) =>
      q.recall &&
      (!p.region || p.region === q.recall.region) &&
      (!p.skill || p.skill === q.recall.skillGroup) &&
      (!p.year || q.year == p.year),
  );
}

function choicesForCase(r, round = 0) {
  const coords = [r.recall.target, ...r.recall.distractors];
  let seed = Array.from(r.id).reduce(
    (s, c) => (Math.imul(s, 31) + c.charCodeAt(0)) >>> 0,
    17,
  );
  for (let i = coords.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [coords[i], coords[j]] = [coords[j], coords[i]];
  }
  const shift = round % coords.length;
  return coords.slice(shift).concat(coords.slice(0, shift));
}

function coordText(point) {
  return (
    Math.abs(point.lat).toFixed(1) +
    "°" +
    (point.lat < 0 ? "S" : "N") +
    " · " +
    Math.abs(point.lon).toFixed(1) +
    "°" +
    (point.lon < 0 ? "W" : "E")
  );
}

function mapPlot(points, world, opts) {
  const { left, top, span } = mapBounds(
    points,
    world,
    -1,
    points.length === 1 ? 18 : 8,
  );
  const base = [-360, 0, 360]
    .map(
      (offset) =>
        '<img src="assets/world.webp" alt="" class="world-tile" style="left:' +
        ((offset - 180 - left) * 100) / span +
        "%;top:" +
        ((top - 90) * 200) / span +
        "%;width:" +
        36000 / span +
        '%">',
    )
    .join("");
  const markers = points.map((q, i) => {
    const x = (((((q.lon - left) % 360) + 360) % 360) * 100) / span,
      y = ((top - q.lat) * 200) / span;
    return {
      q,
      i,
      x,
      y,
      px: Math.min(95, Math.max(5, x)),
      py: Math.min(90, Math.max(10, y)),
    };
  });
  // Spread close labels on a narrow screen. A leader keeps each symbol tied to its position.
  for (let i = 0; i < markers.length; i++) {
    const m = markers[i];
    const near = markers
      .slice(0, i)
      .filter(
        (a) => Math.hypot((a.px - m.px) * 3.1, (a.py - m.py) * 1.55) < 35,
      );
    if (near.length) {
      const alternatives = [
        [0, 23],
        [0, -23],
        [12, 3],
        [-12, 3],
        [12, 20],
        [-12, -20],
        [20, -10],
        [-20, 10],
      ];
      let best;
      for (const [dx, dy] of alternatives) {
        const px = Math.min(95, Math.max(5, m.x + dx)),
          py = Math.min(90, Math.max(11, m.y + dy));
        const score = Math.min(
          ...markers
            .slice(0, i)
            .map((a) => Math.hypot((a.px - px) * 3.1, (a.py - py) * 1.55)),
        );
        if (!best || score > best.score) best = { px, py, score };
        if (score > 36) break;
      }
      m.px = best.px;
      m.py = best.py;
    }
  }
  const leaders = markers
    .filter((m) => m.x !== m.px || m.y !== m.py)
    .map(
      (m) =>
        '<line x1="' +
        m.x +
        '" y1="' +
        m.y +
        '" x2="' +
        m.px +
        '" y2="' +
        m.py +
        '" vector-effect="non-scaling-stroke"/><circle cx="' +
        m.x +
        '" cy="' +
        m.y +
        '" r=".55"/>',
    )
    .join("");
  const pins = markers
    .map(({ q, i, px, py }) => {
      const label = opts.study ? String(i + 1) : String.fromCharCode(65 + i);
      const name =
        opts.study || opts.revealed
          ? q.name
          : "Marker " + label + " · " + coordText(q);
      const active = opts.study
        ? i === opts.point
        : q.name === opts.target && opts.revealed;
      const wrong =
        !opts.study && opts.chosen === q.name && q.name !== opts.target;
      const attrs = opts.study
        ? ' data-study-pin="' +
          i +
          '" aria-pressed="' +
          (i === opts.point) +
          '"'
        : ' data-recall-choice="' +
          i +
          '" ' +
          (opts.revealed ? "disabled" : "");
      return (
        '<button type="button" class="geo-pin ' +
        (active ? "pin-key" : "") +
        (wrong ? " pin-miss" : "") +
        '" style="left:' +
        px +
        "%;top:" +
        py +
        '%" ' +
        attrs +
        ' aria-label="' +
        esc(name) +
        '" title="' +
        esc(name) +
        '">' +
        label +
        "</button>"
      );
    })
    .join("");
  return (
    '<div class="map-figure recall-plot" role="group" aria-label="Physical map with selectable markers">' +
    base +
    '<svg class="map-leaders" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden="true">' +
    leaders +
    "</svg>" +
    pins +
    '<span class="north-arrow" aria-hidden="true">↑ N</span></div>'
  );
}

function mapRoom(p) {
  const study = p.mode === "study" || (!p.mode && !!p.id);
  const available = recallCases(p);
  const q = available.find((r) => r.id === p.id) || available[0];
  const scopes = { region: p.region, skill: p.skill, year: p.year };
  const mode = study ? "study" : "recall",
    to = { ...scopes, mode };
  const header =
    '<section class="route-head"><div><span class="kicker">Geography in the papers</span><h1>Map <em>room</em></h1><p>Place the feature on a relief map, then try the UPSC question that inspired the exercise.</p></div>' +
    tabs(
      [
        [
          "Test yourself",
          url("maps", { ...scopes, id: q?.id, mode: "recall" }),
          "recall",
        ],
        [
          "Explore places",
          url("maps", { ...scopes, id: q?.id, mode: "study" }),
          "study",
        ],
      ],
      mode,
    ) +
    "</section>";
  const mapRows = atlas.maps.map((r) => ({ ...r.recall, year: r.year }));
  const skillRows = mapRows.filter((r) => !p.skill || r.skillGroup === p.skill);
  const regionRows = skillRows.filter(
    (r) => !p.region || r.region === p.region,
  );
  const filters =
    '<form class="map-filters" id="map-filters"><input name="mode" type="hidden" value="' +
    mode +
    '">' +
    select(
      "skill",
      "Map skill",
      sorted(mapRows, "skillGroup"),
      p.skill,
      "All map skills",
    ) +
    select(
      "region",
      "Region",
      sorted(skillRows, "region"),
      p.region,
      "All regions",
    ) +
    select(
      "year",
      "Exam year",
      sorted(regionRows, "year").reverse(),
      p.year,
      "All years",
    ) +
    "</form>";
  if (!q)
    return (
      header +
      filters +
      '<div class="empty">No exercises match this selection. ' +
      anchor("maps", { mode }, "Show all exercises") +
      "</div>"
    );
  const i = available.indexOf(q),
    r = q.recall;
  const answer = mapAnswers[q.id] || {},
    round = answer.round || 0,
    selected = answer.name;
  const choices = choicesForCase(q, round),
    active = Number(p.pin) || 0;
  const hasAnswer = !study && choices.some((c) => c.name === selected);
  const list = study ? q.places : choices;
  const map = mapPlot(list, p.zoom === "world", {
    study,
    point: active,
    target: r.target.name,
    revealed: hasAnswer,
    chosen: selected,
  });
  const labels = list
    .map((place, j) => {
      const letter = study ? String(j + 1) : String.fromCharCode(65 + j);
      const reveal = study || hasAnswer;
      const button = study
        ? 'data-study-pin="' + j + '" aria-pressed="' + (j === active) + '"'
        : 'data-recall-choice="' + j + '" ' + (hasAnswer ? "disabled" : "");
      return (
        '<button type="button" ' +
        button +
        ' class="map-key ' +
        ((study && j === active) || (hasAnswer && place.name === r.target.name)
          ? "is-key"
          : "") +
        '"><b>' +
        letter +
        "</b><span>" +
        esc(reveal ? place.name : coordText(place)) +
        "</span></button>"
      );
    })
    .join("");
  const identified = study
    ? '<div class="geo-result"><strong>' +
      esc(q.places[active]?.name || q.places[0].name) +
      "</strong><p>" +
      esc(coordText(q.places[active] || q.places[0])) +
      "</p></div>"
    : hasAnswer
      ? '<div role="status" class="geo-result"><strong>' +
        (r.target.name === selected
          ? "Correct. "
          : "The correct marker is " +
            String.fromCharCode(
              65 + choices.findIndex((c) => c.name === r.target.name),
            ) +
            ". ") +
        esc(r.target.name) +
        "</strong><p>" +
        esc(r.explanation) +
        '</p><button class="text-btn" data-recall-retry type="button">Try again</button></div>'
      : '<p class="chart-note">Select a letter on the map or use the coordinates below.</p>';
  const nav =
    '<div class="map-step">' +
    (i > 0
      ? anchor(
          "maps",
          { ...to, id: available[i - 1].id },
          "Previous",
          "compact",
        )
      : "<span></span>") +
    "<span>" +
    (i + 1) +
    " of " +
    available.length +
    "</span>" +
    (i + 1 < available.length
      ? anchor(
          "maps",
          { ...to, id: available[i + 1].id },
          "Next exercise",
          "btn",
        )
      : anchor(
          "maps",
          { ...to, id: available[0].id },
          "Back to first",
          "compact",
        )) +
    "</div>";
  const context = study ? "<p>" + esc(r.explanation) + "</p>" : "";
  const heading =
    '<div class="map-exercise-heading" id="map-exercise" tabindex="-1"><span class="kicker">' +
    esc(r.skillGroup) +
    " · " +
    q.year +
    "</span><h2>" +
    esc(study ? q.title : r.prompt) +
    "</h2></div>";
  const card =
    '<section class="map-prompt"><h3>' +
    (study ? "Places on this map" : "Choose a marker") +
    "</h3>" +
    context +
    (!study && !hasAnswer ? identified : "") +
    '<div class="map-options">' +
    labels +
    "</div>" +
    (study || hasAnswer ? identified : "") +
    nav +
    "</section>";
  const scale = anchor(
    "maps",
    { ...p, id: q.id, mode, zoom: p.zoom === "world" ? "region" : "world" },
    p.zoom === "world" ? "Zoom to this region" : "See on the world map",
    "quiet-link",
  );
  const detail = anchor(
    "topic",
    { paper: "gs", ...topicPath(q) },
    "Study this subtheme " + icon("arrow-right"),
    "quiet-link",
  );
  const jumps =
    '<label class="case-select">Choose an exercise<select id="map-case">' +
    available
      .map(
        (item, j) =>
          '<option value="' +
          esc(item.id) +
          '" ' +
          (q === item ? "selected" : "") +
          ">" +
          esc(
            study
              ? item.year + " · " + item.title
              : j +
                  1 +
                  " · " +
                  item.year +
                  " · " +
                  item.recall.skillGroup +
                  " · " +
                  item.recall.region,
          ) +
          "</option>",
      )
      .join("") +
    "</select></label>";
  return (
    header +
    filters +
    heading +
    '<div class="map-workspace"><figure>' +
    map +
    '<figcaption class="caption">Natural Earth relief · approximate locations · ' +
    esc(r.region) +
    "</figcaption>" +
    scale +
    "</figure>" +
    card +
    "</div>" +
    jumps +
    '<details class="original-pyq" ' +
    (p.question === "open" || study ? "open" : "") +
    "><summary>Read the original UPSC question <span>" +
    q.year +
    " · " +
    esc(locator(q)) +
    "</span></summary>" +
    studyCard(q, url("maps", { ...to, id: q.id, question: "open" }), false) +
    '</details><div class="map-study-links">' +
    detail +
    anchor(
      "index",
      { map: 1 },
      "Practise all " +
        qCount(atlas.gs.filter((x) => x.map).length) +
        " tagged for map study",
      "quiet-link",
    ) +
    "</div>" +
    mapPatterns()
  );
}

function mapPatterns() {
  const mapped = atlas.gs.filter((q) => q.map);
  const groups = groupTopics(mapped).slice(0, 5);
  const info = paperInfo({});
  const rows = groups
    .map(
      (g) =>
        '<div class="map-pattern">' +
        topicLink(info, g) +
        "<span>" +
        qCount(g.rows.length) +
        " · " +
        examYears(g.years.size) +
        "</span>" +
        anchor("index", { ...topicPath(g), map: 1 }, "Practise", "quiet-link") +
        "</div>",
    )
    .join("");
  return (
    '<details class="more-examples map-patterns"><summary>Which map subthemes keep returning?</summary><p>Among the ' +
    mapped.length +
    " GS questions tagged for map study, these subthemes recur in the most exam years.</p>" +
    rows +
    "</details>"
  );
}

function handleRecall(e) {
  const el = e.target.closest(
    "[data-recall-choice],[data-recall-retry],[data-study-pin]",
  );
  if (!el) return;
  const { p } = state(),
    items = recallCases(p),
    q = items.find((r) => r.id === p.id) || items[0];
  if (!q) return;
  if (el.dataset.studyPin !== undefined) {
    location.hash = url("maps", {
      ...p,
      id: q.id,
      mode: "study",
      pin: el.dataset.studyPin,
    });
    return;
  }
  const existing = mapAnswers[q.id] || { round: 0 };
  if (el.dataset.recallRetry !== undefined)
    mapAnswers[q.id] = { round: (existing.round || 0) + 1 };
  else {
    if (existing.name) return;
    const pick = choicesForCase(q, existing.round)[
      Number(el.dataset.recallChoice)
    ];
    if (!pick) return;
    mapAnswers[q.id] = { round: existing.round || 0, name: pick.name };
  }
  saveStored("prelims-atlas-map-recall-v1", mapAnswers);
  render();
  document
    .querySelector(
      el.dataset.recallRetry !== undefined
        ? "[data-recall-choice]"
        : "[data-recall-retry]",
    )
    ?.focus({ preventScroll: true });
}
