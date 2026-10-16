import type { RawJob } from "./adzuna.js";

/**
 * Sample shortlist cards for UI + feedback training.
 * These are NOT live single postings — each CTA opens a simple working board search
 * for a similar title (LinkedIn search pages that return HTTP 200).
 */
export function fetchDemoJobs(): RawJob[] {
  const today = new Date().toISOString();
  return [
    {
      id: "demo-sm-1",
      source: "Demo",
      title: "Smart Manufacturing / Industry 4.0 Lead",
      company: "MedTech Systems Israel",
      location: "Rehovot, Israel",
      description:
        "Lead the digital manufacturing roadmap across automated assembly lines. Own MES/SCADA integration, OEE dashboards, and cross-functional programs connecting Operations, Quality, and Engineering.",
      requirements:
        "Requirements: 5+ years manufacturing engineering; experience with automation or MES; leadership of cross-functional initiatives; medical device or regulated industry a plus.",
      salary: "₪35,000–45,000",
      url: "https://www.linkedin.com/jobs/search/?keywords=Smart%20Manufacturing&location=Israel",
      postedAt: today,
    },
    {
      id: "demo-mgr-1",
      source: "Demo",
      title: "Engineering Manager — Manufacturing",
      company: "Advanced Production Group",
      location: "Rishon LeZion / Hybrid",
      description:
        "Manage a multidisciplinary engineering team supporting high-mix production. Drive process capability, capital projects, and R&D-to-production handoffs with a data-driven operating rhythm.",
      requirements:
        "Requirements: prior team leadership; manufacturing systems mindset; PFMEA/RCA fluency; ERP familiarity; Hebrew and English.",
      salary: "₪38,000–48,000",
      url: "https://www.linkedin.com/jobs/search/?keywords=Engineering%20Manager&location=Israel",
      postedAt: today,
    },
    {
      id: "demo-pe-1",
      source: "Demo",
      title: "Manufacturing Systems Engineer — Automation & Data",
      company: "Factory Digital",
      location: "Modiin / Center",
      description:
        "Bridge shop-floor processes with connected systems. Specify right-sized automation, instrument processes for yield analytics, and partner with IT/OT on IIoT rollouts.",
      requirements:
        "Requirements: B.Sc. Mechanical/Industrial/Electrical; automation judgment; comfort with production data and continuous improvement.",
      url: "https://www.linkedin.com/jobs/search/?keywords=Manufacturing%20Systems%20Engineer&location=Israel",
      postedAt: today,
    },
    {
      id: "demo-npi-low",
      source: "Demo",
      title: "Mechanical Design Engineer (SolidWorks)",
      company: "Classic Design Shop",
      location: "Haifa",
      description:
        "Full-time mechanical design of machined parts in SolidWorks. Focus on CAD deliverables and drawings only.",
      requirements:
        "Requirements: SolidWorks expert, drafting, junior-friendly NPI support. Student/intern welcome.",
      url: "https://www.linkedin.com/jobs/search/?keywords=Mechanical%20Design%20Engineer&location=Israel",
      postedAt: today,
    },
  ];
}
