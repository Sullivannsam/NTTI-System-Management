export const MAJORS = [
  { id: "it", name: "IT" },
  { id: "el", name: "Electronic" },
  { id: "arc", name: "Architecture" },
];

export const DEGREES = ["Certificate", "Diploma", "Bachelor", "Master"];
export const SHIFTS = ["Morning", "Evening", "Night"];

/** Standard class-hour ranges per shift (auto-set when a shift is chosen). */
export const SHIFT_TIMES = {
  Morning: { start: "7:30 AM", end: "12:00 PM" },
  Evening: { start: "2:00 PM", end: "5:00 PM" },
  Night: { start: "5:30 PM", end: "8:30 PM" },
};

export const shiftRange = (shift) =>
  SHIFT_TIMES[shift] ? `${SHIFT_TIMES[shift].start} – ${SHIFT_TIMES[shift].end}` : "";
export const YEARS = ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5", "Year 6"];
export const SEMESTERS = ["Semester 1", "Semester 2"];

/** Academic progression: 1 semester = 15 weeks. S<semester>Y<year>. */
export const ACADEMIC_LEVELS = ["S1Y1", "S2Y1", "S1Y2", "S2Y2", "S1Y3", "S2Y3", "S1Y4", "S2Y4", "S1Y5", "S2Y5", "S1Y6", "S2Y6"];

/**
 * Programme length (academic years) per major — edit these to match the real
 * curriculum. Architecture runs 5 years; IT / Electronic run 4. A major that
 * isn't listed falls back to 4 years.
 */
export const PROGRAM_YEARS = { it: 4, el: 4, arc: 5 };
export const programYears = (majorId) => PROGRAM_YEARS[majorId] || 4;
/** The levels a major actually runs through: S1Y1 … S2Y<years>. */
export const levelsForMajor = (majorId) => ACADEMIC_LEVELS.slice(0, programYears(majorId) * 2);
export const maxLevelForMajor = (majorId) => levelsForMajor(majorId).slice(-1)[0] || "S1Y1";

export const levelMeta = (lvl) => ({
  label: lvl,
  year: `Year ${String(lvl || "")[3] || 1}`,
  semester: `Semester ${String(lvl || "")[1] || 1}`,
});

export const nextLevel = (lvl) => {
  const i = ACADEMIC_LEVELS.indexOf(lvl);
  return i >= 0 && i < ACADEMIC_LEVELS.length - 1 ? ACADEMIC_LEVELS[i + 1] : null;
};

/** Fields of study (program types) per major — used when creating a class. */
export const FIELDS_OF_STUDY = {
  it: ["IT General", "Cyber Security", "Graphic Design"],
  el: ["Electrical Engineering", "Mechatronics", "Electronics Repair"],
  arc: ["Architecture Design", "Interior Design", "Urban Planning"],
};

/* Every demo class starts at the very beginning of its programme: Year 1 · Semester 1. */
export const CLASSES = [
  { id: "cyber", name: "IT01A", field: "Cyber Security", major: "it", shift: "Morning", year: "Year 1", semester: "Semester 1", degree: "Diploma" },
  { id: "git", name: "IT02A", field: "IT General", major: "it", shift: "Morning", year: "Year 1", semester: "Semester 1", degree: "Diploma" },
  { id: "gin", name: "IT03A", field: "Graphic Design", major: "it", shift: "Night", year: "Year 1", semester: "Semester 1", degree: "Diploma" },
  { id: "ele", name: "IT04A", field: "Electrical Engineering", major: "el", shift: "Night", year: "Year 1", semester: "Semester 1", degree: "Bachelor" },
  { id: "mec", name: "IT05A", field: "Mechatronics", major: "el", shift: "Night", year: "Year 1", semester: "Semester 1", degree: "Diploma" },
  { id: "rep", name: "IT06A", field: "Electronics Repair", major: "el", shift: "Night", year: "Year 1", semester: "Semester 1", degree: "Certificate" },
  { id: "ads", name: "IT07A", field: "Architecture Design", major: "arc", shift: "Morning", year: "Year 1", semester: "Semester 1", degree: "Bachelor" },
  { id: "int", name: "IT08A", field: "Interior Design", major: "arc", shift: "Night", year: "Year 1", semester: "Semester 1", degree: "Diploma" },
  { id: "urb", name: "IT09A2", field: "Urban Planning", major: "arc", shift: "Night", year: "Year 1", semester: "Semester 1", degree: "Bachelor" },
];

