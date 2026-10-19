import { applyFeedbackToScore, feedbackMap, feedbackReasonsMap } from "./feedback.js";
import { isLocationAllowed, locationExcludeReason } from "./geo.js";
import { reasonLabel } from "./reasons.js";
import type { FeedbackEntry, Job, Profile } from "./types.js";

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function includesAny(haystack: string, needles: string[]): string[] {
  return needles.filter((n) => haystack.includes(norm(n)));
}

function isRecentlyPosted(postedAt: string | undefined, hours = 72): boolean {
  if (!postedAt) return false;
  const t = Date.parse(postedAt);
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= hours * 3_600_000;
}

export function scoreJob(
  job: Omit<Job, "matchScore" | "matchReasons" | "isNew" | "userFeedback" | "userFeedbackReasons">,
  profile: Profile,
  feedback: FeedbackEntry[] = []
): { matchScore: number; matchReasons: string[]; excluded: boolean } {
  const blob = norm(
    [job.title, job.company, job.location, job.description, job.requirements].join(" ")
  );

  const geoReason = locationExcludeReason(job.location);
  if (geoReason || !isLocationAllowed(job.location)) {
    return {
      matchScore: 0,
      matchReasons: [geoReason ?? `North of Tel Aviv: ${job.location}`],
      excluded: true,
    };
  }

  const hardHits = includesAny(blob, profile.hard_exclude_keywords);
  if (hardHits.length) {
    return {
      matchScore: 0,
      matchReasons: [`Excluded: ${hardHits.join(", ")}`],
      excluded: true,
    };
  }

  // Explicit "not relevant" → drop from shortlist on future runs
  const byId = feedbackMap(feedback);
  const whyMap = feedbackReasonsMap(feedback);
  if (byId.get(job.id) === "not_relevant") {
    const why = (whyMap.get(job.id) ?? []).map(reasonLabel).join(", ");
    return {
      matchScore: 0,
      matchReasons: [why ? `You marked not relevant: ${why}` : "You marked this as not relevant"],
      excluded: true,
    };
  }

  let score = 28;
  const reasons: string[] = [];

  const titleBoost = includesAny(norm(job.title), profile.boost_keywords);
  if (titleBoost.length) {
    score += Math.min(28, 10 + titleBoost.length * 4);
    reasons.push(`Title fit: ${titleBoost.slice(0, 3).join(", ")}`);
  }

  const bodyBoost = includesAny(blob, profile.boost_keywords);
  if (bodyBoost.length) {
    score += Math.min(22, bodyBoost.length * 2);
    reasons.push(`Keywords: ${bodyBoost.slice(0, 5).join(", ")}`);
  }

  const roleHits = profile.target_roles.filter((role) => {
    const tokens = norm(role)
      .split(/[\/,&]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 3);
    return tokens.some((t) => blob.includes(t));
  });
  if (roleHits.length) {
    score += Math.min(18, roleHits.length * 6);
    reasons.push(`Role track: ${roleHits[0]}`);
  }

  const loc = norm(job.location);
  const preferred = profile.locations.preferred.filter((p) => loc.includes(norm(p)));
  const avoided = profile.locations.avoid_unless_strong_match.filter((p) =>
    loc.includes(norm(p))
  );
  if (preferred.length) {
    score += 12;
    reasons.push(`Location: ${job.location}`);
  } else if (avoided.length) {
    score -= 15;
    reasons.push(`Farther location: ${job.location}`);
  } else if (loc.includes("israel") || loc.includes("ישראל") || !loc) {
    score += 4;
  }

  const depri = includesAny(blob, profile.deprioritize_keywords);
  const strongTech =
    includesAny(blob, [
      "smart manufacturing",
      "industry 4.0",
      "automation",
      "manufacturing systems",
      "ייצור חכם",
      "אוטומציה",
      "manager",
      "מנהל",
    ]).length > 0;

  if (depri.length && !strongTech) {
    score -= 22;
    reasons.push(`Deprioritized classic design/NPI: ${depri.slice(0, 2).join(", ")}`);
  } else if (depri.length && strongTech) {
    score -= 6;
    reasons.push("Has design/NPI flavor but also tech/management signal");
  }

  if (job.salary) {
    score += 3;
    reasons.push("Salary listed");
  }

  const learned = applyFeedbackToScore(job, score, reasons, feedback);
  score = learned.matchScore;

  if (!learned.matchReasons.length) learned.matchReasons.push("Partial keyword overlap");

  return {
    matchScore: score,
    matchReasons: learned.matchReasons,
    excluded: false,
  };
}

export function enrichAndFilter(
  jobs: Omit<Job, "matchScore" | "matchReasons" | "isNew" | "userFeedback" | "userFeedbackReasons">[],
  profile: Profile,
  seenIds: Set<string>,
  feedback: FeedbackEntry[] = []
): Job[] {
  const scored: Job[] = [];
  const verdicts = feedbackMap(feedback);
  const whyMap = feedbackReasonsMap(feedback);

  for (const job of jobs) {
    const { matchScore, matchReasons, excluded } = scoreJob(job, profile, feedback);
    if (excluded || matchScore < profile.min_match_score) continue;
    scored.push({
      ...job,
      matchScore,
      matchReasons,
      // First time we see the ID, or LinkedIn/board marks it as posted in the last 3 days
      isNew: !seenIds.has(job.id) || isRecentlyPosted(job.postedAt, 72),
      userFeedback: verdicts.get(job.id),
      userFeedbackReasons: whyMap.get(job.id),
    });
  }

  scored.sort((a, b) => {
    if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
    return b.matchScore - a.matchScore;
  });

  const seen = new Set<string>();
  return scored.filter((j) => {
    const key = `${norm(j.title)}|${norm(j.company)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
