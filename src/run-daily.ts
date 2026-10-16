import "dotenv/config";
import { loadProfile } from "./profile.js";
import { fetchAdzuna } from "./fetchers/adzuna.js";
import { fetchJooble } from "./fetchers/jooble.js";
import { fetchLiveFileJobs } from "./fetchers/live-file.js";
import { fetchDemoJobs } from "./fetchers/demo.js";
import { boardSearchCards } from "./fetchers/manual-boards.js";
import { enrichAndFilter } from "./match.js";
import { feedbackSummary, loadFeedback } from "./feedback.js";
import { loadPreviousListings, loadSeenIds, markSeen, saveRun, saveSeenIds } from "./store.js";
import { writeDashboard } from "./web.js";
import { sendEmail } from "./email.js";
import type { Job, RunResult } from "./types.js";
import { looksLikeApplyUrl } from "./fetchers/jooble.js";

type Raw = Omit<Job, "matchScore" | "matchReasons" | "isNew" | "userFeedback">;

function mergeRaw(...lists: Raw[][]): Raw[] {
  const map = new Map<string, Raw>();
  for (const list of lists) {
    for (const job of list) {
      if (!map.has(job.id)) map.set(job.id, job);
    }
  }
  return [...map.values()];
}

function isApplyReady(job: Raw): boolean {
  if (job.id.startsWith("demo-") || job.id.startsWith("board-")) return false;
  return looksLikeApplyUrl(job.url);
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const demo = args.has("--demo");
  const skipFetch = args.has("--skip-fetch");
  const skipEmail = args.has("--skip-email");

  const profile = loadProfile();
  const seen = loadSeenIds();
  const feedback = loadFeedback();
  const learned = feedbackSummary(feedback);

  let raw: Raw[] = [];
  if (!skipFetch) {
    const [adzuna, jooble, live] = await Promise.all([
      fetchAdzuna(profile),
      fetchJooble(profile),
      Promise.resolve(fetchLiveFileJobs()),
    ]);
    raw = mergeRaw(adzuna, jooble, live);
  }

  if (demo) {
    console.log("Demo mode: sample jobs (may not open a real apply page).");
    raw = mergeRaw(raw, fetchDemoJobs());
  }

  // Keep prior real apply-ready jobs for feedback continuity
  const previous = loadPreviousListings().filter(isApplyReady);
  raw = mergeRaw(raw, previous).filter((j) => demo || isApplyReady(j));

  if (!demo && raw.length === 0) {
    console.log("No apply-ready jobs yet. Run: node scripts/build-live-jobs.mjs");
  }

  const boards = boardSearchCards();
  const scoredListings = enrichAndFilter(raw, profile, seen, feedback);

  const scoredBoards = boards.map((b) => ({
    ...b,
    matchScore: 60,
    matchReasons: ["Saved board search for daily manual scan"],
    isNew: false,
  }));

  const jobs = [...scoredListings, ...scoredBoards];
  const newCount = scoredListings.filter((j) => j.isNew).length;

  const result: RunResult = {
    generatedAt: new Date().toISOString(),
    jobs,
    newCount,
    totalCount: scoredListings.length,
  };

  saveRun(result);
  saveSeenIds(markSeen(scoredListings, seen));

  const webPath = writeDashboard(result, profile, learned);
  console.log(`Dashboard → ${webPath}`);
  console.log(`Apply-ready shortlist: ${scoredListings.length} (${newCount} new)`);
  console.log(`Feedback: ${learned.relevant} relevant · ${learned.notRelevant} not relevant`);
  console.log("Open http://localhost:8787 — click Apply to open the real job page");

  if (!skipEmail) {
    if (!demo || process.env.SMTP_PASS) {
      await sendEmail(result, profile);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
