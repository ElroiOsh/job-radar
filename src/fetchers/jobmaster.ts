import type { Profile } from "../types.js";
import type { RawJob } from "./adzuna.js";
import { looksLikeApplyUrl } from "./jooble.js";

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function parseJobMasterHtml(html: string): RawJob[] {
  const jobs: RawJob[] = [];
  const seen = new Set<string>();
  const blocks = html.split(/data-jobNum="/i);
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const idMatch = block.match(/^(\d+)/);
    if (!idMatch) continue;
    const idNum = idMatch[1];
    const titleMatch = block.match(/class="CardHeader"[^>]*>\s*([\s\S]*?)\s*<\/div>/i);
    const companyMatch = block.match(/class="[^"]*ByTitle[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/span>/i);
    const locMatch = block.match(/class="jobLocation"[^>]*>[\s\S]*?<a[^>]*>\s*([\s\S]*?)\s*<\/a>/i);
    const title = decodeHtml((titleMatch?.[1] ?? "").replace(/<[^>]+>/g, ""));
    const company = decodeHtml((companyMatch?.[1] ?? "Unknown company").replace(/<[^>]+>/g, ""));
    const location = decodeHtml((locMatch?.[1] ?? "Israel").replace(/<[^>]+>/g, ""));
    if (!title || title.length < 3) continue;
    const id = `jobmaster-${idNum}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const url = `https://www.jobmaster.co.il/jobs/checknum.asp?key=${idNum}`;
    if (!looksLikeApplyUrl(url)) continue;
    jobs.push({
      id,
      source: "JobMaster",
      title,
      company,
      location,
      description: `${title} at ${company} — ${location}. Open JobMaster for full details and apply.`,
      requirements: "See the JobMaster posting for requirements.",
      url,
    });
  }
  return jobs;
}

async function fetchPage(q: string): Promise<RawJob[]> {
  const url = `https://www.jobmaster.co.il/jobs/?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "he-IL,he;q=0.9,en;q=0.8",
    },
  });
  if (!res.ok) {
    console.warn(`JobMaster "${q}": HTTP ${res.status}`);
    return [];
  }
  return parseJobMasterHtml(await res.text());
}

export async function fetchJobMaster(profile: Profile): Promise<RawJob[]> {
  const queries = [
    "מנהל ייצור",
    "הנדסת ייצור",
    "אוטומציה תעשייתית",
    "מנהל הנדסה",
    "ייצור חכם",
    "MES",
    "manufacturing manager",
    ...profile.search_queries.filter((q) => /[\u0590-\u05FF]/.test(q)).slice(0, 2),
  ];
  const unique = [...new Set(queries)].slice(0, 7);
  const all: RawJob[] = [];
  const seen = new Set<string>();

  for (const q of unique) {
    try {
      const batch = await fetchPage(q);
      for (const job of batch) {
        if (seen.has(job.id)) continue;
        seen.add(job.id);
        all.push(job);
      }
      console.log(`JobMaster "${q}": ${batch.length} jobs`);
    } catch (err) {
      console.warn(`JobMaster fetch failed for "${q}":`, err);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`JobMaster total: ${all.length}`);
  return all;
}
