import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { projectRoot } from "./profile.js";
import { reasonLabel } from "./reasons.js";
import type { FeedbackEntry, FeedbackVerdict, Job } from "./types.js";
import type { FeedbackReasonId } from "./reasons.js";

const STOP = new Set([
  "the", "and", "for", "with", "from", "that", "this", "your", "our", "you",
  "are", "was", "will", "have", "has", "job", "role", "team", "work", "working",
  "israel", "tel", "aviv", "את", "של", "על", "עם", "או", "הוא", "היא", "ל", "ב",
  "and", "or", "to", "in", "of", "a", "an", "as", "by", "be", "is", "on",
  "district", "ago", "hiring", "applicant",
]);

function feedbackPath(): string {
  const dir = join(projectRoot(), "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, "feedback.json");
}

export function loadFeedback(): FeedbackEntry[] {
  const path = feedbackPath();
  if (!existsSync(path)) return [];
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Array<Partial<FeedbackEntry>>;
    return raw.map((e) => ({
      jobId: String(e.jobId ?? ""),
      verdict: e.verdict === "relevant" ? "relevant" : "not_relevant",
      title: String(e.title ?? ""),
      company: String(e.company ?? ""),
      location: String(e.location ?? ""),
      source: String(e.source ?? ""),
      url: String(e.url ?? ""),
      tokens: Array.isArray(e.tokens) ? e.tokens.map(String) : [],
      reasons: Array.isArray(e.reasons) ? (e.reasons as FeedbackReasonId[]) : [],
      note: e.note ? String(e.note) : undefined,
      updatedAt: String(e.updatedAt ?? new Date().toISOString()),
    }));
  } catch {
    return [];
  }
}

export function saveFeedback(entries: FeedbackEntry[]): void {
  writeFileSync(feedbackPath(), JSON.stringify(entries, null, 2), "utf8");
}

export function upsertFeedback(
  payload: Omit<FeedbackEntry, "updatedAt"> & { updatedAt?: string }
): FeedbackEntry[] {
  const entries = loadFeedback().filter((e) => e.jobId !== payload.jobId);
  const next: FeedbackEntry = {
    ...payload,
    reasons: payload.reasons ?? [],
    updatedAt: payload.updatedAt ?? new Date().toISOString(),
  };
  entries.unshift(next);
  saveFeedback(entries);
  return entries;
}

export function feedbackMap(entries: FeedbackEntry[] = loadFeedback()): Map<string, FeedbackVerdict> {
  return new Map(entries.map((e) => [e.jobId, e.verdict]));
}

