import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import {
  Users,
  PlusCircle,
  CheckCircle2,
  RotateCcw,
  Percent,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronsDown,
  ChevronsRight,
  Wand2,
  Check,
  X,
  Trash2,
  FileDown,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import PageHeader, { ProgressBar, EmptyState } from "../components/Page";
import { useApp } from "../context/AppContext";
import { majorName, shiftRange, lastNWeeks } from "../data/seed";
import { StudentAvatar } from "../components/Badge";
import StudentFormModal from "../components/StudentFormModal";
import StudentAttendanceModal from "../components/StudentAttendanceModal";
import ConfirmDialog from "../components/ConfirmDialog";
import { useDropPos } from "../components/Dropdown";

/* ── weekly statuses (Excel tick letters) ────────────────── */
const WEEK_STATUS = {
  present: { label: "Present", short: "P", color: "#10b981", soft: "#d1fae5" },
  late: { label: "Late", short: "L", color: "#f59e0b", soft: "#fef3c7" },
  absent: { label: "Absent", short: "A", color: "#ef4444", soft: "#fee2e2" },
  leave: { label: "Permission", short: "PE", color: "#3b82f6", soft: "#dbeafe" },
};

/* ── the marking toolbar: pick a tool, then click cells ──
   Order matters: this is also the keyboard-shortcut order (1..4, then 0). */
const MARK_TOOLS = [
  { value: "present", label: "Present", short: "P", hint: "1", color: "#10b981", soft: "#d1fae5" },
  { value: "late", label: "Late", short: "L", hint: "2", color: "#f59e0b", soft: "#fef3c7" },
  { value: "absent", label: "Absent", short: "A", hint: "3", color: "#ef4444", soft: "#fee2e2" },
  { value: "leave", label: "Permission", short: "PE", hint: "4", color: "#3b82f6", soft: "#dbeafe" },
  { value: "", label: "Erase", short: "–", hint: "0", color: "#64748b", soft: "#f1f5f9" },
];

const toolOf = (v) => MARK_TOOLS.find((t) => t.value === v) || MARK_TOOLS[0];

const rateTone = (r) => (r >= 85 ? "#10b981" : r >= 70 ? "#f59e0b" : "#ef4444");

const LS_EXTRA_WEEKS = "ntti.weekly.extra.v1";
const LS_WEEKS = "ntti.weekly.weeks.v1";
const LS_SCHED = "ntti.schedule.v2";
const LS_CLASS_SEL = "ntti.attendance.classes.v1";

function readScheduleState() {
  try {
    const raw = localStorage.getItem(LS_SCHED);
    if (!raw) return { schedules: [] };
    const v = JSON.parse(raw);
    if (!v || !Array.isArray(v.schedules)) return { schedules: [] };
    /* keep only real schedule objects — a stray non-object row would break the
       field reads below and hide every subject */
    return { ...v, schedules: v.schedules.filter((s) => s && typeof s === "object" && !Array.isArray(s)) };
  } catch {
    return { schedules: [] };
  }
}

function scheduleForClassId(schedules, cls) {
  if (!cls) return null;
  return (
    schedules.find((s) => s.classId && s.classId === cls.id) ||
    schedules.find((s) => !s.classId && (s.className === cls.id || s.className === cls.name)) ||
    null
  );
}

const schedCellKey = (c, r) => `${c}|${r}`;

function subjectsForClass(schedules, cls) {
  const sched = scheduleForClassId(schedules, cls);
  if (!sched || !Array.isArray(sched.subjects) || !sched.subjects.length) {
    return [{ key: "general", name: "General", day: "", time: "", teacher: "" }];
  }
  const teachers = sched.teachers || [];
  const out = sched.subjects.map((name, c) => {
    let day = "", time = "", teacher = "";
    for (let r = 0; r < teachers.length; r++) {
      const cell = sched.cells?.[schedCellKey(c, r)];
      if (cell && cell.day) {
        day = cell.day;
        time = cell.time || "";
        teacher = teachers[r] || "";
        break;
      }
    }
    return { key: name || `subject-${c}`, name: name || `Subject ${c + 1}`, day, time, teacher };
  });
  return out.length ? out : [{ key: "general", name: "General", day: "", time: "", teacher: "" }];
}

function subjectLabelOf(subj) {
  if (!subj) return "General";
  return subj.day ? `${subj.name} · ${subj.day}${subj.time ? ` ${subj.time}` : ""}` : subj.name;
}

const pad2 = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const monthShort = (d) => d.toLocaleDateString("en-US", { month: "short" });
function weekFromKey(key) {
  const start = new Date(key + "T00:00:00");
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return {
    key,
    start: iso(start),
    end: iso(end),
    range: `${monthShort(start)} ${start.getDate()} – ${monthShort(end)} ${end.getDate()}`,
  };
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function weekDays(startISO) {
  const start = new Date(startISO + "T00:00:00");
  return DAY_NAMES.map((name, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return {
      date: iso(d),
      name,
      short: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    };
  });
}

const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function statusLetter(st) {
  if (st === "present") return "P";
  if (st === "late") return "L";
  if (st === "absent") return "A";
  if (st === "leave") return "PE";
  return "";
}

function attendanceExportHTML(sheets) {
  return `<html><head><meta charset="utf-8"><title>Attendance</title></head><body>${sheets
    .map((s) => {
      const c = s.cls;
      const days = s.days || [];
      const th = (inner) => `<th style="background:#f1f1f1;padding:6px 8px">${inner}</th>`;
      const thead =
        `<tr><th style="background:#f1f1f1;padding:6px 8px;text-align:left">Student</th>` +
        days
          .map((d) => th(`${esc(d.name)}<br/><span style="font-weight:normal">${esc(d.short)}</span>`))
          .join("") +
        th("Rate");
      const rows = s.students
        .map((st) => {
          const map = (s.daily && s.daily[st.id] && s.daily[st.id][s.subjectKey]) || {};
          let pres = 0;
          const cells = days
            .map((d) => {
              const code = statusLetter(map[d.date] || "");
              if (code === "P" || code === "L") pres++;
              return `<td align="center">${code}</td>`;
            })
            .join("");
          const rate = days.length ? Math.round((pres / days.length) * 100) : 0;
          return `<tr><td style="padding:5px 8px">${esc(st.khmerName || `${st.firstName} ${st.lastName}`)}</td>${cells}<td align="center" style="padding:5px 8px">${rate}%</td></tr>`;
        })
        .join("");
      const meta = (label, val) => `<p style="margin:1px 0;font-size:12px"><b>${esc(label)}:</b> ${esc(val)}</p>`;
      const weekLine = s.week ? `${s.weekLabel || ""} · ${s.week.range}` : "";
      return (
        `<h3 style="margin:22px 0 4px">${esc(c.name)}${s.subjectLabel ? ` — ${esc(s.subjectLabel)}` : ""}</h3>` +
        (weekLine ? meta("Week", weekLine) : "") +
        meta("Shift", c.shift || "—") +
        meta("Time", c.shift ? shiftRange(c.shift) || "—" : "—") +
        meta("Semester", c.semester || "—") +
        meta("Year", c.year || "—") +
        meta("Major", majorName(c.major) || "—") +
        meta("Field", c.field || "—") +
        meta("Degree", c.degree || "—") +
        `<table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse;white-space:nowrap">${thead}${rows}</table>`
      );
    })
    .join("")}</body></html>`;
}

function doExport(sheets, type) {
  const html = attendanceExportHTML(sheets);
  const blob = new Blob(["\ufeff", html], {
    type: type === "word" ? "application/msword" : "application/vnd.ms-excel",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const base = sheets.length === 1 && sheets[0].cls ? sheets[0].cls.name : "attendance";
  a.download = `${base.replace(/\s+/g, "-")}.${type === "word" ? "doc" : "xls"}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Numbered step badge for the marking wizard toolbar (1 = Subject, 2 = Week, 3 = Mark with).
    `n` is passed in by the caller so the numbering shifts when the Subject row is hidden. */
function stepLabel(n, text) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1" style={{ background: "#e2e8f0", color: "#1e293b" }}>
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
        style={{ background: "var(--primary)" }}
      >
        {n}
      </span>
      <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wider">{text}</span>
    </span>
  );
}

