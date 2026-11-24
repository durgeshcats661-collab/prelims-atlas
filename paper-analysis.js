"use strict";

function analysisForm(info, p) {
  const subjectRows = info.rows.filter(
    (r) => !p.subject || p.subject === r.subject,
  );
  const themeRows = subjectRows.filter((r) => !p.theme || p.theme === r.theme);
  return (
    '<form class="analysis-filters" id="filters" data-view="trends"><input type="hidden" name="paper" value="' +
    info.paper +
    '">' +
    select("year", "Exam year", range(info.first, 2026), p.year, "All years") +
    select(
      "subject",
      info.paper === "csat" ? "Skill" : "Subject",
      sorted(info.rows, "subject"),
      p.subject,
      info.paper === "csat" ? "All skills" : "All subjects",
    ) +
    select(
      "theme",
      "Theme",
      sorted(subjectRows, "theme"),
      p.theme,
      "All themes",
    ) +
    select(
      "subtheme",
      "Subtheme",
      sorted(themeRows, "subtheme"),
      p.subtheme,
      "All subthemes",
    ) +
    "</form>"
  );
}

function rankTopics(groups, order) {
  const delta = (g) =>
    g.rows.filter((r) => r.year >= 2022).length -
    g.rows.filter((r) => r.year >= 2017 && r.year <= 2021).length;
  const value = (g) =>
    order === "change"
      ? delta(g)
      : order === "volume"
        ? g.rows.length
        : g.years.size;
  return [...groups].sort(
    (a, b) =>
      value(b) - value(a) ||
      b.years.size - a.years.size ||
      b.rows.length - a.rows.length ||
      a.subtheme.localeCompare(b.subtheme),
  );
}

function topicLink(info, g, label) {
  return anchor(
    "topic",
    { paper: info.paper, ...topicPath(g) },
    esc(label || g.subtheme),
  );
}

function recurrenceTable(info, p, groups, yearsShown) {
  const order = ["change", "volume"].includes(p.sort) ? p.sort : "years";
  const ranked = rankTopics(groups, order),
    size = 8;
  const page = Math.min(
    Math.max(Math.floor(Number(p.page) || 1), 1),
    Math.ceil(ranked.length / size),
  );
  const items = ranked.slice((page - 1) * size, page * size);
  const by = (name) => url("trends", { ...p, sort: name, page: "" });
  const sort =
    '<label class="rank-sort">Rank by<select id="rank-order">' +
    [
      ["years", "Most years tested"],
      ["volume", "Most questions"],
      ["change", "Largest five-year increase"],
    ]
      .map(
        ([key, label]) =>
          '<option value="' +
          esc(by(key)) +
          '" ' +
          (key === order ? "selected" : "") +
          ">" +
          label +
          "</option>",
      )
      .join("") +
    "</select></label>";
  function trow(g) {
    const cells = yearsShown.map((y) => {
      const n = g.years.get(y) || 0;
      return n
        ? '<td><a class="heat level-' +
            Math.min(n, 4) +
            '" href="' +
            esc(scopeHref(info, g, y)) +
            '" aria-label="' +
            esc(g.subtheme + ", " + y + ", " + qCount(n)) +
            '">' +
            n +
            "</a></td>"
        : '<td class="zero" aria-label="No questions">·</td>';
    });
    return (
      '<tr><th scope="row">' +
      topicLink(info, g) +
      "<small>" +
      esc(g.theme) +
      " · " +
      examYears(g.years.size) +
      "</small></th>" +
      cells.join("") +
      "</tr>"
    );
  }
  const nav =
    '<div class="rank-nav"><span>' +
    ((page - 1) * size + 1) +
    "–" +
    Math.min(page * size, ranked.length) +
    " of " +
    ranked.length +
    " subthemes</span><div>" +
    (page > 1
      ? anchor("trends", { ...p, page: page - 1 }, "Previous", "compact")
      : "") +
    (page * size < ranked.length
      ? anchor("trends", { ...p, page: page + 1 }, "Next", "compact")
      : "") +
    "</div></div>";
  return (
    '<section class="matrix-section"><div class="heading-row"><div><h2>Subthemes across years</h2><p>Open a subtheme for its analysis, or select a number to practise that year’s questions.</p></div>' +
    sort +
    "</div>" +
    (p.year
      ? '<p class="chart-note">Showing the full histories of the subthemes tested in ' +
        esc(p.year) +
        ".</p>"
      : "") +
    (order === "change"
      ? '<p class="chart-note">Ranked by the change in question count from 2017–2021 to 2022–2026. The two windows have equal paper sizes.</p>'
      : "") +
    '<div class="matrix-scroll" role="region" aria-label="Scrollable subtheme recurrence table" tabindex="0"><table class="matrix"><thead><tr><th scope="col">Subtheme</th>' +
    yearsShown
      .map(
        (y) =>
          '<th scope="col" ' +
          (String(y) === p.year ? 'class="year-focus"' : "") +
          ">" +
          y +
          "</th>",
      )
      .join("") +
    "</tr></thead><tbody>" +
    items.map(trow).join("") +
    "</tbody></table></div>" +
    nav +
    "</section>"
  );
}

