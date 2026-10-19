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
    .replace(/\s+/g, " ")
    .trim();
}

function parseAllJobsHtml(html: string): RawJob[] {
  const jobs: RawJob[] = [];
  const seen = new Set<string>();
  const re =
    /UploadSingle\.aspx\?JobID=(\d+)"[^>]*>\s*<h2[^>]*>([\s\S]*?)<\/h2>\s*<\/a>\s*<\/div>\s*<div class="T14">(?:<a[^>]*>)?([\s\S]*?)(?:<\/a>)?<\/div>[\s\S]{0,900}?job-content-top-location[\s\S]{0,400}?(?:<a[^>]*>([\s\S]*?)<\/a>|<\/b>\s*([^<]+))/gi;

  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const idNum = m[1];
    const title = decodeHtml(m[2] ?? "");
    const company = decodeHtml((m[3] ?? "").replace(/<[^>]+>/g, "")) || "Unknown company";
    const location = decodeHtml((m[4] || m[5] || "Center, Israel").replace(/<[^>]+>/g, ""));
    if (!title || title.length < 3) continue;
    const id = `alljobs-${idNum}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const url = `https://www.alljobs.co.il/Search/UploadSingle.aspx?JobID=${idNum}`;
    if (!looksLikeApplyUrl(url)) continue;
    jobs.push({
      id,
      source: "AllJobs",
      title,
      company,
      location,
      description: `${title} at ${company} — ${location}. Open AllJobs for full details and apply.`,
      requirements: "See the AllJobs posting for requirements.",
      url,
    });
  }
  return jobs;
}

async function fetchPage(freetxt: string): Promise<RawJob[]> {
  const url = new URL("https://www.alljobs.co.il/SearchResultsGuest.aspx");
  url.searchParams.set("page", "1");
  url.searchParams.set("position", "");
  url.searchParams.set("type", "");
  url.searchParams.set("city", "");
  url.searchParams.set("region", "2"); // Center
  url.searchParams.set("freetxt", freetxt);

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
    console.warn(`AllJobs "${freetxt}": HTTP ${res.status}`);
    return [];
  }
  return parseAllJobsHtml(await res.text());
}

export async function fetchAllJobs(profile: Profile): Promise<RawJob[]> {
  const queries = [
    "מנהל ייצור",
    "הנדסת ייצור",
    "אוטומציה",
    "ייצור חכם",
    "מנהל הנדסה",
    "MES",
    "manufacturing manager",
    "industry 4.0",
    ...profile.search_queries.filter((q) => /[\u0590-\u05FF]/.test(q)).slice(0, 3),
  ];
  const unique = [...new Set(queries)].slice(0, 8);
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
      console.log(`AllJobs "${q}": ${batch.length} jobs`);
    } catch (err) {
      console.warn(`AllJobs fetch failed for "${q}":`, err);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`AllJobs total: ${all.length}`);
  return all;
}
