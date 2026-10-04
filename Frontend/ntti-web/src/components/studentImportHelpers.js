import * as XLSX from "xlsx";
import { MAJORS, SHIFTS, FIELDS_OF_STUDY, ACADEMIC_LEVELS, latinToKhmer } from "../data/seed";

/* ── shared helpers for the Excel student import ─────────────── */

export const collapse = (s) =>
  String(s ?? "")
    .replace(/[\u200c\u200b\u200d\ufeff]/g, "")
    .trim()
    .replace(/\s+/g, " ");
export const norm = (s) => collapse(s).toLowerCase();

/* NTTI Excel sheets often list an unregistered English name as "Student <Khmer name>",
   and they put the same "Student" placeholder — sometimes written in Khmer script
   (សិស្ស / សតុដេនត) — in the Khmer-name column. A placeholder is not a name:
   strip it so the real name (from the English / first / last columns) is used. */
export const cleanName = (s) => {
  const t = collapse(s);
  return t
    .replace(/^(?:student|សិស្ស|សតុដេនត)\s+/i, "")
    .replace(/^(?:student|សិស្ស|សតុដេនត)$/i, "");
};

/* Roll-number column headers — "ល.រ", a lone "\" or quote, "No", "លេខរៀង"…
   Sometimes these leaked into a transcript history as fake subjects (with the
   student's roll number as their score). They are never real subjects, so we
   refuse to import them and strip them out of stored history. */