function ClassLabel({ cls, count, className, style, children }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const { pos, menuRef } = useDropPos(ref, open, { rows: 10, minWidth: 252, maxHeight: 360 });

  const rows = [
    ["Shift", cls.shift || "—"],
    ["Time", cls.shift ? shiftRange(cls.shift) || "—" : "—"],
    ["Semester", cls.semester || "—"],
    ["Year", cls.year || "—"],
    ["Major", majorName(cls.major) || "—"],
    ["Field", cls.field || "—"],
    ["Degree", cls.degree || "—"],
  ];

  return (
    <>
      <span
        ref={ref}
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        className={className || "cursor-pointer inline-flex items-center gap-1.5 select-none"}
        style={style}
        title="Click for class details"
      >
        {children}
        <ChevronRight
          size={11}
          className={`shrink-0 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
          style={{ color: "#94a3b8" }}
        />
      </span>
      {open &&
        pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onMouseDown={() => setOpen(false)} />
            <div
              ref={menuRef}
              className={`fixed z-50 rounded-xl p-3 shadow-lg border ${pos.up ? "animate-fade-down" : "animate-fade-up"}`}
              style={{
                left: pos.left,
                width: pos.width,
                maxHeight: pos.maxHeight,
                top: pos.top,
                bottom: pos.bottom,
                background: "#ffffff",
                borderColor: "#e2e8f0",
              }}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-sm font-bold truncate" style={{ color: "#1e293b" }}>
                  {cls.name}
                </span>
                <span className="shrink-0 text-[10px] font-bold rounded px-2 py-1" style={{ background: "#f1f5f9", color: "#64748b" }}>
                  {count} students
                </span>
              </div>
              <div className="grid grid-cols-[62px_1fr] gap-x-3 gap-y-1.5">
                {rows.map(([k, v]) => (
                  <Fragment key={k}>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#94a3b8" }}>
                      {k}
                    </span>
                    <span className="text-xs font-medium break-words" style={{ color: "#334155" }}>
                      {v}
                    </span>
                  </Fragment>
                ))}
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}

function ClassMultiSelect({ options, value = [], onChange, allCount }) {
  const ref = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);

  const close = () => setOpen(false);

  const optMap = useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
  const allSelected = allCount > 0 && value.length >= allCount;

  const toggle = (id) => {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };
  const toggleAll = () => {
    onChange(allSelected ? [] : options.map((o) => o.value));
  };

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
      const estHeight = Math.min(280, (options.length + 2) * 34 + 12);
      const spaceBelow = vh - r.bottom;
      const spaceAbove = r.top;
      const up = spaceBelow < estHeight + GAP + MARGIN && spaceAbove > spaceBelow;
      const width = Math.max(r.width, 260);
      let left = r.left;
      if (left + width > vw - MARGIN) left = Math.max(MARGIN, vw - MARGIN - width);
      const avail = (up ? spaceAbove : spaceBelow) - GAP - MARGIN;
      setPos({
        left,
        minWidth: Math.max(r.width, 260),
        up,
        maxHeight: Math.max(160, Math.min(280, avail)),
        ...(up ? { bottom: vh - r.top + GAP } : { top: r.bottom + GAP }),
      });
    };
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    const onScroll = (e) => {
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
  }, [open, options]);

  const single = value.length === 1 ? optMap.get(value[0]) : null;
  const label =
    value.length === 0
      ? "Select classes…"
      : allSelected
        ? `All classes (${allCount})`
        : single
          ? single.label
          : `${value.length} selected`;

  return (
    <div className="relative w-full">
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center justify-between gap-2 border rounded-lg px-3 text-sm transition-all duration-200"
        style={{
          background: "#ffffff",
          borderColor: open ? "#10b981" : "#e2e8f0",
          color: "#1e293b",
          boxShadow: open ? "0 0 0 2px rgba(16, 185, 129, 0.1)" : "none",
        }}
      >
        <span className="flex items-center gap-2 min-w-0">
          <ChevronDown
            size={15}
            className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            style={{ color: "#94a3b8" }}
          />
          <span className="truncate font-medium text-sm">{label}</span>
        </span>
        <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold tabular-nums" style={{ background: "#f1f5f9", color: "#64748b" }}>
          {value.length}/{allCount}
        </span>
      </button>

      {open &&
        pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onMouseDown={close} />
            <div
              ref={menuRef}
              className={`fixed z-50 rounded-xl p-1.5 overflow-y-auto thin-scroll shadow-lg border ${pos.up ? "dd-panel dd-up" : "dd-panel"}`}
              style={{
                left: pos.left,
                minWidth: pos.minWidth,
                maxHeight: pos.maxHeight,
                ...(pos.bottom != null ? { bottom: pos.bottom } : { top: pos.top }),
                background: "#ffffff",
                borderColor: "#e2e8f0",
              }}
            >
              <button
                type="button"
                onClick={toggleAll}
                className="dd-enter flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition-colors hover:bg-emerald-50"
                style={{ color: "#047857" }}
              >
                <span
                  className="flex h-4 w-4 items-center justify-center rounded border shrink-0"
                  style={{
                    borderColor: allSelected ? "#10b981" : "#cbd5e1",
                    background: allSelected ? "#10b981" : "transparent",
                  }}
                >
                  {allSelected ? <Check size={11} style={{ color: "#fff" }} /> : null}
                </span>
                <Users size={14} />
                All classes
                <span className="ml-auto text-[10px] font-bold tabular-nums" style={{ color: "#94a3b8" }}>
                  {allCount}
                </span>
              </button>
              <div className="my-1 h-px" style={{ background: "#e2e8f0" }} />
              {options.map((o, i) => {
                const on = value.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggle(o.value)}
                    className="dd-enter flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-slate-50"
                    style={{ color: "#1e293b", "--i": i + 1 }}
                  >
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded border shrink-0"
                      style={{
                        borderColor: on ? "#10b981" : "#cbd5e1",
                        background: on ? "#10b981" : "transparent",
                      }}
                    >
                      {on ? <Check size={11} style={{ color: "#fff" }} /> : null}
                    </span>
                    <span className="truncate">
                      {o.label}
                      {o.detail ? (
                        <span className="ml-1.5 text-[10px]" style={{ color: "#94a3b8" }}>
                          {o.detail}
                        </span>
                      ) : null}
                    </span>
                    <span className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold tabular-nums" style={{ background: "#f1f5f9", color: "#64748b" }}>
                      {o.count}
                    </span>
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

function ClassGrid({
  cls,
  students,
  weeks,
  focusKey,
  onSelectWeek,
  onAddWeek,
  onRemoveWeek,
  subjects,
  subject,
  onSelectSubject,
  dailyOf,
  onPick,
  onPickMany,
  onReset,
  onSave,
  dirtySubjects = [],
  onStudentClick,
  tool,
  onToolChange,
  onDeleteClass,
}) {
  const week = weeks.find((w) => w.key === focusKey) || weeks[weeks.length - 1] || null;
  const weekNo = week ? weeks.findIndex((w) => w.key === week.key) + 1 : 0;
  const days = useMemo(() => (week ? weekDays(week.start) : []), [week]);
  const activeSubj = subjects.find((x) => x.key === subject) || subjects[0];
  const hasRealSubjects = subjects.length > 1 || (subjects.length === 1 && subjects[0].key !== "general");
  const activeTool = toolOf(tool);

  const statusOf = (s, date) => ((dailyOf[s.id] || {})[subject] || {})[date] || "";

  const rateFor = (s) => {
    if (!days.length) return 0;
    const map = (dailyOf[s.id] || {})[subject] || {};
    const pres = days.filter((d) => map[d.date] === "present" || map[d.date] === "late").length;
    return Math.round((pres / days.length) * 100);
  };

  const avgRate = students.length
    ? Math.round(students.reduce((acc, s) => acc + rateFor(s), 0) / students.length)
    : 0;

  /* how the week currently stands, for the summary chips */
  const tally = useMemo(() => {
    const out = { present: 0, late: 0, absent: 0, leave: 0, blank: 0 };
    students.forEach((s) => {
      days.forEach((d) => {
        const st = statusOf(s, d.date);
        if (st && out[st] !== undefined) out[st] += 1;
        else out.blank += 1;
      });
    });
    return out;
  }, [students, days, dailyOf, subject]);

  const countsFor = (date) => {
    const out = { present: 0, late: 0, absent: 0, leave: 0, blank: 0 };
    students.forEach((s) => {
      const st = statusOf(s, date);
      if (st && out[st] !== undefined) out[st] += 1;
      else out.blank += 1;
    });
    return out;
  };

  const painting = useRef(false);
  useEffect(() => {
    const stop = () => {
      painting.current = false;
    };
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchend", stop);
    window.addEventListener("blur", stop);
    return () => {
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchend", stop);
      window.removeEventListener("blur", stop);
    };
  }, []);

  const startCell = (s, d) => {
    painting.current = true;
    onPick(s, d.date, statusOf(s, d.date) === tool ? "" : tool);
  };

  const dragCell = (s, d) => {
    if (!painting.current) return;
    if (statusOf(s, d.date) !== tool) onPick(s, d.date, tool);
  };

  const fillColumn = (d) =>
    onPickMany(students.map((s) => ({ student: s, date: d.date, status: tool })));

  const fillRow = (s) => onPickMany(days.map((d) => ({ student: s, date: d.date, status: tool })));

  const fillBlanks = () => {
    const cells = [];
    students.forEach((s) =>
      days.forEach((d) => {
        if (!statusOf(s, d.date)) cells.push({ student: s, date: d.date, status: tool });
      })
    );
    if (cells.length) onPickMany(cells);
  };

  return (
    <div
      className="overflow-hidden rounded-2xl border shadow-sm"
      style={{ borderColor: "#e2e8f0", background: "#ffffff" }}
    >
      <div className="px-5 py-4" style={{ background: "#f8fafc" }}>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: "#10b981" }} />
              <ClassLabel
                cls={cls}
                count={students.length}
                className="group flex min-w-0 cursor-pointer items-center gap-1.5"
              >
                <h2
                  className="truncate text-lg font-bold transition-colors group-hover:text-emerald-600"
                  style={{ color: "#1e293b" }}
                >
                  {cls.name}
                </h2>
              </ClassLabel>
            </div>
            <p className="mt-1 text-[11px]" style={{ color: "var(--text-3)" }}>
              {students.length} students · {week ? `Week ${weekNo} · ${week.range}` : "no week selected"} · {avgRate}%
              average
              {hasRealSubjects ? (
                <>
                  {" "}
                  · <b style={{ color: "var(--text-2)" }}>{subjectLabelOf(activeSubj)}</b>
                </>
              ) : null}
              {" · "}
              <span style={{ color: "var(--text-3)" }}>click the class name for full details</span>
            </p>

            {week && students.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {MARK_TOOLS.filter((t) => t.value).map((t) => (
                  <span
                    key={t.value}
                    className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: t.soft, color: t.color }}
                  >
                    <span className="h-1 w-1 rounded-full" style={{ background: t.color }} />
                    {t.label} <b className="tabular-nums">{tally[t.value]}</b>
                  </span>
                ))}
                <span
                  className="flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-semibold"
                  style={{ borderColor: "#cbd5e1", color: "#94a3b8" }}
                >
                  Empty <b className="tabular-nums">{tally.blank}</b>
                </span>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {dirtySubjects.length > 0 && (
              <span
                className="flex items-center rounded-lg px-2.5 py-1.5 text-[10px] font-bold"
                style={{ background: "#fef3c7", color: "#92400e" }}
              >
                {dirtySubjects.length} unsaved
              </span>
            )}
            <button
              onClick={onReset}
              className="flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all hover:bg-red-50"
              style={{ borderColor: "#e2e8f0", color: "#dc2626" }}
              title="Erase every mark on this sheet for the selected week — nothing is saved until you press Save"
            >
              <RotateCcw size={13} /> Clear week
            </button>
            <button
              onClick={onSave}
              disabled={dirtySubjects.length === 0}
              className="flex items-center gap-1 rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "#10b981" }}
            >
              <CheckCircle2 size={13} /> Save
            </button>
          </div>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-6 text-center">
          <span className="text-sm font-medium" style={{ color: "#64748b" }}>
            No students yet
          </span>
        </div>
      ) : !week ? (
        <div className="px-5 py-6 text-center text-sm" style={{ color: "#94a3b8" }}>
          No week selected
        </div>
      ) : (
        <>
          {hasRealSubjects && (
            <div
              className="flex flex-wrap items-center gap-1.5 border-b px-5 py-3.5"
              style={{ borderColor: "var(--border)", background: "#f1f5f9" }}
            >
              {stepLabel(1, "Subject")}
              {subjects.map((sub) => {
                const active = sub.key === subject;
                return (
                  <button
                    key={sub.key}
                    type="button"
                    onClick={() => onSelectSubject(sub.key)}
                    className="flex max-w-44 flex-col items-start rounded-lg px-2.5 py-1.5 text-left transition-colors"
                    style={
                      active
                        ? { background: "#10b981", color: "#fff" }
                        : { background: "#e2e8f0", color: "#1e293b" }
                    }
                  >
                    <span className="break-words text-[11px] font-bold leading-tight">{sub.name}</span>
                    {sub.day ? (
                      <span className="text-[9px] font-semibold leading-tight" style={{ color: active ? "#d1fae5" : "#64748b" }}>
                        {sub.day}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 2 — which week */}
          <div
            className="flex flex-wrap items-center gap-1.5 border-b px-5 py-3.5"
            style={{ borderColor: "var(--border)", background: "#f1f5f9" }}
          >
            {stepLabel(hasRealSubjects ? 2 : 1, "Week")}
            {weeks.map((w, i) => {
              const active = w.key === week.key;
              return (
                <button
                  key={w.key}
                  type="button"
                  onClick={() => onSelectWeek(w.key)}
                  className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold tabular-nums transition-colors"
                  style={
                    active
                      ? { background: "var(--primary)", color: "#fff" }
                      : { background: "var(--surface-2)", color: "var(--text-2)" }
                  }
                  title={`Week ${i + 1} · ${w.range}`}
                >
                  W{i + 1}
                </button>
              );
            })}
            <button
              type="button"
              onClick={onAddWeek}
              className="flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--primary-soft)]"
              style={{ borderColor: "var(--border)", color: "var(--primary-strong)" }}
              title="Add a new week to this class only"
            >
              <PlusCircle size={13} /> Add W{weeks.length + 1}
            </button>
            <button
              type="button"
              onClick={() => onRemoveWeek(week.key)}
              disabled={weeks.length <= 1}
              className="flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--danger-soft)] disabled:cursor-not-allowed disabled:opacity-40"
              style={{ borderColor: "var(--border)", color: "var(--danger)" }}
              title={`Delete week ${weekNo}${weeks.length <= 1 ? " — a sheet needs at least one week" : ""}`}
            >
              <Trash2 size={13} /> Remove week
            </button>
          </div>

          {/* Step 3 — the marking toolbar. Pick once, then click cells. */}
          <div
            className="border-b px-5 py-4"
            style={{ borderColor: "var(--border)", background: "#f1f5f9" }}
          >
            <div className="flex flex-wrap items-center gap-2">
              {stepLabel(hasRealSubjects ? 3 : 2, "Mark with")}
              <div className="flex flex-wrap items-center gap-1.5">
                {MARK_TOOLS.map((t) => {
                  const active = t.value === tool;
                  return (
                    <button
                      key={t.value || "erase"}
                      type="button"
                      onClick={() => onToolChange(t.value)}
                      className="flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition-all"
                      style={
                        active
                          ? {
                              background: t.value ? t.color : "var(--surface-3)",
                              borderColor: t.value ? t.color : "var(--text-3)",
                              color: t.value ? "#fff" : "var(--text)",
                              boxShadow: "0 6px 14px -8px var(--text-2)",
                            }
                          : { background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-2)" }
                      }
                      title={`${t.label} — press ${t.hint}`}
                      aria-pressed={active}
                    >
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-extrabold"
                        style={
                          active
                            ? { background: "rgba(255,255,255,.22)", color: "inherit" }
                            : { background: t.soft, color: t.color }
                        }
                      >
                        {t.short}
                      </span>
                      {t.label}
                      <span className="text-[9px] font-semibold opacity-60">{t.hint}</span>
                    </button>
                  );
                })}
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={fillBlanks}
                  disabled={!tool}
                  className="flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-semibold transition-colors hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ borderColor: "var(--border)", color: "var(--text-2)" }}
                  title={`Give every still-unmarked cell this week the "${activeTool.label}" status`}
                >
                  <Wand2 size={13} /> Fill empty cells
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto thin-scroll">
            <table
              className="w-full text-sm"
              style={{
                minWidth: 260 + days.length * 110 + 80,
                borderCollapse: "separate",
                borderSpacing: 0,
              }}
            >
              <thead>
                <tr>
                  <th
                    className="sticky left-0 z-20 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      background: "#ffffff",
                      color: "#94a3b8",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    Student
                  </th>
                  {days.map((d) => {
                    const dShort = new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
                    const isSubjectDay = hasRealSubjects && activeSubj?.day && activeSubj.day === dShort;
                    const c = countsFor(d.date);
                    return (
                      <th
                        key={d.date}
                        className="px-1 py-1.5 align-top"
                        style={{
                          borderBottom: "1px solid #e2e8f0",
                          borderLeft: "1px solid #e2e8f0",
                          background: isSubjectDay ? "#d1fae5" : undefined,
                        }}
                      >
                        <div className="flex flex-col items-stretch gap-0.5">
                          <div className="flex flex-col items-center leading-tight">
                            <span
                              className="text-[10px] font-bold"
                              style={{ color: isSubjectDay ? "#047857" : "#64748b" }}
                            >
                              {d.name}
                            </span>
                            <span className="text-[8px] tabular-nums" style={{ color: "#94a3b8" }}>
                              {d.short}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => fillColumn(d)}
                            className="flex h-5 items-center justify-center gap-0.5 rounded border text-[9px] font-semibold transition-colors hover:bg-slate-100"
                            style={{ borderColor: "#cbd5e1", color: "#64748b" }}
                            title={`Fill ${activeTool.label}`}
                          >
                            <ChevronsDown size={10} /> {activeTool.short || "–"}
                          </button>
                        </div>
                      </th>
                    );
                  })}
                  <th
                    className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      background: "#ffffff",
                      color: "#94a3b8",
                      borderBottom: "1px solid #e2e8f0",
                      borderLeft: "1px solid #e2e8f0",
                    }}
                  >
                    Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, rowIdx) => {
                  const rate = rateFor(s);
                  const zebra = rowIdx % 2 === 1 ? "#fafbfc" : "#ffffff";
                  return (
                    <tr key={s.id} className="group">
                      <td
                        className="sticky left-0 z-10 px-4 py-3"
                        style={{ background: zebra, borderBottom: "1px solid var(--border)" }}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onStudentClick?.(s)}
                            className="flex min-w-0 items-center gap-2 text-left"
                            title="Open attendance history"
                          >
                            <StudentAvatar student={s} size="sm" />
                            <div className="min-w-0">
                              <p
                                className="truncate text-[13px] font-semibold leading-normal"
                                style={{ color: "var(--text)" }}
                              >
                                {s.khmerName || `${s.firstName} ${s.lastName}`}
                              </p>
                              {s.khmerName ? (
                                <p className="truncate text-[11px] leading-snug" style={{ color: "var(--text-3)" }}>
                                  {s.firstName} {s.lastName}
                                </p>
                              ) : null}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => fillRow(s)}
                            className="ml-auto flex h-5 shrink-0 items-center gap-0.5 rounded border px-1 text-[9px] font-semibold opacity-0 transition-opacity hover:bg-slate-100 focus:opacity-100 group-hover:opacity-100"
                            style={{ borderColor: "#cbd5e1", color: "#64748b" }}
                            title={`Fill row with ${activeTool.label}`}
                          >
                            <ChevronsRight size={10} />
                          </button>
                        </div>
                      </td>

                      {days.map((d) => {
                        const st = statusOf(s, d.date);
                        const meta = WEEK_STATUS[st];
                        return (
                          <td
                            key={d.date}
                            className="px-1 py-1"
                            style={{
                              background: zebra,
                              borderBottom: "1px solid #e2e8f0",
                              borderLeft: "1px solid #e2e8f0",
                            }}
                          >
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                startCell(s, d);
                              }}
                              onMouseEnter={() => dragCell(s, d)}
                              className="flex h-8 w-full select-none items-center justify-center gap-1 rounded border text-[10px] font-medium transition-all duration-75 hover:scale-[1.02]"
                              style={
                                meta
                                  ? {
                                      background: meta.soft,
                                      color: meta.color,
                                      borderColor: "transparent",
                                      fontWeight: 600,
                                    }
                                  : {
                                      background: "transparent",
                                      borderStyle: "dashed",
                                      borderColor: "#cbd5e1",
                                      color: "#94a3b8",
                                    }
                              }
                            >
                              {meta ? (
                                <>
                                  <span className="text-[9px] font-extrabold">{meta.short}</span>
                                  <span className="hidden sm:inline">{meta.label}</span>
                                </>
                              ) : (
                                <span className="opacity-60">+</span>
                              )}
                            </button>
                          </td>
                        );
                      })}

                      <td
                        className="px-2 py-1 text-right"
                        style={{
                          background: zebra,
                          borderBottom: "1px solid #e2e8f0",
                          borderLeft: "1px solid #e2e8f0",
                        }}
                      >
                        <span className="text-[10px] font-bold tabular-nums" style={{ color: rateTone(rate) }}>
                          {rate}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td
                    className="sticky left-0 z-10 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider"
                    style={{ background: "#fafbfc", color: "#94a3b8" }}
                  >
                    Daily
                  </td>
                  {days.map((d) => {
                    const c = countsFor(d.date);
                    return (
                      <td
                        key={d.date}
                        className="px-1 py-1.5 text-center"
                        style={{ background: "#fafbfc", borderLeft: "1px solid #e2e8f0" }}
                      >
                        <div className="flex items-center justify-center gap-0.5 text-[9px] font-bold tabular-nums flex-wrap">
                          {MARK_TOOLS.filter((t) => t.value && c[t.value] > 0).map((t) => (
                            <span
                              key={t.value}
                              className="rounded px-1 py-px"
                              style={{ background: t.soft, color: t.color, fontSize: "8px" }}
                            >
                              {c[t.value]}{t.short}
                            </span>
                          ))}
                          {c.blank > 0 && (
                            <span style={{ color: "#94a3b8", fontSize: "8px" }}>{c.blank}·</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td style={{ background: "#fafbfc", borderLeft: "1px solid #e2e8f0" }} />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ── read-only view: every student × every subject, who missed what ── */
function ClassView({ cls, students, week, weekLabel, subjects, dailyOf, scopeDay, onDeleteClass }) {
  const days = useMemo(() => (week ? weekDays(week.start) : []), [week]);
  const dayObj = scopeDay ? days.find((d) => d.date === scopeDay) || null : null;
  const allWeek = !dayObj;
  const dayShort = dayObj ? new Date(dayObj.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }) : "";
  const subMeetsDay = (sub, d) => !sub.day || sub.day === new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });

  const statusAt = (s, sub, date) => ((dailyOf[s.id] || {})[sub.key] || {})[date] || "";

  const weekStat = (s, sub) => {
    const map = (dailyOf[s.id] || {})[sub.key] || {};
    let marked = 0, pres = 0, abs = 0;
    days.forEach((d) => {
      const st = map[d.date];
      if (!st) return;
      marked++;
      if (st === "present" || st === "late") pres++;
      else abs++;
    });
    return { marked, pres, abs };
  };

  const missedOn = (s) => {
    const out = [];
    subjects.forEach((sub) => {
      if (allWeek) {
        const { abs } = weekStat(s, sub);
        if (abs > 0) out.push({ sub, n: abs });
      } else {
        const st = statusAt(s, sub, dayObj.date);
        if (st === "absent" || st === "leave") out.push({ sub, n: 1, st });
      }
    });
    return out;
  };

  const overall = (s) => {
    let marked = 0, pres = 0;
    subjects.forEach((sub) => {
      if (allWeek) {
        const w = weekStat(s, sub);
        marked += w.marked;
        pres += w.pres;
      } else {
        const st = statusAt(s, sub, dayObj.date);
        if (st) {
          marked++;
          if (st === "present" || st === "late") pres++;
        }
      }
    });
    return { marked, rate: marked ? Math.round((pres / marked) * 100) : null };
  };

  const subjectAbs = (sub) =>
    students.reduce((a, s) => {
      if (allWeek) return a + weekStat(s, sub).abs;
      const st = statusAt(s, sub, dayObj.date);
      return a + (st === "absent" || st === "leave" ? 1 : 0);
    }, 0);

  return (
    <div
      className="overflow-hidden rounded-2xl border shadow-sm"
      style={{ borderColor: "#e2e8f0", background: "#ffffff" }}
    >
      <div className="px-5 py-3 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ background: "#f8fafc" }}>
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: "#10b981" }} />
        <h2 className="text-lg font-bold truncate" style={{ color: "#1e293b" }}>
          {cls.name}
        </h2>
        <span className="text-[10px]" style={{ color: "#94a3b8" }}>
          {students.length} students · {allWeek ? weekLabel : `${dayObj.name} · ${dayObj.short}`} · {subjects.length} subject{subjects.length === 1 ? "" : "s"}
        </span>
        {onDeleteClass && (
          <button
            type="button"
            onClick={() => onDeleteClass(cls)}
            className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[var(--danger-soft)]"
            title={`Delete the class "${cls.name}"`}
            style={{ color: "var(--text-3)" }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="overflow-x-auto thin-scroll">
        <table
          className="w-full text-sm"
          style={{
            minWidth: 280 + subjects.length * 110 + 200,
            borderCollapse: "separate",
            borderSpacing: "0 4px",
          }}
        >
          <thead>
            <tr>
              <th
                className="sticky left-0 z-20 text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: "#ffffff", color: "#94a3b8", borderBottom: "1px solid #e2e8f0" }}
              >
                Student
              </th>
              {subjects.map((sub) => {
                const abs = subjectAbs(sub);
                const meets = allWeek || subMeetsDay(sub, dayObj);
                return (
                  <th
                    key={sub.key}
                    className="text-center px-1.5 py-2 align-top"
                    style={{
                      borderBottom: "1px solid #e2e8f0",
                      borderLeft: "1px solid #e2e8f0",
                      background: !allWeek && meets ? "#d1fae5" : undefined,
                    }}
                  >
                    <span className="block text-[10px] font-bold leading-tight" style={{ color: !allWeek && meets ? "#047857" : "#64748b" }}>
                      {sub.name}
                    </span>
                    <span className="block text-[8px] leading-tight" style={{ color: "#94a3b8" }}>
                      {sub.day ? `${sub.day}` : "—"}
                    </span>
                    {abs > 0 ? (
                      <span className="block text-[8px] font-bold leading-tight" style={{ color: "#ef4444" }}>
                        {abs} abs
                      </span>
                    ) : null}
                  </th>
                );
              })}
              <th
                className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: "#ffffff", color: "#94a3b8", borderBottom: "1px solid #e2e8f0", borderLeft: "1px solid #e2e8f0" }}
              >
                Missed
              </th>
              <th
                className="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: "#ffffff", color: "#94a3b8", borderBottom: "1px solid #e2e8f0", borderLeft: "1px solid #e2e8f0" }}
              >
                Rate
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const missed = missedOn(s);
              const ov = overall(s);
              return (
                <tr key={s.id}>
                  <td className="sticky left-0 z-10 px-4 py-3" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                    <button type="button" className="flex items-center gap-2.5 min-w-0 text-left" title={`${s.firstName} ${s.lastName}`}>
                      <StudentAvatar student={s} size="sm" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold leading-normal truncate" style={{ color: "var(--text)" }}>{s.khmerName || `${s.firstName} ${s.lastName}`}</p>
                        <p className="text-[10px] leading-snug truncate" style={{ color: "var(--text-3)" }}>{s.studentId || ""}</p>
                      </div>
                    </button>
                  </td>

                  {subjects.map((sub) => {
                    if (allWeek) {
                      const w = weekStat(s, sub);
                      const rate = w.marked ? Math.round((w.pres / w.marked) * 100) : null;
                      return (
                        <td key={sub.key} className="px-1.5 py-1 text-center" style={{ borderBottom: "1px solid #e2e8f0", borderLeft: "1px solid #e2e8f0" }}>
                          {rate == null ? (
                            <span className="text-[10px]" style={{ color: "#94a3b8" }}>
                              —
                            </span>
                          ) : (
                            <span className="inline-flex flex-col items-center gap-0.5">
                              <span className="text-[10px] font-bold tabular-nums" style={{ color: rateTone(rate) }}>
                                {rate}%
                              </span>
                              {w.abs > 0 ? (
                                <span className="rounded-full px-1 py-px text-[8px] font-bold" style={{ background: "#fee2e2", color: "#dc2626" }}>
                                  {w.abs}
                                </span>
                              ) : null}
                            </span>
                          )}
                        </td>
                      );
                    }
                    const st = statusAt(s, sub, dayObj.date);
                    const meta = WEEK_STATUS[st];
                    const meets = subMeetsDay(sub, dayObj);
                    return (
                      <td key={sub.key} className="px-1.5 py-1 text-center" style={{ borderBottom: "1px solid #e2e8f0", borderLeft: "1px solid #e2e8f0" }}>
                        {meta ? (
                          <span className="inline-flex h-6 min-w-[50px] items-center justify-center rounded px-1.5 text-[10px] font-bold" style={{ background: meta.soft, color: meta.color }}>
                            {meta.short}
                          </span>
                        ) : (
                          <span className="text-[10px]" style={{ color: "#94a3b8" }}>
                            {meets ? "·" : "–"}
                          </span>
                        )}
                      </td>
                    );
                  })}

                  <td className="px-3 py-1" style={{ borderBottom: "1px solid #e2e8f0", borderLeft: "1px solid #e2e8f0" }}>
                    {missed.length === 0 ? (
                      <span className="text-[10px]" style={{ color: "#94a3b8" }}>
                        —
                      </span>
                    ) : (
                      <span className="flex flex-wrap gap-0.5">
                        {missed.map((m) => (
                          <span key={m.sub.key} className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: "#fee2e2", color: "#dc2626" }}>
                            {m.sub.name}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1 text-right" style={{ borderBottom: "1px solid #e2e8f0", borderLeft: "1px solid #e2e8f0" }}>
                    {ov.rate == null ? (
                      <span className="text-[10px]" style={{ color: "#94a3b8" }}>
                        —
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold tabular-nums" style={{ color: rateTone(ov.rate) }}>
                        {ov.rate}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Attendance() {
  const { students, classes, attendance, saveAttendance, showToast, logAudit, deleteClass } = useApp();
  const [searchParams] = useSearchParams();
  const classParam = searchParams.get("class");

  /* Which class sheets are open, remembered across a refresh so the panel comes
     back to the same sheets instead of "no class selected". An explicit ?class=
     link wins; ids whose class has since been deleted are dropped. With nothing
     remembered we open the first class rather than show an empty panel — the
     empty state is then only reachable when no class exists at all, or after the
     user clears the selection themselves (an empty list is remembered as such). */
  const [sel, setSel] = useState(() => {
    if (classParam && classes.some((c) => c.id === classParam)) return [classParam];
    const live = classes.map((c) => c.id);
    try {
      const stored = localStorage.getItem(LS_CLASS_SEL);
      if (stored !== null) {
        const raw = JSON.parse(stored);
        if (Array.isArray(raw)) {
          const kept = raw.filter((id) => live.includes(id));
          // everything remembered is gone — fall back instead of sitting empty
          if (kept.length || raw.length === 0) return kept;
        }
      }
    } catch {
      /* ignore */
    }
    return live.length ? [live[0]] : [];
  });

  // a class deleted while the page is open must not linger in the selection
  useEffect(() => {
    setSel((prev) => {
      const live = classes.map((c) => c.id);
      const kept = prev.filter((id) => live.includes(id));
      return kept.length === prev.length ? prev : kept;
    });
  }, [classes]);

  // remember which sheets are open
  useEffect(() => {
    try {
      localStorage.setItem(LS_CLASS_SEL, JSON.stringify(sel));
    } catch {
      /* ignore */
    }
  }, [sel]);
  const [q, setQ] = useState("");
  const [classQ, setClassQ] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formClass, setFormClass] = useState(null);
  const [dlSel, setDlSel] = useState(false);
  const [dlAll, setDlAll] = useState(false);
  const [dlChecked, setDlChecked] = useState({});
  const [dayStudent, setDayStudent] = useState(null); // student whose day log is open
  const [delClassTarget, setDelClassTarget] = useState(null); // class awaiting delete confirmation
  const [focusKey, setFocusKey] = useState(() => lastNWeeks(15)[0].key); // selected week (shared by all sheets) — always starts on the first week
  const [draft, setDraft] = useState({}); // staged cells: { studentId: { subjectKey: { dateISO: status } } } — saved only on Save
  const [subjectOf, setSubjectOf] = useState({}); // { classId: subjectKey } — which subject's session is being marked right now
  const [mode, setMode] = useState("mark"); // "mark" | "view"
  const [tool, setTool] = useState("present"); // active marking tool — shared by every sheet on screen
  const [viewDay, setViewDay] = useState(null); // view scope: null = whole week, else a dateISO
  const [scheduleState] = useState(() => readScheduleState()); // read once; Schedule page owns live edits
  const [weekMap, setWeekMap] = useState(() => {
    const base = lastNWeeks(15).map((w) => w.key);
    try {
      const raw = localStorage.getItem(LS_WEEKS);
      if (raw) {
        const v = JSON.parse(raw);
        if (v && typeof v === "object" && !Array.isArray(v)) return v;
      }
      const old = localStorage.getItem(LS_EXTRA_WEEKS);
      const ov = old ? JSON.parse(old) : {};
      const map = {};
      const merge = (clsId, keys) => {
        if (Array.isArray(keys)) {
          map[clsId] = [...base, ...keys.filter((k) => typeof k === "string" && !base.includes(k))];
        }
      };
      if (Array.isArray(ov)) merge("*", ov);
      else if (ov && typeof ov === "object") Object.entries(ov).forEach(([id, keys]) => merge(id, keys));
      return map;
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(LS_WEEKS, JSON.stringify(weekMap));
  }, [weekMap]);

  const baseWeeks = useMemo(() => lastNWeeks(15), []);
  const baseKeys = useMemo(() => baseWeeks.map((w) => w.key), [baseWeeks]);
  const weeksOf = useMemo(() => {
    /* Always open on the CURRENT 15-week window: each class's list starts with
       today's base weeks (so W1 is always the first week), then keeps any extra
       weeks the admin added — stale weeks from an older window are dropped. */
    const map = {};
    classes.forEach((c) => {
      const stored =
        weekMap[c.id] !== undefined ? weekMap[c.id] : weekMap["*"] !== undefined ? weekMap["*"] : [];
      const custom = (Array.isArray(stored) ? stored : []).filter(
        (k) => typeof k === "string" && !baseKeys.includes(k) && k >= baseKeys[0]
      );
      map[c.id] = [...baseKeys, ...custom].map(weekFromKey);
    });
    return map;
  }, [classes, weekMap, baseKeys]);
  const attendanceOf = useMemo(() => {
    const map = {};
    attendance.forEach((r) => {
      const subj = r.subject || "general";
      map[r.studentId] = map[r.studentId] || {};
      map[r.studentId][subj] = map[r.studentId][subj] || {};
      map[r.studentId][subj][r.date] = r.status;
    });
    return map;
  }, [attendance]);

  const classById = useMemo(() => {
    const map = {};
    classes.forEach((c) => (map[c.id] = c));
    return map;
  }, [classes]);

  const subjectsOf = useMemo(() => {
    const map = {};
    classes.forEach((c) => {
      map[c.id] = subjectsForClass(scheduleState.schedules, c);
    });
    return map;
  }, [classes, scheduleState]);

  const currentSubject = (clsId) => subjectOf[clsId] || subjectsOf[clsId]?.[0]?.key || "general";

  const classOptions = useMemo(
    () =>
      classes
        .map((c) => ({
          value: c.id,
          label: c.name,
          detail: c.field || "General",
          count: students.filter((s) => s.className === c.id && s.status !== "Graduate").length,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [classes, students]
  );

  const classMatches = (id, word) => {
    const w = (word || "").trim().toLowerCase();
    if (!w) return true;
    const c = classById[id];
    if (!c) return false;
    return `${c.name} ${c.field || ""} ${c.shift || ""} ${majorName(c.major)}`.toLowerCase().includes(w);
  };
  const filteredOptions = useMemo(
    () => (classQ ? classOptions.filter((o) => classMatches(o.value, classQ)) : classOptions),
    [classOptions, classQ, classById]
  );
  const visibleSel = useMemo(() => {
    const matched = classQ ? classes.filter((c) => classMatches(c.id, classQ)).map((c) => c.id) : [];
    const base = classQ || sel.length > 0 ? sel : q.trim() ? classes.map((c) => c.id) : [];
    return Array.from(new Set([...base, ...matched]));
  }, [sel, classQ, q, classes, classById]);

  const roster = useMemo(() => {
    if (visibleSel.length === 0) return [];
    const word = q.trim().toLowerCase();
    return students
      .filter((s) => visibleSel.includes(s.className) && s.status !== "Graduate")
      .filter((s) => {
        if (!word) return true;
        const hay = `${s.firstName} ${s.lastName} ${s.khmerName || ""} ${s.studentId || ""}`.toLowerCase();
        return word.split(/\s+/).every((w) => hay.includes(w));
      })
      .sort((a, b) =>
        `${classById[a.className]?.name || ""} ${a.firstName} ${a.lastName}`.localeCompare(
          `${classById[b.className]?.name || ""} ${b.firstName} ${b.lastName}`
        )
      );
  }, [students, visibleSel, q, classById]);

  const groups = useMemo(() => {
    const map = {};
    roster.forEach((s) => {
      (map[s.className] = map[s.className] || []).push(s);
    });
    const ids = Object.keys(map).sort((a, b) => (classById[a]?.name || "").localeCompare(classById[b]?.name || ""));
    return ids.map((id) => ({ cls: classById[id], list: map[id] }));
  }, [roster, classById]);

  const viewWeeks = useMemo(() => {
    for (const id of visibleSel) if (weeksOf[id]?.length) return weeksOf[id];
    return [];
  }, [visibleSel, weeksOf]);
  const viewWeek = viewWeeks.find((w) => w.key === focusKey) || viewWeeks[viewWeeks.length - 1] || null;
  const viewWeekNo = viewWeek ? viewWeeks.findIndex((w) => w.key === viewWeek.key) + 1 : 0;
  const viewDays = useMemo(() => (viewWeek ? weekDays(viewWeek.start) : []), [viewWeek]);

  const dailyOf = useMemo(() => {
    const map = {};
    Object.keys(attendanceOf).forEach((id) => {
      map[id] = {};
      Object.entries(attendanceOf[id] || {}).forEach(([subj, days]) => {
        map[id][subj] = { ...days };
      });
    });
    Object.entries(draft).forEach(([id, subjMap]) => {
      map[id] = map[id] || {};
      Object.entries(subjMap).forEach(([subj, days]) => {
        const dm = { ...(map[id][subj] || {}) };
        Object.entries(days).forEach(([date, st]) => {
          if (st) dm[date] = st;
          else delete dm[date];
        });
        map[id][subj] = dm;
      });
    });
    return map;
  }, [attendanceOf, draft]);

  const avgRate = useMemo(() => {
    if (!roster.length) return 0;
    const total = roster.reduce((acc, s) => {
      const ws = weeksOf[s.className] || [];
      const wk = ws.find((w) => w.key === focusKey) || ws[ws.length - 1];
      if (!wk) return acc;
      const days = weekDays(wk.start);
      const subj = currentSubject(s.className);
      const map = (dailyOf[s.id] || {})[subj] || {};
      const pres = days.filter((d) => map[d.date] === "present" || map[d.date] === "late").length;
      return acc + Math.round((pres / days.length) * 100);
    }, 0);
    return Math.round(total / roster.length);
  }, [roster, dailyOf, weeksOf, focusKey, subjectOf, subjectsOf]);

  const pickDay = (s, date, subject, status) => {
    setDraft((prev) => {
      const forStudent = prev[s.id] || {};
      const forSubject = forStudent[subject] || {};
      return {
        ...prev,
        [s.id]: { ...forStudent, [subject]: { ...forSubject, [date]: status } },
      };
    });
  };

  const pickMany = (cells, subject) => {
    if (!cells.length) return;
    setDraft((prev) => {
      const next = { ...prev };
      cells.forEach(({ student, date, status }) => {
        const forStudent = { ...(next[student.id] || {}) };
        forStudent[subject] = { ...(forStudent[subject] || {}), [date]: status };
        next[student.id] = forStudent;
      });
      return next;
    });
  };

  useEffect(() => {
    if (mode !== "mark") return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      const hit = MARK_TOOLS.find((x) => x.hint === e.key);
      if (!hit) return;
      e.preventDefault();
      setTool(hit.value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode]);

  const resetSheet = (clsId) => {
    const list = roster.filter((s) => s.className === clsId);
    const ws = weeksOf[clsId] || [];
    const wk = ws.find((w) => w.key === focusKey) || ws[ws.length - 1];
    if (!list.length || !wk) return;
    const days = weekDays(wk.start);
    const subs = subjectsOf[clsId] || [];
    setDraft((prev) => {
      const next = { ...prev };
      list.forEach((s) => {
        const forStudent = { ...(next[s.id] || {}) };
        subs.forEach((sub) => {
          const forSubject = { ...(forStudent[sub.key] || {}) };
          days.forEach((d) => {
            forSubject[d.date] = "";
          });
          forStudent[sub.key] = forSubject;
        });
        next[s.id] = forStudent;
      });
      return next;
    });
    showToast(`Week cleared for ${classById[clsId]?.name || clsId}`);
  };

  const draftRecords = (list, subKeys) => {
    const records = [];
    list.forEach((s) => {
      subKeys.forEach((subKey) => {
        const dm = draft[s.id]?.[subKey];
        if (!dm) return;
        Object.entries(dm).forEach(([date, st]) => {
          records.push({
            id: `${s.id}-${date}-${subKey}`,
            studentId: s.id,
            date,
            subject: subKey,
            status: st,
            checkIn: st === "present" ? "07:30" : st === "late" ? "08:20" : null,
          });
        });
      });
    });
    return records;
  };

  const clearDraftFor = (list, subKeys) => {
    setDraft((prev) => {
      const next = { ...prev };
      list.forEach((s) => {
        if (!next[s.id]) return;
        const forStudent = { ...next[s.id] };
        subKeys.forEach((k) => delete forStudent[k]);
        next[s.id] = forStudent;
      });
      return next;
    });
  };

  const saveSheet = (clsId) => {
    const list = roster.filter((s) => s.className === clsId);
    const subKeys = (subjectsOf[clsId] || []).filter((sub) => classDirty(clsId, sub.key)).map((sub) => sub.key);
    const records = draftRecords(list, subKeys);
    if (!records.length) {
      showToast("No changes to save");
      return;
    }
    saveAttendance(records);
    clearDraftFor(list, subKeys);
    const saved = records.filter((r) => r.status).length;
    showToast(`${saved} record${saved === 1 ? "" : "s"} saved`);
  };

  const totalDraftEdits = useMemo(
    () =>
      Object.values(draft).reduce(
        (a, subMap) => a + Object.values(subMap).reduce((b, days) => b + Object.values(days).filter(Boolean).length, 0),
        0
      ),
    [draft]
  );

  const saveAll = () => {
    const subKeys = Array.from(new Set(roster.flatMap((s) => Object.keys(draft[s.id] || {}))));
    const records = draftRecords(roster, subKeys);
    if (!records.length) {
      showToast("Nothing to save");
      return;
    }
    saveAttendance(records);
    clearDraftFor(roster, subKeys);
    const saved = records.filter((r) => r.status).length;
    showToast(`${saved} record${saved === 1 ? "" : "s"} saved`);
  };

  const discardAll = () => {
    setDraft({});
    showToast("Changes discarded");
  };

  const classDirty = (clsId, subject) =>
    roster.some((s) => s.className === clsId && draft[s.id]?.[subject] && Object.keys(draft[s.id][subject]).length > 0);

  const dirtySubjectsOf = (clsId) => (subjectsOf[clsId] || []).filter((sub) => classDirty(clsId, sub.key));

  const addWeek = (clsId) => {
    const cls = classById[clsId];
    if (!cls) return;
    const baseKeys = baseWeeks.map((w) => w.key);
    const curList = weekMap[clsId] ?? weekMap["*"] ?? baseKeys;
    const lastKey = curList.length ? curList[curList.length - 1] : baseKeys[baseKeys.length - 1];
    const next = new Date(lastKey + "T00:00:00");
    next.setDate(next.getDate() + 7);
    const key = iso(next);
    setWeekMap((prev) => {
      const keys = prev[clsId] ?? prev["*"] ?? baseKeys;
      return { ...prev, [clsId]: [...keys, key] };
    });
    setFocusKey(key);
    showToast(`Week added`);
  };

  const removeWeek = (clsId, wkKey) => {
    const cls = classById[clsId];
    const baseKeys = baseWeeks.map((w) => w.key);
    const curList = weekMap[clsId] ?? weekMap["*"] ?? baseKeys;
    if (curList.length <= 1) {
      showToast("Cannot remove the last week", "error");
      return;
    }
    setWeekMap((prev) => {
      const keys = prev[clsId] ?? prev["*"] ?? baseKeys;
      return { ...prev, [clsId]: keys.filter((k) => k !== wkKey) };
    });
    if (wkKey === focusKey) {
      const remaining = curList.filter((k) => k !== wkKey);
      if (remaining.length) setFocusKey(remaining[remaining.length - 1]);
    }
    showToast(`Week removed`);
  };

  /* Deleting a class is destructive, so it goes through ConfirmDialog.
     deleteClass() already writes the audit entry and detaches schedules. */
  const deleteClassNow = (cls) => setDelClassTarget(cls);

  const confirmDeleteClass = () => {
    if (!delClassTarget) return;
    const { id, name } = delClassTarget;
    deleteClass(id);
    setSel((prev) => prev.filter((cid) => cid !== id));
    setDelClassTarget(null);
    showToast(`Deleted class "${name}"`);
  };

  const noSelected = dlSel && !dlAll && !classes.some((c) => dlChecked[c.id]);
  const dlSheets = () => {
    const list = dlAll ? classes : classes.filter((c) => dlChecked[c.id]);
    const sheets = [];
    list.forEach((c) => {
      const ws = weeksOf[c.id] || [];
      const wk = ws.find((w) => w.key === focusKey) || ws[ws.length - 1] || null;
      const base = {
        cls: c,
        students: students.filter((s) => s.className === c.id && s.status !== "Graduate"),
        week: wk,
        weekLabel: wk ? `W${ws.findIndex((w) => w.key === wk.key) + 1}` : "",
        days: wk ? weekDays(wk.start) : [],
        daily: dailyOf,
      };
      (subjectsOf[c.id] || []).forEach((sub) => {
        sheets.push({ ...base, subjectKey: sub.key, subjectLabel: subjectLabelOf(sub) });
      });
    });
    return sheets;
  };

  return (
    <div>
      <PageHeader
        title="Attendance"
        subtitle="Mark attendance by week and subject, then save. Use View report to see who missed what."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border p-0.5" style={{ borderColor: "#e2e8f0", background: "#f1f5f9" }}>
              {[
                { k: "mark", label: "Mark" },
                { k: "view", label: "View report" },
              ].map((t) => (
                <button
                  key={t.k}
                  onClick={() => setMode(t.k)}
                  className="h-9 rounded-lg px-4 text-sm font-semibold transition-all"
                  style={mode === t.k ? { background: "#10b981", color: "#fff" } : { color: "#64748b" }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setDlAll(false);
                setDlChecked(Object.fromEntries(visibleSel.map((id) => [id, true])));
                setDlSel(true);
              }}
              className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-all hover:bg-slate-100"
              style={{ borderColor: "#e2e8f0", color: "#1e293b" }}
              title="Export attendance to Excel or Word"
            >
              <FileDown size={14} /> Export
            </button>
          </div>
        }
      />

      <div className="rounded-xl border p-4 mb-4 animate-fade-up" style={{ borderColor: "#e2e8f0", background: "#ffffff" }}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex flex-col gap-1.5 lg:w-72 shrink-0">
            <label className="text-[11px] font-bold" style={{ color: "#94a3b8" }}>
              Classes
            </label>
            <ClassMultiSelect options={filteredOptions} value={sel} onChange={setSel} allCount={filteredOptions.length} />
          </div>
          <div className="flex flex-col gap-1.5 lg:w-72">
            <label className="text-[11px] font-bold" style={{ color: "#94a3b8" }}>
              Search class
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94a3b8" }} />
              <input
                value={classQ}
                onChange={(e) => setClassQ(e.target.value)}
                className="pl-9 pr-8 h-10 w-full rounded-lg border text-sm"
                style={{ borderColor: "#e2e8f0" }}
                placeholder="Search…"
              />
              {classQ && (
                <button onClick={() => setClassQ("")} className="absolute right-2 top-1/2 -translate-y-1/2" aria-label="Clear">
                  <X size={14} style={{ color: "#94a3b8" }} />
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 lg:w-72">
            <label className="text-[11px] font-bold" style={{ color: "#94a3b8" }}>
              Search students
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94a3b8" }} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 pr-8 h-10 w-full rounded-lg border text-sm"
                style={{ borderColor: "#e2e8f0" }}
                placeholder="Name or ID…"
              />
              {q && (
                <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2" aria-label="Clear">
                  <X size={14} style={{ color: "#94a3b8" }} />
                </button>
              )}
            </div>
          </div>
        </div>

        {sel.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3" style={{ borderTop: "1px solid #e2e8f0" }}>
            <span className="text-[10px] font-bold" style={{ color: "#94a3b8", marginRight: "0.5rem" }}>
              Sheets
            </span>
            {visibleSel.map((id) => {
              const c = classById[id];
              if (!c) return null;
              return (
                <span
                  key={id}
                  className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10px] max-w-full"
                  style={{ borderColor: "#e2e8f0", background: "#f8fafc" }}
                >
                  <span className="truncate font-semibold" style={{ color: "#1e293b" }}>
                    {c.name}
                  </span>
                  <button
                    onClick={() => setSel(sel.filter((x) => x !== id))}
                    className="flex h-4 w-4 items-center justify-center rounded hover:bg-slate-200"
                    title={`Remove ${c.name}`}
                  >
                    <X size={10} />
                  </button>
                </span>
              );
            })}
            <button
              onClick={() => {
                setSel([]);
                setClassQ("");
                setQ("");
              }}
              className="flex items-center gap-1.5 ml-auto text-[10px] font-semibold"
              style={{ color: "#ef4444" }}
            >
              <RotateCcw size={11} /> Clear all
            </button>
          </div>
        )}
      </div>

      {mode === "mark" ? (
        <div className="rounded-xl border overflow-hidden animate-fade-up" style={{ borderColor: "#e2e8f0", background: "#ffffff" }}>
          {visibleSel.length === 0 ? (
            <div className="px-2">
              <EmptyState
                icon={Users}
                title={sel.length === 0 ? "Start a search" : "No results"}
                subtitle="No class selected — search above to get started."
              />
            </div>
          ) : (
            <>
              {groups.length === 0 ? (
                <div className="px-2">
                  <EmptyState
                    icon={Search}
                    title="No students match"
                    subtitle="Try a different student name or ID, or add a new student with the row inside each class sheet."
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {groups.map((g) => (
                    <ClassGrid
                      key={g.cls?.id || "g"}
                      cls={g.cls}
                      students={g.list}
                      weeks={weeksOf[g.cls?.id] || []}
                      focusKey={focusKey}
                      onSelectWeek={setFocusKey}
                      onAddWeek={() => addWeek(g.cls.id)}
                      onRemoveWeek={(k) => removeWeek(g.cls.id, k)}
                      subjects={subjectsOf[g.cls?.id] || []}
                      subject={currentSubject(g.cls?.id)}
                      onSelectSubject={(subj) => setSubjectOf((prev) => ({ ...prev, [g.cls.id]: subj }))}
                      dailyOf={dailyOf}
                      onPick={(s, date, status) => pickDay(s, date, currentSubject(g.cls.id), status)}
                      onPickMany={(cells) => pickMany(cells, currentSubject(g.cls.id))}
                      tool={tool}
                      onToolChange={setTool}
                      onReset={() => resetSheet(g.cls.id)}
                      onSave={() => saveSheet(g.cls.id)}
                      dirtySubjects={dirtySubjectsOf(g.cls?.id)}
                      onStudentClick={setDayStudent}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {roster.length > 0 && (
            <>
              <div className="px-5 py-3 border-t flex items-center gap-3" style={{ borderColor: "#e2e8f0", background: "#fafbfc" }}>
                <div className="flex items-center gap-2 text-[11px]" style={{ color: "#94a3b8" }}>
                  <Percent size={13} /> Average
                  <b className="tabular-nums" style={{ color: avgRate ? rateTone(avgRate) : "#64748b" }}>
                    {avgRate}%
                  </b>
                </div>
                <div className="flex-1">
                  <ProgressBar value={avgRate} tone={avgRate >= 85 ? "success" : avgRate >= 70 ? "warning" : "danger"} />
                </div>
              </div>
              {totalDraftEdits > 0 && (
                <div className="px-5 py-3 border-t flex flex-wrap items-center gap-2" style={{ borderColor: "#e2e8f0", background: "#fef3c7" }}>
                  <span className="text-[11px] font-semibold" style={{ color: "#92400e" }}>
                    {totalDraftEdits} unsaved
                  </span>
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={discardAll}
                      className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all hover:bg-red-100"
                      style={{ color: "#dc2626" }}
                    >
                      <RotateCcw size={12} /> Discard
                    </button>
                    <button
                      onClick={saveAll}
                      className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white transition-all"
                      style={{ background: "#10b981" }}
                    >
                      <CheckCircle2 size={12} /> Save all
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden animate-fade-up" style={{ borderColor: "#e2e8f0", background: "#ffffff" }}>
          {visibleSel.length === 0 ? (
            <div className="px-2">
              <EmptyState icon={Users} title="No classes selected" subtitle="Select classes above to view reports." />
            </div>
          ) : groups.length === 0 ? (
            <div className="px-2">
              <EmptyState icon={Search} title="No students" subtitle="Try a different search." />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1 overflow-x-auto thin-scroll px-5 py-2 border-b" style={{ borderColor: "#e2e8f0", background: "#fafbfc" }}>
                <span className="shrink-0 mr-2 text-[9px] font-bold" style={{ color: "#94a3b8" }}>
                  Week
                </span>
                {viewWeeks.map((w, i) => (
                  <button
                    key={w.key}
                    type="button"
                    onClick={() => setFocusKey(w.key)}
                    className="shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold tabular-nums transition-colors"
                    style={w.key === viewWeek?.key ? { background: "#10b981", color: "#fff" } : { background: "#f1f5f9", color: "#64748b" }}
                  >
                    W{i + 1}
                  </button>
                ))}
                <span className="shrink-0 ml-3 mr-1 text-[9px] font-bold" style={{ color: "#94a3b8" }}>
                  Day
                </span>
                <button
                  type="button"
                  onClick={() => setViewDay(null)}
                  className="shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-colors"
                  style={viewDay === null ? { background: "#06b6d4", color: "#fff" } : { background: "#f1f5f9", color: "#64748b" }}
                >
                  Week
                </button>
                {viewDays.map((d) => {
                  const active = viewDay === d.date;
                  const dayShort = new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
                  return (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() => setViewDay(d.date)}
                      className="shrink-0 flex flex-col items-center rounded-lg px-2 py-1 text-left transition-colors"
                      style={active ? { background: "#06b6d4", color: "#fff" } : { background: "#f1f5f9", color: "#64748b" }}
                    >
                      <span className="text-[10px] font-bold leading-tight">{dayShort}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col gap-5 p-5">
                {groups.map((g) => (
                  <ClassView
                    key={g.cls?.id || "g"}
                    cls={g.cls}
                    students={g.list}
                    week={viewWeek}
                    weekLabel={viewWeek ? `W${viewWeekNo} · ${viewWeek.range}` : ""}
                    subjects={subjectsOf[g.cls?.id] || []}
                    dailyOf={dailyOf}
                    scopeDay={viewDay}
                    onDeleteClass={deleteClassNow}
                  />
                ))}
              </div>

              <div className="px-5 py-3 border-t flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]" style={{ borderColor: "#e2e8f0", color: "#94a3b8" }}>
                <span className="font-bold">Legend</span>
                {Object.entries(WEEK_STATUS).map(([k, m]) => (
                  <span key={k} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-sm" style={{ background: m.color }} /> {m.label}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <StudentFormModal open={formOpen} onClose={() => setFormOpen(false)} lockedClass={formClass} />

      <StudentAttendanceModal
        student={dayStudent}
        records={dayStudent ? attendance.filter((a) => a.studentId === dayStudent.id) : []}
        weeks={dayStudent ? weeksOf[dayStudent.className] : undefined}
        onClose={() => setDayStudent(null)}
      />

      <ConfirmDialog
        open={!!delClassTarget}
        onClose={() => setDelClassTarget(null)}
        onConfirm={confirmDeleteClass}
        title="Delete class?"
        confirmLabel="Delete"
        message={
          delClassTarget && (
            <>
              <b style={{ color: "var(--text)" }}>{delClassTarget.name}</b> will be removed. Its
              students are kept but become unassigned, and the class&apos;s attendance sheets are
              discarded. This cannot be undone.
            </>
          )
        }
      />

      {dlSel &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setDlSel(false)} />
            <div className="relative rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-fade-up" style={{ background: "#ffffff" }}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold" style={{ color: "#1e293b" }}>
                  Export attendance
                </h3>
                <button onClick={() => setDlSel(false)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100">
                  <X size={14} />
                </button>
              </div>
              <p className="text-xs mb-3" style={{ color: "#94a3b8" }}>
                Pick classes and format
              </p>

              <label className="flex items-center gap-2 py-2 border-b" style={{ borderColor: "#e2e8f0" }}>
                <input
                  type="checkbox"
                  checked={dlAll}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setDlAll(on);
                    if (on) setDlChecked({});
                  }}
                  className="accent-emerald-500"
                />
                <span className="text-sm font-semibold" style={{ color: "#1e293b" }}>
                  Export all classes
                </span>
              </label>

              <div className="max-h-56 overflow-y-auto thin-scroll my-3 space-y-0.5">
                {classes.map((c) => {
                  const on = dlAll || dlChecked[c.id];
                  const nStudents = students.filter((s) => s.className === c.id && s.status !== "Graduate").length;
                  const nWeeks = (weeksOf[c.id] || []).length;
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50"
                      style={{ color: "#1e293b" }}
                    >
                      <input
                        type="checkbox"
                        checked={!!on}
                        disabled={dlAll}
                        onChange={(e) => setDlChecked((x) => ({ ...x, [c.id]: e.target.checked }))}
                        className="accent-emerald-500"
                      />
                      <span className="text-sm">{c.name}</span>
                      <span className="ml-auto text-[10px]" style={{ color: "#94a3b8" }}>
                        {nStudents}s · {nWeeks}w
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: "#e2e8f0" }}>
                <button
                  onClick={() => {
                    if (noSelected) {
                      showToast("Pick at least one class");
                      return;
                    }
                    doExport(dlSheets(), "excel");
                    logAudit("export_attendance", `Exported to Excel`);
                    setDlSel(false);
                  }}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-all"
                  style={{ background: "#10b981" }}
                >
                  <FileSpreadsheet size={14} /> Excel
                </button>
                <button
                  onClick={() => {
                    if (noSelected) {
                      showToast("Pick at least one class");
                      return;
                    }
                    doExport(dlSheets(), "word");
                    logAudit("export_attendance", `Exported to Word`);
                    setDlSel(false);
                  }}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-all"
                  style={{ background: "#10b981" }}
                >
                  <FileText size={14} /> Word
                </button>
                <button
                  onClick={() => {
                    if (noSelected) {
                      showToast("Pick at least one class");
                      return;
                    }
                    const sheets = dlSheets();
                    const w = window.open("", "_blank");
                    if (!w) {
                      showToast("Allow pop-ups to export as PDF");
                      return;
                    }
                    w.document.write(attendanceExportHTML(sheets));
                    w.document.close();
                    w.focus();
                    setTimeout(() => w.print(), 250);
                    logAudit("export_attendance", `Exported to PDF`);
                    setDlSel(false);
                  }}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-all"
                  style={{ background: "#10b981" }}
                >
                  <FileDown size={14} /> PDF
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}