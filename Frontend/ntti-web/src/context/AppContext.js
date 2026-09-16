import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { SEED_STUDENTS, SEED_ATTENDANCE } from "../data/seed";

const AppContext = createContext(null);

const LS_STUDENTS = "ntti.students.v2";
const LS_ATTENDANCE = "ntti.attendance.v2";
const LS_THEME = "ntti.theme";

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

let toastId = 0;

export function AppProvider({ children }) {
  const [students, setStudents] = useState(() => load(LS_STUDENTS, SEED_STUDENTS));
  const [attendance, setAttendance] = useState(() => load(LS_ATTENDANCE, SEED_ATTENDANCE));
  const [toasts, setToasts] = useState([]);
  const [theme, setTheme] = useState(() => load(LS_THEME, "light"));

  useEffect(() => {
    localStorage.setItem(LS_STUDENTS, JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem(LS_ATTENDANCE, JSON.stringify(attendance));
  }, [attendance]);

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

  const value = useMemo(
    () => ({
      students,
      attendance,
      addStudent,
      updateStudent,
      deleteStudent,
      saveAttendance,
      showToast,
      toasts,
      theme,
      toggleTheme,
    }),
    [students, attendance, addStudent, updateStudent, deleteStudent, saveAttendance, showToast, toasts, theme, toggleTheme]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}