/** Class id that gets a full demo cohort (students + scores) after a reset. */
export const DEMO_CLASS_ID = "cyber";
/** Subjects used by the demo score sheet / schedule (matches Schedule's defaults). */
export const SEED_SUBJECTS = ["Mathematics", "Khmer", "English", "Physics", "Chemistry", "Computer", "Physical Ed"];

export const classesOfMajor = (classes, majorId) => classes.filter((c) => c.major === majorId);

export const majorName = (majorId) => MAJORS.find((m) => m.id === majorId)?.name || majorId;

export const classInfo = (classes, id) => classes.find((c) => c.id === id);

export const AVATAR_COLORS = [
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

const FIRST = [
  "Sokha", "Dara", "Vannak", "Sreypov", "Visal", "Chanthy", "Rathana",
  "Bopha", "Sothea", "Lina", "Raksa", "Meng", "Heng", "Davy", "Narith",
  "Virak", "Kosal", "Pisey", "Sophea", "Chenda", "Mony", "Ry",
];

const LAST = [
  "Phan", "Chea", "Sok", "Kim", "Sam", "Ly", "Tep", "Nop", "Vong", "Heng",
  "Orn", "Kong", "Chhin", "Meas", "Sao", "Yon", "Nut", "Pich", "Eang",
];

/** Khmer transliterations for the seed first names (given names). */
const KHMER_FIRST = {
  Sokha: "សុខា", Dara: "ដារ៉ា", Vannak: "វណ្ណក", Sreypov: "ស្រីពៅ", Visal: "វិសាល",
  Chanthy: "ច័ន្ទធី", Rathana: "រតនា", Bopha: "បុប្ផា", Sothea: "សុធា", Lina: "លីណា",
  Raksa: "រក្សា", Meng: "ម៉េង", Heng: "ហេង", Davy: "ដាវី", Narith: "ណារិទ្ធ",
  Virak: "វីរៈ", Kosal: "កុសល", Pisey: "ប៉ិសី", Sophea: "សុភា", Chenda: "ចេនដា",
  Mony: "មុន្នី", Ry: "រី",
};

/** Khmer transliterations for the seed last names (family names). */
const KHMER_LAST = {
  Phan: "ផាន់", Chea: "ជា", Sok: "សុក", Kim: "គីម", Sam: "សំ", Ly: "លី",
  Tep: "តេប", Nop: "នប", Vong: "វង្ស", Heng: "ហេង", Orn: "អន", Kong: "គង់",
  Chhin: "ឈិន", Meas: "មាស", Sao: "សាវ", Yon: "យន់", Nut: "នុត", Pich: "ពេជ្រ", Eang: "អាំង",
};

/**
 * Best-effort Latin → Khmer transliteration for common Khmer name romanisations.
 * Not a full dictionary — close enough to recognise, and each student's Khmer name
 * can be edited from the student form afterwards.
 */
const KH_DIGRAPHS = [
  ["chh", "ឈ"], ["ch", "ច"], ["ngh", "ង្ហ"], ["kh", "ខ"], ["th", "ថ"], ["ph", "ផ"],
  ["nh", "ញ"], ["ng", "ង"], ["gh", "ឃ"], ["dh", "ឍ"], ["bh", "ភ"], ["jh", "ឈ"],
  ["tr", "ត្រ"], ["dr", "ឌ្រ"], ["pr", "ប្រ"], ["br", "ប្រ"], ["kr", "ក្រ"],
  ["gr", "គ្រ"], ["sr", "ស្រ"], ["kl", "ក្ល"], ["gl", "គ្ល"], ["pl", "ប្ល"],
  ["sl", "ស្ល"], ["fl", "ផ្ល"], ["sw", "ស្វ"], ["tw", "ត្វ"], ["kw", "ក្វ"],
  ["nn", "ន្ន"], ["ll", "ល្ល"], ["mm", "ម្ម"], ["tt", "ត្ត"], ["ss", "ស្ស"],
  ["rr", "រ្រ"], ["kk", "ក្ក"], ["pp", "ប្ប"],
];

const KH_CONSONANTS = {
  b: "ប", c: "ច", d: "ដ", f: "ផ", g: "គ", h: "ហ", j: "ជ", k: "ក", l: "ល",
  m: "ម", n: "ន", p: "ប", q: "ក", r: "រ", s: "ស", t: "ត", v: "វ", w: "វ",
  x: "ស", y: "យ", z: "ហ្ស",
};

const KH_VOWELS = { a: "ា", e: "េ", i: "ិ", o: "ុ", u: "ុ" };

export function latinToKhmer(text) {
  const t = (text || "").toLowerCase().replace(/[^a-z\s]/g, "").trim();
  if (!t) return "";
  let out = "";
  let i = 0;
  while (i < t.length) {
    const c = t[i];
    if (c === " ") {
      out += " ";
      i++;
      continue;
    }
    const chunk = t.slice(i);
    const match = KH_DIGRAPHS.find(([p]) => chunk.startsWith(p));
    if (match) {
      out += match[1];
      i += match[0].length;
      continue;
    }
    if (c === "y" && (i === t.length - 1 || t[i + 1] === " ")) {
      out += "ី"; // long-i word ending (Mony, Rithy…)
      i++;
      continue;
    }
    if (KH_CONSONANTS[c]) {
      out += KH_CONSONANTS[c];
      i++;
      continue;
    }
    if (KH_VOWELS[c]) {
      out += KH_VOWELS[c];
      i++;
      continue;
    }
    i++;
  }
  return out;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return toISO(new Date());
}

export function weekdayLabel(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
  });
}

