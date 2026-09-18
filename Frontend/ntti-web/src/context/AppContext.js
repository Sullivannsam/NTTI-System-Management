import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { SEED_STUDENTS, SEED_ATTENDANCE, SEED_WEEKLY, CLASSES, ACADEMIC_LEVELS, nextLevel, levelMeta, todayISO } from "../data/seed";

const AppContext = createContext(null);

const LS_STUDENTS = "ntti.students.v2";
const LS_ATTENDANCE = "ntti.attendance.v2";
const LS_CLASSES = "ntti.classes.v1";
const LS_WEEKLY = "ntti.weekly.v1";
const LS_THEME = "ntti.theme";

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
  if (!stored) return SEED_STUDENTS;
  try {
    return JSON.parse(stored).map((s) => {
      const year =
        s.enrollmentYear ||
        (s.enrollmentDate ? Number(String(s.enrollmentDate).slice(0, 4)) : 0) ||
        Number(String(s.studentId || "").match(/NTTI-(\d{4})-/)?.[1] || 0);
      return {
        ...s,
        khmerName: s.khmerName || "",
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

/** Migrate stored classes' shift names to the new vocabulary (Morning / Evening / Night). */
function loadClasses() {
  const stored = localStorage.getItem(LS_CLASSES);
  if (!stored) return CLASSES;
  try {
    return JSON.parse(stored).map((c) =>
      c.shift === "Afternoon"
        ? { ...c, shift: "Evening", field: c.field || "" }
        : c.shift === "Evening"
        ? { ...c, shift: "Night", field: c.field || "" }
        : { ...c, field: c.field || "" }
    );
  } catch {
    return CLASSES;
  }
}

let toastId = 0;

export function AppProvider({ children }) {
  const [students, setStudents] = useState(loadStudents);
  const [attendance, setAttendance] = useState(() => load(LS_ATTENDANCE, SEED_ATTENDANCE));
  const [classes, setClasses] = useState(loadClasses);
  const [weekly, setWeekly] = useState(() => load(LS_WEEKLY, SEED_WEEKLY));
  const [toasts, setToasts] = useState([]);
  const [theme, setTheme] = useState(() => load(LS_THEME, "light"));

  useEffect(() => {
    localStorage.setItem(LS_STUDENTS, JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem(LS_ATTENDANCE, JSON.stringify(attendance));
  }, [attendance]);

  useEffect(() => {
    localStorage.setItem(LS_CLASSES, JSON.stringify(classes));
  }, [classes]);

  useEffect(() => {
    localStorage.setItem(LS_WEEKLY, JSON.stringify(weekly));
  }, [weekly]);

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

  const addStudent = useCallback(
    (data) => {
      setStudents((prev) => [
        {
          id: Math.max(0, ...prev.map((s) => s.id)) + 1,
          ...data,
        },
        ...prev,
      ]);
    },
    []
  );

  const updateStudent = useCallback((id, data) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
  }, []);

  const deleteStudent = useCallback(
    (id) => {
      setStudents((prev) => prev.filter((s) => s.id !== id));
      setAttendance((prev) => prev.filter((a) => a.studentId !== id));
    },
    []
  );

  const saveAttendance = useCallback((records) => {
    setAttendance((prev) => {
      const map = new Map(prev.map((r) => [r.id, r]));
      for (const r of records) map.set(r.id, r);
      return Array.from(map.values());
    });
  }, []);

  const addClass = useCallback(
    (data) => {
      setClasses((prev) => [
        {
          id: `cls-${Date.now().toString(36)}${Math.floor(Math.random() * 90 + 10)}`,
          ...data,
        },
        ...prev,
      ]);
    },
    []
  );

  /** Upsert weekly attendance records: [{ week, studentId, status }]; status "" removes the record. */
  const saveWeekly = useCallback((records) => {
    setWeekly((prev) => {
      const next = prev.filter(
        (r) => !records.some((n) => n.week === r.week && n.studentId === r.studentId)
      );
      records.forEach((n) => {
        if (n.status) next.push({ id: `${n.studentId}-${n.week}`, week: n.week, studentId: n.studentId, status: n.status });
      });
      return next;
    });
  }, []);

  const updateClass = useCallback((id, data) => {
    setClasses((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
  }, []);

  /**
   * Advance a student one semester after passing their exam.
   * The completed semester is archived into `history`; the student moves to the
   * next level (S1Y1 → S2Y1 → S1Y2 …) keeping the same class. After S2Y4 they graduate.
   */
  const promoteStudent = useCallback((id, opts = {}) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const cur = ACADEMIC_LEVELS.includes(s.level) ? s.level : "S1Y1";
        const next = nextLevel(cur);
        const meta = levelMeta(cur);
        const history = [
          ...(s.history || []),
          {
            id: `p-${s.id}-${Date.now()}`,
            level: cur,
            year: meta.year,
            semester: meta.semester,
            className: s.className,
            date: opts.date || todayISO(),
            result: "Passed",
          },
        ];
        if (!next) return { ...s, status: "Graduate", history };
        return { ...s, level: next, history };
      })
    );
  }, []);

  const value = useMemo(
    () => ({
      students,
      attendance,
      classes,
      weekly,
      addClass,
      updateClass,
      saveWeekly,
      addStudent,
      updateStudent,
      deleteStudent,
      promoteStudent,
      saveAttendance,
      showToast,
      toasts,
      theme,
      toggleTheme,
    }),
    [students, attendance, classes, weekly, addClass, updateClass, saveWeekly, addStudent, updateStudent, deleteStudent, promoteStudent, saveAttendance, showToast, toasts, theme, toggleTheme]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}