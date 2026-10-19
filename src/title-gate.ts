/**
 * Title-first relevance: drop software/office/sales titles that only matched
 * because the body mentioned "automation" or "manager".
 */

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Titles that are almost never the manufacturing / systems track. */
const TITLE_BLOCK: string[] = [
  "software engineer",
  "software developer",
  "backend",
  "front end",
  "frontend",
  "full stack",
  "fullstack",
  "devops",
  "mlops",
  "data scientist",
  "data engineer",
  "machine learning",
  "qa automation",
  "test automation",
  "sdet",
  "product manager",
  "product owner",
  "account manager",
  "sales manager",
  "marketing",
  "recruiter",
  "חשבונ",
  "הנהלת חשבונות",
  "מנהל/ת לשכת",
  "מנהלת לשכת",
  "מכירות",
  "שיווק",
  "גיוס",
  "מפתח תוכנה",
  "מהנדס תוכנה",
  "fullstack",
  "full-stack",
  "ai backend",
  "ai engineer",
  "cmm programmer",
  "electrician",
  "חשמלאי",
];

/** Positive manufacturing / ops / systems title signals. */
const TITLE_ALLOW: string[] = [
  "manufacturing",
  "production",
  "plant manager",
  "factory",
  "operations manager",
  "process engineer",
  "process improvement",
  "industrial engineer",
  "manufacturing systems",
  "manufacturing engineer",
  "manufacturing manager",
  "engineering manager",
  "production manager",
  "production engineering",
  "automation engineer",
  "automation manager",
  "mes ",
  "mes-",
  "industry 4",
  "smart manufacturing",
  "lean",
  "oee",
  "ייצור",
  "אוטומציה",
  "הנדסת ייצור",
  "מנהל הנדסה",
  "מנהל ייצור",
  "מנהלת ייצור",
  "מנהל תפעול",
  "מנהלת תפעול",
  "רצפת ייצור",
  "מפעל",
  "תעשייה 4",
  "מטמיע",
  "מערכות ייצור",
  "plm",
  "erp",
];

export function titleHasAllowSignal(title: string): boolean {
  const t = norm(title);
  return TITLE_ALLOW.some((k) => t.includes(norm(k)));
}

export function titleIsBlocked(title: string): boolean {
  const t = norm(title);
  const blocked = TITLE_BLOCK.some((k) => t.includes(norm(k)));
  if (!blocked) return false;
  // Allow e.g. "Manufacturing Software" only if strong mfg allow signal also present
  return !titleHasAllowSignal(title);
}

/** Reject when title has no manufacturing/ops signal at all. */
export function titleLacksTrack(title: string): boolean {
  return !titleHasAllowSignal(title);
}