export function prettyDate(dateStr, opts = {}) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: opts.weekday ? "short" : undefined,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(h, m) {
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

function genStudents() {
  const rng = mulberry32(20260916);
  const students = [];
  const today = todayISO();
  const enrollmentYear = new Date().getFullYear();

  /* One class gets a full demo cohort; every other class gets one student so the
     portal isn't empty. Everyone is at the start of the programme (S1Y1). */
  const plan = CLASSES.flatMap((classDef) =>
    Array.from({ length: classDef.id === DEMO_CLASS_ID ? 12 : 1 }, () => classDef)
  );

  plan.forEach((classDef, idx) => {
    const i = idx; // 0-based
    const firstName = FIRST[Math.floor(rng() * FIRST.length)];
    const lastName = LAST[Math.floor(rng() * LAST.length)];
    const enrolledDaysAgo = 30 + Math.floor(rng() * 90);
    const enrollment = addDays(today, -enrolledDaysAgo);
    const place = ["Phnom Penh", "Kandal", "Sihanoukville", "Battambang", "Siem Reap", "Kampong Cham"][
      Math.floor(rng() * 6)
    ];
    students.push({
      id: i + 1,
      studentId: `NTTI-${enrollmentYear}-${String(i + 1).padStart(4, "0")}`,
      firstName,
      lastName,
      khmerName: `${KHMER_LAST[lastName] || ""} ${KHMER_FIRST[firstName] || ""}`.trim(),
      gender: i % 3 === 0 ? "Female" : "Male",
      dob: `${2000 + Math.floor(rng() * 6)}-${String(1 + Math.floor(rng() * 12)).padStart(2, "0")}-${String(
        1 + Math.floor(rng() * 28)
      ).padStart(2, "0")}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i + 1}@ntti.edu.kh`,
      phone: `+855 1${Math.floor(rng() * 90 + 10)} ${Math.floor(rng() * 900 + 100)} ${Math.floor(rng() * 9000 + 1000)}`,
      guardian: `${LAST[Math.floor(rng() * LAST.length)]} ${FIRST[Math.floor(rng() * FIRST.length)]}`,
      fatherName: `${LAST[Math.floor(rng() * LAST.length)]} ${FIRST[Math.floor(rng() * FIRST.length)]}`,
      motherName: `${LAST[Math.floor(rng() * LAST.length)]} ${FIRST[Math.floor(rng() * FIRST.length)]}`,
      address: place,
      birthPlace: place,
      photo: "",
      major: classDef.major,
      className: classDef.id,
      avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
      enrollmentDate: enrollment,
      enrollmentYear,
      level: "S1Y1",
      history: [],
      status: "Learning",
    });
  });
  return students;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function iso(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function shortMonth(d) {
  return d.toLocaleDateString("en-US", { month: "short" });
}

/** Monday of the week containing dateISO, as ISO date — used as the week key. */
export function weekKeyOf(dateISO) {
  const d = new Date(dateISO + "T00:00:00");
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return iso(m);
}

/** The last n weeks (Monday keys) ending in the current week. */
export function lastNWeeks(n = 15) {
  const curMonday = weekKeyOf(todayISO());
  const c = new Date(curMonday + "T00:00:00");
  return Array.from({ length: n }, (_, i) => {
    const start = new Date(c.getFullYear(), c.getMonth(), c.getDate() - (n - 1 - i) * 7);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return {
      key: iso(start),
      start: iso(start),
      end: iso(end),
      range: `${shortMonth(start)} ${start.getDate()} – ${shortMonth(end)} ${end.getDate()}`,
    };
  });
}

export function genAttendance(students) {
  const rng = mulberry32(884422);
  const records = [];
  const today = todayISO();

  for (const s of students) {
    for (let back = 40; back >= 0; back--) {
      const date = addDays(today, -back);
      const d = new Date(date + "T00:00:00");
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const r = rng();
      let status;
      if (isWeekend) {
        status = r < 0.36 ? "present" : r < 0.4 ? "late" : r < 0.94 ? "absent" : "leave";
      } else {
        status = r < 0.76 ? "present" : r < 0.85 ? "late" : r < 0.92 ? "absent" : "leave";
      }
      const h = 7 + Math.floor(rng() * 2);
      const m = Math.floor(rng() * 60);
      const late = status === "late";
      records.push({
        id: `${s.id}-${date}`,
        studentId: s.id,
        date,
        status,
        checkIn: status === "absent" || status === "leave" ? null : formatTime(late ? h + 1 : h, late ? m : Math.min(m, 25)),
      });
    }
  }
  return records;
}

export const SEED_STUDENTS = genStudents();
export const SEED_ATTENDANCE = genAttendance(SEED_STUDENTS);

function genWeekly(students) {
  const rng = mulberry32(991122);
  const weeks = lastNWeeks(15);
  const records = [];
  for (const s of students) {
    for (const wk of weeks) {
      const r = rng();
      const status = r < 0.68 ? "present" : r < 0.8 ? "late" : r < 0.9 ? "absent" : "leave";
      records.push({ id: `${s.id}-${wk.key}`, studentId: s.id, week: wk.key, status });
    }
  }
  return records;
}

export const SEED_WEEKLY = genWeekly(SEED_STUDENTS);

/** Demo score sheet for the populated class — a deterministic mix of A–F grades. */
function genScores(students) {
  const rng = mulberry32(515151);
  const rows = {};
  students
    .filter((s) => s.className === DEMO_CLASS_ID)
    .forEach((s) => {
      const ability = 55 + rng() * 40; // per-student level, 55–95
      const row = {};
      SEED_SUBJECTS.forEach((sub) => {
        const v = Math.max(35, Math.min(100, ability + (rng() - 0.5) * 22));
        row[sub] = v.toFixed(2);
      });
      rows[s.id] = row;
    });
  return { [DEMO_CLASS_ID]: rows };
}

export const SEED_SCORES = genScores(SEED_STUDENTS);

export const SEED_TEACHERS = ["Teacher 1", "Teacher 2", "Teacher 3", "Teacher 4", "Teacher 5", "Teacher 6", "Teacher 7"];

/** Demo schedule for the populated class so the score sheet has subject columns. */
const demoClass = CLASSES.find((c) => c.id === DEMO_CLASS_ID);
export const SEED_SCHEDULE = {
  activeId: "sched-demo",
  schedules: demoClass
    ? [
        {
          id: "sched-demo",
          className: demoClass.name,
          classId: demoClass.id,
          semester: "1",
          year: "1",
          major: majorName(demoClass.major),
          field: demoClass.field || "",
          studentYear: "2026-2027",
          shift: "morning",
          subjects: [...SEED_SUBJECTS],
          teachers: [...SEED_TEACHERS],
          cells: {},
        },
      ]
    : [],
};

export function computeRate(records) {
  if (!records.length) return 0;
  const attended = records.filter((r) => r.status === "present" || r.status === "late").length;
  return Math.round((attended / records.length) * 100);
}

export function computeRates(students, attendance) {
  return students.map((s) => ({
    ...s,
    rate: computeRate(attendance.filter((a) => a.studentId === s.id)),
  }));
}