function repeatInYear(info, selection, year) {
  const prior = selection.filter((r) => r.year < year && r.year >= year - 5);
  const keys = new Set(prior.map(topicKey));
  const cohort = selection.filter((r) => r.year === year);
  const repeats = cohort.filter((r) => keys.has(topicKey(r)));
  return { repeats, cohort, prior };
}

function analysisNote(title, body, link = "") {
  return (
    '<article class="finding"><h3>' +
    esc(title) +
    "</h3><p>" +
    body +
    "</p>" +
    link +
    "</article>"
  );
}

function findings(info, p, selection, cohort, groups, linkedGroups) {
  const most = linkedGroups[0];
  const mostLink = topicLink(info, most);
  let cards = "";
  if (p.year) {
    const year = Number(p.year),
      { repeats, prior } = repeatInYear(info, selection, year);
    const back = Math.min(5, year - info.first);
    const note = back
      ? "<strong>" +
        repeats.length +
        " of " +
        cohort.length +
        "</strong> questions tested a subtheme seen in the preceding " +
        examYears(back) +
        "."
      : "This is the first paper in the archive. Earlier papers are outside this comparison.";
    const example = repeats[0],
      comparison =
        example && prior.find((q) => topicKey(q) === topicKey(example));
    const linked = comparison
      ? '<div class="evidence-links">' +
        [comparison, example]
          .map(
            (r) =>
              '<a href="' +
              esc(scopeHref(info, r, r.year, r.id)) +
              '">' +
              r.year +
              " · Q" +
              r.number +
              "</a>",
          )
          .join("") +
        "</div>"
      : "";
    const practise = repeats.length
      ? anchor(
          info.practice,
          {
            year,
            subject: p.subject,
            theme: p.theme,
            subtheme: p.subtheme,
            returning: "1",
          },
          "Practise the " +
            repeats.length +
            " returning question" +
            (repeats.length === 1 ? "" : "s"),
          "quiet-link",
        )
      : "";
    cards += analysisNote(
      "Returning subthemes",
      note,
      linked +
        (practise ? '<div class="repeat-link">' + practise + "</div>" : ""),
    );
    const top = groups.slice().sort((a, b) => b.rows.length - a.rows.length)[0];
    cards += analysisNote(
      "Inside this paper",
      topicLink(info, top) +
        " accounts for <strong>" +
        qCount(top.rows.length) +
        "</strong> in the selected part of the " +
        year +
        " paper.",
    );
    cards += analysisNote(
      "Across the archive",
      mostLink +
        " appears in <strong>" +
        examYears(most.years.size) +
        "</strong>, including " +
        year +
        ".",
    );
  } else {
    cards += analysisNote(
      "Most years tested",
      mostLink +
        " appears in <strong>" +
        examYears(most.years.size) +
        "</strong> with " +
        qCount(most.rows.length) +
        ".",
    );
    const biggest = [...groups]
      .sort((a, b) => b.rows.length - a.rows.length)
      .slice(0, 3);
    const total = biggest.reduce((n, g) => n + g.rows.length, 0);
    cards += analysisNote(
      "Where questions cluster",
      "The " +
        (biggest.length === 1
          ? "leading subtheme"
          : "top " + biggest.length + " subthemes") +
        " account" +
        (biggest.length === 1 ? "s" : "") +
        " for <strong>" +
        total +
        " of " +
        cohort.length +
        "</strong> questions. " +
        biggest.map((g) => topicLink(info, g)).join(" · ") +
        ".",
    );
    const rising = rankTopics(groups, "change")[0],
      before = paperWindow(info, rising.rows, 2017, 2021),
      after = paperWindow(info, rising.rows, 2022, 2026);
    cards += analysisNote(
      "Five-year comparison",
      topicLink(info, rising) +
        " went from <strong>" +
        before.n +
        " to " +
        after.n +
        " questions</strong> between 2017–2021 and 2022–2026 (" +
        before.share.toFixed(1) +
        "% to " +
        after.share.toFixed(1) +
        "% of the full papers).",
    );
  }
  return '<div class="findings">' + cards + "</div>";
}

