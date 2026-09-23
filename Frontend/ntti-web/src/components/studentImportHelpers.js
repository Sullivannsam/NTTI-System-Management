import * as XLSX from "xlsx";
import { MAJORS, SHIFTS, FIELDS_OF_STUDY, ACADEMIC_LEVELS, latinToKhmer } from "../data/seed";

/* ── shared helpers for the Excel student import ─────────────── */

export const collapse = (s) =>
  String(s ?? "")
    .replace(/[\u200c\u200b\u200d\ufeff]/g, "")
    .trim()
    .replace(/\s+/g, " ");
export const norm = (s) => collapse(s).toLowerCase();

/* NTTI Excel sheets often list an unregistered English name as "Student <Khmer name>". */
export const cleanName = (s) => {
  const t = collapse(s);
  return t.replace(/^student\s+/i, "");
};

/* name → { firstName, lastName } treating the last token as the family name */
export const splitLatin = (full) => {
  const parts = collapse(full).split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  const lastName = parts[parts.length - 1];
  return { firstName: parts.slice(0, -1).join(" ") || lastName, lastName };
};

/* Excel serial / text / date → yyyy-mm-dd */
export const dobToISO = (v) => {
  const s = collapse(v);
  if (!s) return "";
  const n = Number(s);
  if (Number.isFinite(n) && n > 10000 && n < 80000) {
    const d = new Date(Math.round((n - 25569) * 86400 * 1000));
    if (!isNaN(d)) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  }
  const d = new Date(s);
  return isNaN(d)
    ? ""
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const genderOf = (v) => {
  const s = collapse(v).toLowerCase();
  if (/female|ស្រី/.test(s)) return "Female";
  if (/male|ប្រុស/.test(s)) return "Male";
  const c = collapse(v);
  return c ? c[0].toUpperCase() + c.slice(1) : "";
};

export const shiftOf = (v) => {
  const s = collapse(v).toLowerCase();
  if (/ព្រឹក|morning/.test(s)) return "Morning";
  if (/ល្ងាច|evening/.test(s)) return "Evening";
  if (/យប់|night/.test(s)) return "Night";
  return SHIFTS.includes(collapse(v)) ? collapse(v) : "";
};

export const statusOf = (v) => {
  const s = collapse(v).toLowerCase();
  if (/graduat|បញ្ចប់/.test(s)) return "Graduate";
  if (/undergraduate|suspended|ព្យួរ/.test(s)) return "Undergraduate";
  if (/learn|active|studying|រៀន/.test(s)) return "Learning";
  return "Learning";
};

export const yearOf = (v) => {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n >= 2000 && n <= 2100 ? n : 0;
};

/* column roles a file column can play */
export const ROLES = [
  { key: "sid", label: "Student ID", ex: "NTTI-2026-0001" },
  { key: "khmer", label: "Khmer name", ex: "ជាប ចនារា" },
  { key: "latin", label: "English name", ex: "Chab Channara" },
  { key: "first", label: "First name (EN)", ex: "Chab" },
  { key: "last", label: "Last name (EN)", ex: "Channara" },
  { key: "username", label: "Username", ex: "chab.channara" },
  { key: "gender", label: "Gender", ex: "Male / Female" },
  { key: "dob", label: "Date of birth", ex: "2005-06-14" },
  { key: "birthPlace", label: "Place of birth", ex: "Takeo" },
  { key: "email", label: "Email", ex: "name@ntti.edu.kh" },
  { key: "phone", label: "Phone", ex: "+855 12 345 678" },
  { key: "father", label: "Father's name", ex: "Chab Sopheak" },
  { key: "mother", label: "Mother's name", ex: "Sok Chanthy" },
  { key: "address", label: "Address", ex: "Phnom Penh" },
  { key: "class", label: "Class", ex: "IT01A" },
  { key: "shift", label: "Shift", ex: "Morning" },
  { key: "year", label: "Enrollment year", ex: "2026" },
  { key: "status", label: "Status", ex: "Learning" },
];

export const roleLabel = (key) => ROLES.find((r) => r.key === key)?.label || key;

/* which role does a header cell play? (Khmer + English headers) */
export function classifyHeader(h) {
  const t = collapse(h).toLowerCase();
  if (!t) return null;
  const re = (p) => new RegExp(p, "i").test(t);
  if (re("student\\s*id|student\\s*code|លេខកូដ|ល។កូដ|លេខសម្គាល់|nº|n°|^\\s*(no\\.?|no|#|code|id|roll|ref|stt|seq)\\s*$")) return "sid";
  if (re("username|user\\s*name|ឈ្មោះអ្នកប្រើ|អ្នកប្រើប្រាស់")) return "username";
  if (re("គោត្តនាម-នាម|គោត្តនាម.*នាម|នាម.*គោត្តនាម")) return "latin"; // cheatsheet full-name (Latin) column
  if (re("first\\s*name|given\\s*name|នាមខ្លួន|ឈ្មោះដើម")) return "first";
  if (re("last\\s*name|surname|family\\s*name|គោត្តនាម|ឈ្មោះត្រកូល")) return "last";
  if (re("khmer|ខ្មែរ")) return "khmer";
  if (re("father|ឪពុក|ឈ្មោះឪពុក")) return "father";
  if (re("mother|ម្តាយ|ម្ដាយ|ឈ្មោះម្តាយ")) return "mother";
  if (re("birth\\s*place|place\\s*of\\s*birth|ទីកន្លែងកំណើត|ស្រុកកំណើត")) return "birthPlace";
  if (re("gender|sex|ភេទ")) return "gender";
  if (re("birth|dob|ថ្ងៃខែ|កំណើត|កំនើត")) return "dob";
  if (re("email|អ៊ីមែល|អ៊ីម៉ែល|អ៊ីមែយល៍")) return "email";
  if (re("phone|tel|mobile|ទូរស័ព្ទ|ទូរសព្ទ")) return "phone";
  if (re("address|អាសយដ្ឋាន")) return "address";
  if (re("class|ថ្នាក់")) return "class";
  if (re("shift|វេន")) return "shift";
  if (re("enrollment\\s*year|ឆ្នាំចូល|ឆ្នាំសិក្សា|ឆ្នាំ")) return "year";
  if (re("status|ស្ថានភាព")) return "status";
  if (re("latin|ឡាតាំង|អក្សរឡាតាំង|english|full\\s*name|ឈ្មោះអង់គ្លេស|ឈ្មោះឡាតាំង|គោត្តនាម-នាម")) return "latin";
  if (re("ឈ្មោះ|name")) return "latin"; // plain "name" / "ឈ្មោះ" → English name
  return null;
}

/* first row that carries a recognisable identity column */
export function detectHeaderRow(rows) {
  let widest = -1;
  let widestCells = 0;
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const cells = (rows[r] || []).filter((c) => c != null && collapse(c) !== "");
    if (cells.length < 2) continue;
    if (cells.some((c) => classifyHeader(c))) return r;
    if (cells.length > widestCells) {
      widestCells = cells.length;
      widest = r;
    }
  }
  return widest >= 0 ? widest : 0;
}