export const isRollLabel = (s) => {
  const t = collapse(s);
  if (!t) return true;
  if (/^[\s"'\\“”«»\-]+$/.test(t)) return true;
  return /^\s*(no\.?|no|#|roll|number|លេខរៀង|លេខ|ล\.\s*រ|ល\.\s*រ)\s*$/i.test(t);
};

/* name → { firstName, lastName } treating the last token as the family name */
export const splitLatin = (full) => {
  const parts = collapse(full).split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  const lastName = parts[parts.length - 1];
  return { firstName: parts.slice(0, -1).join(" ") || lastName, lastName };
};

/* Excel serial / text / date → yyyy-mm-dd. Also reads the official rosters'
   Khmer dates: Khmer numerals + Khmer month names ("២៧ សីហា ២០០៦"). */
const KHMER_DIGITS = { "០": 0, "១": 1, "២": 2, "៣": 3, "៤": 4, "៥": 5, "៦": 6, "៧": 7, "៨": 8, "៩": 9 };
const KHMER_MONTHS = [
  [/មករា/, 0],
  [/កុម្ភៈ/, 1],
  [/មីនា/, 2],
  [/មេសា/, 3],
  [/ឧសភា/, 4],
  [/មិថុនា/, 5],
  [/កក្កដា/, 6],
  [/សីហា/, 7],
  [/កញ្ញា/, 8],
  [/តុលា/, 9],
  [/វិច្ឆិកា/, 10],
  [/ធ្នូ/, 11],
];
const latinDigitsOf = (s) => String(s).replace(/[០-៩]/g, (d) => KHMER_DIGITS[d]);
export const dobToISO = (v) => {
  const raw = collapse(v);
  if (!raw) return "";
  const s = latinDigitsOf(raw);
  for (const [re, m] of KHMER_MONTHS) {
    const mm = s.match(new RegExp(`^(\\d{1,2})\\s*${re.source}\\s*(\\d{4})\\s*$`, "i"));
    if (mm) {
      return `${mm[2]}-${String(m + 1).padStart(2, "0")}-${String(Number(mm[1])).padStart(2, "0")}`;
    }
  }
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

/* ── student ID scheme ─────────────────────────────────────
   NTTI auto-generates IDs in two formats:
     • IT bachelor  → "27-IT-000001"   (prefix IT)
     • IT associate → "27-ITD-000001"  (prefix ITD, associate degree = Diploma)
   where "27" is the 2-digit academic-year batch (the academic year 2026–27 is
   batch "27", i.e. the ENDING year of the academic year of enrollment, so a
   student enrolling in 2026 gets "27", in 2025 gets "26"…).
   Only IT bachelor/diploma students use the new scheme — every other major
   and every other degree keeps the legacy "NTTI-<year>-<serial>" format. */
export const degreeIs = (degree) => {
  const d = String(degree || "").trim().toLowerCase();
  return {
    bachelor: d === "bachelor" || d === "bachelor degree",
    diploma: d === "diploma" || d === "associate" || d === "associate degree",
  };
};

/** 2-digit academic-year batch code, or null when the year is unknown. */
export const batchCodeOf = (enrollmentYear) => {
  const y = Number(enrollmentYear);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) return null;
  return String((y + 1) % 100).padStart(2, "0");
};

/** "27-IT" / "27-ITD" prefix for an IT bachelor/diploma student, else null
    (meaning the student keeps the legacy NTTI-… id). */
export const itProgramCode = (major, degree, enrollmentYear) => {
  if (String(major || "").toLowerCase() !== "it") return null;
  const d = degreeIs(degree);
  if (!d.bachelor && !d.diploma) return null;
  const batch = batchCodeOf(enrollmentYear);
  if (!batch) return null;
  return `${batch}-${d.bachelor ? "IT" : "ITD"}`;
};

/** Next auto-incrementing student id. `usedIds` must be the set of normalized
    ids already in the store — serials scan it so they stay unique across every
    import/class — and `seq` is the shared legacy counter (used only by the
    NTTI-… fallback). Adds the generated id to `usedIds`. */
export function nextStudentId({ major, degree, year, usedIds, seq }) {
  const code = itProgramCode(major, degree, year);
  if (code) {
    let serial = 1;
    let sid;
    do {
      sid = `${code}-${String(serial++).padStart(6, "0")}`;
    } while (usedIds.has(norm(sid)));
    usedIds.add(norm(sid));
    return sid;
  }
  let sid;
  do {
    sid = `NTTI-${year}-${String(seq.v++).padStart(4, "0")}`;
  } while (usedIds.has(norm(sid)));
  usedIds.add(norm(sid));
  return sid;
}

/* column roles a file column can play */
export const ROLES = [
  { key: "sid", label: "Student ID", ex: "27-IT-000001 (bachelor) · 27-ITD-000001 (associate)" },
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
  if (re("student\\s*id|student\\s*code|លេខកូដ|ល។កូដ|ល\\.កូដ|អត្តលេខ|លេខសម្គាល់|nº|n°|^\\s*(no\\.?|no|#|code|id|roll|ref|stt|seq)\\s*$")) return "sid";
  if (re("username|user\\s*name|ឈ្មោះអ្នកប្រើ|អ្នកប្រើប្រាស់")) return "username";
  if (re("គោត្តនាម-នាម|គោត្តនាម.*នាម|នាម.*គោត្តនាម")) return "khmer"; // official rosters: full Khmer name
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
  if (re("latin|ឡាតាំង|អក្សរឡាតាំង|english|full\\s*name|ឈ្មោះអង់គ្លេស|ឈ្មោះឡាតាំង")) return "latin";
  if (re("ឈ្មោះ|name")) return "latin"; // plain "name" / "ឈ្មោះ" → English name
  return null;
}

/* first row that carries a recognisable identity column — the real header
   row is the one with the MOST recognised columns, not merely the first row
   with any match: official rosters often put metadata lines above it (e.g.
   "…វេនយប់" matches the Shift column, title lines match "ឆ្នាំសិក្សា"…) */
export function detectHeaderRow(rows) {
  let best = -1;
  let bestScore = -1;
  let widest = -1;
  let widestCells = 0;
  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const cells = (rows[r] || []).filter((c) => c != null && collapse(c) !== "");
    if (cells.length < 2) continue;
    const score = cells.filter((c) => classifyHeader(c)).length;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
    if (cells.length > widestCells) {
      widestCells = cells.length;
      widest = r;
    }
  }
  return bestScore >= 2 ? best : widest >= 0 ? widest : 0;
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
  "27-IT-000001",
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
  let kh = cleanName(get("khmer"));
  let latin = cleanName(get("latin"));
  // Strip leading numbers from Khmer/Latin names (like "01 គង់ ណៃសៀង" or "01 KUNG NAISIENG")
  if (kh) {
    kh = kh.replace(/^\s*\d+\s+/, "").replace(/^\s*\d+[-_\s]+/, "");
  }
  if (latin) {
    latin = latin.replace(/^\s*\d+\s+/, "").replace(/^\s*\d+[-_\s]+/, "");
  }
  let firstName = cleanName(get("first"));
  let lastName = cleanName(get("last"));
  if (firstName) {
    firstName = firstName.replace(/^\s*\d+\s+/, "").replace(/^\s*\d+[-_\s]+/, "");
  }
  if (lastName) {
    lastName = lastName.replace(/^\s*\d+\s+/, "").replace(/^\s*\d+[-_\s]+/, "");
  }
  const latinRaw = latin;
  if (!firstName && !lastName && latinRaw) {
    const sp = splitLatin(latinRaw);
    firstName = sp.firstName;
    lastName = sp.lastName;
  }
  /* Junk safeguard: rows whose "name" is only digits / punctuation (e.g. a
     stray row number, leftover count cell or merged label in the sheet) are
     not real students — drop them just like rows with no name at all. A real
     name always contains at least one Latin or Khmer letter. */
  const hasLetter = (s) => /[A-Za-z\u1780-\u17FF]/.test(collapse(s));
  if (!kh && !firstName && !lastName && !latin) return null; // probably a label row
  if (![kh, firstName, lastName, latin].some(hasLetter)) return null; // numbers only

  const email = get("email");
  const fullLatin = norm(`${firstName || ""} ${lastName || ""}`).trim();
  /* First existing student that matches this row (by ID / email / Khmer name /
     full latin name). The modal uses this to decide whether a row is a real
     duplicate, or an existing registry student that should be linked into a
     class instead of re-created. */
  const existingMatch = (() => {
    if (!existing.length) return null;
    if (sid) {
      const m = existing.find((s) => norm(collapse(s.studentId)) === norm(sid));
      if (m) return m;
    }
    if (email) {
      const m = existing.find((s) => norm(collapse(s.email)) === norm(email));
      if (m) return m;
    }
    if (kh) {
      const m = existing.find((s) => norm(collapse(s.khmerName)) === norm(kh));
      if (m) return m;
    }
    if (fullLatin) {
      const m = existing.find((s) => norm(`${s.firstName} ${s.lastName}`) === fullLatin);
      if (m) return m;
    }
    return null;
  })();
  const dup = !!existingMatch;

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
    existingId: existingMatch?.id || "",
  };
}

/** Build the final student payload (add to store) from a parsed row. */
export function buildStudent(p, classes, defaultClassId, defaultYear, usedSids, seq, lockedClass) {
  /* Class import: lockedClass forces every row into that class, ignoring any
     "Class" column in the file. Accepts a class object or its id. */
  const locked =
    (lockedClass &&
      (typeof lockedClass === "object" ? lockedClass : classes.find((c) => c.id === lockedClass))) ||
    null;
  const cls =
    locked ||
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
    sid = nextStudentId({ major, degree: cls?.degree, year, usedIds: usedSids, seq });
  }

  return {
    studentId: sid,
    khmerName: p.kh || "",
    firstName: p.firstName || "",
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