function analysisBreakdown(info, p, rows) {
  const dimension = !p.subject
    ? "subject"
    : !p.theme
      ? "theme"
      : !p.subtheme
        ? "subtheme"
        : "";
  if (!dimension) return "";
  const counts = countBy(rows, dimension),
    upper = counts[0][1];
  const line = ([name, n]) =>
    anchor(
      "trends",
      { ...p, [dimension]: name, page: "" },
      "<span>" +
        esc(name) +
        '</span><i style="--bar:' +
        Math.max(1, (100 * n) / upper) +
        '%"></i><strong>' +
        n +
        "</strong>",
      "distribution-row",
    );
  return (
    '<section class="dossier-section"><h2>Questions by ' +
    dimension +
    '</h2><div class="distribution">' +
    counts.slice(0, 8).map(line).join("") +
    "</div>" +
    (counts.length > 8
      ? '<details class="more-examples"><summary>Show all ' +
        counts.length +
        "</summary>" +
        counts.slice(8).map(line).join("") +
        "</details>"
      : "") +
    "</section>"
  );
}

function twoPaperComparison(info, p, scope) {
  const options = range(info.first, 2026);
  const end = options.includes(Number(p.to))
    ? Number(p.to)
    : Number(p.year) || 2026;
  const start =
    options.includes(Number(p.from)) && Number(p.from) !== end
      ? Number(p.from)
      : end === info.first
        ? end + 1
        : Math.max(info.first, end - 5);
  const leftTotal = info.rows.filter((r) => r.year === start).length,
    rightTotal = info.rows.filter((r) => r.year === end).length;
  const groups = groupTopics(
    scope.filter((r) => r.year === start || r.year === end),
  )
    .map((g) => {
      const left = g.years.get(start) || 0,
        right = g.years.get(end) || 0;
      return {
        g,
        left,
        right,
        change: 100 * (right / rightTotal - left / leftTotal),
      };
    })
    .sort(
      (a, b) =>
        Math.abs(b.change) - Math.abs(a.change) ||
        b.right + b.left - (a.right + a.left) ||
        a.g.subtheme.localeCompare(b.g.subtheme),
    );
  const selector = (label, field, val, other) =>
    "<label>" +
    label +
    '<select id="compare-' +
    field +
    '">' +
    options
      .filter((y) => y !== other)
      .map(
        (y) =>
          "<option " + (y === val ? "selected" : "") + ">" + y + "</option>",
      )
      .join("") +
    "</select></label>";
  const cell = (g, y, n) =>
    n
      ? '<a href="' +
        esc(scopeHref(info, g, y)) +
        '" aria-label="' +
        y +
        ", " +
        qCount(n) +
        '">' +
        n +
        "</a>"
      : "0";
  const line = ({ g, left, right, change }) =>
    '<tr><th scope="row">' +
    topicLink(info, g) +
    "</th><td>" +
    cell(g, start, left) +
    "</td><td>" +
    cell(g, end, right) +
    "</td><td>" +
    (change > 0 ? "+" : "") +
    change.toFixed(1) +
    "</td></tr>";
  const columns =
    '<thead><tr><th scope="col">Subtheme</th><th scope="col">' +
    start +
    '</th><th scope="col">' +
    end +
    '</th><th scope="col">Change (pp)</th></tr></thead>';
  const table = (rows) =>
    '<div class="table-scroll"><table>' +
    columns +
    "<tbody>" +
    rows.map(line).join("") +
    "</tbody></table></div>";
  return (
    '<details class="paper-pair more-examples" ' +
    (p.compare === "1" ? "open" : "") +
    '><summary>Compare two exam papers</summary><div class="pair-filters">' +
    selector("First paper", "from", start, end) +
    selector("Second paper", "to", end, start) +
    '</div><p class="chart-note">' +
    start +
    " had " +
    leftTotal +
    " printed questions and " +
    end +
    " had " +
    rightTotal +
    ". The table ranks changes by percentage points (pp) of the full paper. Select a count to open its questions.</p>" +
    (groups.length
      ? table(groups.slice(0, 5)) +
        (groups.length > 5
          ? '<details class="more-examples"><summary>See all ' +
            groups.length +
            " subthemes in the two papers</summary>" +
            table(groups.slice(5)) +
            "</details>"
          : "")
      : "<p>This topic appeared in neither selected paper.</p>") +
    "</details>"
  );
}

