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
export const YEARS = ["Year 1", "Year 2", "Year 3", "Year 4"];
export const SEMESTERS = ["Semester 1", "Semester 2"];

/** Academic progression: 1 semester = 15 weeks. S<semester>Y<year>. */
export const ACADEMIC_LEVELS = ["S1Y1", "S2Y1", "S1Y2", "S2Y2", "S1Y3", "S2Y3", "S1Y4", "S2Y4"];

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

export const CLASSES = [
  { id: "cyber", name: "Cyber Security", field: "Cyber Security", major: "it", shift: "Morning", year: "Year 2", semester: "Semester 2", degree: "Diploma" },
  { id: "git", name: "General IT", field: "IT General", major: "it", shift: "Morning", year: "Year 1", semester: "Semester 1", degree: "Diploma" },
  { id: "gin", name: "Graphic Design", field: "Graphic Design", major: "it", shift: "Evening", year: "Year 2", semester: "Semester 1", degree: "Diploma" },
  { id: "ele", name: "Electrical Engineering", field: "Electrical Engineering", major: "el", shift: "Evening", year: "Year 3", semester: "Semester 2", degree: "Bachelor" },
  { id: "mec", name: "Mechatronics", field: "Mechatronics", major: "el", shift: "Night", year: "Year 2", semester: "Semester 1", degree: "Diploma" },
  { id: "rep", name: "Electronics Repair", field: "Electronics Repair", major: "el", shift: "Night", year: "Year 1", semester: "Semester 2", degree: "Certificate" },
  { id: "ads", name: "Architecture Design", field: "Architecture Design", major: "arc", shift: "Morning", year: "Year 3", semester: "Semester 1", degree: "Bachelor" },
  { id: "int", name: "Interior Design", field: "Interior Design", major: "arc", shift: "Evening", year: "Year 2", semester: "Semester 2", degree: "Diploma" },
  { id: "urb", name: "Urban Planning", field: "Urban Planning", major: "arc", shift: "Night", year: "Year 1", semester: "Semester 1", degree: "Bachelor" },
];

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

  for (let i = 0; i < 18; i++) {
    const firstName = FIRST[Math.floor(rng() * FIRST.length)];
    const lastName = LAST[Math.floor(rng() * LAST.length)];
    const classIdx = i % CLASSES.length;
    const classDef = CLASSES[classIdx];
    const enrolledDaysAgo = 40 + Math.floor(rng() * 500);
    const enrollment = addDays(today, -enrolledDaysAgo);
    const cohort = 2020 + Math.floor((i + 1) / 4);
    const currentYear = Math.min(4, Math.max(1, new Date().getFullYear() - cohort));
    const level = `S1Y${currentYear}`;
    const history = [];
    for (let y = 1; y <= currentYear; y++) {
      for (let sem = 1; sem <= 2; sem++) {
        const lvl = `S${sem}Y${y}`;
        if (lvl === level) continue;
        const semIndexBack = (currentYear - y) * 2 + (2 - sem); // semesters behind the current one
        history.push({
          id: `${i + 1}-${lvl}`,
          level: lvl,
          year: `Year ${y}`,
          semester: `Semester ${sem}`,
          className: classDef.id,
          date: addDays(today, -(semIndexBack + 1) * 105), // ~15 weeks per semester
          result: "Passed",
        });
      }
    }
    students.push({
      id: i + 1,
      studentId: `NTTI-${2020 + Math.floor((i + 1) / 4)}-${String(i + 1).padStart(4, "0")}`,
      firstName,
      lastName,
      khmerName: `${KHMER_LAST[lastName] || ""} ${KHMER_FIRST[firstName] || ""}`.trim(),
      gender: i % 3 === 0 ? "Female" : "Male",
      dob: `${1978 + Math.floor(rng() * 16)}-${String(1 + Math.floor(rng() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rng() * 28)).padStart(2, "0")}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@ntti.edu.kh`,
      phone: `+855 1${Math.floor(rng() * 90 + 10)} ${Math.floor(rng() * 900 + 100)} ${Math.floor(rng() * 9000 + 1000)}`,
      guardian: `${LAST[Math.floor(rng() * LAST.length)]} ${FIRST[Math.floor(rng() * FIRST.length)]}`,
      fatherName: `${LAST[Math.floor(rng() * LAST.length)]} ${FIRST[Math.floor(rng() * FIRST.length)]}`,
      motherName: `${LAST[Math.floor(rng() * LAST.length)]} ${FIRST[Math.floor(rng() * FIRST.length)]}`,
      address: ["Phnom Penh", "Kandal", "Sihanoukville", "Battambang", "Siem Reap", "Kampong Cham"][
        Math.floor(rng() * 6)
      ],
      birthPlace: ["Phnom Penh", "Kandal", "Sihanoukville", "Battambang", "Siem Reap", "Kampong Cham"][
        Math.floor(rng() * 6)
      ],
      photo: "",
      major: classDef.major,
      className: classDef.id,
      avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
      enrollmentDate: enrollment,
      enrollmentYear: cohort,
      level,
      history,
      status: rng() > 0.92 ? "Undergraduate" : rng() > 0.86 ? "Graduate" : "Learning",
    });
  }
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