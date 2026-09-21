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
  Check,
  X,
  Trash2,
  FileDown,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import PageHeader, { ProgressBar, EmptyState } from "../components/Page";
import { useApp } from "../context/AppContext";
import { majorName, shiftRange, weekKeyOf, lastNWeeks, todayISO } from "../data/seed";
import { StudentAvatar } from "../components/Badge";
import StudentFormModal from "../components/StudentFormModal";
import StudentAttendanceModal from "../components/StudentAttendanceModal";

/* ── weekly statuses (Excel tick letters) ────────────────── */
const WEEK_STATUS = {
  present: { label: "Present", short: "P", color: "var(--success)", soft: "var(--success-soft)" },
  late: { label: "Late", short: "L", color: "var(--warning)", soft: "var(--warning-soft)" },
  absent: { label: "Absent", short: "A", color: "var(--danger)", soft: "var(--danger-soft)" },
  leave: { label: "Permission", short: "PE", color: "var(--info)", soft: "var(--info-soft)" },
};

const WEEK_OPTIONS = [
  { value: "", label: "Not marked", color: "", soft: "", short: "" },
  { value: "present", label: "Present", color: "var(--success)", soft: "var(--success-soft)", short: "P" },
  { value: "late", label: "Late", color: "var(--warning)", soft: "var(--warning-soft)", short: "L" },
  { value: "absent", label: "Absent", color: "var(--danger)", soft: "var(--danger-soft)", short: "A" },
  { value: "leave", label: "Permission", color: "var(--info)", soft: "var(--info-soft)", short: "PE" },
];

const rateTone = (r) => (r >= 85 ? "var(--success)" : r >= 70 ? "var(--warning)" : "var(--danger)");

const LS_EXTRA_WEEKS = "ntti.weekly.extra.v1";
const LS_WEEKS = "ntti.weekly.weeks.v1";
const LS_SCHED = "ntti.schedule.v2"; // mirrors Schedule.js's storage key exactly

/* ── read the timetable (Schedule page) so Attendance knows how many
   subjects meet on a given weekday, and can open one attendance session
   per subject instead of one per day ─────────────────────────────── */
function readScheduleState() {
  try {
    const raw = localStorage.getItem(LS_SCHED);
    if (!raw) return { schedules: [] };
    const v = JSON.parse(raw);
    return v && Array.isArray(v.schedules) ? v : { schedules: [] };
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

/**
 * Every subject taught to a class, tagged with the weekday + time it meets
 * (read straight from the Schedule page's timetable). A class that hasn't
 * set up a timetable yet — or has no subjects — falls back to a single
 * "General" subject, so attendance behaves exactly as before for it.
 */
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
    // Use the subject name itself as the key so records saved before a
    // timetable existed ("general") keep working alongside real subjects.
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

/** The seven day cells (Monday–Sunday) for the week that starts at startISO. */
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

/* ── weekly attendance HTML export (mirrors Schedule export) ─ */
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

/* ── portaled, flip-aware dropdown positioning ─────────── */
function useDropPos(ref, open, { rows = 5, minWidth = 160, maxHeight = 280 } = {}) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);
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
      const est = Math.min(maxHeight, rows * 34 + 12);
      const spaceBelow = vh - r.bottom;
      const spaceAbove = r.top;
      const up = spaceBelow < est + GAP + MARGIN && spaceAbove > spaceBelow;
      const width = Math.max(r.width, minWidth);
      let left = r.left;
      if (left + width > vw - MARGIN) left = Math.max(MARGIN, vw - MARGIN - width);
      const avail = (up ? spaceAbove : spaceBelow) - GAP - MARGIN;
      setPos({
        left,
        minWidth: Math.max(r.width, minWidth),
        up,
        maxHeight: Math.max(120, Math.min(est, avail)),
        ...(up ? { bottom: vh - r.top + GAP } : { top: r.bottom + GAP }),
      });
    };
    const onKey = (e) => {
      if (e.key === "Escape") setPos(null);
    };
    const onScroll = (e) => {
      const t = e.target;
      if (menuRef.current && t instanceof Node && menuRef.current.contains(t)) return;
      setPos(null);
    };
    const onResize = () => setPos(null);
    measure();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, rows, minWidth, maxHeight]);
  return { pos, menuRef };
}

