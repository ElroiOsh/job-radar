import type { Profile } from "../types.js";
import type { RawJob } from "./adzuna.js";

interface JoobleJob {
  id?: string | number;
  title?: string;
  company?: string;
  location?: string;
  snippet?: string;
  type?: string;
  link?: string;
  updated?: string;
  salary?: string;
  source?: string;
}

interface JoobleResponse {
  totalCount?: number;
  jobs?: JoobleJob[];
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function splitRequirements(description: string): { description: string; requirements: string } {
  const markers = [/requirements?:/i, /qualifications?:/i, /דרישות/, /ניסיון/];
  for (const re of markers) {
    const idx = description.search(re);
    if (idx > 40) {
      return {
        description: description.slice(0, idx).trim(),
        requirements: description.slice(idx).trim(),
      };
    }
  }
  if (description.length > 280) {
    return {
      description: description.slice(0, 280).trim() + "…",
      requirements: description.slice(280).trim() || "See full posting for requirements.",
    };
  }
  return { description, requirements: "See full posting for requirements." };
}

/** Only keep links that look like a specific job page, not a board homepage/search. */
export function looksLikeApplyUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    if (!path || path === "/") return false;
    if (path.includes("/jobs/search")) return false;
    if (path.includes("searchresults")) return false;
    // LinkedIn / Indeed / Jooble / AllJobs style detail pages
    if (
      path.includes("/jobs/view") ||
      path.includes("/job/") ||
      path.includes("/jk=") ||
      path.includes("/desc") ||
      path.includes("/vacancy") ||
      path.includes("/position") ||
      /\/jobs\/\d+/.test(path) ||
      u.searchParams.has("jk") ||
      u.hostname.includes("jooble") ||
      u.hostname.includes("linkedin.com")
    ) {
      return true;
    }
    // generic: has an id-like segment
    return /\/\d{5,}(?:\/|$)/.test(path) || path.split("/").filter(Boolean).length >= 2;
  } catch {
    return false;
  }
}

export async function fetchJooble(profile: Profile): Promise<RawJob[]> {
  const apiKey = process.env.JOOBLE_API_KEY?.trim();
  if (!apiKey) {
    console.warn("JOOBLE_API_KEY missing — skipping Jooble fetcher.");
    return [];
  }

  const endpoint =
    process.env.JOOBLE_API_URL?.trim() || `https://il.jooble.org/api/${apiKey}`;

  const queries = profile.search_queries.slice(0, 5);
  const locations = ["Tel Aviv", "Rishon LeZion", "Rehovot", "Modiin", "Israel"];
  const jobs: RawJob[] = [];
  const seen = new Set<string>();

  for (const keywords of queries) {
    const location = locations[jobs.length % locations.length] ?? "Israel";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords,
          location,
          radius: "80",
          page: "1",
          ResultOnPage: "20",
          companysearch: "false",
        }),
      });

      if (!res.ok) {
        console.warn(`Jooble error for "${keywords}": ${res.status}`);
        continue;
      }

      const data = (await res.json()) as JoobleResponse;
      for (const j of data.jobs ?? []) {
        const link = (j.link ?? "").trim();
        if (!link || !looksLikeApplyUrl(link)) continue;

        const id = `jooble-${j.id ?? Buffer.from(link).toString("base64url").slice(0, 24)}`;
        if (seen.has(id)) continue;
        seen.add(id);

        const full = stripHtml(j.snippet ?? "");
        const parts = splitRequirements(full);
        jobs.push({
          id,
          source: j.source ? `Jooble/${j.source}` : "Jooble",
          title: j.title ?? "Untitled role",
          company: j.company ?? "Unknown company",
          location: j.location ?? location,
          description: parts.description,
          requirements: parts.requirements,
          salary: j.salary || undefined,
          url: link,
          postedAt: j.updated,
        });
      }
    } catch (err) {
      console.warn(`Jooble fetch failed for "${keywords}":`, err);
    }

    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`Jooble: ${jobs.length} jobs with apply links`);
  return jobs;
}
