/**
 * One-shot helper: paste LinkedIn card JSON (from browser extract) into stdin
 * or extend SOURCES below. Writes data/live-jobs.json with direct apply URLs.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** @type {Array<{url:string,title:string,company:string,location:string,snippet?:string}>} */
const SOURCES = [
  // Manufacturing Manager search
  {
    url: "https://il.linkedin.com/jobs/view/production-manager-at-phinergy-4453450023",
    title: "Production Manager",
    company: "Phinergy",
    location: "Kfar Saba, Center District, Israel",
    snippet:
      "Production leadership role in a manufacturing environment. Open the LinkedIn posting to review full requirements and apply.",
  },
  {
    url: "https://il.linkedin.com/jobs/view/production-manager-at-eitan-medical-4475657416",
    title: "Production Manager",
    company: "Eitan Medical",
    location: "Netanya, Center District, Israel",
    snippet:
      "Medical-device manufacturing production manager role. Open the LinkedIn posting to review full requirements and apply.",
  },
  {
    url: "https://il.linkedin.com/jobs/view/production-line-manager-931879-at-spearuav-4474830394",
    title: "Production Line Manager",
    company: "SpearUAV",
    location: "Emek Hefer Regional Council, Center District, Israel",
    snippet:
      "Production line management in advanced manufacturing. Open the LinkedIn posting to review full requirements and apply.",
  },
  {
    url: "https://il.linkedin.com/jobs/view/manufacturing-manager-at-jobsseek-4466895123",
    title: "Manufacturing Manager",
    company: "JobsSeek (client)",
    location: "Beer Yaakov, Center District, Israel",
    snippet:
      "Manufacturing Manager opening in the Center. Open the LinkedIn posting to review full requirements and apply.",
  },
  {
    url: "https://il.linkedin.com/jobs/view/production-section-manager-at-vishay-precision-group-inc-vpg-4455160989",
    title: "Production Section Manager",
    company: "Vishay Precision Group (VPG)",
    location: "Center District, Israel",
    snippet:
      "Production section management role. Open the LinkedIn posting to review full requirements and apply.",
  },
  {
    url: "https://il.linkedin.com/jobs/view/%D7%9E%D7%A0%D7%94%D7%9C-%D7%AA-%D7%9E%D7%97%D7%9C%D7%A7%D7%AA-%D7%99%D7%99%D7%A6%D7%95%D7%A8-at-ellipse-advanced-system-innovation-4477052472",
    title: "Production Department Manager (מנהל/ת מחלקת ייצור)",
    company: "Ellipse Advanced System Innovation",
    location: "Ramat HaSharon, Tel Aviv District, Israel",
    snippet:
      "Lead a production department. Open the LinkedIn posting to review full requirements and apply.",
  },
  // Smart Manufacturing / systems / automation
  {
    url: "https://il.linkedin.com/jobs/view/manufacturing-execution-systems-eng-at-applied-materials-israel-4441831234",
    title: "Manufacturing Execution & Systems Eng",
    company: "Applied Materials - Israel",
    location: "Rehovot, Center District, Israel",
    snippet:
      "MES / manufacturing systems engineering at Applied Materials in Rehovot. Strong Industry 4.0 fit. Open LinkedIn to apply.",
  },
  {
    url: "https://il.linkedin.com/jobs/view/%D7%9E%D7%98%D7%9E%D7%99%D7%A2-%D7%AA-%D7%9E%D7%A2%D7%A8%D7%9B%D7%AA-%D7%9C%D7%A0%D7%99%D7%94%D7%95%D7%9C-%D7%A8%D7%A6%D7%A4%D7%AA-%D7%99%D7%99%D7%A6%D7%95%D7%A8-tulip-composable-mes-at-systematics-ltd-solutions-at-work-4478859110",
    title: "MES Implementer — Tulip Composable MES (מטמיע/ת מערכת לניהול רצפת ייצור)",
    company: "Systematics Ltd.",
    location: "Tel Aviv District, Israel",
    snippet:
      "Implement Tulip composable MES on the shop floor. Direct Smart Manufacturing / digital manufacturing fit. Open LinkedIn to apply.",
  },
  {
    url: "https://il.linkedin.com/jobs/view/operational-technology-manager-at-enlight-renewable-energy-ltd-enlt-4402009285",
    title: "Operational Technology Manager",
    company: "Enlight Renewable Energy Ltd (ENLT)",
    location: "Rosh HaAyin, Center District, Israel",
    snippet:
      "OT management role bridging operations and technology. Open LinkedIn to apply.",
  },
  {
    url: "https://il.linkedin.com/jobs/view/senior-automation-projects-engineer-at-pepsico-4472920368",
    title: "Senior Automation Projects Engineer",
    company: "PepsiCo",
    location: "Rahat, South District, Israel",
    snippet:
      "Senior automation projects in manufacturing. Location is south — score may be lower vs Center preference. Open LinkedIn to apply.",
  },
  {
    url: "https://il.linkedin.com/jobs/view/plc-ot-engineer-at-rafael-advanced-defense-systems-4471408804",
    title: "PLC & OT Engineer",
    company: "Rafael Advanced Defense Systems",
    location: "Kiryat Bialik, Haifa District, Israel",
    snippet:
      "PLC/OT engineering role. Location is north — may score lower vs Center preference. Open LinkedIn to apply.",
  },
  {
    url: "https://il.linkedin.com/jobs/view/automation-engineer-at-manpower-israel-4479284124",
    title: "Automation Engineer",
    company: "Manpower Israel",
    location: "South District, Israel",
    snippet:
      "Automation engineer opening via Manpower. Open LinkedIn to apply.",
  },
];

const jobs = SOURCES.map((s, i) => ({
  id: `linkedin-${s.url.match(/(\d{8,})/)?.[1] ?? i}`,
  source: "LinkedIn",
  title: s.title,
  company: s.company,
  location: s.location,
  description: s.snippet,
  requirements: "See the full LinkedIn posting for requirements and Easy Apply / Apply.",
  url: s.url,
  postedAt: new Date().toISOString(),
}));

const outDir = join(root, "data");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "live-jobs.json");
writeFileSync(outPath, JSON.stringify(jobs, null, 2));
console.log(`Wrote ${jobs.length} apply-ready jobs → ${outPath}`);
