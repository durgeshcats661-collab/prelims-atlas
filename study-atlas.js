"use strict";

function paperInfo(p) {
  const cs = p.paper === "csat";
  return {
    paper: cs ? "csat" : "gs",
    practice: cs ? "csat" : "index",
    name: cs ? "CSAT" : "General Studies",
    rows: cs ? atlas.csat : atlas.gs,
    first: cs ? 2011 : 2008,
  };
}

function topicPath(row) {
  return { subject: row.subject, theme: row.theme, subtheme: row.subtheme };
}

function topicKey(row) {
  return JSON.stringify([row.subject, row.theme, row.subtheme]);
}

function groupTopics(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = topicKey(row);
    if (!groups.has(key))
      groups.set(key, { ...topicPath(row), rows: [], years: new Map() });
    const group = groups.get(key);
    group.rows.push(row);
    group.years.set(row.year, (group.years.get(row.year) || 0) + 1);
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.years.size - a.years.size ||
      b.rows.length - a.rows.length ||
      a.subtheme.localeCompare(b.subtheme),
  );
}

function examYears(n) {
  return n + (n === 1 ? " exam year" : " exam years");
}

function questionCaption(r) {
  const body = window.PRELIMS_READING[r.id];
  if (!r.id.startsWith("csat-") && r.title && r.title !== r.subtheme)
    return r.title;
  const clip = (value, limit) => {
    const text = (value || "").replace(/\s+/g, " ").trim();
    return text.length > limit
      ? text.slice(0, limit - 1).replace(/\s+\S*$/, "") + "…"
      : text;
  };
  if (body.passage) {
    const lines = body.stem.trim().split(/\n+/);
    const task = clip(lines[0], 86);
    const evidence = lines.find((line) => /^\s*(?:1[.)]|I[.)])\s+/.test(line));
    return (
      task +
      " · " +
      clip(
        evidence ? evidence.replace(/^\s*(?:1|I)[.)]\s+/, "") : body.passage,
        72,
      )
    );
  }
  return clip(body.stem, 135);
}

function paperTabs(view, p) {
  const active = paperInfo(p).paper;
  return tabs(
    [
      ["General Studies", url(view, {}), "gs"],
      ["CSAT", url(view, { paper: "csat" }), "csat"],
    ],
    active,
  );
}

function paperSubjectList(rows) {
  const priority = [
    "Geography",
    "History",
    "Polity & Governance",
    "Economy",
    "Environment",
    "Science & Technology",
    "Art & Culture",
    "Reading comprehension",
    "Quantitative aptitude",
    "Logical reasoning",
  ];
  return sorted(rows, "subject").sort(
    (a, b) =>
      (priority.includes(a) ? priority.indexOf(a) : 99) -
      (priority.includes(b) ? priority.indexOf(b) : 99),
  );
}

function scopeHref(info, row, year, at) {
  return url(info.practice, { ...topicPath(row), year, at });
}

function subthemeLine(info, group) {
  return anchor(
    "topic",
    { paper: info.paper, ...topicPath(group) },
    "<span>" +
      esc(group.subtheme) +
      "</span><small>" +
      qCount(group.rows.length) +
      "</small>" +
      icon("caret-right"),
    "subline",
  );
}

function topicFinder(p, info) {
  const terms = (p.find || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!terms.length) return "";
  const hits = groupTopics(info.rows).filter((g) =>
    terms.every((t) =>
      [g.subject, g.theme, g.subtheme].join(" ").toLowerCase().includes(t),
    ),
  );
  const result = (g) =>
    '<div class="find-hit"><small>' +
    esc(g.subject) +
    " · " +
    esc(g.theme) +
    "</small>" +
    subthemeLine(info, g) +
    "</div>";
  const matches = filterRows(info.rows, { q: p.find });
  const matchedGroups = groupTopics(matches);
  const example = (g) =>
    '<div class="find-hit"><small>' +
    esc(g.subject) +
    " · " +
    esc(g.theme) +
    '</small><div class="find-answers">' +
    topicLink(info, g) +
    anchor(
      info.practice,
      { ...topicPath(g), q: p.find },
      "Practise " + qCount(g.rows.length),
      "quiet-link",
    ) +
    "</div></div>";
  const display = (values, item, limit) =>
    values.slice(0, limit).map(item).join("") +
    (values.length > limit
      ? "<details><summary>Show " +
        (values.length - limit) +
        " more</summary>" +
        values.slice(limit).map(item).join("") +
        "</details>"
      : "");
  return (
    '<section class="finder-result"><div class="heading-row"><h2>Search results</h2>' +
    anchor("home", { paper: info.paper }, "Clear search", "quiet-link") +
    "</div>" +
    (hits.length ? "<h3>Subtheme names</h3>" + display(hits, result, 6) : "") +
    (matches.length
      ? "<h3>Matching questions for “" +
        esc(p.find) +
        "”</h3><p>" +
        qCount(matches.length) +
        " in " +
        matchedGroups.length +
        " subtheme" +
        (matchedGroups.length === 1 ? "" : "s") +
        ".</p>" +
        display(matchedGroups, example, 8)
      : "") +
    (!hits.length && !matches.length
      ? "<p>No questions or subthemes match “" +
        esc(p.find) +
        "”. Try a broader word or another spelling.</p>"
      : "") +
    "</section>"
  );
}

