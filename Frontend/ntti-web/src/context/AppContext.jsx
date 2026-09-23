import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { SEED_STUDENTS, SEED_ATTENDANCE, SEED_WEEKLY, SEED_SCORES, SEED_SCHEDULE, CLASSES, ACADEMIC_LEVELS, levelMeta, todayISO, latinToKhmer, FIELDS_OF_STUDY, levelsForMajor } from "../data/seed";

const AppContext = createContext(null);

const LS_STUDENTS = "ntti.students.v2";
const LS_ATTENDANCE = "ntti.attendance.v2";
const LS_CLASSES = "ntti.classes.v1";
const LS_WEEKLY = "ntti.weekly.v1";
const LS_THEME = "ntti.theme";
const LS_ADMINS = "ntti.admins.v1";
const LS_AUDIT = "ntti.audit.v1";
const LS_LASTIP = "ntti.lastip.v1";
const LS_AUTH = "ntti.auth";
const LS_SCORES = "ntti.scores.v1";
const LS_SCHED = "ntti.schedule.v2";
const LS_SEL = "ntti.scores.selected.v1";
const LS_BB = "ntti.billboard.selected.v1";
const LS_SEED = "ntti.seed.v1";

/**
 * One-time demo reset. Bump SEED_VERSION to wipe the academic data (students,
 * classes, attendance, weekly, scores, schedule) and re-seed it from seed.js —
 * every class back at Year 1 · Semester 1, with one class holding a full cohort
 * and a filled score sheet. Admin accounts, audit log, theme and login session
 * are intentionally left untouched.
 */
const SEED_VERSION = "demo-y1s1-2026-09-19";
function applyDemoReset() {
  try {
    if (localStorage.getItem(LS_SEED) === SEED_VERSION) return;
    [LS_STUDENTS, LS_ATTENDANCE, LS_CLASSES, LS_WEEKLY, LS_SCORES, LS_SCHED, LS_SEL, LS_BB].forEach((k) =>
      localStorage.removeItem(k)
    );
    localStorage.setItem(LS_SCORES, JSON.stringify(SEED_SCORES));
    localStorage.setItem(LS_SCHED, JSON.stringify(SEED_SCHEDULE));
    localStorage.setItem(LS_SEED, SEED_VERSION);
  } catch {
    /* ignore */
  }
}
applyDemoReset();

/* ── admin accounts ─────────────────────────────────────── */
const SEED_ADMINS = [
  {
    id: "adm-1",
    username: "admin",
    password: "admin123",
    name: "System Admin",
    email: "admin@ntti.edu.kh",
    role: "admin",
    status: "active",
    createdAt: "2024-01-01T00:00:00.000Z",
  },
];

function loadAdmins() {
  try {
    const raw = localStorage.getItem(LS_ADMINS);
    const list = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(list) || list.length === 0) return SEED_ADMINS;
    // never allow a lockout: if no active admin exists, restore the seed account
    if (!list.some((a) => a.status === "active")) return [...list, SEED_ADMINS[0]];
    return list;
  } catch {
    return SEED_ADMINS;
  }
}

