export const MAJORS = [
  { id: "it", name: "IT" },
  { id: "el", name: "Electronic" },
  { id: "arc", name: "Architecture" },
];

export const CLASSES = [
  { id: "cyber", name: "Cyber Security", major: "it", shift: "Morning" },
  { id: "git", name: "General IT", major: "it", shift: "Morning" },
  { id: "gin", name: "Graphic Design", major: "it", shift: "Afternoon" },
  { id: "ele", name: "Electrical Engineering", major: "el", shift: "Afternoon" },
  { id: "mec", name: "Mechatronics", major: "el", shift: "Evening" },
  { id: "rep", name: "Electronics Repair", major: "el", shift: "Evening" },
  { id: "ads", name: "Architecture Design", major: "arc", shift: "Morning" },
  { id: "int", name: "Interior Design", major: "arc", shift: "Afternoon" },
  { id: "urb", name: "Urban Planning", major: "arc", shift: "Evening" },
];

export const classesOfMajor = (majorId) => CLASSES.filter((c) => c.major === majorId);

export const majorName = (majorId) => MAJORS.find((m) => m.id === majorId)?.name || majorId;

export const classInfo = (id) => CLASSES.find((c) => c.id === id);

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
    students.push({
      id: i + 1,
      studentId: `NTTI-${2020 + Math.floor((i + 1) / 4)}-${String(i + 1).padStart(4, "0")}`,
      firstName,
      lastName,
      gender: i % 3 === 0 ? "Female" : "Male",
      dob: `${1978 + Math.floor(rng() * 16)}-${String(1 + Math.floor(rng() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rng() * 28)).padStart(2, "0")}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@ntti.edu.kh`,
      phone: `+855 1${Math.floor(rng() * 90 + 10)} ${Math.floor(rng() * 900 + 100)} ${Math.floor(rng() * 9000 + 1000)}`,
      guardian: `${LAST[Math.floor(rng() * LAST.length)]} ${FIRST[Math.floor(rng() * FIRST.length)]}`,
      address: ["Phnom Penh", "Kandal", "Sihanoukville", "Battambang", "Siem Reap", "Kampong Cham"][
        Math.floor(rng() * 6)
      ],
      major: classDef.major,
      className: classDef.id,
      avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
      enrollmentDate: enrollment,
      status: rng() > 0.92 ? "Suspended" : rng() > 0.9 ? "Graduated" : "Active",
    });
  }
  return students;
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