import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { projectRoot } from "./profile.js";

export interface CvProfile {
  text: string;
  tokens: Set<string>;
  files: string[];
}

const STOP = new Set(
  "the a an and or of to in for with on at by from as is are was were be been being this that it you your we our they their i me my".split(
    " "
  )
);

function tokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9\u0590-\u05ff.+#]+/)) {
    if (raw.length < 3 || STOP.has(raw)) continue;
    out.add(raw);
  }
  return out;
}

/** Load all .txt / .md CVs from the cv/ folder (drop files there). */
export function loadCvProfile(): CvProfile | null {
  const dir = join(projectRoot(), "cv");
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => /\.(txt|md)$/i.test(f));
  if (!files.length) return null;
  const parts: string[] = [];
  for (const f of files) {
    try {
      parts.push(readFileSync(join(dir, f), "utf8"));
    } catch {
      /* skip */
    }
  }
  const text = parts.join("\n\n").trim();
  if (text.length < 40) return null;
  return { text, tokens: tokens(text), files };
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const t of a) if (b.has(t)) hit += 1;
  return hit / Math.sqrt(a.size * b.size);
}

/**
 * Compare job title + requirements against the CV.
 * Returns a small score delta and a short reason (or null if no CV).
 */
export function cvMatchDelta(
  job: { title: string; description: string; requirements: string },
  cv: CvProfile | null
): { delta: number; reason?: string } {
  if (!cv) return { delta: 0 };
  const jobTok = tokens([job.title, job.requirements, job.description].join(" "));
  const titleTok = tokens(job.title);
  const bodySim = overlap(jobTok, cv.tokens);
  const titleSim = overlap(titleTok, cv.tokens);

  let delta = 0;
  if (titleSim >= 0.08) delta += Math.round(6 + titleSim * 18);
  if (bodySim >= 0.1) delta += Math.round(bodySim * 16);
  if (titleSim < 0.03 && bodySim < 0.06) delta -= 10;

  if (!delta) return { delta: 0 };
  return {
    delta,
    reason:
      delta > 0
        ? `CV overlap with your resume (${cv.files.join(", ")})`
        : `Weak overlap with your resume`,
  };
}