export function feedbackReasonsMap(
  entries: FeedbackEntry[] = loadFeedback()
): Map<string, FeedbackReasonId[]> {
  return new Map(entries.map((e) => [e.jobId, e.reasons ?? []]));
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9א-ת+#./\s-]/gi, " ")
    .split(/[\s,/|]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

function jobTokens(job: Pick<Job, "title" | "description" | "requirements" | "company">): Set<string> {
  return new Set(tokens([job.title, job.company, job.description, job.requirements].join(" ")));
}

function locationTokens(location: string): Set<string> {
  return new Set(tokens(location));
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit += 1;
  return hit / Math.sqrt(a.size * b.size);
}

function hasReason(e: FeedbackEntry, id: string): boolean {
  return (e.reasons ?? []).includes(id as FeedbackReasonId);
}

/** Adjust score from historical thumbs-up / thumbs-down + why. */
export function applyFeedbackToScore(
  job: Omit<Job, "matchScore" | "matchReasons" | "isNew" | "userFeedback" | "userFeedbackReasons">,
  baseScore: number,
  reasons: string[],
  entries: FeedbackEntry[]
): { matchScore: number; matchReasons: string[] } {
  const direct = entries.find((e) => e.jobId === job.id);
  if (direct?.verdict === "relevant") {
    const why = (direct.reasons ?? []).map(reasonLabel).join(", ");
    return {
      matchScore: Math.max(baseScore, 92),
      matchReasons: [
        ...reasons,
        why ? `You marked relevant: ${why}` : "You marked this as relevant",
      ],
    };
  }
  if (direct?.verdict === "not_relevant") {
    const why = (direct.reasons ?? []).map(reasonLabel).join(", ");
    return {
      matchScore: Math.min(baseScore, 25),
      matchReasons: [
        ...reasons,
        why ? `You marked not relevant: ${why}` : "You marked this as not relevant",
      ],
    };
  }

  const current = jobTokens(job);
  const titleTok = new Set(tokens(job.title));
  const locTok = locationTokens(job.location);
  const blob = [job.title, job.description, job.requirements, job.company, job.location]
    .join(" ")
    .toLowerCase();

  let delta = 0;

  // --- learn from rejects with reasons ---
  for (const e of entries.filter((x) => x.verdict === "not_relevant")) {
    const titleSim = overlapScore(titleTok, new Set(tokens(e.title)));
    const locSim = overlapScore(locTok, locationTokens(e.location));
    const bodySim = overlapScore(current, new Set(e.tokens));

    if (hasReason(e, "wrong_location") && locSim >= 0.2) {
      delta -= Math.round(18 + locSim * 20);
      reasons.push(`Location similar to a reject (${e.location})`);
    }

    if (hasReason(e, "wrong_role") && titleSim >= 0.14) {
      delta -= Math.round(22 + titleSim * 28);
      reasons.push(`Title similar to a rejected role: ${e.title}`);
    }

    if (hasReason(e, "classic_npi_design")) {
      const classic =
        /mechanical design|design engineer|solidworks|npi engineer|מתכנן מכני|תכן מכני/.test(blob);
      if (classic) {
        delta -= 20;
        reasons.push("Looks like classic design/NPI — you rejected that track");
      }
    }

    if (hasReason(e, "too_junior")) {
      if (/\b(junior|intern|student|entry.?level|משרת סטודנט|ג'וניור|ג׳וניור)\b/i.test(blob)) {
        delta -= 25;
        reasons.push("Junior-level signal — you rejected that seniority");
      }
    }

    if (hasReason(e, "wrong_industry") && bodySim >= 0.15) {
      delta -= Math.round(10 + bodySim * 14);
      reasons.push(`Similar industry/company flavor to a reject: ${e.company}`);
    }

    // generic similarity if no structured reasons on old entries
    if (!(e.reasons ?? []).length && bodySim >= 0.14) {
      delta -= Math.round(bodySim * 28);
      reasons.push(`Similar to a role you marked not relevant: ${e.title}`);
    }
  }

  // --- learn from accepts ---
  let bestPos = 0;
  let posTitle = "";
  let posReasons: FeedbackReasonId[] = [];
  for (const e of entries.filter((x) => x.verdict === "relevant")) {
    const sim = overlapScore(current, new Set(e.tokens));
    if (sim > bestPos) {
      bestPos = sim;
      posTitle = e.title;
      posReasons = e.reasons ?? [];
    }
    if (hasReason(e, "good_location")) {
      const locSim = overlapScore(locTok, locationTokens(e.location));
      if (locSim >= 0.25) {
        delta += 8;
        reasons.push(`Location similar to a role you liked (${e.location})`);
      }
    }
  }
  if (bestPos >= 0.12) {
    delta += Math.round(bestPos * 28);
    const why = posReasons.map(reasonLabel).join(", ");
    reasons.push(
      why
        ? `Similar to a liked role (${why}): ${posTitle}`
        : `Similar to a role you marked relevant: ${posTitle}`
    );
  }

  return {
    matchScore: Math.max(0, Math.min(99, Math.round(baseScore + delta))),
    matchReasons: [...new Set(reasons)],
  };
}

export function entryFromJob(
  job: Job,
  verdict: FeedbackVerdict,
  reasons: FeedbackReasonId[] = [],
  note?: string
): FeedbackEntry {
  return {
    jobId: job.id,
    verdict,
    title: job.title,
    company: job.company,
    location: job.location,
    source: job.source,
    url: job.url,
    tokens: [...jobTokens(job)].slice(0, 80),
    reasons,
    note,
    updatedAt: new Date().toISOString(),
  };
}

export function feedbackSummary(entries: FeedbackEntry[] = loadFeedback()): {
  relevant: number;
  notRelevant: number;
} {
  return {
    relevant: entries.filter((e) => e.verdict === "relevant").length,
    notRelevant: entries.filter((e) => e.verdict === "not_relevant").length,
  };
}