/* sheet with the most recognizable columns → default pick */
export function pickBestSheet(book) {
  let best = 0;
  let bestCount = -1;
  book.SheetNames.forEach((name, i) => {
    try {
      const rows = XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1, defval: "" });
      const hr = detectHeaderRow(rows);
      const count = (rows[hr] || []).filter((c) => classifyHeader(c)).length;
      if (count > bestCount) {
        bestCount = count;
        best = i;
      }
    } catch {
      /* unreadable sheet — skip */
    }
  });
  return best;
}

export const TEMPLATE_HEADERS = [
  "លេខកូដ (Student ID)",
  "ឈ្មោះខ្មែរ (Khmer Name)",
  "ឈ្មោះអង់គ្លេស (English Name)",
  "ភេទ (Gender)",
  "ថ្ងៃខែឆ្នាំកំណើត (Date of Birth)",
  "អ៊ីមែល (Email)",
  "លេខទូរស័ព្ទ (Phone)",
  "ទីកន្លែងកំណើត (Place of Birth)",
  "ឈ្មោះឪពុក (Father's Name)",
  "ឈ្មោះម្តាយ (Mother's Name)",
  "អាសយដ្ឋាន (Address)",
  "ថ្នាក់ (Class)",
  "Username",
  "ឆ្នាំចូល (Enrollment Year)",
  "ស្ថានភាព (Status)",
];

export const TEMPLATE_SAMPLE = [
  "NTTI-2026-0001",
  "ជាប ចនារា",
  "Chab Channara",
  "Male",
  "2005-06-14",
  "chab.channara@ntti.edu.kh",
  "+855 12 345 678",
  "Takeo",
  "Chab Sopheak",
  "Sok Chanthy",
  "Phnom Penh",
  "IT01A",
  "chab.channara",
  2026,
  "Learning",
];

/**
 * Turn one parsed file row (cells array) into a student payload.
 * `roles` = { [colIdx]: roleKey | null }, `classes` = existing classes,
 * `existing` = current students (for duplicate checks), `defaultClassId` and
 * `defaultYear` fill in gaps. Returns null when the row has no name.
 */
