import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Job, RunResult } from "./types.js";
import { projectRoot } from "./profile.js";

function dataDir(): string {
  const dir = join(projectRoot(), "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function loadSeenIds(): Set<string> {
  const path = join(dataDir(), "seen-ids.json");
  if (!existsSync(path)) return new Set();
  try {
    const arr = JSON.parse(readFileSync(path, "utf8")) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export function saveSeenIds(ids: Set<string>): void {
  writeFileSync(join(dataDir(), "seen-ids.json"), JSON.stringify([...ids], null, 2));
}

export function saveRun(result: RunResult): void {
  writeFileSync(join(dataDir(), "latest.json"), JSON.stringify(result, null, 2));
  const day = result.generatedAt.slice(0, 10);
  writeFileSync(join(dataDir(), `run-${day}.json`), JSON.stringify(result, null, 2));
}

export function markSeen(jobs: Job[], seen: Set<string>): Set<string> {
  const next = new Set(seen);
  for (const j of jobs) next.add(j.id);
  return next;
}

/** Keep prior shortlist jobs so you can keep training feedback across runs. */
export function loadPreviousListings(): Omit<
  Job,
  "matchScore" | "matchReasons" | "isNew" | "userFeedback" | "userFeedbackReasons"
>[] {
  const path = join(dataDir(), "latest.json");
  if (!existsSync(path)) return [];
  try {
    const latest = JSON.parse(readFileSync(path, "utf8")) as RunResult;
    return latest.jobs
      .filter((j) => !j.id.startsWith("board-"))
      .map(
        ({
          matchScore: _m,
          matchReasons: _r,
          isNew: _n,
          userFeedback: _u,
          userFeedbackReasons: _w,
          ...rest
        }) => rest
      );
  } catch {
    return [];
  }
}
