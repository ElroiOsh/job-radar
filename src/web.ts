import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { FeedbackEntry, Job, Profile, RunResult } from "./types.js";
import { projectRoot } from "./profile.js";
import { ACCEPT_REASONS, REJECT_REASONS, reasonLabel } from "./reasons.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jobPayload(job: {
  id: string;
  source: string;
  title: string;
  company: string;
  location: string;
  description?: string;
  requirements?: string;
  salary?: string;
  url: string;
  postedAt?: string;
}): string {
  return JSON.stringify({
    id: job.id,
    source: job.source,
    title: job.title,
    company: job.company,
    location: job.location,
    description: job.description ?? "",
    requirements: job.requirements ?? "",
    salary: job.salary,
    url: job.url,
    postedAt: job.postedAt,
  }).replace(/</g, "\\u003c");
}

function reasonChips(kind: "reject" | "accept", selected: string[] = []): string {
  const list = kind === "reject" ? REJECT_REASONS : ACCEPT_REASONS;
  return list
    .map(
      (r) =>
        `<label class="reason-chip"><input type="checkbox" value="${r.id}" ${
          selected.includes(r.id) ? "checked" : ""
        }/> ${esc(r.label)}</label>`
    )
    .join("");
}

function jobArticle(job: Job, mode: "new" | "rated"): string {
  const isBoard = job.id.startsWith("board-");
  const fb = job.userFeedback;
  const why = job.userFeedbackReasons ?? [];
  const whyText = why.map(reasonLabel).join(", ");
  const rated = mode === "rated" || Boolean(fb);

  return `
  <article class="job" data-id="${esc(job.id)}" data-score="${job.matchScore}" data-source="${esc(job.source)}" data-feedback="${fb ?? ""}" data-list="${rated ? "rated" : "new"}">
    <script type="application/json" class="job-json">${jobPayload(job)}</script>
    <header class="job-head">
      <div class="job-meta">
        <span class="src">${esc(job.source)}</span>
        ${
          rated
            ? `<span class="tag-rated ${fb === "relevant" ? "yes" : "no"}">${
                fb === "relevant" ? "Relevant" : "Not relevant"
              }${whyText ? ` · ${esc(whyText)}` : ""}</span>`
            : ""
        }
      </div>
      <h3><a href="${esc(job.url)}" target="_blank" rel="noopener noreferrer">${esc(job.title)}</a></h3>
      <p class="company">${esc(job.company)} · ${esc(job.location)}${job.salary ? ` · <strong>${esc(job.salary)}</strong>` : ""}</p>
    </header>
    <div class="job-actions">
      <a class="job-cta" href="${esc(job.url)}" target="_blank" rel="noopener noreferrer">${
        isBoard
          ? "Open board search →"
          : `Apply on ${esc(job.source.split("/")[0] ?? "LinkedIn")} →`
      }</a>
      ${
        isBoard
          ? ""
          : `<div class="learn" role="group" aria-label="Relevance feedback">
        <button type="button" class="fb fb-yes" data-verdict="relevant" aria-pressed="${fb === "relevant"}">Relevant</button>
        <button type="button" class="fb fb-no" data-verdict="not_relevant" aria-pressed="${fb === "not_relevant"}">Not relevant</button>
        <span class="fb-status" hidden></span>
      </div>`
      }
    </div>
    ${
      isBoard
        ? ""
        : `<div class="reason-panel" hidden data-kind="">
      <p class="reason-title">Why? (pick one or more)</p>
      <div class="reason-list reject-reasons">${reasonChips("reject", fb === "not_relevant" ? why : [])}</div>
      <div class="reason-list accept-reasons" hidden>${reasonChips("accept", fb === "relevant" ? why : [])}</div>
      <div class="reason-actions">
        <button type="button" class="reason-save">Save feedback</button>
        <button type="button" class="reason-cancel">Cancel</button>
      </div>
    </div>`
    }
  </article>`;
}

function ratedFromFeedback(entries: FeedbackEntry[]): Job[] {
  return entries.map((e) => ({
    id: e.jobId,
    source: e.source || "LinkedIn",
    title: e.title,
    company: e.company,
    location: e.location,
    description: "",
    requirements: "",
    url: e.url,
    matchScore: e.verdict === "relevant" ? 90 : 20,
    matchReasons: [],
    isNew: false,
    userFeedback: e.verdict,
    userFeedbackReasons: e.reasons,
  }));
}