function loadAudit() {
  try {
    const raw = localStorage.getItem(LS_AUDIT);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(LS_AUTH);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/* ── client IP (best-effort; real IP requires a backend) ─── */
let cachedIp = "";
try {
  cachedIp = localStorage.getItem(LS_LASTIP) || "";
} catch {
  cachedIp = "";
}

function ipNow() {
  return cachedIp || "unknown";
}

async function refreshIP() {
  if (cachedIp) return cachedIp;
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch("https://api.ipify.org?format=json", { signal: ctrl.signal });
    clearTimeout(to);
    const j = await res.json();
    if (typeof j.ip === "string" && j.ip) {
      cachedIp = j.ip;
      try {
        localStorage.setItem(LS_LASTIP, cachedIp);
      } catch {
        /* ignore */
      }
    }
    return ipNow();
  } catch {
    return ipNow();
  }
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** Migrate stored students: lifecycle statuses, enrollment year, academic level + history. */
function loadStudents() {
  const stored = localStorage.getItem(LS_STUDENTS);
  // NTTI Excel exports often store unmapped English names as "Student <Khmer name>".
  const clean = (name) => String(name ?? "").trim().replace(/^student\s+/i, "");
  if (!stored) return SEED_STUDENTS;
  try {
    return JSON.parse(stored).map((s) => {
      const year =
        s.enrollmentYear ||
        (s.enrollmentDate ? Number(String(s.enrollmentDate).slice(0, 4)) : 0) ||
        Number(String(s.studentId || "").match(/NTTI-(\d{4})-/)?.[1] || 0);
      const firstName = /^student$/i.test(String(s.firstName ?? "").trim()) ? "" : clean(s.firstName);
      return {
        ...s,
        firstName,
        lastName: clean(s.lastName),
        khmerName:
          clean(s.khmerName) ||
          (firstName && s.lastName ? latinToKhmer(`${clean(s.lastName)} ${firstName}`) : ""),
        level: s.level || (year ? `S1Y${Math.min(4, Math.max(1, new Date().getFullYear() - year))}` : "S1Y1"),
        history: s.history || [],
        status:
          s.status === "Active"
            ? "Learning"
            : s.status === "Graduated"
            ? "Graduate"
            : s.status === "Suspended"
            ? "Undergraduate"
            : s.status,
        enrollmentYear: year,
      };
    });
  } catch {
    return SEED_STUDENTS;
  }
}

/**
 * Class renames: legacy descriptive seed names → IT-style codes (e.g. IT01A, IT09B1).
 * Keyed by the stable seed id so only the original seed classes are touched —
 * classes the user created themselves (cls-* ids, IT09A1/IT09B1/IT09B2) are never renamed,
 * and a class the user renames afterwards is left alone.
 */
const CLASS_IT_CODES = {
  cyber: { name: "IT01A", field: "Cyber Security", major: "it", shift: "Morning", year: "Year 2", semester: "Semester 2", degree: "Diploma" },
  git: { name: "IT02A", field: "IT General", major: "it", shift: "Morning", year: "Year 1", semester: "Semester 1", degree: "Diploma" },
  gin: { name: "IT03A", field: "Graphic Design", major: "it", shift: "Night", year: "Year 2", semester: "Semester 1", degree: "Diploma" },
  ele: { name: "IT04A", field: "Electrical Engineering", major: "el", shift: "Night", year: "Year 3", semester: "Semester 2", degree: "Bachelor" },
  mec: { name: "IT05A", field: "Mechatronics", major: "el", shift: "Night", year: "Year 2", semester: "Semester 1", degree: "Diploma" },
  rep: { name: "IT06A", field: "Electronics Repair", major: "el", shift: "Night", year: "Year 1", semester: "Semester 2", degree: "Certificate" },
  ads: { name: "IT07A", field: "Architecture Design", major: "arc", shift: "Morning", year: "Year 3", semester: "Semester 1", degree: "Bachelor" },
  int: { name: "IT08A", field: "Interior Design", major: "arc", shift: "Night", year: "Year 2", semester: "Semester 2", degree: "Diploma" },
  urb: { name: "IT09A2", field: "Urban Planning", major: "arc", shift: "Night", year: "Year 1", semester: "Semester 1", degree: "Bachelor" },
};

const LEGACY_CLASS_NAMES = {
  cyber: "Cyber Security",
  git: "General IT",
  gin: "Graphic Design",
  ele: "Electrical Engineering",
  mec: "Mechatronics",
  rep: "Electronics Repair",
  ads: "Architecture Design",
  int: "Interior Design",
  urb: "Urban Planning",
};

/** Load classes: rename legacy seed classes to IT codes, backfill info, fix shift vocab. */
function loadClasses() {
  const stored = localStorage.getItem(LS_CLASSES);
  if (!stored) return CLASSES;
  try {
    return JSON.parse(stored).map((c) => {
      const patch = CLASS_IT_CODES[c.id];
      const stillLegacy = patch && LEGACY_CLASS_NAMES[c.id] && c.name === LEGACY_CLASS_NAMES[c.id];
      return {
        ...c,
        name: stillLegacy ? patch.name : c.name,
        field: c.field || patch?.field || "",
        major: c.major || patch?.major || "it",
        shift: c.shift === "Afternoon" ? "Evening" : c.shift === "Evening" ? "Night" : c.shift || patch?.shift || "Morning",
        year: c.year || patch?.year || "Year 1",
        semester: c.semester || patch?.semester || "Semester 1",
        degree: c.degree || patch?.degree || "Diploma",
      };
    });
  } catch {
    return CLASSES;
  }
}

function readLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** Academic level of a class, derived from its "Semester n" / "Year n" labels. */
function classLevelOf(cls) {
  const sem = String(cls?.semester || "").match(/\d+/)?.[0] || "1";
  const year = String(cls?.year || "").match(/\d+/)?.[0] || "1";
  const lvl = `S${sem}Y${year}`;
  return ACADEMIC_LEVELS.includes(lvl) ? lvl : "S1Y1";
}

/** Find the schedule entry bound to a class (by id, falling back to name). */
function scheduleForClass(schedules, cls) {
  return (
    schedules.find((s) => s.classId && s.classId === cls.id) ||
    schedules.find((s) => !s.classId && (s.className === cls.id || s.className === cls.name)) ||
    null
  );
}

const gradeLetter = (avg) =>
  avg == null ? "" : avg >= 90 ? "A" : avg >= 80 ? "B" : avg >= 70 ? "C" : avg >= 60 ? "D" : "F";

let toastId = 0;

export function AppProvider({ children }) {
  const [students, setStudents] = useState(loadStudents);
  const [attendance, setAttendance] = useState(() => load(LS_ATTENDANCE, SEED_ATTENDANCE));
  const [classes, setClasses] = useState(loadClasses);
  const [weekly, setWeekly] = useState(() => load(LS_WEEKLY, SEED_WEEKLY));
  const [toasts, setToasts] = useState([]);
  const [theme, setTheme] = useState(() => load(LS_THEME, "light"));
  const [admins, setAdmins] = useState(loadAdmins);
  const [audit, setAudit] = useState(loadAudit);
  const [session, setSession] = useState(loadSession);

  useEffect(() => {
    localStorage.setItem(LS_STUDENTS, JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem(LS_ATTENDANCE, JSON.stringify(attendance));
  }, [attendance]);

  /* One-time repair: classes rolled over before attendance was cleared at
     "Next semester" still keep their previous terms' day records in the live
     store, so the new term looks un-reset. Drop every roster day up to the
     class's latest term end — those days are already in the term archive. */
  const attendanceRepaired = useRef(false);
  useEffect(() => {
    if (attendanceRepaired.current) return;
    attendanceRepaired.current = true;
    const cutoffByStudent = {};
    students.forEach((s) => {
      if (!s.className) return;
      const cls = classes.find((c) => c.id === s.className);
      const last = (cls?.terms || []).reduce((m, t) => (t.endedOn && t.endedOn > m ? t.endedOn : m), "");
      if (last) cutoffByStudent[s.id] = last;
    });
    if (!Object.keys(cutoffByStudent).length) return;
    setAttendance((prev) =>
      prev.filter(
        (a) => !(a.date && cutoffByStudent[a.studentId] && a.date <= cutoffByStudent[a.studentId])
      )
    );
  }, [classes, students]);

  /* One-time repair: students must follow their class. An earlier build let the
     profile's per-student "Pass exam" run a student ahead of their class and even
     graduate them alone. For any class that hasn't finished the programme, pull
     its students back to the class level, restore a non-graduate status, and drop
     history passes the class never actually did. */
  const studentsRepaired = useRef(false);
  useEffect(() => {
    if (studentsRepaired.current) return;
    studentsRepaired.current = true;
    setStudents((prev) => {
      let changed = false;
      const next = prev.map((s) => {
        if (!s.className) return s;
        const cls = classes.find((c) => c.id === s.className);
        if (!cls) return s;
        const classLevel = classLevelOf(cls);
        if (cls.completed) {
          if (s.status === "Graduate" && s.level === classLevel) return s;
          changed = true;
          return { ...s, level: classLevel, status: "Graduate" };
        }
        const finishedLevels = new Set((cls.terms || []).map((t) => t.level));
        const history = (s.history || []).filter((h) => finishedLevels.has(h.level));
        const needsLevel = s.level !== classLevel;
        const needsStatus = s.status === "Graduate";
        const needsHistory = history.length !== (s.history || []).length;
        if (!needsLevel && !needsStatus && !needsHistory) return s;
        changed = true;
        return {
          ...s,
          level: classLevel,
          status: needsStatus ? "Learning" : s.status,
          history,
        };
      });
      return changed ? next : prev;
    });
  }, [classes]);

  useEffect(() => {
    localStorage.setItem(LS_CLASSES, JSON.stringify(classes));
  }, [classes]);

  /* keep every student's major / field / shift aligned with their class —
     the class is the source of truth, so adding a student or editing the
     class both leave them consistent. */
  useEffect(() => {
    setStudents((prev) => {
      let changed = false;
      const next = prev.map((s) => {
        const c = classes.find((x) => x.id === s.className);
        if (!c) return s;
        const field = c.field || FIELDS_OF_STUDY[c.major]?.[0] || "";
        if (s.major === c.major && s.field === field && s.shift === c.shift) return s;
        changed = true;
        return { ...s, major: c.major, field, shift: c.shift };
      });
      return changed ? next : prev;
    });
  }, [classes]);

  useEffect(() => {
    localStorage.setItem(LS_WEEKLY, JSON.stringify(weekly));
  }, [weekly]);

  useEffect(() => {
    localStorage.setItem(LS_ADMINS, JSON.stringify(admins));
  }, [admins]);

  useEffect(() => {
    localStorage.setItem(LS_AUDIT, JSON.stringify(audit));
  }, [audit]);

  useEffect(() => {
    localStorage.setItem(LS_THEME, theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === "light" ? "dark" : "light")),
    []
  );

  const showToast = useCallback((message, type = "success") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  /* ── admin session + audit trail ───────────────────────── */
  const currentAdmin = useMemo(() => {
    if (!session) return null;
    return admins.find((a) => a.id === session.adminId) || session;
  }, [session, admins]);

  /** Append an audit entry (auto-tags acting admin + client IP). */
  const logAudit = useCallback(
    (action, detail = "", extra = {}) => {
      const who = session && (admins.find((a) => a.id === session.adminId) || session);
      const entry = {
        id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        ts: new Date().toISOString(),
        adminId: who?.id || "system",
        adminName: who?.name || who?.username || "System",
        ip: extra.ip || ipNow(),
        action,
        detail: detail || "",
        ...extra,
      };
      setAudit((prev) => [...prev, entry].slice(-400));
    },
    [session, admins]
  );

  /** Validate credentials. Enables IP resolution (public IP via ipify, cached). */
  const login = useCallback(
    async (username, password) => {
      const ip = await refreshIP();
      const target = admins.find((a) => a.username.toLowerCase() === username.trim().toLowerCase());
      if (!target) {
        logAudit("login_failed", `Unknown user "${username.trim()}" tried to sign in`, { ip, adminName: username.trim() || "Unknown" });
        return { ok: false, reason: "unknown", ip };
      }
      if (target.status !== "active") {
        logAudit("login_failed", `Suspended account "${target.username}" tried to sign in`, { ip, adminId: target.id, adminName: target.name });
        return { ok: false, reason: "suspended", ip };
      }
      if ((target.password || "") !== password) {
        logAudit("login_failed", `Wrong password for "${target.username}"`, { ip, adminId: target.id, adminName: target.name });
        return { ok: false, reason: "password", ip };
      }
      const now = new Date().toISOString();
      const newIp = !target.lastIp || target.lastIp !== ip;
      const sess = {
        adminId: target.id,
        username: target.username,
        name: target.name,
        email: target.email,
        role: target.role,
        loginAt: now,
        ip,
      };
      localStorage.setItem(LS_AUTH, JSON.stringify(sess));
      setSession(sess);
      setAdmins((prev) => prev.map((a) => (a.id === target.id ? { ...a, lastLogin: now, lastIp: ip } : a)));
      logAudit("login", `Signed in from ${ip}`, { ip, newIp: !!newIp, adminId: target.id, adminName: target.name });
      return { ok: true, ip, newIp: !!newIp };
    },
    [admins, logAudit]
  );

  const logout = useCallback(() => {
    logAudit("logout", "Signed out");
    localStorage.removeItem(LS_AUTH);
    setSession(null);
  }, [logAudit]);

  const addAdmin = useCallback(
    (data) => {
      setAdmins((prev) => [
        ...prev,
        { id: `adm-${Date.now().toString(36)}${Math.floor(Math.random() * 90 + 10)}`, createdAt: new Date().toISOString(), ...data },
      ]);
      logAudit("create_admin", `Added admin "${data.username}"`);
    },
    [logAudit]
  );

  const updateAdmin = useCallback(
    (id, data) => {
      const prev = admins.find((a) => a.id === id);
      setAdmins((prevAdmins) => prevAdmins.map((a) => (a.id === id ? { ...a, ...data } : a)));
      const bits = [];
      if (data.password) bits.push("reset password");
      if (data.status && data.status !== prev?.status) bits.push(`status → ${data.status}`);
      if (data.role && data.role !== prev?.role) bits.push(`role → ${data.role}`);
      logAudit("update_admin", `Updated admin "${data.username || prev?.username || id}"${bits.length ? " (" + bits.join(", ") + ")" : ""}`);
    },
    [admins, logAudit]
  );

  const deleteAdmin = useCallback(
    (id) => {
      const target = admins.find((a) => a.id === id);
      if (!target) return false;
      const remainingActive = admins.filter((a) => a.id !== id && a.status === "active").length;
      if (remainingActive < 1) return false;
      setAdmins((prev) => prev.filter((a) => a.id !== id));
      logAudit("delete_admin", `Removed admin "${target.username}"`);
      return true;
    },
    [admins, logAudit]
  );

  const addStudent = useCallback(
    (data) => {
      setStudents((prev) => [
        {
          id: Math.max(0, ...prev.map((s) => s.id)) + 1,
          ...data,
        },
        ...prev,
      ]);
      logAudit("create_student", `Added student "${data.firstName} ${data.lastName}"${data.className ? ` to ${data.className}` : ""}`);
    },
    [logAudit]
  );

  /** Bulk-create students from the Excel import — one audit entry for the whole batch. */
  const addStudentsBatch = useCallback(
    (dataList) => {
      if (!dataList || !dataList.length) return 0;
      setStudents((prev) => {
        let maxId = Math.max(0, ...prev.map((s) => s.id));
        const next = dataList.map((d) => ({ id: ++maxId, ...d }));
        return [...next, ...prev];
      });
      logAudit(
        "import_students_excel",
        `Imported ${dataList.length} student${dataList.length === 1 ? "" : "s"} from Excel`
      );
      return dataList.length;
    },
    [logAudit]
  );

  const updateStudent = useCallback(
    (id, data) => {
      setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
      logAudit("update_student", `Updated student "${data.firstName} ${data.lastName}"`);
    },
    [logAudit]
  );

  const deleteStudent = useCallback(
    (id) => {
      const target = students.find((s) => s.id === id);
      setStudents((prev) => prev.filter((s) => s.id !== id));
      setAttendance((prev) => prev.filter((a) => a.studentId !== id));
      setWeekly((prev) => prev.filter((r) => r.studentId !== id));
      logAudit("delete_student", target ? `Deleted student "${target.firstName} ${target.lastName}"` : `Deleted student #${id}`);
    },
    [students, logAudit]
  );

  /* move students into a class — the class is the source of truth, so the
     imported students take its level, major, field and shift. */
  const importStudents = useCallback(
    (classId, ids) => {
      const cls = classes.find((c) => c.id === classId);
      if (!cls || !ids || !ids.length) return 0;
      const idSet = new Set(ids);
      const level = classLevelOf(cls);
      const field = cls.field || FIELDS_OF_STUDY[cls.major]?.[0] || "";
      setStudents((prev) =>
        prev.map((s) =>
          idSet.has(s.id)
            ? {
                ...s,
                className: cls.id,
                level,
                major: cls.major,
                field,
                shift: cls.shift,
                status: "Learning",
              }
            : s
        )
      );
      logAudit(
        "import_students",
        `Imported ${ids.length} student${ids.length === 1 ? "" : "s"} into ${cls.name} (${level})`
      );
      return ids.length;
    },
    [classes, logAudit]
  );

  /**
   * Take a student out of a class WITHOUT deleting them. Their archived term
   * record stays (so past semesters still show them), and they are left at the
   * class's previous level with no class, so they show up again in the import
   * list ("Import from <previous level>") and can be added back.
   */
  const removeFromClass = useCallback(
    (classId, studentId) => {
      const cls = classes.find((c) => c.id === classId);
      if (!cls) return null;
      const levels = levelsForMajor(cls.major);
      const classLevel = classLevelOf(cls);
      const ci = levels.indexOf(classLevel);
      const back = ci > 0 ? levels[ci - 1] : classLevel;
      const target = students.find((s) => s.id === studentId);
      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentId
            ? {
                ...s,
                className: "",
                level: s.level === classLevel ? back : s.level,
                status: s.status === "Graduate" ? s.status : "Undergraduate",
              }
            : s
        )
      );
      logAudit(
        "remove_from_class",
        `Removed ${target ? `"${target.firstName} ${target.lastName}"` : `#${studentId}`} from ${cls.name} — kept at ${back} so they can be imported again`
      );
      showToast(`${target ? `${target.firstName} ${target.lastName}` : "Student"} removed from ${cls.name}`);
      return back;
    },
    [classes, students, logAudit, showToast]
  );

  const saveAttendance = useCallback(
    (records) => {
      setAttendance((prev) => {
        const map = new Map(prev.map((r) => [r.id, r]));
        for (const r of records) {
          if (r.status) map.set(r.id, r);
          else map.delete(r.id);
        }
        return Array.from(map.values());
      });
      const saved = records.filter((r) => r.status).length;
      const cleared = records.length - saved;
      logAudit(
        "save_daily_attendance",
        `Saved ${saved} daily attendance record${saved === 1 ? "" : "s"}${cleared ? `, cleared ${cleared}` : ""}`
      );
    },
    [logAudit]
  );

  const addClass = useCallback(
    (data) => {
      setClasses((prev) => [
        {
          id: `cls-${Date.now().toString(36)}${Math.floor(Math.random() * 90 + 10)}`,
          ...data,
        },
        ...prev,
      ]);
      logAudit("create_class", `Created class "${data.name}"`);
    },
    [logAudit]
  );

  /** Upsert weekly attendance records: [{ week, studentId, status }]; status "" removes the record. */
  const saveWeekly = useCallback(
    (records) => {
      setWeekly((prev) => {
        const next = prev.filter(
          (r) => !records.some((n) => n.week === r.week && n.studentId === r.studentId)
        );
        records.forEach((n) => {
          if (n.status) next.push({ id: `${n.studentId}-${n.week}`, week: n.week, studentId: n.studentId, status: n.status });
        });
        return next;
      });
      const saved = records.filter((n) => n.status).length;
      logAudit("save_weekly_attendance", `Saved ${saved} weekly attendance record${saved === 1 ? "" : "s"}`);
    },
    [logAudit]
  );

  const updateClass = useCallback(
    (id, data) => {
      const target = classes.find((c) => c.id === id);
      setClasses((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
      if (target && data.name && data.name.trim() && data.name !== target.name) {
        logAudit("rename_class", `Renamed class "${target.name}" → "${data.name}"`);
      } else if (target) {
        logAudit("update_class", `Updated class "${data.name || target.name}"`);
      }
    },
    [classes, logAudit]
  );

  /**
   * End the current semester for a whole class (e.g. S1Y1 → S2Y1):
   *  1. archive the class term (schedule subjects/timetable + ranked scores),
   *  2. advance the class to the next level (schedule follows via the class link),
   *  3. clear the live class scores and blank the schedule for the new term,
   *  4. advance every active student and archive their finished term.
   */
  const endClassTerm = useCallback(
    (classId, opts = {}) => {
      const cls = classes.find((c) => c.id === classId);
      if (!cls) return null;
      const endedOn = opts.date || todayISO();
      const curLevel = classLevelOf(cls);
      const classLevels = levelsForMajor(cls.major);
      const ci = classLevels.indexOf(curLevel);
      const next = ci >= 0 && ci < classLevels.length - 1 ? classLevels[ci + 1] : null;
      const meta = levelMeta(curLevel);

      const schedRaw = readLS(LS_SCHED, { schedules: [], activeId: null });
      const schedList = Array.isArray(schedRaw?.schedules) ? schedRaw.schedules : [];
      const sched = scheduleForClass(schedList, cls);
      const subjects = sched ? (sched.subjects || []).filter(Boolean) : [];
      const teachers = sched ? sched.teachers || [] : [];

      const allScores = readLS(LS_SCORES, {});
      const classScores = allScores[classId] || {};

      // attendance window for this term: records after the previous term ended,
      // up to the rollover date (daily attendance records).
      const termStart = (cls.terms || []).reduce((m, t) => (t.endedOn && t.endedOn > m ? t.endedOn : m), "");
      const attendanceSummary = (studentId) => {
        const recs = attendance.filter(
          (a) => a.studentId === studentId && a.date && a.date <= endedOn && (!termStart || a.date > termStart)
        );
        const present = recs.filter((r) => r.status === "present").length;
        const late = recs.filter((r) => r.status === "late").length;
        const absent = recs.filter((r) => r.status === "absent").length;
        const leave = recs.filter((r) => r.status === "leave").length;
        const total = recs.length;
        return {
          present,
          late,
          absent,
          leave,
          total,
          rate: total ? Math.round(((present + late) / total) * 100) : 0,
        };
      };

      // ranked snapshot of every student's scores for the finished term
      const roster = students.filter((s) => s.className === classId && s.status !== "Graduate");
      // who continues to the next semester: opts.advanceIds, or everyone by default
      const advanceSet = Array.isArray(opts.advanceIds) ? new Set(opts.advanceIds) : null;
      const willAdvance = roster.filter((s) => !advanceSet || advanceSet.has(s.id)).length;
      const willStay = roster.length - willAdvance;
      const rows = roster.map((s) => {
        const map = classScores[s.id] || {};
        const scores = {};
        subjects.forEach((sub) => {
          const v = map[sub];
          if (v !== undefined && v !== null && v !== "") scores[sub] = v;
        });
        const vals = Object.values(scores).map(Number).filter((n) => !isNaN(n));
        const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        return {
          studentId: s.id,
          studentCode: s.studentId,
          khmerName: s.khmerName || "",
          name: `${s.firstName} ${s.lastName}`,
          scores,
          avg,
          grade: gradeLetter(avg),
          attendance: attendanceSummary(s.id),
          rank: null,
        };
      });
      const scored = rows.filter((r) => r.avg != null).sort((a, b) => b.avg - a.avg);
      let prevAvg = null;
      let prevRank = 0;
      scored.forEach((r, i) => {
        const rank = prevAvg !== null && Math.abs(r.avg - prevAvg) < 1e-9 ? prevRank : i + 1;
        r.rank = rank;
        prevAvg = r.avg;
        prevRank = rank;
      });
      const classAvg = scored.length ? scored.reduce((a, r) => a + r.avg, 0) / scored.length : null;

      const classAtt = rows.reduce(
        (acc, r) => {
          const a = r.attendance || {};
          acc.present += a.present || 0;
          acc.late += a.late || 0;
          acc.absent += a.absent || 0;
          acc.leave += a.leave || 0;
          acc.total += a.total || 0;
          return acc;
        },
        { present: 0, late: 0, absent: 0, leave: 0, total: 0 }
      );
      classAtt.rate = classAtt.total ? Math.round(((classAtt.present + classAtt.late) / classAtt.total) * 100) : 0;

      // raw daily records for this term, so clicking a student shows which day
      // they were present / late / absent / on permission
      const rosterIds = new Set(roster.map((s) => s.id));
      const attendanceRecords = attendance
        .filter(
          (a) => a.date && a.date <= endedOn && (!termStart || a.date > termStart) && rosterIds.has(a.studentId)
        )
        .map((a) => ({ studentId: a.studentId, date: a.date, status: a.status, checkIn: a.checkIn || null }));

      const term = {
        id: `t-${classId}-${Date.now()}`,
        level: curLevel,
        year: meta.year,
        semester: meta.semester,
        className: cls.name,
        endedOn,
        subjects,
        teachers,
        cells: sched?.cells || {},
        rows,
        classSize: roster.length,
        classAvg,
        classAttendance: classAtt,
        attendanceRecords,
      };

      // archive on the class and advance its term
      setClasses((prev) =>
        prev.map((c) => {
          if (c.id !== classId) return c;
          const terms = [...(c.terms || []), term];
          if (!next) return { ...c, terms, completed: true };
          const nm = levelMeta(next);
          return { ...c, terms, year: nm.year, semester: nm.semester };
        })
      );

      // clear the live class scores (captured above in the archive)
      delete allScores[classId];
      try {
        localStorage.setItem(LS_SCORES, JSON.stringify(allScores));
      } catch {
        /* ignore */
      }

      // clear every live attendance day for this class's roster up to the
      // rollover date so the new semester starts from a blank sheet. Anything
      // dated after endedOn (the new term) and every other class is left alone;
      // the finished days are preserved in the term archive above. Clearing the
      // whole range (not just this term's window) matters because consecutive
      // rollovers can leave the window empty while older days are still live.
      if (rosterIds.size) {
        setAttendance((prev) =>
          prev.filter((a) => !(rosterIds.has(a.studentId) && a.date && a.date <= endedOn))
        );
      }

      // blank the schedule so the new term is built from scratch
      if (sched) {
        try {
          const nm = next ? levelMeta(next) : meta;
          const nextSched = {
            ...schedRaw,
            schedules: schedList.map((s) =>
              s === sched
                ? {
                    ...s,
                    subjects: [],
                    teachers: [],
                    cells: {},
                    year: String(nm.year).match(/\d+/)?.[0] || "1",
                    semester: String(nm.semester).match(/\d+/)?.[0] || "1",
                  }
                : s
            ),
          };
          localStorage.setItem(LS_SCHED, JSON.stringify(nextSched));
        } catch {
          /* ignore */
        }
      }

      // advance the selected students WITH the class: everyone moves exactly one
      // level (the class's next level), so a student can never run ahead of or
      // graduate before their class. Unselected students stay at the finished
      // level with no class so they can be imported again.
      setStudents((prev) =>
        prev.map((s) => {
          if (s.className !== classId) return s;
          const map = classScores[s.id] || {};
          const scores = {};
          subjects.forEach((sub) => {
            const v = map[sub];
            if (v !== undefined && v !== null && v !== "") scores[sub] = v;
          });

          if (advanceSet && !advanceSet.has(s.id)) {
            return { ...s, className: "", level: curLevel, status: "Undergraduate" };
          }

          const history = [
            ...(s.history || []),
            {
              id: `p-${s.id}-${Date.now()}`,
              level: curLevel,
              year: levelMeta(curLevel).year,
              semester: levelMeta(curLevel).semester,
              className: s.className,
              date: endedOn,
              result: "Passed",
              subjects,
              scores,
              attendance: attendanceSummary(s.id),
            },
          ];
          if (!next) return { ...s, level: curLevel, status: "Graduate", history };
          return { ...s, level: next, status: "Learning", history };
        })
      );

      logAudit(
        "end_class_term",
        next
          ? `Ended ${curLevel} for ${cls.name} · archived ${rows.length} · advanced ${willAdvance} → ${next}${willStay ? ` · ${willStay} stayed at ${curLevel}` : ""}`
          : `Ended ${curLevel} for ${cls.name} · archived ${rows.length} students · class completed`
      );
      return term;
    },
    [classes, students, attendance, logAudit]
  );

  const value = useMemo(
    () => ({
      students,
      attendance,
      classes,
      weekly,
      admins,
      audit,
      currentAdmin,
      addClass,
      updateClass,
      saveWeekly,
      addStudent,
      addStudentsBatch,
      updateStudent,
      deleteStudent,
      importStudents,
      removeFromClass,
      endClassTerm,
      saveAttendance,
      login,
      logout,
      addAdmin,
      updateAdmin,
      deleteAdmin,
      logAudit,
      showToast,
      toasts,
      theme,
      toggleTheme,
    }),
    [students, attendance, classes, weekly, admins, audit, currentAdmin, addClass, updateClass, saveWeekly, addStudent, addStudentsBatch, updateStudent, deleteStudent, importStudents, removeFromClass, endClassTerm, saveAttendance, login, logout, addAdmin, updateAdmin, deleteAdmin, logAudit, showToast, toasts, theme, toggleTheme]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}