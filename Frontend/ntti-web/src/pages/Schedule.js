import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Plus, Save, RotateCcw, Trash2, CalendarDays, Download, ChevronDown, Check, X,
  FileDown, FileSpreadsheet, FileText, Copy,
} from "lucide-react";
import { useApp } from "../context/AppContext";

const KEY = "ntti.schedule.v2";
const LEGACY = "ntti.schedule.v1";

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAIA = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };

const SEMESTERS = ["1", "2", "2.5"];
const YEARS = ["1", "2", "3", "4", "5"];
const MAJORS = [
  "IT", "Electronic", "Electrical", "Mechanical", "Civil", "Chemistry", "Computer Science", "Accounting", "Tourism", "Architecture",
];
const FIELDS = [
  "Cyber Security",
  "Software Development",
  "Programming",
  "Web Development",
  "Mobile App Development",
  "Graphic Design",
  "Video Editor",
  "Multimedia",
  "Networking",
  "Data Science",
  "UI/UX Design",
];
const CLASS_YEARS = ["2025-2026", "2026-2027", "2027-2028", "2028-2029"];

/* Schedule shifts: morning / evening / night with hour windows */
const SHIFTS = {
  morning: { label: "Morning", from: [7, 30], to: [12, 0] },
  evening: { label: "Evening", from: [14, 0], to: [17, 0] },
  night: { label: "Night", from: [17, 30], to: [20, 30] },
};
const DEFAULT_SHIFT = "morning";

const DEFAULT_SUBJECTS = ["Mathematics", "Khmer", "English", "Physics", "Chemistry", "Computer", "Physical Ed"];
const DEFAULT_TEACHERS = ["Teacher 1", "Teacher 2", "Teacher 3", "Teacher 4", "Teacher 5", "Teacher 6", "Teacher 7"];

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

/* ── time-slot generation (30-minute steps within a window) ── */
function genTimeSlots(from, to) {
  const [fh, fm] = from;
  const [th, tm] = to;
  const slots = [];
  let m = fh * 60 + fm;
  const end = th * 60 + tm;
  while (m <= end) {
    const h = Math.floor(m / 60);
    const mi = m % 60;
    const ap = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    slots.push(`${h12}:${String(mi).padStart(2, "0")} ${ap}`);
    m += 30;
  }
  return slots;
}

const TIME_FOR = (shift) => genTimeSlots((SHIFTS[shift] || SHIFTS[DEFAULT_SHIFT]).from, (SHIFTS[shift] || SHIFTS[DEFAULT_SHIFT]).to);

const SLOTS = {
  morning: TIME_FOR("morning"),
  evening: TIME_FOR("evening"),
  night: TIME_FOR("night"),
};

const cellKey = (c, r) => `${c}|${r}`;

function splitKey(k) {
  return k.split("|").map(Number);
}

let uid = 0;
const nextId = () => `s${Date.now().toString(36)}${(uid++).toString(36)}`;

const newSchedule = (name, idx) => ({
  id: nextId(),
  className: name || "",
  semester: "1",
  year: "1",
  major: "IT",
  field: "",
  studentYear: "2026-2027",
  shift: DEFAULT_SHIFT,
  subjects: [...DEFAULT_SUBJECTS],
  teachers: [...DEFAULT_TEACHERS],
  cells: {}, // "c|r" → { day, time }
});

/* ── load / persist state ─────────────────────────────────── */
function load() {
  let schedules = [];
  let activeId = null;

  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && Array.isArray(raw.schedules) && raw.schedules.length) {
      schedules = raw.schedules;
      activeId = raw.activeId && schedules.some((s) => s.id === raw.activeId) ? raw.activeId : schedules[0].id;
    }
  } catch {
    /* ignore */
  }

  if (!schedules.length) {
    try {
      const old = JSON.parse(localStorage.getItem(LEGACY));
      if (old && Array.isArray(old.subjects) && Array.isArray(old.teachers)) {
        const cells = {};
        Object.keys(old.cells || {}).forEach((k) => {
          const v = old.cells[k];
          if (v && typeof v === "object") cells[k] = { day: v.day || "", time: v.time || "" };
          else if (typeof v === "string" && v) cells[k] = { day: v, time: "" };
          else if (Array.isArray(v) && v[0]) cells[k] = { day: v[0], time: "" };
        });
        schedules = [
          {
            id: nextId(),
            className: old.className || "",
            semester: "1",
            year: "1",
            major: old.major || "IT",
            field: old.field || "",
            studentYear: "2026-2027",
            shift: old.shift || DEFAULT_SHIFT,
            subjects: Array.isArray(old.subjects) ? old.subjects : [...DEFAULT_SUBJECTS],
            teachers: Array.isArray(old.teachers) ? old.teachers : [...DEFAULT_TEACHERS],
            cells,
          },
        ];
        activeId = schedules[0].id;
      }
    } catch {
      /* ignore */
    }
  }

  if (!schedules.length) {
    const s = newSchedule("");
    schedules = [s];
    activeId = s.id;
  }

  return { schedules, activeId };
}