export function renderDashboard(
  result: RunResult,
  profile: Profile,
  learned: { relevant: number; notRelevant: number } = { relevant: 0, notRelevant: 0 },
  feedbackEntries: FeedbackEntry[] = []
): string {
  const listings = result.jobs.filter((j) => !j.id.startsWith("board-"));
  const boards = result.jobs.filter((j) => j.id.startsWith("board-"));
  const ratedIds = new Set(feedbackEntries.map((e) => e.jobId));

  const newJobs = listings.filter((j) => !j.userFeedback && !ratedIds.has(j.id));
  const ratedJobsMap = new Map<string, Job>();
  for (const j of ratedFromFeedback(feedbackEntries)) ratedJobsMap.set(j.id, j);
  for (const j of listings.filter((x) => x.userFeedback || ratedIds.has(x.id))) {
    ratedJobsMap.set(j.id, {
      ...j,
      userFeedback: j.userFeedback ?? feedbackEntries.find((e) => e.jobId === j.id)?.verdict,
      userFeedbackReasons:
        j.userFeedbackReasons ?? feedbackEntries.find((e) => e.jobId === j.id)?.reasons,
    });
  }
  const ratedJobs = [...ratedJobsMap.values()];

  const dateLabel = new Date(result.generatedAt).toLocaleString("en-IL", {
    dateStyle: "full",
    timeStyle: "short",
  });
  const apiBase = (process.env.WEB_FEEDBACK_API_URL || "").replace(/\/$/, "");

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="radar-api-base" content="${esc(apiBase)}" />
  <title>RADAR · ${esc(profile.candidate.name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Sora:wght@500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    :root {
      --ink: #0e1614;
      --muted: #4d5c57;
      --paper: #eef2ef;
      --panel: #f7faf8;
      --line: #c5d0ca;
      --signal: #0f8a6a;
      --signal-deep: #0a5c48;
      --warn: #c45c26;
      --steel: #1c3a4a;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      font-family: "IBM Plex Sans", system-ui, sans-serif;
      color: var(--ink);
      background:
        linear-gradient(180deg, rgba(238,242,239,0.92), rgba(238,242,239,0.97)),
        repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(28,58,74,0.05) 24px),
        repeating-linear-gradient(90deg, transparent, transparent 23px, rgba(28,58,74,0.04) 24px),
        var(--paper);
    }
    a { color: var(--signal-deep); }
    .hero {
      position: relative;
      min-height: 72vh;
      min-height: 72dvh;
      display: grid;
      align-content: end;
      padding: clamp(1.25rem, 3vw, 2.5rem);
      color: #f4f7f5;
      overflow: hidden;
      isolation: isolate;
    }
    .hero-media {
      position: absolute;
      inset: 0;
      z-index: -2;
      background:
        linear-gradient(180deg, rgba(14,22,20,0.25) 0%, rgba(14,22,20,0.72) 55%, rgba(14,22,20,0.92) 100%),
        url("assets/hero-smart-factory.jpg") center/cover no-repeat;
    }
    .brand {
      font-family: Sora, sans-serif;
      font-weight: 800;
      font-size: clamp(3rem, 10vw, 6rem);
      line-height: 0.9;
      letter-spacing: -0.04em;
      margin: 0;
    }
    .brand span { color: #8fe0c5; }
    .hero h2 {
      font-family: Sora, sans-serif;
      font-weight: 600;
      font-size: clamp(1.25rem, 3vw, 1.9rem);
      max-width: 18ch;
      margin: 1rem 0 0.6rem;
    }
    .hero p.lead {
      max-width: 40ch;
      margin: 0;
      color: #d7e3dd;
      font-size: 1.05rem;
      line-height: 1.55;
    }
    .hero-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.5rem; }
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 0.85rem 1.2rem; border: 1px solid transparent;
      text-decoration: none; font-weight: 700; font-size: 0.95rem;
    }
    .btn-primary { background: #8fe0c5; color: var(--ink); }
    .btn-ghost { background: transparent; border-color: rgba(244,247,245,0.45); color: #f4f7f5; }
    main { padding: clamp(1.5rem, 4vw, 3rem); max-width: 1100px; margin: 0 auto; }
    .section-head {
      display: flex; flex-wrap: wrap; justify-content: space-between; gap: 1rem;
      align-items: end; margin: 1.5rem 0 1rem;
      border-bottom: 1px solid var(--line); padding-bottom: 0.85rem;
    }
    .section-head h2 {
      font-family: Sora, sans-serif;
      font-size: clamp(1.5rem, 3vw, 2rem);
      margin: 0; letter-spacing: -0.03em;
    }
    .section-head p { margin: 0.35rem 0 0; color: var(--muted); max-width: 48ch; }
    .stats { display: flex; gap: 1.25rem; color: var(--muted); font-size: 0.92rem; }
    .stats strong { color: var(--ink); font-size: 1.35rem; display: block; font-family: Sora, sans-serif; }
    .tabs {
      display: flex; gap: 0.5rem; margin: 0 0 1.25rem; flex-wrap: wrap;
    }
    .tab {
      border: 1px solid var(--line);
      background: var(--panel);
      color: var(--ink);
      padding: 0.65rem 1rem;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    .tab[aria-selected="true"] {
      background: var(--steel);
      border-color: var(--steel);
      color: #f4f7f5;
    }
    .tab-panel[hidden] { display: none !important; }
    .jobs { display: grid; gap: 0.85rem; }
    .job {
      background: var(--panel);
      border: 1px solid var(--line);
      border-left: 4px solid var(--signal);
      padding: 1rem 1.15rem;
      transition: opacity 0.28s ease, transform 0.28s ease, max-height 0.28s ease, margin 0.28s ease, padding 0.28s ease;
    }
    .job.leaving {
      opacity: 0;
      transform: translateX(-28px);
      max-height: 0;
      margin: 0;
      padding-top: 0;
      padding-bottom: 0;
      border-width: 0;
      overflow: hidden;
      pointer-events: none;
    }
    .job[data-feedback="not_relevant"] { border-left-color: var(--warn); }
    .job[data-feedback="relevant"] { border-left-color: var(--signal); }
    .job-meta {
      display: flex; flex-wrap: wrap; gap: 0.55rem; align-items: center;
      margin-bottom: 0.4rem; font-size: 0.82rem; color: var(--muted);
    }
    .tag-rated {
      font-weight: 700; padding: 0.15rem 0.45rem;
      background: rgba(28,58,74,0.08);
    }
    .tag-rated.yes { color: var(--signal-deep); background: rgba(15,138,106,0.12); }
    .tag-rated.no { color: var(--warn); background: rgba(196,92,38,0.12); }
    .job h3 { margin: 0; font-family: Sora, sans-serif; font-size: 1.2rem; letter-spacing: -0.02em; }
    .job h3 a { color: inherit; text-decoration: none; }
    .job h3 a:hover { color: var(--signal-deep); }
    .company { margin: 0.35rem 0 0; color: var(--muted); }
    .job-actions {
      display: flex; flex-wrap: wrap; align-items: center;
      justify-content: space-between; gap: 0.85rem; margin-top: 0.9rem;
    }
    .job-cta { font-weight: 700; text-decoration: none; color: var(--signal-deep); }
    .learn { display: flex; flex-wrap: wrap; align-items: center; gap: 0.45rem; }
    .fb {
      border: 1px solid var(--line); background: #fff; color: var(--ink);
      font: inherit; font-weight: 700; padding: 0.45rem 0.75rem; cursor: pointer;
    }
    .fb-yes[aria-pressed="true"] {
      background: rgba(15,138,106,0.12); border-color: var(--signal); color: var(--signal-deep);
    }
    .fb-no[aria-pressed="true"] {
      background: rgba(196,92,38,0.12); border-color: var(--warn); color: var(--warn);
    }
    .fb-status { font-size: 0.82rem; color: var(--muted); }
    .fb-status[hidden] { display: none !important; }
    .reason-panel {
      margin-top: 0.85rem; padding: 0.85rem 0.95rem;
      border: 1px dashed var(--line); background: rgba(255,255,255,0.7);
    }
    .reason-title { margin: 0 0 0.55rem; font-weight: 700; font-size: 0.92rem; }
    .reason-list { display: flex; flex-wrap: wrap; gap: 0.45rem; }
    .reason-chip {
      display: inline-flex; align-items: center; gap: 0.35rem;
      border: 1px solid var(--line); padding: 0.4rem 0.65rem;
      background: #fff; font-size: 0.85rem; cursor: pointer;
    }
    .reason-chip:has(input:checked) {
      border-color: var(--steel); background: rgba(28,58,74,0.08); font-weight: 600;
    }
    .reason-actions { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
    .reason-save, .reason-cancel {
      border: 1px solid var(--line); background: var(--steel); color: #f4f7f5;
      font: inherit; font-weight: 700; padding: 0.5rem 0.85rem; cursor: pointer;
    }
    .reason-cancel { background: #fff; color: var(--ink); }
    .serve-hint {
      margin: 0 0 1rem; padding: 0.75rem 0.9rem;
      border: 1px solid var(--line); background: rgba(28,58,74,0.06);
      color: var(--steel); font-size: 0.92rem;
    }
    .boards {
      display: grid; gap: 0.75rem;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    }
    .board-link {
      display: block; padding: 1rem; border: 1px dashed var(--line);
      background: rgba(255,255,255,0.55); text-decoration: none; color: inherit;
    }
    .board-link strong { display: block; font-family: Sora, sans-serif; margin-bottom: 0.35rem; }
    .board-link span { color: var(--muted); font-size: 0.9rem; line-height: 1.45; }
    footer {
      max-width: 1100px; margin: 0 auto;
      padding: 2rem clamp(1.5rem, 4vw, 3rem) 3rem;
      color: var(--muted); font-size: 0.88rem;
    }
    .empty {
      padding: 1.5rem; border: 1px dashed var(--line); color: var(--muted);
    }
  </style>
</head>
<body>
  <header class="hero">
    <div class="hero-media" aria-hidden="true"></div>
    <p class="brand">RADAR<span>.</span></p>
    <h2>New roles for your track</h2>
    <p class="lead">Smart Manufacturing, systems, engineering leadership — Center &amp; Shfela. Updated ${esc(dateLabel)}.</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="#inbox">New jobs</a>
      <a class="btn btn-ghost" href="#rated">Rated jobs</a>
    </div>
  </header>

  <main id="inbox">
    <div class="section-head">
      <div>
        <h2>Your inbox</h2>
        <p>Rate a role — it slides out of New and lands in Rated. You stay on New.</p>
      </div>
      <div class="stats">
        <div><strong id="stat-new">${newJobs.length}</strong>new</div>
        <div><strong id="stat-rated">${ratedJobs.length}</strong>rated</div>
        <div><strong>${learned.relevant}/${learned.notRelevant}</strong>✓ / ✗</div>
      </div>
    </div>

    <p class="serve-hint" id="serve-hint">Mark Relevant or Not relevant, pick why, Save — the card slides out; you keep browsing New.</p>

    <div class="tabs" role="tablist" aria-label="Job lists">
      <button type="button" class="tab" role="tab" id="tab-new" aria-selected="true" aria-controls="panel-new">New <span id="count-new">(${newJobs.length})</span></button>
      <button type="button" class="tab" role="tab" id="tab-rated" aria-selected="false" aria-controls="panel-rated">Rated / viewed <span id="count-rated">(${ratedJobs.length})</span></button>
    </div>

    <div class="tab-panel" id="panel-new" role="tabpanel" aria-labelledby="tab-new">
      <div class="jobs" id="job-list-new">
        ${
          newJobs.length
            ? newJobs.map((j) => jobArticle(j, "new")).join("\n")
            : `<div class="empty" id="empty-new">No new unrated jobs. Check Rated / viewed, or wait for the next scan.</div>`
        }
      </div>
    </div>

    <div class="tab-panel" id="panel-rated" role="tabpanel" aria-labelledby="tab-rated" hidden>
      <div class="jobs" id="job-list-rated">
        ${
          ratedJobs.length
            ? ratedJobs.map((j) => jobArticle(j, "rated")).join("\n")
            : `<div class="empty" id="empty-rated">No rated jobs yet. Rate something from New.</div>`
        }
      </div>
    </div>

    <div class="section-head" id="boards">
      <div>
        <h2>Job boards</h2>
        <p>Saved searches if you want to browse manually.</p>
      </div>
    </div>
    <div class="boards">
      ${boards
        .map(
          (b) => `<a class="board-link" href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">
        <strong>${esc(b.title)}</strong>
        <span>${esc(b.description)}</span>
      </a>`
        )
        .join("\n")}
    </div>
  </main>

  <footer>
    RADAR for ${esc(profile.candidate.name)} ·
    <a href="#rated">Rated jobs</a>
  </footer>

  <script>
    const hint = document.getElementById("serve-hint");
    const apiBase = (document.querySelector('meta[name="radar-api-base"]')?.getAttribute("content") || "").replace(/\\/$/, "");
    const feedbackUrl = (apiBase || "") + "/api/feedback";
    const LS_KEY = "radar-feedback-v1";
    const newList = document.getElementById("job-list-new");
    const ratedList = document.getElementById("job-list-rated");
    const panelNew = document.getElementById("panel-new");
    const panelRated = document.getElementById("panel-rated");
    const tabNew = document.getElementById("tab-new");
    const tabRated = document.getElementById("tab-rated");

    function cleanError(raw) {
      if (!raw) return "Could not save feedback";
      const text = String(raw).replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim();
      if (/405/.test(text) || /Not Allowed/i.test(text)) {
        return "Saved on this device.";
      }
      return text.slice(0, 160);
    }

    function loadLocalFeedback() {
      try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
    }

    function saveLocalFeedback(entry) {
      const all = loadLocalFeedback().filter((e) => e.jobId !== entry.jobId);
      all.unshift(entry);
      localStorage.setItem(LS_KEY, JSON.stringify(all));
      return all;
    }

    function showStatus(article, text) {
      const status = article.querySelector(".fb-status");
      if (!status) return;
      status.hidden = false;
      status.textContent = text;
    }

    function ensureEmpty(listEl, id, message) {
      if (listEl.querySelector(".job")) {
        const empty = listEl.querySelector(".empty");
        if (empty) empty.remove();
        return;
      }
      if (!listEl.querySelector(".empty")) {
        const d = document.createElement("div");
        d.className = "empty";
        d.id = id;
        d.textContent = message;
        listEl.appendChild(d);
      }
    }

    function updateCounts() {
      const n = newList.querySelectorAll(".job").length;
      const r = ratedList.querySelectorAll(".job").length;
      const cn = document.getElementById("count-new");
      const cr = document.getElementById("count-rated");
      const sn = document.getElementById("stat-new");
      const sr = document.getElementById("stat-rated");
      if (cn) cn.textContent = "(" + n + ")";
      if (cr) cr.textContent = "(" + r + ")";
      if (sn) sn.textContent = String(n);
      if (sr) sr.textContent = String(r);
      ensureEmpty(newList, "empty-new", "No new unrated jobs. Check Rated / viewed.");
      ensureEmpty(ratedList, "empty-rated", "No rated jobs yet.");
    }

    function setRatedBadge(article, verdict, reasons) {
      const meta = article.querySelector(".job-meta");
      let badge = meta.querySelector(".tag-rated");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "tag-rated";
        meta.appendChild(badge);
      }
      badge.className = "tag-rated " + (verdict === "relevant" ? "yes" : "no");
      const labels = (reasons || []).join(", ");
      badge.textContent = (verdict === "relevant" ? "Relevant" : "Not relevant") + (labels ? " · " + labels : "");
    }

    const REASON_LABELS = ${JSON.stringify(
      Object.fromEntries([...REJECT_REASONS, ...ACCEPT_REASONS].map((r) => [r.id, r.label]))
    )};

    function labelReasons(reasons) {
      return (reasons || []).map((r) => REASON_LABELS[r] || r);
    }

    function moveToRated(article, verdict, reasons, animate) {
      const finish = () => {
        article.classList.remove("leaving");
        article.dataset.feedback = verdict;
        article.dataset.list = "rated";
        setRatedBadge(article, verdict, labelReasons(reasons));
        article.querySelectorAll(".fb").forEach((b) => {
          b.setAttribute("aria-pressed", String(b.getAttribute("data-verdict") === verdict));
        });
        const status = article.querySelector(".fb-status");
        if (status) { status.hidden = true; status.textContent = ""; }
        ratedList.prepend(article);
        updateCounts();
        // Stay on New — only the card leaves; Rated tab updates in the background
      };
      if (animate) {
        article.classList.add("leaving");
        setTimeout(finish, 280);
      } else {
        finish();
      }
    }

    function selectTab(which) {
      const isNew = which === "new";
      tabNew.setAttribute("aria-selected", String(isNew));
      tabRated.setAttribute("aria-selected", String(!isNew));
      panelNew.hidden = !isNew;
      panelRated.hidden = isNew;
      if (!isNew) panelRated.removeAttribute("hidden");
      if (isNew) panelNew.removeAttribute("hidden");
    }

    tabNew.addEventListener("click", () => selectTab("new"));
    tabRated.addEventListener("click", () => selectTab("rated"));

    async function postFeedback(article, verdict, reasons) {
      const raw = article.querySelector(".job-json")?.textContent || "{}";
      const job = JSON.parse(raw);
      const payload = {
        jobId: job.id,
        verdict,
        reasons,
        job,
        title: job.title,
        company: job.company,
        location: job.location,
        source: job.source,
        url: job.url,
        updatedAt: new Date().toISOString(),
      };
      try {
        const res = await fetch(feedbackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          let msg = await res.text();
          try { msg = JSON.parse(msg).error || msg; } catch {}
          throw new Error(cleanError(msg));
        }
        saveLocalFeedback(payload);
        return { via: "server" };
      } catch (err) {
        saveLocalFeedback(payload);
        return { via: "local", warning: cleanError(err && err.message) };
      }
    }

    function selectedReasons(panel, kind) {
      const box = panel.querySelector(kind === "not_relevant" ? ".reject-reasons" : ".accept-reasons");
      return [...box.querySelectorAll("input:checked")].map((i) => i.value);
    }

    function openReasonPanel(article, verdict) {
      const panel = article.querySelector(".reason-panel");
      panel.hidden = false;
      panel.dataset.kind = verdict;
      panel.querySelector(".reject-reasons").hidden = verdict !== "not_relevant";
      panel.querySelector(".accept-reasons").hidden = verdict !== "relevant";
      panel.querySelector(".reason-title").textContent =
        verdict === "not_relevant"
          ? "Why is this not relevant? (pick one or more)"
          : "Why is this relevant? (optional — pick any)";
      showStatus(article, "Pick why, then Save");
    }

    function bindJob(article) {
      article.querySelectorAll(".fb").forEach((btn) => {
        btn.addEventListener("click", () => {
          const verdict = btn.getAttribute("data-verdict");
          openReasonPanel(article, verdict);
          article.querySelectorAll(".fb").forEach((b) => {
            b.setAttribute("aria-pressed", String(b.getAttribute("data-verdict") === verdict));
          });
        });
      });
      const cancel = article.querySelector(".reason-cancel");
      if (cancel) {
        cancel.addEventListener("click", () => {
          article.querySelector(".reason-panel").hidden = true;
          const status = article.querySelector(".fb-status");
          if (status && article.dataset.list !== "rated") {
            status.hidden = true;
            status.textContent = "";
          }
        });
      }
      const save = article.querySelector(".reason-save");
      if (save) {
        save.addEventListener("click", async () => {
          const panel = article.querySelector(".reason-panel");
          const verdict = panel.dataset.kind;
          const reasons = selectedReasons(panel, verdict);
          if (verdict === "not_relevant" && reasons.length === 0) {
            showStatus(article, "Pick at least one reason");
            return;
          }
          await postFeedback(article, verdict, reasons);
          panel.hidden = true;
          moveToRated(article, verdict, reasons, true);
          if (hint) hint.textContent = "Saved — card left New. Still browsing unrated jobs.";
        });
      }
    }

    document.querySelectorAll(".job").forEach(bindJob);

    // Move locally rated jobs out of New on load (stay on New)
    loadLocalFeedback().forEach((e) => {
      const article = document.querySelector('.job[data-id="' + CSS.escape(e.jobId) + '"]');
      if (!article) return;
      if (article.dataset.list === "rated") {
        setRatedBadge(article, e.verdict, labelReasons(e.reasons || []));
        return;
      }
      moveToRated(article, e.verdict, e.reasons || [], false);
    });

    selectTab("new");
    updateCounts();
  </script>
</body>
</html>`;
}

export function writeDashboard(
  result: RunResult,
  profile: Profile,
  learned: { relevant: number; notRelevant: number } = { relevant: 0, notRelevant: 0 },
  feedbackEntries: FeedbackEntry[] = []
): string {
  const webDir = join(projectRoot(), "web");
  mkdirSync(webDir, { recursive: true });
  const path = join(webDir, "index.html");
  writeFileSync(path, renderDashboard(result, profile, learned, feedbackEntries), "utf8");
  return path;
}
