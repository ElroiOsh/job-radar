import type { Profile } from "../types.js";

export interface RawJob {
  id: string;
  source: string;
  title: string;
  company: string;
  location: string;
  description: string;
  requirements: string;
  salary?: string;
  url: string;
  postedAt?: string;
}

interface AdzunaResult {
  results?: Array<{
    id: string | number;
    title?: string;
    company?: { display_name?: string };
    location?: { display_name?: string };
    description?: string;
    redirect_url?: string;
    created?: string;
    salary_min?: number;
    salary_max?: number;
    salary_is_predicted?: string;
  }>;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function formatSalary(min?: number, max?: number, predicted?: string): string | undefined {
  if (!min && !max) return undefined;
  const pred = predicted === "1" ? " (estimate)" : "";
  if (min && max) return `₪${Math.round(min).toLocaleString()}–${Math.round(max).toLocaleString()}${pred}`;
  if (min) return `From ₪${Math.round(min).toLocaleString()}${pred}`;
  return `Up to ₪${Math.round(max!).toLocaleString()}${pred}`;
}

function splitRequirements(description: string): { description: string; requirements: string } {
  const markers = [
    /requirements?:/i,
    /qualifications?:/i,
    /what you.?ll need/i,
    /דרישות/,
    /ניסיון נדרש/,
  ];
  for (const re of markers) {
    const idx = description.search(re);
    if (idx > 40) {
      return {
        description: description.slice(0, idx).trim(),
        requirements: description.slice(idx).trim(),
      };
    }
  }
  const sentences = description.split(/(?<=[.!?])\s+/);
  if (sentences.length > 4) {
    const mid = Math.ceil(sentences.length * 0.55);
    return {
      description: sentences.slice(0, mid).join(" "),
      requirements: sentences.slice(mid).join(" "),
    };
  }
  return { description, requirements: "See full posting for requirements." };
}

export async function fetchAdzuna(profile: Profile): Promise<RawJob[]> {
  const appId = process.env.ADZUNA_APP_ID?.trim();
  const appKey = process.env.ADZUNA_APP_KEY?.trim();
  if (!appId || !appKey) {
    console.warn("Adzuna keys missing — skipping Adzuna fetcher.");
    return [];
  }

  const queries = profile.search_queries.slice(0, 8);
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  for (const what of queries) {
    const url = new URL("https://api.adzuna.com/v1/api/jobs/il/search/1");
    url.searchParams.set("app_id", appId);
    url.searchParams.set("app_key", appKey);
    url.searchParams.set("results_per_page", "20");
    url.searchParams.set("what", what);
    url.searchParams.set("max_days_old", String(profile.max_days_old));
    url.searchParams.set("content-type", "application/json");

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`Adzuna error for "${what}": ${res.status}`);
        continue;
      }
      const data = (await res.json()) as AdzunaResult;
      for (const r of data.results ?? []) {
        const id = `adzuna-${r.id}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const full = stripHtml(r.description ?? "");
        const parts = splitRequirements(full);
        jobs.push({
          id,
          source: "Adzuna",
          title: r.title ?? "Untitled",
          company: r.company?.display_name ?? "Unknown company",
          location: r.location?.display_name ?? "Israel",
          description: parts.description,
          requirements: parts.requirements,
          salary: formatSalary(r.salary_min, r.salary_max, r.salary_is_predicted),
          url: r.redirect_url ?? "https://www.adzuna.co.il/",
          postedAt: r.created,
        });
      }
    } catch (err) {
      console.warn(`Adzuna fetch failed for "${what}":`, err);
    }

    // gentle rate limit
    await new Promise((r) => setTimeout(r, 350));
  }

  return jobs;
}