/* ── Half-select: portable day/time picker (Day or Time) ─── */
function HalfSelect({ value, options, onChange, style, wide, h9 = false, label }) {
  const ref = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);

  const close = () => setOpen(false);

  const display = options.find((o) => (typeof o === "string" ? o : o.value) === value);
  const shown = display ? (typeof display === "string" ? display : display.label) : "";
  const longest = options.reduce(
    (m, o) => Math.max(m, (typeof o === "string" ? o : o.label || "").length),
    0
  );

  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const measure = () => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const GAP = 4;
      const MARGIN = 8;
      // rough height of the menu (None row + divider + one row per option)
      const estHeight = Math.min(240, (options.length + 2) * 30 + 12);
      const spaceBelow = vh - r.bottom;
      const spaceAbove = r.top;
      // flip upward when there isn't enough room below and more room above
      const up = spaceBelow < estHeight + GAP + MARGIN && spaceAbove > spaceBelow;
      const width = Math.max(r.width, 150);
      let left = r.left;
      if (left + width > vw - MARGIN) left = Math.max(MARGIN, vw - MARGIN - width);
      const avail = (up ? spaceAbove : spaceBelow) - GAP - MARGIN;
      setPos({
        left,
        minWidth: Math.max(r.width, 140),
        up,
        maxHeight: Math.max(140, Math.min(240, avail)),
        ...(up ? { bottom: vh - r.top + GAP } : { top: r.bottom + GAP }),
      });
    };
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    const onScroll = (e) => {
      // keep the menu open while the user scrolls inside it
      const t = e.target;
      if (menuRef.current && t instanceof Node && menuRef.current.contains(t)) return;
      close();
    };
    measure();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`relative ${wide ? "w-full" : "shrink-0"}`}>
      {label ? (
        <span
          className="mb-0.5 block text-[9px] font-bold uppercase tracking-wider"
          style={{ color: "var(--text-3)" }}
        >
          {label}
        </span>
      ) : null}
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-center gap-0.5 border transition-colors ${
          h9 ? "h-9 px-2 text-xs" : "h-7 px-0.5 text-[10px]"
        }`}
        style={{
          background: "var(--surface)",
          borderColor: open ? "var(--primary)" : "var(--border)",
          color: value ? "var(--text)" : "var(--text-3)",
          boxShadow: open ? "0 0 0 3px var(--ring)" : "none",
          minWidth: wide ? "auto" : `${Math.max(longest + 2, 5)}ch`,
          ...style,
        }}
      >
        <span className="whitespace-nowrap">{shown || "—"}</span>
        <ChevronDown size={10} className="shrink-0" style={{ color: "var(--text-3)" }} />
      </button>

      {open &&
        pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onMouseDown={close} />
            <div
              ref={menuRef}
              className={`fixed z-50 card p-1 min-w-[150px] overflow-y-auto thin-scroll shadow-lg ${
                pos.up ? "animate-fade-down" : "animate-fade-up"
              }`}
              style={{
                left: pos.left,
                minWidth: pos.minWidth,
                maxHeight: pos.maxHeight,
                ...(pos.bottom != null ? { bottom: pos.bottom } : { top: pos.top }),
              }}
            >
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  close();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-[var(--surface-2)]"
                style={{ color: "var(--text-3)" }}
              >
                <span className="w-3.5 shrink-0">{value === "" ? <Check size={12} /> : null}</span>
                None
              </button>
              <div className="my-1 h-px" style={{ background: "var(--border)" }} />
              {options.map((o) => {
                const val = typeof o === "string" ? o : o.value;
                const label = typeof o === "string" ? o : o.label;
                const active = value === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      onChange(val);
                      close();
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                      active ? "bg-[var(--primary-soft)]" : "hover:bg-[var(--surface-2)]"
                    }`}
                    style={{ color: active ? "var(--primary-strong)" : "var(--text)", fontWeight: active ? 700 : 500 }}
                  >
                    <span className="w-3.5 shrink-0">{active ? <Check size={12} /> : null}</span>
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