/* ── per-week status dropdown (Excel-style data picker) ── */
function WeekCellSelect({ status, w, weekNo, onPick, heading }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const { pos, menuRef } = useDropPos(ref, open, { rows: 6, minWidth: 176 });
  const meta = WEEK_STATUS[status];

  return (
    <div className="relative inline-block align-middle">
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-8 min-w-[88px] max-w-full rounded-md border px-1.5 transition-all duration-150 flex items-center justify-center gap-1 select-none"
        style={
          meta
            ? { background: meta.soft, color: meta.color, borderColor: "transparent", boxShadow: "0 4px 10px -6px var(--text-2)" }
            : { borderStyle: "dashed", borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-3)" }
        }
        title={meta ? `${meta.label} — ${w.range}` : `Not marked — ${w.range}`}
      >
        <span className="text-[10px] font-bold shrink-0">{meta ? meta.short : "·"}</span>
        <span className="text-[10px] font-medium truncate">{meta ? meta.label : "None"}</span>
        <ChevronDown size={10} className="shrink-0 opacity-70" />
      </button>

      {open &&
        pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onMouseDown={() => setOpen(false)} />
            <div
              ref={menuRef}
              className={`fixed z-50 card p-1.5 shadow-lg ${pos.up ? "animate-fade-down" : "animate-fade-up"}`}
              style={{ left: pos.left, minWidth: pos.minWidth, maxHeight: pos.maxHeight, top: pos.top, bottom: pos.bottom }}
            >
              <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
                {heading || `W${weekNo} · ${w.range}`}
              </div>
              {WEEK_OPTIONS.map((o) => {
                const active = status === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      onPick(o.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-[var(--surface-2)] ${active ? "" : ""}`}
                    style={active ? { background: "var(--primary-soft)", color: "var(--primary-strong)" } : { color: "var(--text)" }}
                  >
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded-full shrink-0"
                      style={{
                        background: o.color || "transparent",
                        border: `1px solid ${o.color || "var(--border)"}`,
                      }}
                    >
                      {o.color ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: o.color }} /> : null}
                    </span>
                    <span className="truncate font-medium">{o.label}</span>
                    {active ? <Check size={13} className="ml-auto shrink-0" style={{ color: "var(--primary-strong)" }} /> : null}
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

/* ── clickable class label → info popover ──────────────── */
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
          style={{ color: "var(--text-3)" }}
        />
      </span>
      {open &&
        pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onMouseDown={() => setOpen(false)} />
            <div
              ref={menuRef}
              className={`fixed z-50 card p-3 shadow-lg ${pos.up ? "animate-fade-down" : "animate-fade-up"}`}
              style={{ left: pos.left, minWidth: pos.minWidth, maxHeight: pos.maxHeight, top: pos.top, bottom: pos.bottom }}
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="text-sm font-bold truncate" style={{ color: "var(--text)" }}>{cls.name}</span>
                <span className="shrink-0 text-[10px] font-bold rounded-md px-1.5 py-0.5" style={{ background: "var(--surface-3)", color: "var(--text-2)" }}>
                  {count} students
                </span>
              </div>
              <div className="grid grid-cols-[62px_1fr] gap-x-3 gap-y-1.5">
                {rows.map(([k, v]) => (
                  <Fragment key={k}>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>{k}</span>
                    <span className="text-xs font-medium break-words" style={{ color: "var(--text)" }}>{v}</span>
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

/* ── checkable multi-select (portaled, flip-aware) ─────── */
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
          : `${value.length} classes selected`;

  return (
    <div className="relative w-full">
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center justify-between gap-2 border rounded-lg px-3 text-sm transition-colors"
        style={{
          background: "var(--surface)",
          borderColor: open ? "var(--primary)" : "var(--border)",
          color: "var(--text)",
          boxShadow: open ? "0 0 0 3px var(--ring)" : "none",
        }}
      >
        <span className="flex items-center gap-2 min-w-0">
          <ChevronDown
            size={15}
            className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            style={{ color: "var(--text-3)" }}
          />
          <span className="truncate font-medium">{label}</span>
        </span>
        <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums" style={{ background: "var(--surface-3)", color: "var(--text-2)" }}>
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
              className={`fixed z-50 card p-1.5 overflow-y-auto thin-scroll shadow-lg ${
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
                onClick={toggleAll}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition-colors hover:bg-[var(--surface-2)]"
                style={{ color: "var(--primary-strong)" }}
              >
                <span
                  className="flex h-4 w-4 items-center justify-center rounded border shrink-0"
                  style={{
                    borderColor: allSelected ? "var(--primary)" : "var(--border)",
                    background: allSelected ? "var(--primary)" : "transparent",
                  }}
                >
                  {allSelected ? <Check size={11} style={{ color: "#fff" }} /> : null}
                </span>
                <Users size={14} />
                All classes
                <span className="ml-auto text-[10px] font-bold tabular-nums" style={{ color: "var(--text-3)" }}>
                  {allCount}
                </span>
              </button>
              <div className="my-1 h-px" style={{ background: "var(--border)" }} />
              {options.map((o) => {
                const on = value.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggle(o.value)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-2)]"
                    style={{ color: "var(--text)" }}
                  >
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded border shrink-0"
                      style={{
                        borderColor: on ? "var(--primary)" : "var(--border)",
                        background: on ? "var(--primary)" : "transparent",
                      }}
                    >
                      {on ? <Check size={11} style={{ color: "#fff" }} /> : null}
                    </span>
                    <span className="truncate">
                      {o.label}
                      {o.detail ? (
                        <span className="ml-1.5 text-[10px]" style={{ color: "var(--text-3)" }}>
                          {o.detail}
                        </span>
                      ) : null}
                    </span>
                    <span className="ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums" style={{ background: "var(--surface-3)", color: "var(--text-2)" }}>
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

/* ── one class = one Excel-style sheet ─────────────────── */
function ClassGrid({ cls, students, weeks, focusKey, onSelectWeek, onAddWeek, onRemoveWeek, subjects, subject, onSelectSubject, dailyOf, onPick, onReset, onSave, dirtySubjects = [], onStudentClick }) {
  const week = weeks.find((w) => w.key === focusKey) || weeks[weeks.length - 1] || null;
  const weekNo = week ? weeks.findIndex((w) => w.key === week.key) + 1 : 0;
  const days = useMemo(() => (week ? weekDays(week.start) : []), [week]);
  const activeSubj = subjects.find((x) => x.key === subject) || subjects[0];
  const hasRealSubjects = subjects.length > 1 || (subjects.length === 1 && subjects[0].key !== "general");

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

  // mark a day — nothing saves automatically. Every subject you touch is kept
  // as a draft and written in one shot when you press "Save all subjects".
  const handlePick = (s, day, status) => {
    onPick(s, day.date, status);
  };

  return (
    <div className="overflow-hidden rounded-2xl border shadow-sm" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      {/* sheet header — h1 (class name) + one labeled h2 row per field */}
      <div className="px-5 py-4" style={{ background: "var(--surface-1)" }}>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full shrink-0" style={{ background: "var(--primary)" }} />
              <ClassLabel cls={cls} count={students.length} className="flex items-center gap-1.5 min-w-0 cursor-pointer group">
                <h2 className="text-lg font-bold truncate transition-colors group-hover:text-[var(--primary-strong)]" style={{ color: "var(--text)" }}>
                  {cls.name}
                </h2>
              </ClassLabel>
            </div>
            <p className="text-[11px] mt-1" style={{ color: "var(--text-3)" }}>
              {students.length} students · {week ? `W${weekNo} · ${week.range}` : "no week selected"} · {avgRate}% average
              {hasRealSubjects ? <> · <b style={{ color: "var(--text-2)" }}>{subjectLabelOf(activeSubj)}</b></> : null}
            </p>
            <div className="mt-3 text-[11px] w-full">
              <div className="grid grid-cols-[96px_1fr] gap-x-4 gap-y-1.5">
                {[
                  ["Shift", cls.shift || "—"],
                  ["Time", cls.shift ? shiftRange(cls.shift) || "—" : "—"],
                  ["Semester", cls.semester || "—"],
                  ["Year", cls.year || "—"],
                  ["Major", majorName(cls.major) || "—"],
                  ["Field", cls.field || "—"],
                  ["Degree", cls.degree || "—"],
                ].map(([k, v]) => (
                  <Fragment key={k}>
                    <span className="font-bold uppercase tracking-wider truncate" style={{ color: "var(--text-3)" }}>
                      {k}:
                    </span>
                    <span className="font-medium break-words" style={{ color: "var(--text-2)" }}>{v}</span>
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {dirtySubjects.length > 0 && (
              <span
                className="flex h-8 items-center rounded-lg px-2 text-[10px] font-bold"
                style={{ background: "var(--warning-soft)", color: "var(--text-2)" }}
                title={`Unsaved: ${dirtySubjects.map((s) => s.name).join(", ")}`}
              >
                {dirtySubjects.length} subject{dirtySubjects.length === 1 ? "" : "s"} unsaved
              </span>
            )}
            <button
              onClick={onReset}
              className="flex h-8 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-medium transition-colors bg-[var(--surface-2)] hover:bg-[var(--danger-soft)]"
              title="Clear every subject's marks for this week — nothing is written until you Save"
              style={{ borderColor: "var(--border)", color: "var(--danger)" }}
            >
              <RotateCcw size={13} /> Reset week
            </button>
            <button
              onClick={onSave}
              disabled={dirtySubjects.length === 0}
              className="flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-colors bg-[var(--primary)] hover:bg-[var(--primary-strong)] text-white disabled:opacity-50 disabled:cursor-not-allowed"
              title="Save the marked attendance for every subject in this class — one save for the whole sheet"
            >
              <CheckCircle2 size={13} /> Save all subjects
            </button>
          </div>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="px-5 py-6 flex flex-col items-center gap-2 text-center">
          <span className="text-sm font-medium" style={{ color: "var(--text-2)" }}>No students in {cls.name} yet</span>
          <span className="text-xs" style={{ color: "var(--text-3)" }}>Add students from the Students page.</span>
        </div>
      ) : !week ? (
        <div className="px-5 py-6 text-center text-sm" style={{ color: "var(--text-3)" }}>
          No week in this sheet yet — add one to start marking attendance.
        </div>
      ) : (
        <>
          {/* subject/session bar — one class can meet several times a day
              (e.g. Monday: Math, English, Khmer); pick which subject's
              session you're taking attendance for before marking students.
              Hidden for classes with no real timetable (just "General"). */}
          {hasRealSubjects && (
            <div
              className="flex items-center gap-1.5 overflow-x-auto thin-scroll px-5 py-2 border-b"
              style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
            >
              <span className="shrink-0 mr-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
                Subject
              </span>
              {subjects.map((sub) => {
                const active = sub.key === subject;
                return (
                  <button
                    key={sub.key}
                    type="button"
                    onClick={() => onSelectSubject(sub.key)}
                    className="shrink-0 flex flex-col items-start rounded-lg px-2.5 py-1 text-left transition-colors"
                    style={
                      active
                        ? { background: "var(--primary)", color: "#fff" }
                        : { background: "var(--surface-2)", color: "var(--text-2)" }
                    }
                    title={sub.day ? `Meets ${sub.day}${sub.time ? ` · ${sub.time}` : ""}${sub.teacher ? ` · ${sub.teacher}` : ""}` : sub.name}
                  >
                    <span className="text-[11px] font-bold leading-tight">{sub.name}</span>
                    {sub.day ? (
                      <span className="text-[9px] leading-tight" style={{ opacity: active ? 0.85 : 0.7 }}>
                        {sub.day}{sub.time ? ` · ${sub.time}` : ""}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          {/* horizontal week bar — pick which week to mark */}
          <div
            className="flex items-center gap-1.5 overflow-x-auto thin-scroll px-5 py-2 border-b"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <span className="shrink-0 mr-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
              Week
            </span>
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
              className="shrink-0 flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--primary-soft)]"
              style={{ borderColor: "var(--border)", color: "var(--primary-strong)" }}
              title="Add a new week to this class only"
            >
              <PlusCircle size={13} /> Add W{weeks.length + 1}
            </button>
            <button
              type="button"
              onClick={() => onRemoveWeek(week.key)}
              disabled={weeks.length <= 1}
              className="shrink-0 flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--danger-soft)] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: "var(--border)", color: "var(--danger)" }}
              title={`Delete week ${weekNo}${weeks.length <= 1 ? " — a sheet needs at least one week" : ""}`}
            >
              <Trash2 size={13} /> Remove week
            </button>
          </div>

          <div className="overflow-x-auto thin-scroll">
            <table className="w-full text-sm" style={{ minWidth: 240 + days.length * 112 + 84, borderCollapse: "separate", borderSpacing: "0 8px" }}>
              <thead>
                <tr>
                  <th
                    className="sticky left-0 z-20 text-left px-4 py-2 text-[11px] font-bold uppercase tracking-wider"
                    style={{ background: "var(--surface)", color: "var(--text-3)", borderBottom: "1px solid var(--border)" }}
                  >
                    Student
                  </th>
                  {days.map((d) => {
                    const dShort = new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
                    const isSubjectDay = hasRealSubjects && activeSubj?.day && activeSubj.day === dShort;
                    return (
                    <th
                      key={d.date}
                      className="text-center px-1 py-1.5 align-top"
                      title={`${d.name} · ${d.short}${isSubjectDay ? ` · ${activeSubj.name} usually meets today` : ""}`}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        borderLeft: "1px solid var(--border)",
                        background: isSubjectDay ? "var(--primary-soft)" : undefined,
                      }}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="block text-center text-[10px] font-bold leading-tight" style={{ color: isSubjectDay ? "var(--primary-strong)" : "var(--text-2)" }}>
                          {d.name}
                        </span>
                        <span className="block text-[9px] tabular-nums" style={{ color: "var(--text-3)" }}>
                          {d.short}
                        </span>
                      </div>
                    </th>
                    );
                  })}
                  <th
                    className="text-right px-3 py-2 text-[11px] font-bold uppercase tracking-wider"
                    style={{ background: "var(--surface)", color: "var(--text-3)", borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)" }}
                  >
                    Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const rate = rateFor(s);
                  return (
                    <tr key={s.id} className="group">
                      <td className="sticky left-0 z-10 px-4 py-1.5" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                        <button
                          type="button"
                          onClick={() => onStudentClick?.(s)}
                          className="flex items-center gap-2.5 min-w-0 text-left"
                          title="Click to see this student's full attendance by day"
                        >
                          <StudentAvatar student={s} size="sm" />
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold leading-tight truncate" style={{ color: "var(--text)" }}>
                              {s.khmerName || `${s.firstName} ${s.lastName}`}
                            </p>
                            {s.khmerName ? (
                              <p className="text-[11px] leading-tight truncate" style={{ color: "var(--text-3)" }}>
                                {s.firstName} {s.lastName}
                              </p>
                            ) : null}
                          </div>
                        </button>
                      </td>
                      {days.map((d) => (
                        <td key={d.date} className="px-1 py-1 text-center" style={{ borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)" }}>
                          <WeekCellSelect
                            status={statusOf(s, d.date)}
                            w={{ range: `${d.name} ${d.short}` }}
                            heading={`${d.name} · ${d.short}`}
                            onPick={(status) => handlePick(s, d, status)}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-1.5 text-right" style={{ borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)" }}>
                        <span className="text-xs font-bold tabular-nums" style={{ color: rateTone(rate) }}>{rate}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ── read-only view: every student × every subject, who missed what ── */
function ClassView({ cls, students, week, weekLabel, subjects, dailyOf, scopeDay }) {
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
    <div className="overflow-hidden rounded-2xl border shadow-sm" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="px-5 py-3.5 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ background: "var(--surface-1)" }}>
        <span className="h-3 w-3 rounded-full shrink-0" style={{ background: "var(--primary)" }} />
        <h2 className="text-lg font-bold truncate" style={{ color: "var(--text)" }}>{cls.name}</h2>
        <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
          {students.length} students · {allWeek ? weekLabel : `${dayObj.name} · ${dayObj.short}`} · {subjects.length} subject{subjects.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="overflow-x-auto thin-scroll">
        <table className="w-full text-sm" style={{ minWidth: 280 + subjects.length * 118 + 210, borderCollapse: "separate", borderSpacing: "0 6px" }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-20 text-left px-4 py-2 text-[11px] font-bold uppercase tracking-wider" style={{ background: "var(--surface)", color: "var(--text-3)", borderBottom: "1px solid var(--border)" }}>
                Student
              </th>
              {subjects.map((sub) => {
                const abs = subjectAbs(sub);
                const meets = allWeek || subMeetsDay(sub, dayObj);
                return (
                  <th key={sub.key} className="text-center px-1.5 py-2 align-top" style={{ borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)", background: !allWeek && meets ? "var(--primary-soft)" : undefined }}>
                    <span className="block text-[11px] font-bold leading-tight" style={{ color: !allWeek && meets ? "var(--primary-strong)" : "var(--text-2)" }}>{sub.name}</span>
                    <span className="block text-[9px] leading-tight" style={{ color: "var(--text-3)" }}>{sub.day ? `${sub.day}${sub.time ? ` · ${sub.time}` : ""}` : "no timetable"}</span>
                    {abs > 0 ? <span className="block text-[9px] font-bold leading-tight" style={{ color: "var(--danger)" }}>{abs} absent</span> : null}
                  </th>
                );
              })}
              <th className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wider" style={{ background: "var(--surface)", color: "var(--text-3)", borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)" }}>
                Missed subjects
              </th>
              <th className="text-right px-3 py-2 text-[11px] font-bold uppercase tracking-wider" style={{ background: "var(--surface)", color: "var(--text-3)", borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)" }}>
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
                  <td className="sticky left-0 z-10 px-4 py-1.5" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                    <button type="button" className="flex items-center gap-2.5 min-w-0 text-left" title={`${s.firstName} ${s.lastName}`}>
                      <StudentAvatar student={s} size="sm" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold leading-tight truncate" style={{ color: "var(--text)" }}>{s.khmerName || `${s.firstName} ${s.lastName}`}</p>
                        <p className="text-[10px] leading-tight truncate" style={{ color: "var(--text-3)" }}>{s.studentId || ""}</p>
                      </div>
                    </button>
                  </td>

                  {subjects.map((sub) => {
                    if (allWeek) {
                      const w = weekStat(s, sub);
                      const rate = w.marked ? Math.round((w.pres / w.marked) * 100) : null;
                      return (
                        <td key={sub.key} className="px-1.5 py-1.5 text-center" style={{ borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)" }}>
                          {rate == null ? (
                            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>—</span>
                          ) : (
                            <span className="inline-flex flex-col items-center gap-0.5">
                              <span className="text-xs font-bold tabular-nums" style={{ color: rateTone(rate) }}>{rate}%</span>
                              {w.abs > 0 ? (
                                <span className="rounded-full px-1.5 py-px text-[9px] font-bold" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>{w.abs} absent</span>
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
                      <td key={sub.key} className="px-1.5 py-1.5 text-center" style={{ borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)" }}>
                        {meta ? (
                          <span className="inline-flex h-7 min-w-[54px] items-center justify-center rounded-md px-1.5 text-[11px] font-bold" style={{ background: meta.soft, color: meta.color }}>{meta.short}</span>
                        ) : (
                          <span className="text-[11px]" style={{ color: "var(--text-3)" }}>{meets ? "·" : "–"}</span>
                        )}
                      </td>
                    );
                  })}

                  <td className="px-3 py-1.5" style={{ borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)" }}>
                    {missed.length === 0 ? (
                      <span className="text-[11px]" style={{ color: "var(--text-3)" }}>—</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {missed.map((m) => (
                          <span key={m.sub.key} className="rounded-md px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                            {m.sub.name}{allWeek && m.n > 1 ? ` ×${m.n}` : ""}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right" style={{ borderBottom: "1px solid var(--border)", borderLeft: "1px solid var(--border)" }}>
                    {ov.rate == null ? (
                      <span className="text-[11px]" style={{ color: "var(--text-3)" }}>—</span>
                    ) : (
                      <span className="text-xs font-bold tabular-nums" style={{ color: rateTone(ov.rate) }}>{ov.rate}%</span>
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

/* ── page ──────────────────────────────────────────────── */
export default function Attendance() {
  const { students, classes, attendance, saveAttendance, showToast, logAudit } = useApp();
  const [searchParams] = useSearchParams();
  const classParam = searchParams.get("class");

  const [sel, setSel] = useState(() => {
    if (classParam && classes.some((c) => c.id === classParam)) return [classParam];
    return [];
  });
  const [q, setQ] = useState("");
  const [classQ, setClassQ] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formClass, setFormClass] = useState(null);
  const [dlSel, setDlSel] = useState(false);
  const [dlAll, setDlAll] = useState(false);
  const [dlChecked, setDlChecked] = useState({});
  const [dayStudent, setDayStudent] = useState(null); // student whose day log is open
  const [focusKey, setFocusKey] = useState(() => weekKeyOf(todayISO())); // selected week (shared by all sheets)
  const [draft, setDraft] = useState({}); // staged cells: { studentId: { subjectKey: { dateISO: status } } } — saved only on Save
  const [subjectOf, setSubjectOf] = useState({}); // { classId: subjectKey } — which subject's session is being marked right now
  const [mode, setMode] = useState("mark"); // "mark" | "view"
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
      // migrate legacy per-class extra weeks into the explicit week list
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
  const weeksOf = useMemo(() => {
    const map = {};
    classes.forEach((c) => {
      if (weekMap[c.id] !== undefined) map[c.id] = weekMap[c.id].map(weekFromKey);
      else if (weekMap["*"] !== undefined) map[c.id] = weekMap["*"].map(weekFromKey);
      else map[c.id] = baseWeeks;
    });
    return map;
  }, [classes, weekMap, baseWeeks]);
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

  /* every subject a class is taught, tagged with the weekday/time it meets —
     this is what lets "Monday · 3 subjects" become 3 separate attendance
     sessions instead of one shared day slot */
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
    [classOptions, classQ, classById] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const visibleSel = useMemo(() => {
    const matched = classQ ? classes.filter((c) => classMatches(c.id, classQ)).map((c) => c.id) : [];
    const base = classQ || sel.length > 0 ? sel : q.trim() ? classes.map((c) => c.id) : [];
    return Array.from(new Set([...base, ...matched]));
  }, [sel, classQ, q, classes, classById]); // eslint-disable-line react-hooks/exhaustive-deps

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

  /* view mode: the week + day the report is scoped to */
  const viewWeeks = useMemo(() => {
    for (const id of visibleSel) if (weeksOf[id]?.length) return weeksOf[id];
    return [];
  }, [visibleSel, weeksOf]);
  const viewWeek = viewWeeks.find((w) => w.key === focusKey) || viewWeeks[viewWeeks.length - 1] || null;
  const viewWeekNo = viewWeek ? viewWeeks.findIndex((w) => w.key === viewWeek.key) + 1 : 0;
  const viewDays = useMemo(() => (viewWeek ? weekDays(viewWeek.start) : []), [viewWeek]);

  /* staged view = persisted daily attendance + unsaved draft overrides,
     now keyed student -> subject -> date, so each subject's session for a
     day is independent of every other subject's session that same day */
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
  }, [roster, dailyOf, weeksOf, focusKey, subjectOf, subjectsOf]); // eslint-disable-line react-hooks/exhaustive-deps

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
    showToast(`Week ${wk.range} cleared for ${classById[clsId]?.name || clsId} (all subjects) — press Save to keep it`);
  };

  /* build attendance records from the current draft for some students + subjects */
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

  /* save every subject of one class sheet in a single write */
  const saveSheet = (clsId) => {
    const list = roster.filter((s) => s.className === clsId);
    const subKeys = (subjectsOf[clsId] || []).filter((sub) => classDirty(clsId, sub.key)).map((sub) => sub.key);
    const records = draftRecords(list, subKeys);
    if (!records.length) {
      showToast("No changes to save for this sheet");
      return;
    }
    saveAttendance(records);
    clearDraftFor(list, subKeys);
    const saved = records.filter((r) => r.status).length;
    showToast(`${saved} attendance record${saved === 1 ? "" : "s"} saved for ${classById[clsId]?.name || clsId} (${subKeys.length} subject${subKeys.length === 1 ? "" : "s"})`);
  };

  /* every unsaved edit on the page, across all classes and subjects */
  const totalDraftEdits = useMemo(
    () =>
      Object.values(draft).reduce(
        (a, subMap) => a + Object.values(subMap).reduce((b, days) => b + Object.values(days).filter(Boolean).length, 0),
        0
      ),
    [draft]
  );

  /* one button saves every marked cell — all subjects, all students shown */
  const saveAll = () => {
    const subKeys = Array.from(new Set(roster.flatMap((s) => Object.keys(draft[s.id] || {}))));
    const records = draftRecords(roster, subKeys);
    if (!records.length) {
      showToast("Nothing to save — mark some attendance first");
      return;
    }
    saveAttendance(records);
    clearDraftFor(roster, subKeys);
    const saved = records.filter((r) => r.status).length;
    showToast(`${saved} attendance record${saved === 1 ? "" : "s"} saved across ${roster.length} student${roster.length === 1 ? "" : "s"}`);
  };

  const discardAll = () => {
    setDraft({});
    showToast("All unsaved attendance discarded");
  };

  const classDirty = (clsId, subject) =>
    roster.some((s) => s.className === clsId && draft[s.id]?.[subject] && Object.keys(draft[s.id][subject]).length > 0);

  // every subject with unsaved edits for a class, even ones not currently
  // being viewed — so switching subjects never hides forgotten drafts
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
    showToast(`Week added to ${cls.name} (${weekFromKey(key).range})`);
  };

  const removeWeek = (clsId, wkKey) => {
    const cls = classById[clsId];
    const baseKeys = baseWeeks.map((w) => w.key);
    const curList = weekMap[clsId] ?? weekMap["*"] ?? baseKeys;
    if (curList.length <= 1) {
      showToast("Cannot remove the last week of a sheet", "error");
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
    const w = weekFromKey(wkKey);
    showToast(`Week ${w?.range || wkKey} removed from ${cls?.name || clsId}`);
  };

  /* export picker helpers */
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
      // one exported sheet per subject, so a class with 3–4 subjects a day
      // exports as 3–4 separate tables instead of mixing their attendance
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
        subtitle="Mark every subject first — nothing is saved until you press Save all. Use View report to see all students, all subjects, and exactly which subject each student missed."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border p-0.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              {[
                { k: "mark", label: "Mark" },
                { k: "view", label: "View report" },
              ].map((t) => (
                <button
                  key={t.k}
                  onClick={() => setMode(t.k)}
                  className="h-9 rounded-lg px-3 text-sm font-semibold transition-colors"
                  style={mode === t.k ? { background: "var(--primary)", color: "#fff" } : { color: "var(--text-2)" }}
                  title={t.k === "mark" ? "Mark attendance for the week" : "See every student's attendance by subject"}
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
              className="btn btn-outline h-10 px-4 text-sm gap-1.5"
              title="Export the selected week for one or more classes to Excel or Word"
            >
              <FileDown size={15} /> Export
            </button>
          </div>
        }
      />

      {/* controls */}
      <div className="card p-4 mb-5 animate-fade-up">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex flex-col gap-1.5 lg:w-[320px] shrink-0">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
              Classes
            </label>
            <ClassMultiSelect options={filteredOptions} value={sel} onChange={setSel} allCount={filteredOptions.length} />
          </div>
          <div className="flex flex-col gap-1.5 lg:w-72">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
              Search class name
            </label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
              <input
                value={classQ}
                onChange={(e) => setClassQ(e.target.value)}
                className="input pl-9 pr-8 h-11 text-sm"
                placeholder="IT09B1, Cyber…"
              />
              {classQ && (
                <button onClick={() => setClassQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost h-6 w-6 p-0 rounded-full" aria-label="Clear class search">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 lg:w-72">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
              Search students
            </label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="input pl-9 pr-8 h-11 text-sm"
                placeholder="Name or ID…"
              />
              {q && (
                <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost h-6 w-6 p-0 rounded-full" aria-label="Clear search">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* selected-class chips = the Excel header columns */}
        {sel.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
            <span className="text-[11px] font-bold uppercase tracking-wider mr-1" style={{ color: "var(--text-3)" }}>
              Sheets
            </span>
            {visibleSel.map((id) => {
              const c = classById[id];
              if (!c) return null;
              return (
                <span
                  key={id}
                  className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] max-w-full"
                  style={{ borderColor: "var(--border)", background: "var(--surface-1)", color: "var(--text-2)" }}
                >
                  <span className="truncate font-semibold" style={{ color: "var(--text)" }}>{c.name}</span>
                  <button
                    onClick={() => setSel(sel.filter((x) => x !== id))}
                    className="btn btn-ghost h-4 w-4 p-0 rounded-full -mr-0.5 shrink-0"
                    title={`Remove ${c.name}`}
                    aria-label={`Remove ${c.name}`}
                  >
                    <X size={11} />
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
              className="btn btn-ghost h-6 px-2.5 text-[11px] ml-auto"
              title="Deselect every class — close all sheets"
              style={{ color: "var(--danger)" }}
            >
              <RotateCcw size={12} /> Clear all
            </button>
          </div>
        )}
      </div>

      {mode === "mark" ? (
        /* ── mark mode: draft every subject first, then save once ── */
        <div className="card overflow-hidden animate-fade-up" style={{ animationDelay: "80ms" }}>
          {visibleSel.length === 0 ? (
            <div className="px-2">
              <EmptyState
                icon={Users}
                title={sel.length === 0 && !classQ && !q.trim() ? "Start a search" : "No classes match"}
                subtitle={
                  sel.length === 0 && !classQ && !q.trim()
                    ? "No class is selected yet — start typing a class name or a student name above, or tick classes in the dropdown."
                    : "No classes match your current search — try a different name."
                }
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
              <div className="px-5 py-4 border-t flex items-center gap-4" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-3)" }}>
                  <Percent size={14} /> Average attendance
                  <b className="tabular-nums" style={{ color: avgRate ? rateTone(avgRate) : "var(--text-2)" }}>{avgRate}%</b>
                </div>
                <div className="flex-1">
                  <ProgressBar value={avgRate} tone={avgRate >= 85 ? "success" : avgRate >= 70 ? "warning" : "danger"} />
                </div>
              </div>
              {totalDraftEdits > 0 && (
                <div className="px-5 py-3 border-t flex flex-wrap items-center gap-3" style={{ borderColor: "var(--border)", background: "var(--primary-soft)" }}>
                  <span className="text-xs font-bold" style={{ color: "var(--primary-strong)" }}>
                    {totalDraftEdits} unsaved mark{totalDraftEdits === 1 ? "" : "s"} — save once when you're done
                  </span>
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={discardAll}
                      className="btn btn-ghost h-9 px-3 text-xs"
                      style={{ color: "var(--danger)" }}
                      title="Throw away every unsaved mark"
                    >
                      <RotateCcw size={13} /> Discard all
                    </button>
                    <button
                      onClick={saveAll}
                      className="btn btn-primary h-9 px-4 text-xs"
                      title="Save every marked subject for all students at once"
                    >
                      <CheckCircle2 size={14} /> Save all attendance
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* ── view report mode: all students × all subjects, who missed what ── */
        <div className="card overflow-hidden animate-fade-up" style={{ animationDelay: "80ms" }}>
          {visibleSel.length === 0 ? (
            <div className="px-2">
              <EmptyState icon={Users} title="No classes selected" subtitle="Tick classes above to view their attendance by subject." />
            </div>
          ) : groups.length === 0 ? (
            <div className="px-2">
              <EmptyState icon={Search} title="No students match" subtitle="Try a different student name or ID." />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 overflow-x-auto thin-scroll px-5 py-2 border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <span className="shrink-0 mr-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
                  Week
                </span>
                {viewWeeks.map((w, i) => (
                  <button
                    key={w.key}
                    type="button"
                    onClick={() => setFocusKey(w.key)}
                    className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold tabular-nums transition-colors"
                    style={w.key === viewWeek?.key ? { background: "var(--primary)", color: "#fff" } : { background: "var(--surface-2)", color: "var(--text-2)" }}
                  >
                    W{i + 1}
                  </button>
                ))}
                <span className="shrink-0 ml-4 mr-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
                  Day
                </span>
                <button
                  type="button"
                  onClick={() => setViewDay(null)}
                  className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors"
                  style={viewDay === null ? { background: "var(--accent)", color: "#fff" } : { background: "var(--surface-2)", color: "var(--text-2)" }}
                >
                  Whole week
                </button>
                {viewDays.map((d) => {
                  const active = viewDay === d.date;
                  const dayShort = new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
                  return (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() => setViewDay(d.date)}
                      className="shrink-0 flex flex-col items-start rounded-lg px-2 py-1 text-left transition-colors"
                      title={`${d.name} · ${d.short}`}
                      style={active ? { background: "var(--accent)", color: "#fff" } : { background: "var(--surface-2)", color: "var(--text-2)" }}
                    >
                      <span className="text-[11px] font-bold leading-tight">{dayShort}</span>
                      <span className="text-[9px] leading-tight tabular-nums" style={{ opacity: 0.75 }}>{d.short}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col gap-6">
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
                  />
                ))}
              </div>

              <div className="px-5 py-3 border-t flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]" style={{ borderColor: "var(--border)", color: "var(--text-3)" }}>
                <span className="text-[10px] font-bold uppercase tracking-wider">Legend</span>
                {Object.entries(WEEK_STATUS).map(([k, m]) => (
                  <span key={k} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: m.color }} /> {m.label}
                  </span>
                ))}
                <span className="ml-auto">Missed subjects = any subject with Absent or Permission.</span>
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

      {/* export picker — mirrors Schedule's export */}
      {dlSel &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setDlSel(false)} />
            <div className="relative card w-full max-w-2xl p-6 shadow-2xl animate-fade-up">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold" style={{ color: "var(--text)" }}>
                  Export attendance
                </h3>
                <button onClick={() => setDlSel(false)} className="btn btn-ghost h-8 w-8 p-0 rounded-lg" title="Close">
                  <X size={15} />
                </button>
              </div>
              <p className="text-xs mb-4" style={{ color: "var(--text-3)" }}>
                Pick which class sheet(s) to export, or export all of them. Then choose a file type.
              </p>

              {/* export all toggle */}
              <label className="flex items-center gap-2 py-2 border-b" style={{ borderColor: "var(--border)" }}>
                <input
                  type="checkbox"
                  checked={dlAll}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setDlAll(on);
                    if (on) setDlChecked({});
                  }}
                  className="accent-[var(--primary)]"
                />
                <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  Export all classes
                </span>
              </label>

              {/* class list */}
              <div className="max-h-64 overflow-y-auto thin-scroll my-3 space-y-1">
                {classes.map((c) => {
                  const on = dlAll || dlChecked[c.id];
                  const nStudents = students.filter((s) => s.className === c.id && s.status !== "Graduate").length;
                  const nWeeks = (weeksOf[c.id] || []).length;
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[var(--surface-2)]"
                      style={{ color: "var(--text)" }}
                    >
                      <input
                        type="checkbox"
                        checked={!!on}
                        disabled={dlAll}
                        onChange={(e) => setDlChecked((x) => ({ ...x, [c.id]: e.target.checked }))}
                        className="accent-[var(--primary)]"
                      />
                      <span className="text-sm">{c.name}</span>
                      <span className="ml-auto text-[11px]" style={{ color: "var(--text-3)" }}>
                        {nStudents}s · W1–W{nWeeks} · {c.shift || "—"} · {c.year || "—"}
                      </span>
                    </label>
                  );
                })}
              </div>

              {/* format buttons */}
              <div className="flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                <button
                  onClick={() => {
                    if (noSelected) {
                      showToast("Pick at least one class to export");
                      return;
                    }
                    const sheets = dlSheets();
                    doExport(sheets, "excel");
                    logAudit("export_attendance", `Exported ${sheets.length} sheet(s) as .xls`);
                    setDlSel(false);
                  }}
                  className="btn btn-primary h-10 px-4 text-sm gap-1.5"
                >
                  <FileSpreadsheet size={15} /> Excel (.xls)
                </button>
                <button
                  onClick={() => {
                    if (noSelected) {
                      showToast("Pick at least one class to export");
                      return;
                    }
                    const sheets = dlSheets();
                    doExport(sheets, "word");
                    logAudit("export_attendance", `Exported ${sheets.length} sheet(s) as .doc`);
                    setDlSel(false);
                  }}
                  className="btn btn-primary h-10 px-4 text-sm gap-1.5"
                >
                  <FileText size={15} /> Word (.doc)
                </button>
                <button
                  onClick={() => {
                    if (noSelected) {
                      showToast("Pick at least one class to export");
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
                    logAudit("export_attendance", `Exported ${sheets.length} sheet(s) for print / PDF`);
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