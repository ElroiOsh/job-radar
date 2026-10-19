import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { projectRoot } from "../profile.js";
import type { Profile } from "../types.js";
import type { RawJob } from "./adzuna.js";
import { looksLikeApplyUrl } from "./jooble.js";

const QUERIES = [
  "Manufacturing Manager",
  "Engineering Manager Manufacturing",
  "Smart Manufacturing",
  "Industry 4.0",
  "Manufacturing Systems Engineer",
  "Production Engineering Manager",
  "MES Engineer",
  "Advanced Manufacturing",
];

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

function parseCards(html: string): RawJob[] {
  const jobs: RawJob[] = [];
  const blocks = html.split('data-entity-urn="urn:li:jobPosting:');
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const idMatch = block.match(/^(\d+)/);
    if (!idMatch) continue;
    const idNum = idMatch[1];

    const hrefMatch = block.match(/href="(https:\/\/[^"]*linkedin\.com\/jobs\/view\/[^"?]+)/i);
    const titleMatch = block.match(/class="base-search-card__title"[^>]*>\s*([^<]+)/i);
    const companyMatch = block.match(/class="base-search-card__subtitle"[^>]*>[\s\S]*?<a[^>]*>\s*([^<]+)/i)
      || block.match(/class="hidden-nested-link"[^>]*>\s*([^<]+)/i);
    const locationMatch = block.match(/class="job-search-card__location"[^>]*>\s*([^<]+)/i);
    const timeMatch = block.match(/datetime="([^"]+)"/i);

    const title = decodeHtml(titleMatch?.[1] ?? "");
    const company = decodeHtml(companyMatch?.[1] ?? "Unknown company");
    const location = decodeHtml(locationMatch?.[1] ?? "Israel");
    let url = hrefMatch?.[1] ? decodeHtml(hrefMatch[1]) : `https://www.linkedin.com/jobs/view/${idNum}`;
    url = url.split("?")[0];

    if (!title || !looksLikeApplyUrl(url)) continue;

    jobs.push({
      id: `linkedin-${idNum}`,
      source: "LinkedIn",
      title,
      company,
      location,
      description: `${title} at ${company} — ${location}. Open the LinkedIn posting for the full description and apply.`,
      requirements: "See the full LinkedIn posting for requirements and Easy Apply / Apply.",
      url,
      postedAt: timeMatch?.[1] ?? new Date().toISOString(),
    });
  }
  return jobs;
}

async function fetchQuery(keywords: string): Promise<RawJob[]> {
  const url = new URL(
    "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
  );
  url.searchParams.set("keywords", keywords);
  url.searchParams.set("location", "Israel");
  url.searchParams.set("f_TPR", "r604800"); // past week
  url.searchParams.set("start", "0");

  const res = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
    },
  });
  if (!res.ok) {
    console.warn(`LinkedIn guest "${keywords}": HTTP ${res.status}`);
    return [];
  }
  const html = await res.text();
  return parseCards(html);
}

export async function fetchLinkedInGuest(profile: Profile): Promise<RawJob[]> {
  const queries = [
    ...QUERIES,
    ...profile.search_queries.filter((q) => /[A-Za-z]/.test(q)).slice(0, 4),
  ];
  const uniqueQueries = [...new Set(queries)].slice(0, 10);

  const all: RawJob[] = [];
  const seen = new Set<string>();

  for (const q of uniqueQueries) {
    try {
      const batch = await fetchQuery(q);
      for (const job of batch) {
        if (seen.has(job.id)) continue;
        seen.add(job.id);
        all.push(job);
      }
      console.log(`LinkedIn "${q}": ${batch.length} jobs`);
    } catch (err) {
      console.warn(`LinkedIn fetch failed for "${q}":`, err);
    }
    await new Promise((r) => setTimeout(r, 450));
  }

  // Persist for dashboard continuity / offline rebuilds
  try {
    const dir = join(projectRoot(), "data");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "live-jobs.json"), JSON.stringify(all, null, 2), "utf8");
  } catch (err) {
    console.warn("Could not write live-jobs.json:", err);
  }

  console.log(`LinkedIn guest total: ${all.length} apply-ready jobs`);
  return all;
}
