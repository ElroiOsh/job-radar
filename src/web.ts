import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Job, Profile, RunResult } from "./types.js";
import { projectRoot } from "./profile.js";
import { ACCEPT_REASONS, REJECT_REASONS, reasonLabel } from "./reasons.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function jobPayload(job: Job): string {
  return JSON.stringify({
    id: job.id,
    source: job.source,
    title: job.title,
    company: job.company,
    location: job.location,
    description: job.description,
    requirements: job.requirements,
    salary: job.salary,
    url: job.url,
    postedAt: job.postedAt,
  }).replace(/</g, "\\u003c");
}

function reasonChips(
  kind: "reject" | "accept",
  selected: string[] = []
): string {
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

function jobArticle(job: Job): string {
  const isBoard = job.id.startsWith("board-");
  const fb = job.userFeedback;
  const why = job.userFeedbackReasons ?? [];
  const whyText = why.map(reasonLabel).join(", ");
  return `
  <article class="job" data-id="${esc(job.id)}" data-score="${job.matchScore}" data-new="${job.isNew}" data-source="${esc(job.source)}" data-feedback="${fb ?? ""}">
    <script type="application/json" class="job-json">${jobPayload(job)}</script>
    <header class="job-head">
      <div class="job-meta">
        ${job.isNew && !isBoard ? `<span class="tag-new">New today</span>` : ""}
        <span class="src">${esc(job.source)}</span>
        <span class="score" title="${esc(job.matchReasons.join(" · "))}">${job.matchScore}% match</span>
      </div>
      <h3><a href="${esc(job.url)}" target="_blank" rel="noopener noreferrer">${esc(job.title)}</a></h3>
      <p class="company">${esc(job.company)} · ${esc(job.location)}${job.salary ? ` · <strong>${esc(job.salary)}</strong>` : ""}</p>
    </header>
    <div class="job-body">
      <section>
        <h4>Role overview</h4>
        <p>${esc(job.description)}</p>
      </section>
      <section>
        <h4>Requirements</h4>
        <p>${esc(job.requirements)}</p>
      </section>
      <p class="why"><span>Why it matched:</span> ${esc(job.matchReasons.join(" · "))}</p>
    </div>
    <div class="job-actions">
      <a class="job-cta" href="${esc(job.url)}" target="_blank" rel="noopener noreferrer">${
        isBoard
          ? "Open board search →"
          : job.source === "Demo"
            ? "Demo link (not a real apply page) →"
            : `Apply on ${esc(job.source.split("/")[0] ?? "job board")} →`
      }</a>
      ${
        isBoard
          ? ""
          : `<div class="learn" role="group" aria-label="Relevance feedback">
        <button type="button" class="fb fb-yes" data-verdict="relevant" aria-pressed="${fb === "relevant"}">Relevant</button>
        <button type="button" class="fb fb-no" data-verdict="not_relevant" aria-pressed="${fb === "not_relevant"}">Not relevant</button>
        <span class="fb-status"${fb ? "" : " hidden"}>${
          fb === "relevant"
            ? `Saved: relevant${whyText ? ` — ${esc(whyText)}` : ""}`
            : fb === "not_relevant"
              ? `Saved: not relevant${whyText ? ` — ${esc(whyText)}` : ""}`
              : ""
        }</span>
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

export function renderDashboard(
  result: RunResult,
  profile: Profile,
  learned: { relevant: number; notRelevant: number } = { relevant: 0, notRelevant: 0 }
): string {
  const listings = result.jobs.filter((j) => !j.id.startsWith("board-"));
  const boards = result.jobs.filter((j) => j.id.startsWith("board-"));
  const dateLabel = new Date(result.generatedAt).toLocaleString("en-IL", {
    dateStyle: "full",
    timeStyle: "short",
  });
  // Optional remote API for GitHub Pages (e.g. http://localhost:8787 or a hosted server)
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
      min-height: 100vh;
      min-height: 100dvh;
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
        url("https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1800&q=80") center/cover no-repeat;
      transform: scale(1.04);
      animation: heroDrift 18s ease-in-out infinite alternate;
    }
    @keyframes heroDrift {
      from { transform: scale(1.04) translate3d(0,0,0); }
      to { transform: scale(1.08) translate3d(1.5%, -1%, 0); }
    }
    .brand {
      font-family: Sora, sans-serif;
      font-weight: 800;
      font-size: clamp(3.4rem, 12vw, 7.5rem);
      line-height: 0.9;
      letter-spacing: -0.04em;
      margin: 0;
      animation: rise 0.9s ease both;
    }
    .brand span { color: #8fe0c5; }
    .hero h2 {
      font-family: Sora, sans-serif;
      font-weight: 600;
      font-size: clamp(1.35rem, 3.2vw, 2.1rem);
      max-width: 18ch;
      margin: 1rem 0 0.6rem;
      animation: rise 1s ease 0.08s both;
    }
    .hero p.lead {
      max-width: 40ch;
      margin: 0;
      color: #d7e3dd;
      font-size: 1.05rem;
      line-height: 1.55;
      animation: rise 1s ease 0.16s both;
    }
    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-top: 1.5rem;
      animation: rise 1s ease 0.24s both;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.85rem 1.2rem;
      border: 1px solid transparent;
      text-decoration: none;
      font-weight: 700;
      font-size: 0.95rem;
      transition: transform 0.2s ease, background 0.2s ease;
    }
    .btn:hover { transform: translateY(-2px); }
    .btn-primary { background: #8fe0c5; color: var(--ink); }
    .btn-ghost { background: transparent; border-color: rgba(244,247,245,0.45); color: #f4f7f5; }
    @keyframes rise {
      from { opacity: 0; transform: translateY(18px); }
      to { opacity: 1; transform: translateY(0); }
    }
    main { padding: clamp(1.5rem, 4vw, 3rem); max-width: 1100px; margin: 0 auto; }
    .section-head {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 1rem;
      align-items: end;
      margin: 2.5rem 0 1.25rem;
      border-bottom: 1px solid var(--line);
      padding-bottom: 0.85rem;
    }
    .section-head h2 {
      font-family: Sora, sans-serif;
      font-size: clamp(1.6rem, 3vw, 2.2rem);
      margin: 0;
      letter-spacing: -0.03em;
    }
    .section-head p { margin: 0.35rem 0 0; color: var(--muted); max-width: 48ch; }
    .stats {
      display: flex;
      gap: 1.25rem;
      color: var(--muted);
      font-size: 0.92rem;
    }
    .stats strong { color: var(--ink); font-size: 1.35rem; display: block; font-family: Sora, sans-serif; }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1.25rem;
    }
    .filters button {
      border: 1px solid var(--line);
      background: var(--panel);
      color: var(--ink);
      padding: 0.55rem 0.85rem;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    .filters button[aria-pressed="true"] {
      background: var(--steel);
      border-color: var(--steel);
      color: #f4f7f5;
    }
    .jobs { display: grid; gap: 1rem; }
    .job {
      background: var(--panel);
      border: 1px solid var(--line);
      border-left: 4px solid var(--signal);
      padding: 1.15rem 1.2rem 1.2rem;
      animation: rise 0.6s ease both;
    }
    .job[data-new="true"] { border-left-color: var(--warn); }
    .job-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.55rem;
      align-items: center;
      margin-bottom: 0.45rem;
      font-size: 0.82rem;
      color: var(--muted);
    }
    .tag-new {
      background: rgba(196,92,38,0.12);
      color: var(--warn);
      font-weight: 700;
      padding: 0.15rem 0.45rem;
    }
    .score {
      margin-left: auto;
      font-weight: 700;
      color: var(--signal-deep);
    }
    .job h3 { margin: 0; font-family: Sora, sans-serif; font-size: 1.25rem; letter-spacing: -0.02em; }
    .job h3 a { color: inherit; text-decoration: none; }
    .job h3 a:hover { color: var(--signal-deep); }
    .company { margin: 0.35rem 0 0; color: var(--muted); }
    .job-body { display: grid; gap: 0.85rem; margin-top: 1rem; }
    @media (min-width: 800px) {
      .job-body { grid-template-columns: 1.1fr 0.9fr; }
      .why { grid-column: 1 / -1; }
    }
    .job-body h4 {
      margin: 0 0 0.35rem;
      font-size: 0.75rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .job-body p { margin: 0; line-height: 1.55; }
    .why { color: var(--muted); font-size: 0.92rem; }
    .why span { color: var(--ink); font-weight: 600; }
    .job-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.85rem;
      margin-top: 1rem;
    }
    .job-cta {
      display: inline-block;
      font-weight: 700;
      text-decoration: none;
      color: var(--signal-deep);
    }
    .learn { display: flex; flex-wrap: wrap; align-items: center; gap: 0.45rem; }
    .fb {
      border: 1px solid var(--line);
      background: #fff;
      color: var(--ink);
      font: inherit;
      font-weight: 700;
      padding: 0.45rem 0.75rem;
      cursor: pointer;
    }
    .fb:hover { border-color: var(--steel); }
    .fb-yes[aria-pressed="true"] {
      background: rgba(15,138,106,0.12);
      border-color: var(--signal);
      color: var(--signal-deep);
    }
    .fb-no[aria-pressed="true"] {
      background: rgba(196,92,38,0.12);
      border-color: var(--warn);
      color: var(--warn);
    }
    .fb-status { font-size: 0.82rem; color: var(--muted); }
    .fb-status[hidden] { display: none !important; }
    .reason-panel {
      margin-top: 0.85rem;
      padding: 0.85rem 0.95rem;
      border: 1px dashed var(--line);
      background: rgba(255,255,255,0.7);
    }
    .reason-title { margin: 0 0 0.55rem; font-weight: 700; font-size: 0.92rem; }
    .reason-list { display: flex; flex-wrap: wrap; gap: 0.45rem; }
    .reason-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      border: 1px solid var(--line);
      padding: 0.4rem 0.65rem;
      background: #fff;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .reason-chip:has(input:checked) {
      border-color: var(--steel);
      background: rgba(28,58,74,0.08);
      font-weight: 600;
    }
    .reason-chip input { accent-color: var(--steel); }
    .reason-actions { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
    .reason-save, .reason-cancel {
      border: 1px solid var(--line);
      background: var(--steel);
      color: #f4f7f5;
      font: inherit;
      font-weight: 700;
      padding: 0.5rem 0.85rem;
      cursor: pointer;
    }
    .reason-cancel { background: #fff; color: var(--ink); }
    .serve-hint {
      margin: 0 0 1rem;
      padding: 0.75rem 0.9rem;
      border: 1px solid var(--line);
      background: rgba(28,58,74,0.06);
      color: var(--steel);
      font-size: 0.92rem;
    }
    .serve-hint code { font-weight: 700; }
    .boards {
      display: grid;
      gap: 0.75rem;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    }
    .board-link {
      display: block;
      padding: 1rem;
      border: 1px dashed var(--line);
      background: rgba(255,255,255,0.55);
      text-decoration: none;
      color: inherit;
      transition: border-color 0.2s ease, transform 0.2s ease;
    }
    .board-link:hover {
      border-color: var(--signal);
      transform: translateY(-2px);
    }
    .board-link strong { display: block; font-family: Sora, sans-serif; margin-bottom: 0.35rem; }
    .board-link span { color: var(--muted); font-size: 0.9rem; line-height: 1.45; }
    footer {
      max-width: 1100px;
      margin: 0 auto;
      padding: 2rem clamp(1.5rem, 4vw, 3rem) 3rem;
      color: var(--muted);
      font-size: 0.88rem;
    }
    .empty {
      padding: 1.5rem;
      border: 1px dashed var(--line);
      color: var(--muted);
    }
  </style>
</head>
<body>
  <header class="hero">
    <div class="hero-media" aria-hidden="true"></div>
    <p class="brand">RADAR<span>.</span></p>
    <h2>Roles matched to your track</h2>
    <p class="lead">Smart Manufacturing, manufacturing systems, and engineering leadership — Center &amp; Shfela. Updated ${esc(dateLabel)}.</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="#matches">View ranked roles</a>
      <a class="btn btn-ghost" href="#boards">Open board searches</a>
    </div>
  </header>

  <main>
    <div class="section-head" id="matches">
      <div>
        <h2>Today's matches</h2>
        <p>Filtered for Smart Manufacturing / automation &amp; data / engineering management — not classic design-only or NPI-only seats.</p>
      </div>
      <div class="stats">
        <div><strong>${result.newCount}</strong>new</div>
        <div><strong>${listings.length}</strong>shortlist</div>
        <div><strong>${learned.relevant}/${learned.notRelevant}</strong>feedback ✓/✗</div>
      </div>
    </div>

    <p class="serve-hint" id="serve-hint">Mark Relevant / Not relevant, then pick why. Feedback saves after you choose reasons.</p>

    <div class="filters" role="group" aria-label="Filter roles">
      <button type="button" data-filter="all" aria-pressed="true">All</button>
      <button type="button" data-filter="new" aria-pressed="false">New only</button>
      <button type="button" data-filter="high" aria-pressed="false">70%+ match</button>
    </div>

    <div class="jobs" id="job-list">
      ${listings.length ? listings.map(jobArticle).join("\n") : `<div class="empty">No ranked roles yet. Run <code>npm run demo</code> to practice feedback, or connect a job source.</div>`}
    </div>

    <div class="section-head" id="boards">
      <div>
        <h2>Job boards</h2>
        <p>Simple saved searches (one keyword each) for LinkedIn, Indeed, AllJobs, and Drushim. Open in a new tab, then sort by Most recent.</p>
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
    RADAR for ${esc(profile.candidate.name)} · ${esc(profile.candidate.email)} ·
    Focus: ${esc(profile.target_roles.slice(0, 2).join(" · "))}
  </footer>

  <script>
    const buttons = document.querySelectorAll(".filters button");
    const jobs = [...document.querySelectorAll(".job")];
    const hint = document.getElementById("serve-hint");
    const apiBase = (document.querySelector('meta[name="radar-api-base"]')?.getAttribute("content") || "").replace(/\\/$/, "");
    const feedbackUrl = (apiBase || "") + "/api/feedback";
    const LS_KEY = "radar-feedback-v1";

    function cleanError(raw) {
      if (!raw) return "Could not save feedback";
      const text = String(raw).replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim();
      if (/405/.test(text) || /Not Allowed/i.test(text)) {
        return "This page has no feedback server — saved on this device instead.";
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

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
        const mode = btn.getAttribute("data-filter");
        jobs.forEach((job) => {
          const score = Number(job.getAttribute("data-score"));
          const isNew = job.getAttribute("data-new") === "true";
          let show = true;
          if (mode === "new") show = isNew;
          if (mode === "high") show = score >= 70;
          job.style.display = show ? "" : "none";
        });
      });
    });

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
        return { ...(await res.json()), via: "server" };
      } catch (err) {
        // GitHub Pages cannot POST — keep learning data on this device
        saveLocalFeedback(payload);
        return { ok: true, via: "local", warning: cleanError(err && err.message) };
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
      showStatus(article, "Pick why, then Save feedback");
    }

    document.querySelectorAll(".job .fb").forEach((btn) => {
      btn.addEventListener("click", () => {
        const article = btn.closest(".job");
        const verdict = btn.getAttribute("data-verdict");
        openReasonPanel(article, verdict);
        article.querySelectorAll(".fb").forEach((b) => {
          b.setAttribute("aria-pressed", String(b.getAttribute("data-verdict") === verdict));
        });
      });
    });

    document.querySelectorAll(".job .reason-cancel").forEach((btn) => {
      btn.addEventListener("click", () => {
        const article = btn.closest(".job");
        article.querySelector(".reason-panel").hidden = true;
        const status = article.querySelector(".fb-status");
        if (status && !article.getAttribute("data-feedback")) {
          status.hidden = true;
          status.textContent = "";
        }
      });
    });

    document.querySelectorAll(".job .reason-save").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const article = btn.closest(".job");
        const panel = article.querySelector(".reason-panel");
        const verdict = panel.dataset.kind;
        const reasons = selectedReasons(panel, verdict);
        if (verdict === "not_relevant" && reasons.length === 0) {
          showStatus(article, "Pick at least one reason (role, location, …)");
          return;
        }
        try {
          const result = await postFeedback(article, verdict, reasons);
          article.setAttribute("data-feedback", verdict);
          panel.hidden = true;
          const labels = reasons.join(", ");
          const base = verdict === "relevant"
            ? ("Saved: relevant" + (labels ? " — " + labels : ""))
            : ("Saved: not relevant — " + labels);
          showStatus(article, result.via === "local" ? (base + " (this device)") : base);
          if (hint) {
            hint.textContent = result.via === "local"
              ? "Saved on this device. For the daily agent to learn it, use http://localhost:8787 on your PC (or connect a feedback API)."
              : "Feedback + reasons saved. Next daily scan will use these reasons.";
          }
        } catch (err) {
          showStatus(article, cleanError(err && err.message));
          console.error(err);
        }
      });
    });

    // Restore locally saved feedback marks when API is unavailable (GitHub Pages)
    const local = loadLocalFeedback();
    if (local.length) {
      local.forEach((e) => {
        const article = document.querySelector('.job[data-id="' + CSS.escape(e.jobId) + '"]');
        if (!article) return;
        article.setAttribute("data-feedback", e.verdict);
        article.querySelectorAll(".fb").forEach((b) => {
          b.setAttribute("aria-pressed", String(b.getAttribute("data-verdict") === e.verdict));
        });
        const labels = (e.reasons || []).join(", ");
        showStatus(
          article,
          (e.verdict === "relevant" ? "Saved: relevant" : "Saved: not relevant") +
            (labels ? " — " + labels : "") +
            " (this device)"
        );
      });
    }
  </script>
</body>
</html>`;
}

export function writeDashboard(
  result: RunResult,
  profile: Profile,
  learned: { relevant: number; notRelevant: number } = { relevant: 0, notRelevant: 0 }
): string {
  const webDir = join(projectRoot(), "web");
  mkdirSync(webDir, { recursive: true });
  const path = join(webDir, "index.html");
  writeFileSync(path, renderDashboard(result, profile, learned), "utf8");
  return path;
}
