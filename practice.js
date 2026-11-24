"use strict";
const attemptKey = "prelims-atlas-practice-v1";
function readStored(name, fallback) {
  try {
    return JSON.parse(localStorage.getItem(name)) ?? fallback;
  } catch {
    return fallback;
  }
}
const attempts = readStored(attemptKey, {});
function saveStored(name, value) {
  try {
    localStorage.setItem(name, JSON.stringify(value));
  } catch {}
}
function answerLetters(entry) {
  const raw = entry?.acceptedAnswers || entry?.answer;
  const values = Array.isArray(raw)
    ? raw
    : String(raw || "")
        .toUpperCase()
        .split(/[^A-D]+/);
  return values
    .map((v) => String(v).trim().toUpperCase())
    .filter((v) => /^[A-D]$/.test(v));
}
function questionControls(row) {
  const entry = window.PRELIMS_READING?.[row.id] || {};
  const state = attempts[row.id] || {};
  const keys = answerLetters(entry);
  const dropped =
    entry.dropped ||
    /dropped|excluded|withdrawn/i.test(
      [row.scoringStatus, entry.answerStatus].join(" "),
    );
  if (/keys differ/i.test(entry.answerStatus || ""))
    return '<p class="choice-notice">Published study keys disagree. This question is unscored here.</p>';
  if (dropped)
    return (
      '<p class="answer-feedback">' +
      (/provisional/i.test(entry.answerStatus || "")
        ? "The provisional key omits this question."
        : "This question was excluded from scoring.") +
      "</p>"
    );
  if (!keys.length) {
    return state.choice
      ? '<p class="choice-notice" role="status">Your choice is ' +
          esc(state.choice) +
          ". The verified answer is unavailable.</p>"
      : "";
  }
  if (!state.reveal) {
    return (
      '<button type="button" class="btn-light check" data-check="' +
      esc(row.id) +
      '">' +
      (state.choice ? "Check answer" : "Show answer") +
      "</button>"
    );
  }
  const correct = keys.includes(state.choice);
  const letter = keys.join(" or ");
  const lead = state.choice
    ? correct
      ? "Correct."
      : "Your choice was " + state.choice + "."
    : "";
  const label = /provisional/i.test(entry.answerStatus || "")
    ? "Provisional UPSC key"
    : /study/i.test(entry.answerStatus || "")
      ? "Study key"
      : "";
  const source = label ? ' <span class="key-label">' + label + "</span>" : "";
  return (
    '<div class="answer-feedback" role="status">' +
    (lead ? esc(lead) + " " : "") +
    "Answer: <strong>" +
    esc(letter) +
    "</strong>." +
    source +
    ' <button class="text-btn" type="button" data-retry="' +
    esc(row.id) +
    '">Try again</button></div>'
  );
}
function practiceHeading(cs, p) {
  const title =
    p.subtheme ||
    p.theme ||
    p.subject ||
    (cs ? "CSAT practice" : "General Studies practice");
  const crumb = cs ? "CSAT · Paper II" : "Prelims · General Studies";
  return (
    '<div class="viewhead practice-head"><span class="kicker">' +
    crumb +
    "</span><h1>" +
    esc(title) +
    "</h1></div>"
  );
}
function practiceForm(rows, p, view) {
  const cs = view === "csat";
  const filteredByYear = rows.filter((r) => !p.year || r.year == p.year);
  const subjectRows = filteredByYear.filter(
    (r) => !p.subject || r.subject === p.subject,
  );
  const themeRows = subjectRows.filter((r) => !p.theme || r.theme === p.theme);

  const keepHidden = ["map", "evidence", "format", "returning"]
    .filter((k) => p[k])
    .map(
      (k) => '<input type="hidden" name="' + k + '" value="' + esc(p[k]) + '">',
    )
    .join("");
  return (
    '<form id="filters" data-view="' +
    view +
    '" class="practice-form"><div class="basic-filters">' +
    select("year", "Year", range(cs ? 2011 : 2008, 2026), p.year, "All years") +
    select(
      "subject",
      cs ? "Skill" : "Subject",
      sorted(filteredByYear, "subject"),
      p.subject,
      cs ? "All skills" : "All subjects",
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
    '</div><details class="fine-filters" ' +
    (p.q ? "open" : "") +
    '><summary>Search question text</summary><div class="filter-inner"><label>Keyword<input type="search" name="q" placeholder="e.g. monsoon" value="' +
    esc(p.q) +
    '"></label><button class="compact" type="submit">Search</button></div></details>' +
    keepHidden +
    "</form>"
  );
}
function footerNav(rows, i, view, p) {
  const jump = (n, text, style) =>
    anchor(view, { ...p, at: rows[n].id, page: "" }, text, style);
  return (
    '<div class="practice-nav">' +
    (i > 0 ? jump(i - 1, "Previous", "compact") : "<span></span>") +
    '<label class="position">Question <input type="number" id="practice-jump" aria-label="Go to question in this selection" value="' +
    (i + 1) +
    '" min="1" max="' +
    rows.length +
    '"> of ' +
    format(rows.length) +
    "</label>" +
    (i < rows.length - 1
      ? jump(i + 1, "Next question", "btn")
      : '<span class="caption">Last question</span>') +
    "</div>"
  );
}
function studyCard(row, notesBack, allowMap = true) {
  const mapsLink =
    allowMap && row.places?.length
      ? anchor(
          "maps",
          { id: row.id },
          icon("map-trifold") + " View map",
          "quiet-link",
        )
      : "";
  const notes = anchor(
    "notes",
    { id: row.id, back: notesBack },
    "Paper &amp; references",
    "quiet-link",
  );
  return (
    '<article class="study-card" id="current-question" tabindex="-1"><div class="question-top"><strong>' +
    row.year +
    " · " +
    (row.id.startsWith("csat") ? "CSAT" : "General Studies") +
    "</strong><span>" +
    esc(locator(row)) +
    "</span></div>" +
    reading(row) +
    questionControls(row) +
    '<div class="study-foot"><span>' +
    esc(row.subject) +
    (attempts[row.id]?.reveal
      ? " · " +
        anchor(
          "topic",
          {
            paper: row.id.startsWith("csat") ? "csat" : "gs",
            ...topicPath(row),
          },
          esc(row.subtheme),
        )
      : "") +
    "</span><div>" +
    mapsLink +
    " " +
    notes +
    "</div></div></article>"
  );
}
function practicePage(p, view) {
  const cs = view === "csat",
    rows = cs ? atlas.csat : atlas.gs,
    found = filterRows(rows, p);
  const idx = found.findIndex((r) => r.id === p.at),
    i = idx < 0 ? 0 : idx;
  const active = found[i];
  const sideTags = ["map", "evidence", "format", "returning"].filter(
    (k) => p[k],
  );
  const top =
    practiceHeading(cs, p) +
    '<div class="practice-atlas-links">' +
    anchor(
      "home",
      { paper: cs ? "csat" : "gs", subject: p.subject, theme: p.theme },
      "Browse subthemes",
      "quiet-link",
    ) +
    (p.subtheme && active
      ? anchor(
          "topic",
          { paper: cs ? "csat" : "gs", ...topicPath(active) },
          "Subtheme analysis",
          "quiet-link",
        )
      : anchor(
          "trends",
          {
            paper: cs ? "csat" : "gs",
            year: p.year,
            subject: p.subject,
            theme: p.theme,
          },
          "See paper analysis",
          "quiet-link",
        )) +
    "</div>" +
    practiceForm(rows, p, view) +
    (sideTags.length ? activeFilters(p, view) : "");
  if (!active)
    return (
      top +
      '<p class="empty">No questions match these filters. ' +
      anchor(view, {}, "Show all questions") +
      "</p>"
    );
  const current = url(view, { ...p, at: active.id });
  saveStored("prelims-atlas-last", {
    url: current,
    title: active.year + " · " + active.subject + " · Q" + active.number,
  });
  return (
    '<div class="practice-wrap">' +
    top +
    studyCard(active, current) +
    footerNav(found, i, view, p) +
    "</div>"
  );
}
function directQuestion(p) {
  const row =
    atlas.gs.find((q) => q.id === p.id) ||
    atlas.csat.find((q) => q.id === p.id);
  if (!row)
    return (
      head(
        "Question index",
        "Question unavailable",
        "Choose a paper to start practising.",
      ) + anchor("index", {}, "General Studies", "btn")
    );
  const page = row.id.startsWith("csat-") ? "csat" : "index";
  return practicePage({ year: String(row.year), at: row.id }, page);
}
function sourceNotePage(p) {
  const row =
    atlas.gs.find((q) => q.id === p.id) ||
    atlas.csat.find((q) => q.id === p.id);
  if (!row) return sources();
  const back = /^#(?:index|csat|maps|question)(?:\?|$)/.test(p.back || "")
    ? p.back
    : url("question", { id: row.id });
  return (
    '<div class="reader-wrap"><div class="actions"><a class="compact" href="' +
    esc(back) +
    '">Back to question</a></div>' +
    head(
      row.year + " · " + esc(locator(row)),
      "Paper &amp; references",
      esc(row.title),
    ) +
    '<div class="panel question-paper">' +
    detail(row, false) +
    "</div></div>"
  );
}
function startRevision(id) {
  const current = attempts[id];
  if (!current) return;
  if (current.choice && current.reveal && !current.checkedChoice)
    current.checkedChoice = current.choice;
  delete current.choice;
  current.reveal = false;
  saveStored(attemptKey, attempts);
}
function handleStudyClick(e) {
  const retryLink = e.target.closest("a[data-review-item]");
  if (retryLink?.dataset.reviewItem) {
    startRevision(retryLink.dataset.reviewItem);
    return;
  }
  const button = e.target.closest("[data-choice],[data-check],[data-retry]");
  if (!button) return;
  const id =
    button.dataset.question || button.dataset.check || button.dataset.retry;
  const current = attempts[id] || {};
  if (button.dataset.choice) {
    current.choice = button.dataset.choice;
    current.reveal = false;
  } else if (button.dataset.check) {
    current.reveal = true;
    if (current.choice && answerLetters(window.PRELIMS_READING[id]).length)
      current.checkedChoice = current.choice;
  } else {
    delete current.choice;
    current.reveal = false;
  }
  attempts[id] = current;
  saveStored(attemptKey, attempts);
  render();
  const target = button.dataset.choice
    ? '[data-question="' +
      id +
      '"][data-choice="' +
      button.dataset.choice +
      '"]'
    : button.dataset.check
      ? '[data-retry="' + id + '"]'
      : '[data-question="' + id + '"]';
  document.querySelector(target)?.focus({ preventScroll: true });
}