export function rowToStudent(row, roles, { classes = [], existing = [], defaultClassId = "", defaultYear = 2026, seq = { v: 1 } } = {}) {
  const roleIdx = {};
  (roles || []).forEach((r, i) => {
    if (!r) return;
    (roleIdx[r] = roleIdx[r] || []).push(i);
  });
  const get = (key, preferLast = false) => {
    const idxs = roleIdx[key] || [];
    if (!idxs.length) return "";
    if (preferLast) {
      for (let i = idxs.length - 1; i >= 0; i--) {
        const v = collapse(row[idxs[i]]);
        if (v) return v;
      }
      return "";
    }
    for (const i of idxs) {
      const v = collapse(row[i]);
      if (v) return v;
    }
    return "";
  };

  const sid = get("sid", true);
  const kh = cleanName(get("khmer"));
  const latin = cleanName(get("latin"));
  let firstName = cleanName(get("first"));
  let lastName = cleanName(get("last"));
  if (!firstName && !lastName && latin) {
    const sp = splitLatin(latin);
    firstName = sp.firstName;
    lastName = sp.lastName;
  }
  if (!kh && !firstName && !lastName && !latin) return null; // probably a label row

  const email = get("email");
  const fullLatin = norm(`${firstName || ""} ${lastName || ""}`).trim();
  const dup = (() => {
    if (!existing.length) return false;
    if (sid && existing.some((s) => collapse(s.studentId).toLowerCase() === norm(sid))) return true;
    if (email && existing.some((s) => collapse(s.email).toLowerCase() === norm(email))) return true;
    if (kh && existing.some((s) => collapse(s.khmerName).toLowerCase() === norm(kh))) return true;
    if (fullLatin && existing.some((s) => norm(`${s.firstName} ${s.lastName}`) === fullLatin)) return true;
    return false;
  })();

  return {
    sid,
    kh,
    firstName,
    lastName,
    latin,
    username: get("username"),
    gender: genderOf(get("gender")),
    dob: dobToISO(get("dob")),
    birthPlace: get("birthPlace"),
    email,
    phone: get("phone"),
    fatherName: get("father"),
    motherName: get("mother"),
    address: get("address"),
    classNameRaw: get("class"),
    shift: shiftOf(get("shift")),
    status: statusOf(get("status")),
    year: yearOf(get("year")) || Number(String(sid).match(/NTTI-(\d{4})-/)?.[1] || 0) || defaultYear,
    dup,
  };
}

/** Build the final student payload (add to store) from a parsed row. */
export function buildStudent(p, classes, defaultClassId, defaultYear, usedSids, seq) {
  const cls =
    (p.classNameRaw && classes.find((c) => norm(c.name) === norm(p.classNameRaw))) ||
    (p.classNameRaw && classes.find((c) => norm(c.name).replace(/\s+/g, "") === norm(p.classNameRaw))) ||
    (defaultClassId ? classes.find((c) => c.id === defaultClassId) || null : null) ||
    null;
  const major = cls?.major || MAJORS[0].id;
  const field = cls?.field || FIELDS_OF_STUDY[major]?.[0] || "";
  const shift = cls?.shift || p.shift || SHIFTS[0];
  const year = p.year || defaultYear;

  const sem = String(cls?.semester || "").match(/\d+/)?.[0] || "1";
  const y = String(cls?.year || "").match(/\d+/)?.[0] || "1";
  const lvl = `S${sem}Y${y}`;

  let sid = p.sid;
  if (!sid) {
    do {
      sid = `NTTI-${year}-${String(seq.v++).padStart(4, "0")}`;
    } while (usedSids.has(norm(sid)));
    usedSids.add(norm(sid));
  }

  return {
    studentId: sid,
    khmerName: p.kh || latinToKhmer(`${p.lastName} ${p.firstName}`.trim()),
    firstName: p.firstName || p.kh || "Student",
    lastName: p.lastName || "",
    username: p.username || "",
    photo: "",
    gender: p.gender || "Male",
    dob: p.dob || "",
    birthPlace: p.birthPlace || "",
    email: p.email || "",
    phone: p.phone || "",
    fatherName: p.fatherName || "",
    motherName: p.motherName || "",
    major,
    className: cls?.id || "",
    field,
    shift,
    address: p.address || "",
    status: p.status || "Learning",
    level: cls ? (ACADEMIC_LEVELS.includes(lvl) ? lvl : "S1Y1") : "S1Y1",
    enrollmentYear: year,
    enrollmentDate: `${year}-09-01`,
  };
}