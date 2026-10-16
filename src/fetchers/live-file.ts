import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { projectRoot } from "../profile.js";
import { looksLikeApplyUrl } from "./jooble.js";
import type { RawJob } from "./adzuna.js";

/**
 * Loads real job postings from data/live-jobs.json.
 * Each item must include a direct apply/job URL (not a search page).
 */
export function fetchLiveFileJobs(): RawJob[] {
  const path = join(projectRoot(), "data", "live-jobs.json");
  if (!existsSync(path)) return [];

  try {
    const rows = JSON.parse(readFileSync(path, "utf8")) as RawJob[];
    return rows.filter((j) => j.url && looksLikeApplyUrl(j.url));
  } catch (err) {
    console.warn("Failed to read data/live-jobs.json:", err);
    return [];
  }
}