function checkedChoice(row) {
  const current = attempts[row.id];
  return current?.checkedChoice || (current?.reveal ? current.choice : "");
}

function missedQuestions(rows) {
  return rows.filter((r) => {
    const choice = checkedChoice(r);
    if (!choice) return false;
    const keys = answerLetters(window.PRELIMS_READING[r.id]);
    return keys.length && !keys.includes(choice);
  });
}

function revisionQueue(info) {
  const missed = missedQuestions(info.rows);
  if (!missed.length) return "";
  const groups = groupTopics(missed);
  return (
    '<details class="revision-queue"><summary>Revisit ' +
    qCount(missed.length) +
    " you missed in " +
    info.name +
    "</summary>" +
    groups
      .map(
        (g) =>
          "<div><strong>" +
          esc(g.subtheme) +
          "</strong><span>" +
          g.rows
            .map(
              (r) =>
                '<a data-review-item="' +
                esc(r.id) +
                '" href="' +
                esc(scopeHref(info, r, null, r.id)) +
                '">' +
                r.year +
                " · Q" +
                r.number +
                "</a>",
            )
            .join(" ") +
          "</span></div>",
      )
      .join("") +
    "</details>"
  );
}

function atlasHome(p) {
  const info = paperInfo(p),
    subjects = paperSubjectList(info.rows);
  const subject = subjects.includes(p.subject) ? p.subject : subjects[0];
  const subset = info.rows.filter((q) => q.subject === subject);
  const groups = groupTopics(subset),
    themes = countBy(subset, "theme");
  const preferred = themes.find(([name]) => name === "Rivers & inland waters");
  if (preferred) {
    themes.splice(themes.indexOf(preferred), 1);
    themes.unshift(preferred);
  }
  const last = readStored("prelims-atlas-last", null);
  const resume =
    last && /^#(?:index|csat)\?/.test(last.url)
      ? '<a class="resume-link" href="' +
        esc(last.url) +
        '">' +
        icon("book-open") +
        "Continue where you left off <span>· " +
        esc(last.title) +
        "</span></a>"
      : "";
  const intro =
    '<section class="desk-head"><div><span class="kicker">Anjali’s study atlas · 2008–2026</span><h1>Prelims <em>Atlas</em></h1><p>Find a subtheme, see how UPSC has tested it, and practise the questions.</p>' +
    resume +
    '</div><a class="desk-map" href="#maps"><img src="assets/subcontinent.webp" alt=""><span>' +
    icon("map-trifold") +
    " Open map room " +
    icon("arrow-right") +
    "</span></a></section>";
  const top =
    '<section class="catalog" id="catalog"><div class="heading-row"><h2>Browse subthemes</h2>' +
    paperTabs("home", p) +
    '</div><div class="catalog-tools"><form id="find-topic" class="finder"><input type="hidden" name="paper" value="' +
    info.paper +
    '"><label>' +
    icon("magnifying-glass") +
    '<input aria-label="Find a subtheme across ' +
    info.name +
    '" type="search" name="find" placeholder="Find a subtheme in ' +
    info.name +
    '…" value="' +
    esc(p.find) +
    '"></label><button class="compact">Search</button></form>' +
    '<label class="home-year">Analyse a paper by year<select id="home-year"><option value="">Choose an exam year</option>' +
    range(info.first, 2026)
      .map((y) => "<option>" + y + "</option>")
      .join("") +
    "</select></label>" +
    "</div>";
  if (p.find?.trim()) return intro + top + topicFinder(p, info) + "</section>";
  const sidebar =
    '<aside class="subject-rail"><strong>' +
    (info.paper === "csat" ? "Skills" : "Subjects") +
    "</strong>" +
    subjects
      .map(
        (s) =>
          '<a href="' +
          esc(url("home", { paper: info.paper, subject: s })) +
          '" ' +
          (s === subject ? 'aria-current="true"' : "") +
          ">" +
          icon(subjectStyle[s]?.[0] || "books") +
          "<span>" +
          esc(s) +
          "</span></a>",
      )
      .join("") +
    "</aside>";
  const mobile =
    '<label class="mobile-subject">Choose a ' +
    (info.paper === "csat" ? "skill" : "subject") +
    '<select id="atlas-subject">' +
    subjects
      .map(
        (s) =>
          "<option " +
          (s === subject ? "selected" : "") +
          ">" +
          esc(s) +
          "</option>",
      )
      .join("") +
    "</select></label>";
  const selectedTheme = themes.some((t) => t[0] === p.theme)
    ? p.theme
    : themes[0]?.[0];
  const tree = themes
    .map(([theme, n]) => {
      const children = groups.filter((g) => g.theme === theme);
      return (
        '<details class="theme-branch" ' +
        (p.expand === "all" || theme === selectedTheme ? "open" : "") +
        "><summary><span><strong>" +
        esc(theme) +
        "</strong><small>" +
        children.length +
        " subtheme" +
        (children.length === 1 ? "" : "s") +
        " · " +
        qCount(n) +
        '</small><span class="theme-preview">' +
        esc(
          children
            .slice(0, 2)
            .map((g) => g.subtheme)
            .join(" · "),
        ) +
        (children.length > 2 ? " …" : "") +
        "</span></span>" +
        icon("caret-down") +
        '</summary><div class="branch-children">' +
        children.map((g) => subthemeLine(info, g)).join("") +
        "</div></details>"
      );
    })
    .join("");
  const sectionTitle =
    '<div class="subject-title"><div><h3>' +
    esc(subject) +
    "</h3><p>" +
    themes.length +
    " themes · " +
    groups.length +
    " subthemes · " +
    qCount(subset.length) +
    "</p></div>" +
    anchor(
      "trends",
      { paper: info.paper, subject },
      "Compare years " + icon("arrow-right"),
      "quiet-link",
    ) +
    "</div>";
  return (
    intro +
    top +
    mobile +
    '<div class="catalog-layout">' +
    sidebar +
    '<section class="topic-tree">' +
    sectionTitle +
    '<div class="tree-tools">' +
    anchor(
      "home",
      {
        paper: info.paper,
        subject,
        theme: p.theme,
        expand: p.expand === "all" ? "" : "all",
      },
      p.expand === "all" ? "Collapse themes" : "Expand all themes",
      "quiet-link",
    ) +
    "</div>" +
    tree +
    "</section></div>" +
    revisionQueue(info) +
    "</section>"
  );
}