/* ── build export table / download ───────────────────────── */
function buildTableCell(s, c, r) {
  const v = s.cells[cellKey(c, r)];
  const day = v && v.day ? DAIA[v.day] || v.day : "";
  const time = v && v.time ? v.time : "";
  return day || time ? `${esc(day)}${day && time ? " · " : ""}${esc(time)}` : "";
}

function renderScheduleHTML(s) {
  const thead = `<tr><th>Teacher \\ Subject</th>${s.subjects.map((sub) => `<th>${esc(sub)}</th>`).join("")}</tr>`;
  const rows = s.teachers
    .map((t, r) => `<tr><th>${esc(t)}</th>${s.subjects.map((_, c) => `<td>${buildTableCell(s, c, r)}</td>`).join("")}</tr>`)
    .join("");
  return `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">${thead}${rows}</table>`;
}

function exportHTML(schedules) {
  const esc2 = esc;
  return `<html><head><meta charset="utf-8"><title>Teaching schedule</title></head><body>${schedules
    .map(
      (s) => `<h3 style="margin:20px 0 6px">${esc2(s.className || "Schedule")}</h3>${renderScheduleHTML(s)}`
    )
    .join("")}</body></html>`;
}

function doExport(schedules, type) {
  const html = exportHTML(schedules);
  const blob = new Blob(
    ["\ufeff", html],
    { type: type === "word" ? "application/msword" : "application/vnd.ms-excel" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${schedules.length === 1 && schedules[0].className ? schedules[0].className : "schedules"}.${type === "word" ? "doc" : "xls"}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ── main page ───────────────────────────────────────────── */
export default function Schedule() {
  const { showToast } = useApp();
  const [state, setState] = useState(load());
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // persist every state change so schedules survive a refresh
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, [state]);

  const schedules = state.schedules;
  const data = schedules.find((s) => s.id === state.activeId) || schedules[0];

  const persist = (next) => setState(next);

  /* schedule list ops */
  const addSchedule = () => {
    const s = newSchedule(`Class ${schedules.length + 1}`, schedules.length);
    persist({ schedules: [...schedules, s], activeId: s.id });
    showToast("New schedule added — old ones kept");
  };

  const duplicateSchedule = (id) => {
    const src = schedules.find((s) => s.id === id);
    if (!src) return;
    const copy = { ...src, id: nextId(), className: `${src.className} (copy)`, cells: { ...src.cells } };
    persist({ schedules: [...schedules, copy], activeId: copy.id });
    showToast("Schedule duplicated");
  };

  const removeSchedule = (id) => {
    if (schedules.length <= 1) {
      showToast("Keep at least one schedule");
      return;
    }
    const rest = schedules.filter((s) => s.id !== id);
    persist({ schedules: rest, activeId: rest[0].id });
  };

  const switchSchedule = (id) => persist({ ...state, activeId: id });

  const setMeta = (patch) => {
    let next = { ...data, ...patch };
    if (patch.shift && patch.shift !== data.shift) {
      // times that don't exist in the new shift must be reset to none
      const valid = new Set(SLOTS[patch.shift] || SLOTS[DEFAULT_SHIFT]);
      const cells = {};
      Object.keys(data.cells).forEach((k) => {
        const c = data.cells[k];
        const time = valid.has(c.time) ? c.time : "";
        if (c.day || time) cells[k] = { ...c, time };
      });
      next = { ...next, cells };
    }
    persist({ ...state, schedules: schedules.map((s) => (s.id === data.id ? next : s)) });
  };

  const setSubjectName = (i, name) =>
    setMeta({ subjects: data.subjects.map((s, idx) => (idx === i ? name : s)) });
  const setTeacherName = (i, name) =>
    setMeta({ teachers: data.teachers.map((t, idx) => (idx === i ? name : t)) });

  const addSubject = () =>
    setMeta({ subjects: [...data.subjects, `Subject ${data.subjects.length + 1}`] });
  const addTeacher = () =>
    setMeta({ teachers: [...data.teachers, `Teacher ${data.teachers.length + 1}`] });

  const removeSubject = (i) => {
    const cells = {};
    Object.keys(data.cells).forEach((k) => {
      const [c] = splitKey(k);
      if (c !== i) cells[k] = data.cells[k];
    });
    setMeta({ subjects: data.subjects.filter((_, idx) => idx !== i), cells });
  };

  const removeTeacher = (i) => {
    const cells = {};
    Object.keys(data.cells).forEach((k) => {
      const [, r] = splitKey(k);
      if (r !== i) cells[k] = data.cells[k];
    });
    setMeta({ teachers: data.teachers.filter((_, idx) => idx !== i), cells });
  };

  const setCell = (c, r, patch) => {
    const k = cellKey(c, r);
    const prev = data.cells[k] || { day: "", time: "" };
    const next = { ...prev, ...patch };
    const cells = { ...data.cells };
    if (next.day || next.time) cells[k] = next;
    else delete cells[k];
    setMeta({ cells });
  };

  const reset = () => {
    const s = newSchedule(data.className, schedules.length);
    setMeta({ ...s, cells: {} });
    showToast("Schedule reset");
  };

  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(stateRef.current));
    } catch {
      /* ignore */
    }
    showToast("All schedules saved");
  };

  /* export picker state */
  const [dlSel, setDlSel] = useState(false);
  const [dlAll, setDlAll] = useState(false);
  const [checked, setChecked] = useState({});
  const [dlType, setDlType] = useState("excel");

  const toggleAll = (on) => setDlAll(on);

  const dlSchedules = () => {
    if (dlAll) return schedules;
    return schedules.filter((s) => checked[s.id]);
  };
  const someChecked = dlAll || Object.keys(checked).some((k) => checked[k]);

  const times = SLOTS[data.shift] || SLOTS[DEFAULT_SHIFT];

  const noSelected = dlSel && !someChecked && !dlAll;

  return (
    <div className="animate-fade-up">
      {/* header */}
      <div className="card">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3 px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
              Schedule
            </label>
            <HalfSelect
              h9
              style={{ minWidth: 220 }}
              value={state.activeId}
              options={schedules.map((s) => ({ value: s.id, label: s.className || "Untitled" }))}
              onChange={(id) => switchSchedule(id)}
            />
          </div>
          <div className="flex items-end gap-2 ml-auto">
            <button onClick={addSchedule} className="btn btn-outline h-9 px-3 text-sm gap-1.5" title="Add new schedule — keeps existing ones">
              <Plus size={15} /> Add schedule
            </button>
            <button onClick={() => duplicateSchedule(data.id)} className="btn btn-outline h-9 px-3 text-sm gap-1.5" title="Duplicate current schedule">
              <Copy size={15} /> Duplicate
            </button>
            <button onClick={() => removeSchedule(data.id)} className="btn btn-outline h-9 px-3 text-sm gap-1.5 !text-red-500" title="Remove current schedule">
              <Trash2 size={15} /> Delete
            </button>
          </div>
        </div>

        {/* class meta fields — under the class-name input */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 px-5 py-4 border-b md:grid-cols-3 xl:grid-cols-7" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>Class</label>
            <input
              value={data.className}
              onChange={(e) => setMeta({ className: e.target.value })}
              className="input h-9 text-sm !w-full rounded-md"
              placeholder="e.g., IT09A1"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>Semester</label>
            <HalfSelect
              h9
              style={{ minWidth: 0 }}
              value={data.semester}
              options={SEMESTERS.map((s) => ({ value: s, label: `Semester ${s}` }))}
              onChange={(v) => setMeta({ semester: v })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>Year</label>
            <HalfSelect
              h9
              style={{ minWidth: 0 }}
              value={data.year}
              options={YEARS.map((y) => ({ value: y, label: `Year ${y}` }))}
              onChange={(v) => setMeta({ year: v })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>Major</label>
            <HalfSelect
              h9
              style={{ minWidth: 0 }}
              value={data.major}
              options={MAJORS.map((m) => ({ value: m, label: m }))}
              onChange={(v) => setMeta({ major: v })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>Field</label>
            <HalfSelect
              h9
              style={{ minWidth: 0 }}
              value={data.field || ""}
              options={FIELDS.map((f) => ({ value: f, label: f }))}
              onChange={(v) => setMeta({ field: v })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>Student year</label>
            <input
              list="class-year-datalist"
              value={data.studentYear}
              onChange={(e) => setMeta({ studentYear: e.target.value })}
              className="input h-9 text-sm !w-full rounded-md"
              placeholder="2026-2027"
            />
            <datalist id="class-year-datalist">
              {CLASS_YEARS.map((y) => (
                <option key={y} value={y} />
              ))}
            </datalist>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>Shift</label>
            <HalfSelect
              h9
              style={{ minWidth: 0 }}
              value={data.shift}
              options={Object.keys(SHIFTS).map((k) => ({ value: k, label: SHIFTS[k].label }))}
              onChange={(v) => setMeta({ shift: v })}
            />
            <span className="text-[11px] tabular-nums" style={{ color: "var(--text-3)" }}>
              {SHIFTS[data.shift].label}{" "}
              {SHIFTS[data.shift].from[0] % 12 || 12}:{String(SHIFTS[data.shift].from[1]).padStart(2, "0")}–{SHIFTS[data.shift].to[0] % 12 || 12}:
              {String(SHIFTS[data.shift].to[1]).padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
          <button onClick={addSubject} className="btn btn-outline h-9 px-3 text-sm gap-1.5">
            <Plus size={14} /> Add column
          </button>
          <button onClick={addTeacher} className="btn btn-outline h-9 px-3 text-sm gap-1.5">
            <Plus size={14} /> Add row
          </button>
          <span className="ml-auto" />
          <button onClick={() => setDlSel(true)} className="btn btn-outline h-9 px-3 text-sm gap-1.5">
            <FileDown size={15} /> Export
          </button>
          <button onClick={reset} className="btn btn-outline h-9 px-3 text-sm gap-1.5">
            <RotateCcw size={14} /> Reset
          </button>
          <button onClick={save} className="btn btn-primary h-9 px-3 text-sm gap-1.5">
            <Save size={14} /> Save
          </button>
        </div>

        <div className="overflow-x-auto thin-scroll">
          <table className="table-w">
            <thead>
              <tr>
                <th className="sticky left-0 z-10" style={{ background: "var(--surface)" }}>
                  <div className="h-7 w-10" />
                </th>
                {data.subjects.map((s, i) => (
                  <th key={i} className="p-1 align-bottom">
                    <div className="flex items-center gap-0.5">
                      <input
                        value={s}
                        onChange={(e) => setSubjectName(i, e.target.value)}
                        className="min-w-0 rounded-none bg-transparent px-1 py-1 text-center text-xs font-bold outline-none transition-colors focus:bg-[var(--surface-2)]"
                        style={{ color: "var(--text)", width: `${Math.max((s || "").length + 1, 6)}ch`, maxWidth: 320 }}
                        placeholder="Subject"
                      />
                      <button
                        onClick={() => removeSubject(i)}
                        className="btn btn-ghost h-5 w-5 p-0 rounded-none shrink-0 opacity-40 hover:opacity-100"
                        title="Remove subject"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.teachers.map((t, r) => (
                <tr key={r}>
                  <td className="sticky left-0 z-10 whitespace-nowrap p-1" style={{ background: "var(--surface)" }}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => removeTeacher(r)}
                        className="btn btn-ghost h-5 w-5 p-0 rounded-none shrink-0 opacity-40 hover:opacity-100"
                        title="Remove teacher"
                      >
                        <Trash2 size={11} />
                      </button>
                      <input
                        value={t}
                        onChange={(e) => setTeacherName(r, e.target.value)}
                        className="min-w-[70px] max-w-[280px] rounded-none bg-transparent px-1 py-1 text-xs font-semibold outline-none transition-colors focus:bg-[var(--surface-2)]"
                        style={{ color: "var(--text-2)", width: `${Math.max((t || "").length + 1, 8)}ch` }}
                        placeholder="Teacher"
                      />
                    </div>
                  </td>
                  {data.subjects.map((_, c) => {
                    const k = cellKey(c, r);
                    const cell = data.cells[k] || { day: "", time: "" };
                    return (
                      <td key={c} className="p-1 text-center">
                        <span className="flex w-full items-stretch gap-0.5">
                          <HalfSelect
                            label="Day"
                            value={cell.day || ""}
                            options={DAY_SHORT.map((d) => ({ value: d, label: DAIA[d] || d }))}
                            onChange={(day) => setCell(c, r, { day })}
                          />
                          <HalfSelect
                            label="Time"
                            value={cell.time || ""}
                            options={times.map((t) => ({ value: t, label: t }))}
                            onChange={(time) => setCell(c, r, { time })}
                          />
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* export picker — big card */}
      {dlSel &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setDlSel(false)} />
            <div className="relative card w-full max-w-2xl p-6 shadow-2xl animate-fade-up">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold" style={{ color: "var(--text)" }}>
                  Export schedules
                </h3>
                <button onClick={() => setDlSel(false)} className="btn btn-ghost h-8 w-8 p-0 rounded-lg" title="Close">
                  <X size={15} />
                </button>
              </div>
              <p className="text-xs mb-4" style={{ color: "var(--text-3)" }}>
                Pick which schedule(s) to export, or export all of them. Then choose a file type.
              </p>

              {/* export all toggle */}
              <label className="flex items-center gap-2 py-2 border-b" style={{ borderColor: "var(--border)" }}>
                <input
                  type="checkbox"
                  checked={dlAll}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setDlAll(on);
                    if (on) setChecked({});
                  }}
                  className="accent-[var(--primary)]"
                />
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  Export all schedules
                </span>
              </label>

              {/* schedule list */}
              <div className="max-h-64 overflow-y-auto thin-scroll my-3 space-y-1">
                {schedules.map((s) => {
                  const on = dlAll || checked[s.id];
                  return (
                    <label
                      key={s.id}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[var(--surface-2)]"
                      style={{ color: "var(--text)" }}
                    >
                      <input
                        type="checkbox"
                        checked={!!on}
                        disabled={dlAll}
                        onChange={(e) => setChecked((c) => ({ ...c, [s.id]: e.target.checked }))}
                        className="accent-[var(--primary)]"
                      />
                      <span className="text-sm">{s.className || "Untitled"}</span>
                      <span className="ml-auto text-[11px]" style={{ color: "var(--text-3)" }}>
                        {s.subjects.length}s · {s.teachers.length}t · {(SHIFTS[s.shift] || SHIFTS[DEFAULT_SHIFT]).label}
                      </span>
                    </label>
                  );
                })}
              </div>

              {/* format buttons */}
              <div className="flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                <button
                  onClick={() => {
                    setDlType("excel");
                    if (noSelected) {
                      showToast("Pick at least one schedule to export");
                      return;
                    }
                    doExport(dlSchedules(), "excel");
                    setDlSel(false);
                  }}
                  className="btn btn-primary h-10 px-4 text-sm gap-1.5"
                >
                  <FileSpreadsheet size={15} /> Excel (.xls)
                </button>
                <button
                  onClick={() => {
                    setDlType("word");
                    if (noSelected) {
                      showToast("Pick at least one schedule to export");
                      return;
                    }
                    doExport(dlSchedules(), "word");
                    setDlSel(false);
                  }}
                  className="btn btn-primary h-10 px-4 text-sm gap-1.5"
                >
                  <FileText size={15} /> Word (.doc)
                </button>
                <button
                  onClick={() => {
                    setDlType("pdf");
                    if (noSelected) {
                      showToast("Pick at least one schedule to export");
                      return;
                    }
                    const w = window.open("", "_blank");
                    if (!w) {
                      showToast("Allow pop-ups to export as PDF");
                      return;
                    }
                    w.document.write(exportHTML(dlSchedules()));
                    w.document.close();
                    w.focus();
                    setTimeout(() => w.print(), 250);
                    setDlSel(false);
                  }}
                  className="btn btn-primary h-10 px-4 text-sm gap-1.5"
                >
                  <FileDown size={15} /> PDF
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
