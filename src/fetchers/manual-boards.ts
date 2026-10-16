import type { RawJob } from "./adzuna.js";

/**
 * Saved board searches — simple URLs that open real result pages in a browser.
 * (Complex OR/geoId LinkedIn queries often show empty/broken results.)
 */
export function boardSearchCards(): RawJob[] {
  const stamped = new Date().toISOString();
  const searches: Array<Omit<RawJob, "id" | "postedAt"> & { id: string }> = [
    {
      id: "board-li-sm",
      source: "LinkedIn",
      title: "LinkedIn — Smart Manufacturing (Israel)",
      company: "LinkedIn Jobs",
      location: "Israel",
      description:
        "Opens LinkedIn Jobs for “Smart Manufacturing” in Israel. After it loads, sort by Most recent / Past 24 hours.",
      requirements: "Then refine with Industry 4.0, manufacturing systems, or automation if needed.",
      url: "https://www.linkedin.com/jobs/search/?keywords=Smart%20Manufacturing&location=Israel",
    },
    {
      id: "board-li-i40",
      source: "LinkedIn",
      title: "LinkedIn — Industry 4.0 (Israel)",
      company: "LinkedIn Jobs",
      location: "Israel",
      description: "Opens LinkedIn Jobs for “Industry 4.0” in Israel.",
      requirements: "Sort by Most recent after opening.",
      url: "https://www.linkedin.com/jobs/search/?keywords=Industry%204.0&location=Israel",
    },
    {
      id: "board-li-mgr",
      source: "LinkedIn",
      title: "LinkedIn — Engineering Manager (Israel)",
      company: "LinkedIn Jobs",
      location: "Israel",
      description: "Opens LinkedIn Jobs for “Engineering Manager” in Israel.",
      requirements: "Prefer Manufacturing / Operations flavored titles over pure software EM roles.",
      url: "https://www.linkedin.com/jobs/search/?keywords=Engineering%20Manager&location=Israel",
    },
    {
      id: "board-li-mfg-mgr",
      source: "LinkedIn",
      title: "LinkedIn — Manufacturing Manager (Israel)",
      company: "LinkedIn Jobs",
      location: "Israel",
      description: "Opens LinkedIn Jobs for “Manufacturing Manager” in Israel.",
      requirements: "Sort by Most recent after opening.",
      url: "https://www.linkedin.com/jobs/search/?keywords=Manufacturing%20Manager&location=Israel",
    },
    {
      id: "board-indeed-mfg",
      source: "Indeed",
      title: "Indeed — Manufacturing Manager (Israel)",
      company: "Indeed",
      location: "Israel",
      description: "Opens Indeed for manufacturing manager roles in Israel.",
      requirements: "Sort by date after opening.",
      url: "https://www.indeed.com/jobs?q=manufacturing+manager&l=Israel",
    },
    {
      id: "board-indeed-sm",
      source: "Indeed",
      title: "Indeed — Smart Manufacturing (Israel)",
      company: "Indeed",
      location: "Israel",
      description: "Opens Indeed for smart manufacturing roles in Israel.",
      requirements: "Sort by date after opening.",
      url: "https://www.indeed.com/jobs?q=smart+manufacturing&l=Israel",
    },
    {
      id: "board-alljobs",
      source: "AllJobs",
      title: "AllJobs — Center region listings",
      company: "AllJobs",
      location: "Center",
      description:
        "Opens AllJobs guest results for the Center region. Use on-site filters for engineering / manufacturing.",
      requirements: "Filter for הנדסה / ייצור after the page loads.",
      url: "https://www.alljobs.co.il/SearchResultsGuest.aspx?page=1&position=&type=&city=&region=2",
    },
    {
      id: "board-drushim",
      source: "Drushim",
      title: "Drushim — Manufacturing engineering",
      company: "Drushim",
      location: "Israel",
      description: "Opens Drushim search for הנדסת ייצור (manufacturing engineering).",
      requirements: "Refine location to Center / Shfela on the site.",
      url: "https://www.drushim.co.il/jobs/search/%D7%94%D7%A0%D7%93%D7%A1%D7%AA%20%D7%99%D7%99%D7%A6%D7%95%D7%A8/",
    },
  ];

  return searches.map((s) => ({ ...s, postedAt: stamped }));
}
