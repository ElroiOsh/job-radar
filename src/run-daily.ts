import "dotenv/config";
import { loadProfile } from "./profile.js";
import { fetchAdzuna } from "./fetchers/adzuna.js";
import { fetchAllJobs } from "./fetchers/alljobs.js";
import { fetchJooble } from "./fetchers/jooble.js";
import { fetchJobMaster } from "./fetchers/jobmaster.js";
import { fetchLinkedInGuest } from "./fetchers/linkedin-guest.js";
import { fetchLiveFileJobs } from "./fetchers/live-file.js";
import { fetchDemoJobs } from "./fetchers/demo.js";
import { boardSearchCards } from "./fetchers/manual-boards.js";
import { enrichAndFilter } from "./match.js";
import { loadCvProfile } from "./cv.js";
import { feedbackSummary, loadFeedback } from "./feedback.js";
import { loadSeenIds, markSeen, saveRun, saveSeenIds } from "./store.js";
import { writeDashboard } from "./web.js";
import { sendEmail } from "./email.js";
import type { Job, RunResult } from "./types.js";
import { looksLikeApplyUrl } from "./fetchers/jooble.js";

type Raw = Omit<Job, "matchScore" | "matchReasons" | "isNew" | "userFeedback" | "userFeedbackReasons">;

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

async function fetchOrEmpty(
  name: string,
  fn: () => Promise<Raw[]>,
  ms = 50_000
): Promise<Raw[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      fn(),
      new Promise<Raw[]>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${name} timed out after ${ms / 1000}s`)), ms);
      }),
    ]);
    return result;
  } catch (err) {
    console.warn(`${name} failed:`, err instanceof Error ? err.message : err);
    return [];
  } finally {
    if (timer) clearTimeout(timer);
  }
}

  let raw: Raw[] = [];
  if (!skipFetch) {
    const [linkedin, alljobs, jobmaster, adzuna, jooble] = await Promise.all([
      fetchOrEmpty("LinkedIn", () => fetchLinkedInGuest(profile), 70_000),
      fetchOrEmpty("AllJobs", () => fetchAllJobs(profile), 50_000),
      fetchOrEmpty("JobMaster", () => fetchJobMaster(profile), 40_000),
      fetchOrEmpty("Adzuna", () => fetchAdzuna(profile), 20_000),
      fetchOrEmpty("Jooble", () => fetchJooble(profile), 20_000),
    ]);
    // Prefer freshly fetched boards; fall back to last saved file if everything empty
    const liveFallback =
      linkedin.length + alljobs.length + jobmaster.length > 0 ? [] : fetchLiveFileJobs();
    raw = mergeRaw(linkedin, alljobs, jobmaster, adzuna, jooble, liveFallback);
    console.log(
      `Fresh listings fetched: ${raw.length} (LI ${linkedin.length} · AllJobs ${alljobs.length} · JobMaster ${jobmaster.length})`
    );
  } else {
    raw = fetchLiveFileJobs();
  }

  if (demo) {
    console.log("Demo mode: sample jobs (may not open a real apply page).");
    raw = mergeRaw(raw, fetchDemoJobs());
  }

  // Do NOT keep forever-stale previous shortlist — that blocked "new" jobs.
  // Only keep apply-ready rows from this run's sources.
  raw = raw.filter((j) => demo || isApplyReady(j));

  if (!demo && raw.length === 0) {
    console.log("No apply-ready jobs found this run.");
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

  const webPath = writeDashboard(result, profile, learned, feedback);
  const cv = loadCvProfile();
  console.log(`Dashboard → ${webPath}`);
  console.log(`Apply-ready shortlist: ${scoredListings.length} (${newCount} new)`);
  console.log(`Feedback: ${learned.relevant} relevant · ${learned.notRelevant} not relevant`);
  if (cv) {
    console.log(`CV match: loaded ${cv.files.join(", ")} (${cv.tokens.size} tokens)`);
  } else {
    console.log("CV match: no files in cv/ yet — drop .txt or .md resumes there to tighten ranking");
  }

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
