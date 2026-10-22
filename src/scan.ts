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
import { inboxFromResult, writeDashboard } from "./web.js";
import type { Job, Profile, RunResult } from "./types.js";
import { looksLikeApplyUrl } from "./fetchers/jooble.js";

export type Raw = Omit<
  Job,
  "matchScore" | "matchReasons" | "isNew" | "userFeedback" | "userFeedbackReasons"
>;

export interface ScanOptions {
  skipFetch?: boolean;
  demo?: boolean;
}

export interface ScanPayload {
  generatedAt: string;
  newCount: number;
  totalCount: number;
  newHtml: string;
  ratedHtml: string;
  ratedCount: number;
  dateLabel: string;
  sources: { linkedin: number; alljobs: number; jobmaster: number };
  cvLoaded: boolean;
}

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

export async function runScan(
  options: ScanOptions = {}
): Promise<{ result: RunResult; profile: Profile; payload: ScanPayload }> {
  const skipFetch = Boolean(options.skipFetch);
  const demo = Boolean(options.demo);

  const profile = loadProfile();
  const seen = loadSeenIds();
  const feedback = loadFeedback();
  const learned = feedbackSummary(feedback);

  let raw: Raw[] = [];
  let sources = { linkedin: 0, alljobs: 0, jobmaster: 0 };

  if (!skipFetch) {
    const [linkedin, alljobs, jobmaster, adzuna, jooble] = await Promise.all([
      fetchOrEmpty("LinkedIn", () => fetchLinkedInGuest(profile), 70_000),
      fetchOrEmpty("AllJobs", () => fetchAllJobs(profile), 50_000),
      fetchOrEmpty("JobMaster", () => fetchJobMaster(profile), 40_000),
      fetchOrEmpty("Adzuna", () => fetchAdzuna(profile), 20_000),
      fetchOrEmpty("Jooble", () => fetchJooble(profile), 20_000),
    ]);
    sources = {
      linkedin: linkedin.length,
      alljobs: alljobs.length,
      jobmaster: jobmaster.length,
    };
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
    raw = mergeRaw(raw, fetchDemoJobs());
  }

  raw = raw.filter((j) => demo || isApplyReady(j));

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
  writeDashboard(result, profile, learned, feedback);

  const inbox = inboxFromResult(result, feedback);
  const cv = loadCvProfile();
  const dateLabel = new Date(result.generatedAt).toLocaleString("en-IL", {
    dateStyle: "full",
    timeStyle: "short",
  });

  console.log(`Apply-ready shortlist: ${scoredListings.length} (${newCount} new)`);

  return {
    result,
    profile,
    payload: {
      generatedAt: result.generatedAt,
      newCount,
      totalCount: scoredListings.length,
      newHtml: inbox.newHtml,
      ratedHtml: inbox.ratedHtml,
      ratedCount: inbox.ratedCount,
      dateLabel,
      sources,
      cvLoaded: Boolean(cv),
    },
  };
}