function analysisLedger(info, p, cohort) {
  const counts = new Map(countBy(cohort, "year")),
    totals = new Map(countBy(info.rows, "year"));
  return (
    '<details class="more-examples ledger"><summary>Share by exam year</summary><div class="ledger-list">' +
    range(info.first, 2026)
      .map((y) => {
        const n = counts.get(y) || 0,
          whole = totals.get(y);
        return (
          "<div><b>" +
          y +
          "</b><span>" +
          n +
          " of " +
          whole +
          " questions</span><span>" +
          ((100 * n) / whole).toFixed(1) +
          "%</span></div>"
        );
      })
      .join("") +
    "</div></details>"
  );
}

function paperAnalysis(p) {
  const info = paperInfo(p),
    scope = { subject: p.subject, theme: p.theme, subtheme: p.subtheme };
  const selection = filterRows(info.rows, scope);
  const cohort = p.year ? selection.filter((r) => r.year == p.year) : selection;
  const groups = groupTopics(cohort);
  const keys = new Set(groups.map(topicKey));
  const linkedGroups = groupTopics(selection).filter((g) =>
    keys.has(topicKey(g)),
  );
  const header =
    '<section class="route-head"><div><span class="kicker">' +
    info.name +
    " · " +
    info.first +
    "–2026</span><h1>Paper <em>analysis</em></h1><p>See which subthemes return, how their weight changes, and the questions behind each count.</p></div>" +
    paperTabs("trends", p) +
    "</section>";
  if (!cohort.length)
    return (
      header +
      analysisForm(info, p) +
      '<p class="empty">No questions in this selection. ' +
      (p.year && selection.length
        ? anchor(
            "trends",
            { ...p, year: "", page: "" },
            "See the years when this topic appeared",
          )
        : anchor("trends", { paper: info.paper }, "Clear filters")) +
      "</p>"
    );
  const scopeTitle = p.subtheme || p.theme || p.subject || info.name;
  const summary =
    '<div class="analysis-summary"><div><span class="kicker">Cross-year meta-analysis</span><h2>' +
    esc(scopeTitle) +
    (p.year ? " · " + esc(p.year) : "") +
    "</h2><p>" +
    qCount(cohort.length) +
    " · " +
    groups.length +
    " subtheme" +
    (groups.length === 1 ? "" : "s") +
    (p.year ? "" : " · " + examYears(new Set(cohort.map((r) => r.year)).size)) +
    "</p></div>" +
    anchor(
      info.practice,
      { ...scope, year: p.year },
      "Practise this selection " + icon("arrow-right"),
      "quiet-link",
    ) +
    "</div>";
  const shown = range(info.first, 2026);
  const studyExample = linkedGroups.find(
    (g) => atlas.briefs?.[topicKey(g)]?.pattern,
  );
  let brief = "";
  if (studyExample) {
    const b = atlas.briefs[topicKey(studyExample)];
    const links = b.examples
      .map((id) => studyExample.rows.find((r) => r.id === id))
      .map(
        (r) =>
          '<a href="' +
          esc(scopeHref(info, r, r.year, r.id)) +
          '">' +
          r.year +
          " · Q" +
          r.number +
          "</a>",
      )
      .join("");
    brief =
      '<section class="analysis-brief"><div><span class="kicker">A pattern in the questions</span><h3>' +
      topicLink(info, studyExample) +
      "</h3></div><div><p>" +
      esc(b.pattern) +
      '</p><div class="evidence-links">' +
      links +
      "</div></div></section>";
  }
  return (
    header +
    analysisForm(info, p) +
    summary +
    findings(info, p, selection, cohort, groups, linkedGroups) +
    brief +
    twoPaperComparison(info, p, selection) +
    recurrenceTable(info, p, linkedGroups, shown) +
    analysisBreakdown(info, p, cohort) +
    analysisLedger(info, p, selection) +
    '<details class="more-examples method-note"><summary>How the counts work</summary><p>Each printed question has one primary subject, theme and subtheme. A year counts once for a subtheme even when several questions tested it. Percentages use the full printed paper, including questions later excluded from scoring. GS has 150 questions per year in 2008–2010 and 100 thereafter. CSAT has 80 per year from 2011.</p></details>'
  );
}
