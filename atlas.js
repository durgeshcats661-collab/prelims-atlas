"use strict";
const atlas = window.PRELIMS_ATLAS;
const main = document.getElementById("main");
const format = (n) => n.toLocaleString("en-IN");
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
const icon = (name) => '<i aria-hidden="true" class="ph ph-' + name + '"></i>';
const url = (view, filters = {}) => {
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v != null && String(v) !== ""),
  );
  return "#" + view + (params.size ? "?" + params : "");
};
const anchor = (view, params, text, classes = "") =>
  '<a class="' +
  classes +
  '" href="' +
  esc(url(view, params)) +
  '">' +
  text +
  "</a>";
const external = (href, title) =>
  /^https?:\/\//i.test(href || "")
    ? '<a href="' +
      esc(href) +
      '" target="_blank" rel="noopener noreferrer">' +
      esc(title) +
      "</a>"
    : "";
const range = (first, last) =>
  Array.from({ length: last - first + 1 }, (_, i) => last - i);
const years = range(2008, 2026);
const qCount = (n) => format(n) + (n === 1 ? " question" : " questions");
const sorted = (rows, key) =>
  [...new Set(rows.map((q) => q[key]).filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), "en", { numeric: true }),
  );
const countBy = (rows, key) => {
  const counts = new Map();
  for (const row of rows)
    if (row[key]) counts.set(row[key], (counts.get(row[key]) || 0) + 1);
  return [...counts].sort(
    (a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])),
  );
};
const subjectStyle = {
  Geography: ["globe-hemisphere-east", "#e4eee6", "#386446"],
  History: ["hourglass", "#f3e9dc", "#885c38"],
  "Polity & Governance": ["bank", "#e5ebf1", "#415d74"],
  Economy: ["chart-line", "#eaeede", "#566b34"],
  Environment: ["plant", "#e2ece0", "#466a43"],
  "Science & Technology": ["atom", "#e9e7f2", "#66567c"],
  "Art & Culture": ["scroll", "#efe4db", "#8a5a41"],
  "International Relations": ["globe", "#e5edef", "#426b76"],
  "Current Affairs": ["newspaper", "#efeadd", "#786637"],
  "Reading Comprehension": ["book-open", "#e8ebdf", "#486044"],
  "Quantitative Aptitude": ["calculator", "#e8e4ee", "#635777"],
  "Logical Reasoning": ["puzzle", "#eee5d8", "#815e3c"],
};
function state() {
  const [view = "home", query = ""] = location.hash.slice(1).split("?");
  return {
    view: view || "home",
    p: Object.fromEntries(new URLSearchParams(query)),
  };
}
function head(kicker, title, info) {
  return (
    '<div class="viewhead"><span class="kicker">' +
    kicker +
    "</span><h1>" +
    title +
    "</h1><p>" +
    info +
    "</p></div>"
  );
}
function tabs(options, value) {
  return (
    '<div class="toggle">' +
    options
      .map(
        ([text, href, key]) =>
          '<a href="' +
          esc(href) +
          '"' +
          (key === value ? ' aria-current="true"' : "") +
          ">" +
          text +
          "</a>",
      )
      .join("") +
    "</div>"
  );
}
function select(
  name,
  label,
  values,
  chosen,
  all = "All " + label.toLowerCase(),
) {
  return (
    "<label>" +
    label +
    '<select name="' +
    name +
    '"><option value="">' +
    esc(all) +
    "</option>" +
    values
      .map(
        (v) =>
          '<option value="' +
          esc(v) +
          '"' +
          (String(v) === String(chosen) ? " selected" : "") +
          ">" +
          esc(v) +
          "</option>",
      )
      .join("") +
    "</select></label>"
  );
}
function searchMatch(row, text) {
  if (!text) return true;
  const words = text.toLocaleLowerCase().trim().split(/\s+/);
  const body = window.PRELIMS_READING?.[row.id] || {};
  const full = [
    row.title,
    row.cue,
    body.stem,
    body.passage,
    ...(body.choices || []),
    row.subject,
    row.theme,
    row.subtheme,
    row.year,
    row.id,
    row.number ? "Q" + row.number : "",
    row.referenceTitle,
    ...(row.places || []).map((p) => p.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
  return words.every((w) => full.includes(w));
}
function filterRows(rows, p) {
  const past =
    p.returning && p.year
      ? new Set(
          rows
            .filter(
              (r) => r.year < Number(p.year) && r.year >= Number(p.year) - 5,
            )
            .map(topicKey),
        )
      : null;
  return rows.filter(
    (row) =>
      (!past || past.has(topicKey(row))) &&
      (!p.format || row.questionFormat === p.format) &&
      (!p.year || row.year == p.year) &&
      (!p.subject || row.subject === p.subject) &&
      (!p.theme || row.theme === p.theme) &&
      (!p.subtheme || row.subtheme === p.subtheme) &&
      (!p.map || row.map) &&
      (!p.evidence ||
        (p.evidence === "linked"
          ? Boolean(row.referenceUrl)
          : references(row).some((r) => r.referenceKind === p.evidence))) &&
      searchMatch(row, p.q),
  );
}
function migratedPath(p, rows) {
  if (
    (!p.theme && !p.subtheme && !p.subject) ||
    filterRows(rows, {
      subject: p.subject,
      theme: p.theme,
      subtheme: p.subtheme,
    }).length
  )
    return p;
  const legacy = rows.filter((r) =>
    ["subject", "theme", "subtheme"].every(
      (k) =>
        !p[k] ||
        p[k] === (r["previous" + k[0].toUpperCase() + k.slice(1)] || r[k]),
    ),
  );
  if (!legacy.length) return p;
  const exact = legacy.find((r) => r.id === p.at) || legacy[0];
  return {
    ...p,
    subject: p.subject ? exact.subject : "",
    theme: p.theme ? exact.theme : "",
    subtheme: p.subtheme ? exact.subtheme : "",
  };
}
function locator(row) {
  return [
    row.booklet ? "Set " + row.booklet : "",
    row.number ? "Q" + row.number : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
function references(row) {
  const first = row.referenceUrl ? [row] : [];
  return first.concat(row.otherReferences || []);
}
const sourceNames = {
  named: "Named in the question",
  textMatch: "Wording match",
  supporting: "Supporting source",
};
function detail(row, showMapLink = true) {
  const citation = row.paperLabel || "Exam paper",
    paper = row.paperUrl || row.recordUrl;
  const locate =
    row.recordUrl &&
    (row.recordUrl.split("#")[0] === paper || row.recordUrl === paper)
      ? row.recordUrl
      : paper;
  const links = [];
  if (
    row.localPaper &&
    (location.protocol === "file:" ||
      ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname))
  ) {
    const original =
      location.protocol === "file:"
        ? row.localPaper.replace(
            "local-papers/",
            "../../Research inputs/Papers/",
          )
        : row.localPaper;
    links.push(
      '<a href="' +
        esc(original) +
        '" target="_blank" rel="noopener">Read the printed paper' +
        (row.localPaper.includes("#page=")
          ? " · p. " + esc(row.localPaper.split("#page=")[1])
          : "") +
        "</a>",
    );
  }
  if (locate) links.push(external(locate, citation));
  if (
    row.officialUrl &&
    row.officialUrl !== paper &&
    row.officialUrl !== locate?.split("#")[0]
  )
    links.push(external(row.officialUrl, "UPSC archive"));
  if (row.recordUrl && !links.length)
    links.push(external(row.recordUrl, "Question reference"));
  if (
    row.recordUrl &&
    row.recordUrl !== locate &&
    !row.recordUrl.includes("/tree/") &&
    !row.recordUrl.includes("upsc-prelims-20") &&
    !row.recordUrl.endsWith(".pdf")
  )
    links.push(external(row.recordUrl, "Question index reference"));
  const key = window.PRELIMS_READING?.[row.id];
  if (key?.originalFigure) {
    const base =
      location.protocol === "file:"
        ? "../../Research inputs/Question figures/"
        : "question-figures/";
    const name = key.originalFigure.split("/").pop();
    links.push(
      '<a href="' +
        esc(base + encodeURIComponent(name)) +
        '" target="_blank" rel="noopener">' +
        esc(key.originalFigureType || "Original question excerpt") +
        "</a>",
    );
  }
  if (key?.studyKeys)
    for (const provider of key.studyKeys) {
      if (provider.url)
        links.push(
          external(
            provider.url,
            (provider.title ||
              provider.source ||
              provider.label ||
              "Study key") + (provider.answer ? " · " + provider.answer : ""),
          ),
        );
    }
  if (key?.answerUrl && key.answerUrl !== row.keyUrl)
    links.push(external(key.answerUrl, key.answerStatus || "Answer key"));
  if (
    row.localPassage &&
    ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname)
  )
    links.push(
      '<a href="' +
        esc(row.localPassage) +
        '" target="_blank" rel="noopener">Printed passage</a>',
    );
  const src = references(row)
    .map(
      (r) =>
        '<div class="trail"><span class="trail-label">' +
        (sourceNames[r.referenceKind] || "Supporting source") +
        "</span><div>" +
        external(r.referenceUrl, r.referenceTitle || "Study reference") +
        (r.referenceNote
          ? '<p class="caption">' + esc(r.referenceNote) + "</p>"
          : "") +
        "</div></div>",
    )
    .join("");
  const mapLink =
    showMapLink && row.places?.length
      ? "<p>" +
        anchor(
          "maps",
          { id: row.id },
          icon("map-trifold") + " Locate on the study map",
        ) +
        "</p>"
      : "";
  const status = row.scoringStatus
    ? '<p class="caption">Scoring · ' +
      esc(row.scoringStatus) +
      (row.keyUrl ? " · " + external(row.keyUrl, "Answer-key scan") : "") +
      "</p>"
    : "";
  return (
    '<p class="meta">' +
    [row.subject, row.theme, row.subtheme]
      .filter(Boolean)
      .map(esc)
      .join(" · ") +
    "</p>" +
    (row.cue ? "<p>" + esc(row.cue) + "</p>" : "") +
    mapLink +
    (links.length
      ? '<div class="trail"><span class="trail-label">Exam evidence</span><div>' +
        links.join(" &nbsp;·&nbsp; ") +
        (locator(row)
          ? '<p class="caption">' + esc(locator(row)) + "</p>"
          : "") +
        "</div></div>"
      : "") +
    src +
    status +
    '<p class="caption origin">Question-setter’s original source · ' +
    esc(
      !row.originStatus ||
        ["unknown", "supporting", "named", "textmatch"].includes(
          row.originStatus.toLowerCase(),
        )
        ? "Unconfirmed"
        : row.originStatus,
    ) +
    "</p>"
  );
}
function lines(text) {
  if (!text) return "";
  return String(text)
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((para) => {
      const separated = para.replace(
        /([^\n\d])\s+(?=(?:[1-6][.)]|I{1,3}\.)\s+[A-Za-z(])/g,
        "$1\n",
      );
      return "<p>" + esc(separated.trim()).replace(/\n/g, "<br>") + "</p>";
    })
    .join("");
}
function readingFigures(entry) {
  const paths = [entry.figure, ...(entry.figures || [])].filter(Boolean);
  return paths
    .map((f) => {
      const name = typeof f === "string" ? f : f.path || f.src,
        caption =
          typeof f === "string"
            ? entry.figureAlt || "Original question figure"
            : f.caption || "Original question figure";
      if (!name || name.includes("..")) return "";
      const base =
        location.protocol === "file:"
          ? "../../Research inputs/Question figures/"
          : "question-figures/";
      const src = base + encodeURIComponent(name.split("/").pop());
      return (
        '<figure class="question-figure"><a href="' +
        esc(src) +
        '" target="_blank" rel="noopener"><img loading="lazy" src="' +
        esc(src) +
        '" alt="' +
        esc(caption) +
        '"></a><figcaption class="caption">' +
        esc(caption) +
        "</figcaption></figure>"
      );
    })
    .join("");
}
function reading(row) {
  const entry = (window.PRELIMS_READING || {})[row.id];
  if (!entry)
    return (
      '<div class="reading"><p>' +
      esc(row.cue || row.title) +
      '</p><p class="caption">The inline transcription is being checked for this question.</p></div>'
    );
  const showSharedGraphic =
    entry.passageFigure && (entry.passageNeedsFigure || !entry.passage);
  const passage =
    entry.passage || showSharedGraphic
      ? '<section class="passage"><h4>' +
        (showSharedGraphic ? "Passage and figure" : "Passage") +
        "</h4>" +
        lines(entry.passage) +
        (showSharedGraphic
          ? readingFigures({
              figure: entry.passageFigure,
              figureAlt: "Shared figure for this question",
            })
          : "") +
        "</section>"
      : "";
  const t = entry.table;
  const stem =
    t?.headers && t?.rows
      ? lines(t.intro) +
        '<div class="table-scroll stem-table"><table><thead><tr>' +
        t.headers.map((h) => "<th>" + esc(h) + "</th>").join("") +
        "</tr></thead><tbody>" +
        t.rows
          .map(
            (r) =>
              "<tr>" +
              r.map((cell) => "<td>" + esc(cell) + "</td>").join("") +
              "</tr>",
          )
          .join("") +
        "</tbody></table></div>" +
        lines(t.after)
      : lines(entry.stem);
  const attempt = attempts[row.id] || {},
    keys = answerLetters(entry);
  const picks = (entry.choices || [])
    .map((answer, j) => {
      const letter = String.fromCharCode(65 + j),
        selected = attempt.choice === letter,
        correct = attempt.reveal && keys.includes(letter),
        incorrect = attempt.reveal && selected && !correct && keys.length > 0;
      return (
        '<li><button type="button" class="answer-choice' +
        (correct ? " correct" : incorrect ? " incorrect" : "") +
        '" aria-pressed="' +
        selected +
        '" data-question="' +
        esc(row.id) +
        '" data-choice="' +
        letter +
        '"><span>' +
        letter +
        "</span><div>" +
        lines(
          typeof answer === "string" &&
            /^see (?:the )?printed option [A-D]/i.test(answer)
            ? "Figure " + letter
            : typeof answer === "string"
              ? answer
              : answer.text,
        ) +
        "</div>" +
        (correct
          ? '<small class="choice-note">Correct</small>'
          : incorrect
            ? '<small class="choice-note">Your choice</small>'
            : "") +
        "</button></li>"
      );
    })
    .join("");
  return (
    '<div class="reading">' +
    passage +
    '<div class="stem">' +
    stem +
    "</div>" +
    readingFigures(entry) +
    (picks
      ? '<ol class="choices" aria-label="Answer choices">' + picks + "</ol>"
      : "") +
    "</div>"
  );
}
function activeFilters(p, view) {
  const filtered = [
    "year",
    "subject",
    "theme",
    "subtheme",
    "q",
    "map",
    "evidence",
    "returning",
    "format",
  ].filter((k) => p[k]);
  if (!filtered.length) return "";
  const label = {
    map: "Map questions",
    returning: "Returning subthemes",
    format: p.format,
    evidence: sourceNames[p.evidence] || "With study references",
  };
  return (
    '<div class="chips">' +
    filtered
      .map((k) => {
        const next = { ...p, page: "" };
        delete next[k];
        if (k === "subject") {
          delete next.theme;
          delete next.subtheme;
        }
        if (k === "theme") delete next.subtheme;
        return anchor(
          view,
          next,
          esc(label[k] || p[k]) + ' <span aria-hidden="true">×</span>',
          "filter-chip",
        );
      })
      .join("") +
    anchor(view, p.paper ? { paper: p.paper } : {}, "Clear all", "clear") +
    "</div>"
  );
}
function mapBounds(points, world, focus, minSpan = 20) {
  if (world) return { left: -180, top: 90, span: 360 };
  const active = points[focus] ? [points[focus]] : points;
  const xs = active.map((p) => (p.lon + 360) % 360).sort((a, b) => a - b),
    ys = active.map((p) => p.lat);
  let gap = -1,
    start = xs[0];
  xs.forEach((v, i) => {
    const next = i === xs.length - 1 ? xs[0] + 360 : xs[i + 1];
    if (next - v > gap) {
      gap = next - v;
      start = next % 360;
    }
  });
  const lonSpan = 360 - gap,
    latMin = Math.min(...ys),
    latMax = Math.max(...ys);
  const span = Math.min(
    360,
    Math.max(minSpan, lonSpan * 1.55, (latMax - latMin) * 3.25),
  );
  const left = ((start + lonSpan / 2 - span / 2 + 540) % 360) - 180;
  const top = Math.max(
    -90 + span / 2,
    Math.min(90, (latMin + latMax) / 2 + span / 4),
  );
  return { left, top, span };
}
function sources() {
  const gsLinked = atlas.gs.filter((q) => references(q).length).length,
    csLinked = atlas.csat.filter((q) => references(q).length).length;
  const coverage = years
    .map((y) => {
      const g = atlas.gs.filter((r) => r.year === y),
        c = atlas.csat.filter((r) => r.year === y),
        source = g.find((r) => r.paperUrl);
      return (
        "<tr><td>" +
        anchor("index", { year: y }, String(y)) +
        "</td><td>" +
        g.length +
        "</td><td>" +
        (y >= 2011 ? anchor("csat", { year: y }, String(c.length)) : "—") +
        "</td><td>" +
        external(source?.officialUrl || source?.paperUrl, "Paper") +
        "</td></tr>"
      );
    })
    .join("");
  return (
    head(
      "Editorial method",
      "Sources &amp; <em>coverage</em>",
      "Use the paper to check exactly what UPSC asked. Use the source trail to see which material can be connected to the question.",
    ) +
    '<div class="analysis-grid"><div><section class="panel"><h3>Reading a source trail</h3><dl class="glossary"><dt>Exam evidence</dt><dd>The printed booklet, series and question number. A scan is available for checking the printed layout.</dd><dt>Named in the question</dt><dd>The question explicitly refers to a document, programme, institution or publication.</dd><dt>Wording match</dt><dd>A distinctive passage or statement can be matched to the cited text. The note identifies the material or edition checked.</dd><dt>Supporting source</dt><dd>A primary document or textbook explains the topic. Later editions can help with revision.</dd><dt>Question-setter’s original source</dt><dd>Marked unconfirmed unless evidence identifies the material the examiner actually used.</dd></dl>' +
    '<div class="source-actions">' +
    anchor(
      "index",
      { evidence: "linked" },
      format(gsLinked) + " GS entries with references",
      "compact",
    ) +
    (csLinked
      ? anchor(
          "csat",
          { evidence: "linked" },
          format(csLinked) + " CSAT entries with references",
          "compact",
        )
      : "") +
    "</div></section>" +
    '<section class="panel block"><h3>How the analysis is counted</h3><p>One printed question counts once, under its main subject, theme and subtheme. Location tags can span subjects. The map room contains worked examples from every exam year.</p><p class="block">Yearly shares use all printed questions in the corresponding paper as the denominator. Questions that were withdrawn still count when describing what appeared in the booklet.</p><p>The 2008–2010 General Studies paper contained 150 questions, including mental ability. From 2011, the index tracks 100 General Studies questions and 80 CSAT questions per year.</p></section>' +
    '<details class="panel block data-detail"><summary>Data and cartography credits</summary><p class="block">Question locators were checked against exam booklets. Study descriptions and categories are editorial. Booklets were also located through ' +
    external(
      "https://educationprovince.com/upsc-prelims-previous-year-question-papers/",
      "Education Province",
    ) +
    ". Earlier topic indexes were cross-checked with " +
    external(
      "https://github.com/mahavishnu47/upsc-prelims-microthemes",
      "UPSC Prelims Microthemes",
    ) +
    ". CSAT classification was checked against " +
    external("https://www.writeupsc.app/upsc-csat-pyq", "WriteUPSC") +
    " and " +
    external("https://www.habitatias.com/upsc/csat/", "Habitat IAS") +
    ". Sources specific to individual questions are linked in their entries.</p><p>Maps use relief, coastlines, rivers and geographic boundaries from " +
    external("https://www.naturalearthdata.com/", "Natural Earth") +
    ".</p></details></div>" +
    '<section class="panel"><h3>Paper coverage</h3><div class="table-scroll"><table><thead><tr><th>Year</th><th>GS</th><th>CSAT</th><th>Booklet</th></tr></thead><tbody>' +
    coverage +
    "</tbody></table></div></section></div>"
  );
}
let previousView, previousItem, previousScope;
function render() {
  const { view, p } = state();
  const views = {
    home: atlasHome,
    topic: topicDossier,
    question: directQuestion,
    notes: sourceNotePage,
    index: () => practicePage(p, "index"),
    csat: () => practicePage(p, "csat"),
    trends: paperAnalysis,
    maps: mapRoom,
    sources,
  };
  const chosen = Object.hasOwn(views, view) ? view : "home";
  if (["csat", "index"].includes(chosen))
    Object.assign(
      p,
      migratedPath(p, chosen === "csat" ? atlas.csat : atlas.gs),
    );
  const reopen =
    chosen === "maps" &&
    previousView === chosen &&
    (p.id || "") === previousItem &&
    document.querySelector(".original-pyq")?.open;
  main.innerHTML = views[chosen](p);
  if (reopen && document.querySelector(".original-pyq"))
    document.querySelector(".original-pyq").open = true;
  const navTitles = {
    notes: "Paper & references",
    question: "Practise",
    home: "Study atlas",
    topic: p.subtheme || "Subtheme",
    index: "General Studies practice",
    csat: "CSAT",
    trends: "Paper analysis",
    maps: "Map room",
    sources: "Sources & coverage",
  };
  document.title = navTitles[chosen] + " · Prelims Atlas";
  document.querySelectorAll("nav a").forEach((a) => {
    if (
      a.getAttribute("href") ===
      "#" +
        (chosen === "question"
          ? p.id?.startsWith("csat-")
            ? "csat"
            : "index"
          : chosen === "topic"
            ? "home"
            : chosen)
    )
      a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  if (previousView && previousView !== chosen) {
    window.scrollTo({ top: 0, behavior: "instant" });
    main.focus({ preventScroll: true });
  }
  const item = p.at || p.id || "";
  if (
    previousView === chosen &&
    previousItem !== undefined &&
    previousItem !== item &&
    ["csat", "index", "question"].includes(chosen)
  ) {
    const question = document.getElementById("current-question");
    if (question) {
      question.scrollIntoView({ block: "start", behavior: "instant" });
      question.focus({ preventScroll: true });
    }
  }
  const scope = JSON.stringify([
    p.paper,
    p.year,
    p.subject,
    p.theme,
    p.subtheme,
    p.find,
  ]);
  const sameScreen = previousView === chosen;
  if (sameScreen && chosen === "maps" && previousItem !== item) {
    const heading = document.getElementById("map-exercise");
    heading?.scrollIntoView({ block: "start", behavior: "instant" });
    heading?.focus({ preventScroll: true });
  } else if (sameScreen && chosen === "home" && previousScope !== scope) {
    const catalog = document.getElementById("catalog");
    if (catalog?.getBoundingClientRect().top < 0)
      catalog.scrollIntoView({ block: "start", behavior: "instant" });
  } else if (sameScreen && chosen === "trends" && previousScope !== scope) {
    const filter = document.getElementById("filters");
    if (filter?.getBoundingClientRect().bottom < 0)
      filter.scrollIntoView({ block: "start", behavior: "instant" });
  }
  previousScope = scope;
  previousView = chosen;
  previousItem = item;
}
function submitFilters(form, changed) {
  const p = Object.fromEntries(new FormData(form));
  if (changed === "year" && form.dataset.view !== "trends") {
    let pool = (
      form.dataset.view === "csat" || p.paper === "csat" ? atlas.csat : atlas.gs
    ).filter((r) => !p.year || r.year == p.year);
    for (const field of ["subject", "theme", "subtheme"]) {
      if (!p[field]) continue;
      const matches = pool.filter((r) => r[field] === p[field]);
      if (matches.length) pool = matches;
      else delete p[field];
    }
    if (!p.year) delete p.returning;
  }
  if (changed === "subject") {
    delete p.theme;
    delete p.subtheme;
  }
  if (changed === "theme") delete p.subtheme;
  const dest = url(form.dataset.view, p);
  if (location.hash !== dest) location.hash = dest;
}
main.addEventListener("submit", (e) => {
  if (e.target.id === "find-topic") {
    e.preventDefault();
    location.hash = url("home", Object.fromEntries(new FormData(e.target)));
  }
  if (e.target.id === "filters") {
    e.preventDefault();
    submitFilters(e.target);
  }
});
main.addEventListener("change", (e) => {
  if (e.target.id === "practice-jump") {
    let { view, p } = state();
    if (view === "question") {
      const row = atlas.gs.concat(atlas.csat).find((r) => r.id === p.id);
      if (!row) return;
      view = row.id.startsWith("csat") ? "csat" : "index";
      p = { year: row.year };
    }
    const pool = view === "csat" ? atlas.csat : atlas.gs;
    p = migratedPath(p, pool);
    const found = filterRows(pool, p),
      i = Math.min(
        found.length - 1,
        Math.max(0, (Number(e.target.value) || 1) - 1),
      );
    if (found[i]) location.hash = url(view, { ...p, at: found[i].id });
    return;
  }
  if (e.target.id === "atlas-subject")
    location.hash = url("home", {
      paper: state().p.paper,
      subject: e.target.value,
    });
  if (e.target.id === "home-year" && e.target.value)
    location.hash = url("trends", {
      paper: state().p.paper,
      year: e.target.value,
    });
  if (["compare-from", "compare-to"].includes(e.target.id)) {
    const from = document.getElementById("compare-from").value;
    const to = document.getElementById("compare-to").value;
    location.hash = url("trends", { ...state().p, compare: "1", from, to });
  }
  if (e.target.id === "rank-order") location.hash = e.target.value;
  if (e.target.id === "map-case") {
    const { p } = state();
    location.hash = url("maps", {
      ...p,
      id: e.target.value,
      pin: "",
      mode: p.mode || (p.id ? "study" : "recall"),
    });
  }
  if (e.target.matches("#map-filters select")) {
    const filters = Object.fromEntries(new FormData(e.target.form));
    const bySkill = recallCases({ skill: filters.skill });
    if (
      filters.region &&
      !bySkill.some((r) => r.recall.region === filters.region)
    )
      delete filters.region;
    if (filters.year && !recallCases(filters).length) delete filters.year;
    location.hash = url("maps", filters);
  }
  if (e.target.matches("#filters select"))
    submitFilters(e.target.form, e.target.name);
});
main.addEventListener("click", handleStudyClick);
main.addEventListener("click", handleRecall);
document.querySelector(".skip")?.addEventListener("click", (e) => {
  e.preventDefault();
  main.focus();
});
window.addEventListener("hashchange", render);
render();
