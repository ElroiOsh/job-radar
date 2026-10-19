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
      title: "AllJobs — מנהל ייצור (מרכז)",
      company: "AllJobs",
      location: "Center",
      description: "Opens AllJobs Center-region search for מנהל ייצור.",
      requirements: "Sort by newest after opening.",
      url: "https://www.alljobs.co.il/SearchResultsGuest.aspx?page=1&position=&type=&city=&region=2&freetxt=%D7%9E%D7%A0%D7%94%D7%9C+%D7%99%D7%99%D7%A6%D7%95%D7%A8",
    },
    {
      id: "board-jobmaster",
      source: "JobMaster",
      title: "JobMaster — מנהל ייצור",
      company: "JobMaster",
      location: "Israel",
      description: "Opens JobMaster for מנהל ייצור roles.",
      requirements: "Filter location to Center / Shfela on the site.",
      url: "https://www.jobmaster.co.il/jobs/?q=%D7%9E%D7%A0%D7%94%D7%9C+%D7%99%D7%99%D7%A6%D7%95%D7%A8",
    },
    {
      id: "board-drushim",
      source: "Drushim",
      title: "Drushim — הנדסת ייצור",
      company: "Drushim",
      location: "Israel",
      description: "Opens Drushim search for הנדסת ייצור.",
      requirements: "Refine location to Center / Shfela on the site.",
      url: "https://www.drushim.co.il/jobs/search/%D7%94%D7%A0%D7%93%D7%A1%D7%AA%20%D7%99%D7%99%D7%A6%D7%95%D7%A8/",
    },
  ];

  return searches.map((s) => ({ ...s, postedAt: stamped }));
}