function paperWindow(info, rows, first, last) {
  const inside = (r) => r.year >= first && r.year <= last;
  const n = rows.filter(inside).length,
    total = info.rows.filter(inside).length;
  return { n, total, share: total ? (100 * n) / total : 0 };
}

function yearChips(info, r, grouped) {
  return (
    '<div class="year-chips">' +
    [...grouped.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(
        ([y, n]) =>
          '<a href="' +
          esc(scopeHref(info, r, y)) +
          '" aria-label="' +
          y +
          ", " +
          qCount(n) +
          '">' +
          y +
          " <b>" +
          n +
          "</b></a>",
      )
      .join("") +
    "</div>"
  );
}

function examples(info, rows, label) {
  const item = (r) =>
    '<a class="example" href="' +
    esc(scopeHref(info, r, r.year, r.id)) +
    '"><small>' +
    r.year +
    "<span>" +
    esc(locator(r)) +
    "</span></small><span>" +
    esc(questionCaption(r)) +
    "</span>" +
    icon("caret-right") +
    "</a>";
  return (
    '<section class="dossier-section"><h2>' +
    esc(label) +
    "</h2>" +
    rows.slice(0, 6).map(item).join("") +
    (rows.length > 6
      ? '<details class="more-examples"><summary>Show ' +
        (rows.length - 6) +
        " more questions</summary>" +
        rows.slice(6).map(item).join("") +
        "</details>"
      : "") +
    "</section>"
  );
}

function topicDossier(p) {
  const info = paperInfo(p),
    rows = filterRows(info.rows, {
      subject: p.subject,
      theme: p.theme,
      subtheme: p.subtheme,
    });
  const group = groupTopics(rows)[0];
  if (!group || !p.subtheme || !p.theme || !p.subject)
    return (
      head(
        info.name,
        "Find a subtheme",
        "Choose a subject and theme to open a revision page.",
      ) +
      anchor(
        "home",
        { paper: info.paper, subject: p.subject },
        "Browse subthemes",
        "btn",
      )
    );
  const route = { paper: info.paper, ...topicPath(group) };
  const brief = atlas.briefs?.[topicKey(group)],
    sample = brief
      ? brief.examples.map((id) => rows.find((r) => r.id === id))
      : [];
  const byYear = [...group.years.keys()].sort((a, b) => a - b),
    first = byYear[0],
    last = byYear.at(-1);
  const before = paperWindow(info, rows, 2017, 2021),
    after = paperWindow(info, rows, 2022, 2026);
  const crumb =
    '<div class="crumb">' +
    anchor("home", { paper: info.paper }, info.name) +
    " / " +
    anchor("home", { paper: info.paper, subject: p.subject }, esc(p.subject)) +
    " / " +
    anchor(
      "home",
      { paper: info.paper, subject: p.subject, theme: p.theme },
      esc(p.theme),
    ) +
    "</div>";
  const opening =
    '<div class="dossier-title"><span class="kicker">Subtheme analysis</span><h1>' +
    esc(p.subtheme) +
    "</h1><p>" +
    qCount(rows.length) +
    " across " +
    examYears(group.years.size) +
    " · " +
    (first === last ? first : first + "–" + last) +
    '</p><div class="actions">' +
    anchor(
      info.practice,
      topicPath(group),
      icon("book-open") + " Practise " + qCount(rows.length),
      "btn",
    ) +
    anchor("trends", route, "See year-by-year analysis", "btn-light") +
    "</div></div>";
  const earliest = rows.find((r) => r.year === first),
    latest = rows.find((r) => r.year === last);
  const linkExample = (r) =>
    '<a href="' +
    esc(scopeHref(info, r, r.year, r.id)) +
    '">' +
    esc(r.year + " · " + questionCaption(r)) +
    "</a>";
  const bridge =
    rows.length === 1
      ? "<p>The " +
        first +
        " paper contains the only question on this subtheme in the archive.</p>"
      : first === last
        ? "<p>All " +
          qCount(rows.length) +
          " on this subtheme appear in the " +
          first +
          " paper.</p>"
        : '<p>Compare the earliest and latest appearances in this archive.</p><div class="paired-examples">' +
          linkExample(earliest) +
          linkExample(latest) +
          "</div>";
  const pattern =
    (brief?.pattern
      ? "<p>" +
        esc(brief.pattern) +
        '</p><div class="paired-examples">' +
        sample.map(linkExample).join("") +
        "</div>"
      : bridge) +
    (brief
      ? "<h3>Revision drill</h3><p>" +
        esc(brief.revise) +
        "</p>" +
        (!brief.pattern && sample.length
          ? '<div class="evidence-links">' +
            sample
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
          : "")
      : "");
  const checked = rows.filter(
    (r) =>
      attempts[r.id]?.checkedChoice ||
      (attempts[r.id]?.reveal &&
        attempts[r.id]?.choice &&
        answerLetters(window.PRELIMS_READING[r.id]).length),
  );
  const missed = missedQuestions(checked);
  const progress = checked.length
    ? '<p class="local-progress">Your practice · ' +
      (checked.length - missed.length) +
      " correct of " +
      checked.length +
      " checked" +
      (missed.length
        ? ' · <a data-review-item="' +
          esc(missed[0].id) +
          '" href="' +
          esc(scopeHref(info, missed[0], null, missed[0].id)) +
          '">Retry a missed question</a>'
        : "") +
      "</p>"
    : "";
  const term =
    '<section class="pattern-card"><span class="kicker">Across the papers</span><h2>' +
    (brief?.pattern ? "What UPSC tests" : "How the question appears") +
    "</h2>" +
    pattern +
    "</section>";
  const comparison =
    '<aside class="time-card"><h3>Two five-year windows</h3><p>Share of all ' +
    info.name +
    " questions in each window.</p>" +
    [
      [before, "2017–2021"],
      [after, "2022–2026"],
    ]
      .map(
        ([w, label]) =>
          "<div><span>" +
          label +
          "</span><strong>" +
          w.share.toFixed(1) +
          "%</strong><small>" +
          w.n +
          " of " +
          w.total +
          " questions</small></div>",
      )
      .join("") +
    "</aside>";
  const forms = info.paper === "gs" ? countBy(rows, "questionFormat") : [];
  const structure = forms.length
    ? '<details class="more-examples"><summary>Question formats in this subtheme</summary><div class="evidence-links">' +
      forms
        .map(([name, n]) =>
          anchor(
            info.practice,
            { ...topicPath(group), format: name },
            esc(name) + " · " + n,
          ),
        )
        .join("") +
      "</div></details>"
    : "";
  return (
    '<div class="study-route">' +
    crumb +
    opening +
    progress +
    '<div class="insight-layout">' +
    term +
    comparison +
    '</div><section class="dossier-section"><h2>Years tested</h2>' +
    yearChips(info, group, group.years) +
    structure +
    "</section>" +
    examples(info, rows, "Previous-year questions") +
    "</div>"
  );
}
