/**
 * Hard geographic gate: Center / Shfela / Gush Dan (+ nearby south like Ashdod).
 * Drop anything clearly north of Tel Aviv (Haifa + North districts and cities).
 */

const NORTH_OF_TA: string[] = [
  "haifa",
  "חיפה",
  "north district",
  "northern district",
  "צפון",
  "מחוז הצפון",
  "מחוז חיפה",
  "haifa district",
  "caesarea",
  "קיסריה",
  "yokneam",
  "yoqneam",
  "יקנעם",
  "karmiel",
  "כרמיאל",
  "nahariy",
  "נהרייה",
  "נהריה",
  "acre",
  "akko",
  "עכו",
  "tiberias",
  "טבריה",
  "nazareth",
  "נצרת",
  "nof hagalil",
  "נוף הגליל",
  "afula",
  "עפולה",
  "migdal haemek",
  "מגדל העמק",
  "beit shean",
  "beit she an",
  "בית שאן",
  "netanya",
  "נתניה",
  "kiryat shmona",
  "קריית שמונה",
  "kiryat ata",
  "קריית אתא",
  "kiryat bim",
  "קריית ביאליק",
  "kiryat motzkin",
  "קריית מוצקין",
  "kiryat yam",
  "קריית ים",
  "kiryat tivon",
  "קריית טבעון",
  "nesher",
  "נשר",
  "tirat carmel",
  "טירת כרמל",
  "zichron",
  "זכרון",
  "pardes hanna",
  "פרדס חנה",
  "hadera",
  "חדרה",
  "or akiva",
  "אור עקיבא",
  "daliyat",
  "דאלית",
  "shefaram",
  "שפרעם",
  "maalot",
  "מעלות",
  "safed",
  "צפת",
  "katzrin",
  "קצרין",
  "golan",
  "גולן",
];

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[''`´ʼ]/g, "")
    .replace(/[־–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns false when the role is clearly north of Tel Aviv. */
export function isLocationAllowed(location: string): boolean {
  const loc = norm(location || "");
  if (!loc) return true; // unknown — keep and let scoring decide
  return !NORTH_OF_TA.some((n) => loc.includes(norm(n)));
}

export function locationExcludeReason(location: string): string | null {
  if (isLocationAllowed(location)) return null;
  return `North of Tel Aviv: ${location}`;
}
