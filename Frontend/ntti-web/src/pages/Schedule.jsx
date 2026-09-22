import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Plus, Save, RotateCcw, Trash2, CalendarDays, Download, ChevronDown, Check, X,
  FileDown, FileSpreadsheet, FileText, Copy, Link2, Search,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { MAJORS as SEED_MAJORS, majorName, FIELDS_OF_STUDY } from "../data/seed";

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
  classId: "", // linked to a real class in AppContext when the schedule belongs to one
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

/* ── class ↔ schedule term mapping ─────────────────────────
 * A class stores "Semester 1" / "Year 1"; the schedule stores "1" / "1".
 * These map between the two so the term can be kept in sync both ways. */
const digitsOf = (v, fallback = "1") => {
  const m = String(v ?? "").match(/\d+(?:\.\d+)?/);
  return m ? m[0] : fallback;
};
const semToClass = (v) => (v === "1" || v === "2" ? `Semester ${v}` : null);
const yearToClass = (v) => `Year ${digitsOf(v, "1")}`;

/* major / field / shift mapping between the class and the schedule */
const majorNameOf = (id) => majorName(id) || "";
const majorIdOf = (name) => {
  const s = String(name || "").toLowerCase();
  return (
    SEED_MAJORS.find((m) => m.name.toLowerCase() === s)?.id ||
    SEED_MAJORS.find((m) => m.id === name)?.id ||
    null
  );
};
const shiftKeyOf = (label) => {
  const k = String(label || "").toLowerCase();
  return SHIFTS[k] ? k : DEFAULT_SHIFT;
};
const shiftLabelOf = (key) => (SHIFTS[key] ? SHIFTS[key].label : String(key || ""));

/* everything a linked schedule inherits from its class */
const fromClass = (c) => ({
  className: c.name,
  semester: digitsOf(c.semester),
  year: digitsOf(c.year),
  major: majorNameOf(c.major),
  field: c.field || "",
  shift: shiftKeyOf(c.shift),
});

/* ── bind schedules to real classes ────────────────────────
 * Every class that exists in the portal gets its own schedule entry
 * (auto-created when the class appears). For a linked schedule the
 * class name, term, major, field AND shift follow the class. Custom
 * schedules that aren't linked to a class stay untouched. */
function mergeClasses(prev, classList) {
  const list = classList || [];
  let scheds = (prev.schedules || []).map((s) => {
    if (s.classId) {
      const c = list.find((x) => x.id === s.classId);
      if (!c) return s;
      return { ...s, ...fromClass(c) };
    }
    const c = list.find((x) => x.name === s.className);
    return c ? { ...s, classId: c.id, ...fromClass(c) } : s;
  });
  const linked = new Set(scheds.map((s) => s.classId).filter(Boolean));
  const need = list.filter((c) => !linked.has(c.id));
  for (const c of need) {
    scheds = [...scheds, { ...newSchedule(c.name), classId: c.id, ...fromClass(c) }];
  }
  return scheds;
}

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
function HalfSelect({ value, options, onChange, style, wide, h9 = false, label, searchable }) {
  const ref = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [q, setQ] = useState("");

  const close = () => setOpen(false);

  const display = options.find((o) => (typeof o === "string" ? o : o.value) === value);
  const shown = display ? (typeof display === "string" ? display : display.label) : "";
  const longest = options.reduce(
    (m, o) => Math.max(m, (typeof o === "string" ? o : o.label || "").length),
    0
  );

  const qq = q.trim().toLowerCase();
  const shownOpts = searchable && qq
    ? options.filter((o) => (typeof o === "string" ? o : o.label || "").toLowerCase().includes(qq))
    : options;

  useEffect(() => {
    if (!open) {
      setQ("");
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
      // rough height of the menu (search + None row + divider + one row per option)
      const estHeight = Math.min(280, (shownOpts.length + 3) * 30 + (searchable ? 40 : 12));
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
        maxHeight: Math.max(140, Math.min(260, avail)),
        ...(up ? { bottom: vh - r.top + GAP } : { top: r.bottom + GAP }),
      });
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        close();
        setQ("");
      }
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
  }, [open, q, searchable, shownOpts.length]);

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
              {searchable && (
                <div className="relative px-1 pb-1.5">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search…"
                    className="w-full rounded-lg border py-1.5 pl-8 pr-3 text-xs outline-none transition-colors focus:border-[var(--primary)]"
                    style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                  />
                </div>
              )}
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
              {searchable && shownOpts.length === 0 && (
                <p className="px-2.5 py-1.5 text-xs" style={{ color: "var(--text-3)" }}>No match</p>
              )}
              {shownOpts.map((o) => {
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
  const { showToast, classes, logAudit, updateClass } = useApp();
  const [state, setState] = useState(load());
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // when the class list changes (class created/renamed), pick up those classes
  useEffect(() => {
    setState((prev) => {
      const next = mergeClasses(prev, classes);
      if (
        next.length === prev.schedules.length &&
        next.every((s, i) => s === prev.schedules[i])
      ) {
        return prev;
      }
      return { ...prev, schedules: next };
    });
  }, [classes]);

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

  const removeSchedule = (id) => {
    const target = schedules.find((s) => s.id === id);
    if (target?.classId) {
      showToast(`Linked to class ${target.className} — delete the class itself to remove its schedule`, "info");
      return;
    }
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

  /* schedule → class: changing a linked field here updates the class too,
     so the class follows the schedule back. */
  const pushToClass = (patch) => {
    if (!data.classId) return;
    const clsPatch = {};
    if (patch.semester !== undefined) {
      const v = semToClass(patch.semester);
      if (v) clsPatch.semester = v;
    }
    if (patch.year !== undefined) clsPatch.year = yearToClass(patch.year);
    if (patch.major !== undefined) {
      const id = majorIdOf(patch.major);
      if (id) clsPatch.major = id;
    }
    if (patch.field !== undefined) clsPatch.field = patch.field;
    if (patch.shift !== undefined) clsPatch.shift = shiftLabelOf(patch.shift);
    if (Object.keys(clsPatch).length) updateClass(data.classId, clsPatch);
  };

  const setLinkedField = (field, value) => {
    setMeta({ [field]: value });
    pushToClass({ [field]: value });
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
    // keep the class link and everything that follows it when clearing the table
    const linked = data.classId ? classes.find((c) => c.id === data.classId) : null;
    const next = linked
      ? { ...s, classId: linked.id, ...fromClass(linked), cells: {} }
      : { ...s, major: data.major, field: data.field, shift: data.shift, semester: data.semester, year: data.year, cells: {} };
    setMeta(next);
    showToast("Schedule reset");
  };

  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(stateRef.current));
    } catch {
      /* ignore */
    }
    logAudit("save_schedule", `Saved ${stateRef.current.schedules.length} schedule(s)`);
    showToast("All schedules saved");
  };

  /* export picker state */
  const [dlSel, setDlSel] = useState(false);
  const [dlAll, setDlAll] = useState(false);
  const [checked, setChecked] = useState({});
  const [dlType, setDlType] = useState("excel");

  /* copy-from state */
  const [copyFrom, setCopyFrom] = useState(false);
  const [copySrc, setCopySrc] = useState("");
  const [copyOpts, setCopyOpts] = useState({ subjects: true, teachers: true, cells: true });
  const [copyQ, setCopyQ] = useState("");

  /* clear the copy search whenever the dialog closes */
  useEffect(() => {
    if (!copyFrom) {
      setCopySrc("");
      setCopyQ("");
    }
  }, [copyFrom]);

  const toggleAll = (on) => setDlAll(on);

  const dlSchedules = () => {
    if (dlAll) return schedules;
    return schedules.filter((s) => checked[s.id]);
  };
  const someChecked = dlAll || Object.keys(checked).some((k) => checked[k]);

  const times = SLOTS[data.shift] || SLOTS[DEFAULT_SHIFT];

  /* a linked schedule offers the class's own major/field values (plus the
     current one, so a value never shows as "—" just because it wasn't in
     the preset list) */
  const linkedClass = data.classId ? classes.find((c) => c.id === data.classId) : null;
  const majorChoices = Array.from(
    new Set([...(data.classId ? SEED_MAJORS.map((m) => m.name) : MAJORS), data.major].filter(Boolean))
  );
  const fieldPool =
    linkedClass && (FIELDS_OF_STUDY[linkedClass.major] || []).length
      ? FIELDS_OF_STUDY[linkedClass.major]
      : FIELDS;
  const fieldChoices = Array.from(new Set([...fieldPool, data.field].filter(Boolean)));

  const noSelected = dlSel && !someChecked && !dlAll;

  /* copy an existing schedule's subjects/teachers/times into the current one */
  const copySources = schedules
    .filter((s) => s.id !== data.id)
    .sort(
      (a, b) =>
        (a.classId ? 0 : 1) - (b.classId ? 0 : 1) ||
        a.className.localeCompare(b.className)
    );

  const copyQq = copyQ.trim().toLowerCase();
  const copyList = copyQq
    ? copySources.filter((s) => (s.className || "Untitled").toLowerCase().includes(copyQq))
    : copySources;

  const applyCopy = () => {
    const src = schedules.find((s) => s.id === copySrc);
    if (!src) return;
    const patch = {};
    if (copyOpts.subjects) patch.subjects = [...src.subjects];
    if (copyOpts.teachers) patch.teachers = [...src.teachers];
    if (copyOpts.cells) {
      // only keep times that exist in this schedule's shift
      const valid = new Set(SLOTS[data.shift] || SLOTS[DEFAULT_SHIFT]);
      patch.cells = Object.fromEntries(
        Object.entries(src.cells)
          .map(([k, v]) => {
            const time = valid.has(v.time) ? v.time : "";
            return [k, { ...v, time }];
          })
          .filter(([, v]) => v.day || v.time)
      );
    }
    setMeta(patch);
    logAudit(
      "copy_schedule",
      `Copied ${["subjects", "teachers", "cells"].filter((k) => copyOpts[k]).join(", ")} from ${src.className || "a schedule"} into ${data.className || "current schedule"}`
    );
    setCopyFrom(false);
    setCopySrc("");
    showToast(`Copied from ${src.className || "schedule"} into ${data.className || "this schedule"}`);
  };

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
              searchable
              style={{ minWidth: 220 }}
              value={state.activeId}
              options={[...schedules]
                .sort(
                  (a, b) =>
                    (a.classId ? 0 : 1) - (b.classId ? 0 : 1) ||
                    a.className.localeCompare(b.className)
                )
                .map((s) => ({ value: s.id, label: s.className || "Untitled" }))}
              onChange={(id) => switchSchedule(id)}
            />
          </div>
          <div className="flex items-end gap-2 ml-auto">
            <button onClick={addSchedule} className="btn btn-outline h-9 px-3 text-sm gap-1.5" title="Add new schedule — keeps existing ones">
              <Plus size={15} /> Add schedule
            </button>
            <button
              onClick={() => {
                setCopyFrom(true);
                setCopySrc("");
              }}
              className="btn btn-outline h-9 px-3 text-sm gap-1.5"
              title="Copy subjects, teachers and lesson times from an existing schedule — no retyping"
            >
              <Copy size={15} /> Copy from…
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
            <div className="relative">
              <input
                value={data.className}
                readOnly={!!data.classId}
                list="schedule-class-datalist"
                onChange={(e) => {
                  const v = e.target.value;
                  const hit = classes.find((c) => c.name === v);
                  // picking a class makes the whole term/major/field/shift follow
                  setMeta({
                    className: v,
                    ...(hit ? { classId: hit.id, ...fromClass(hit) } : {}),
                  });
                }}
                className="input h-9 text-sm !w-full rounded-md"
                placeholder="e.g., IT09A1"
                style={data.classId ? { cursor: "default", color: "var(--text-2)" } : undefined}
              />
              {data.classId && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                  style={{ background: "var(--primary-soft)", color: "var(--primary-strong)" }}>
                  <Link2 size={10} /> linked to class
                </span>
              )}
            </div>
            <datalist id="schedule-class-datalist">
              {classes.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
              {classes.length} class{classes.length === 1 ? "" : "es"} in portal
              {data.classId ? " · name, term, major, field & shift follow the class" : ""}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>Semester</label>
            <HalfSelect
              h9
              style={{ minWidth: 0 }}
              value={data.semester}
              options={SEMESTERS.map((s) => ({ value: s, label: `Semester ${s}` }))}
              onChange={(v) => setLinkedField("semester", v)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>Year</label>
            <HalfSelect
              h9
              style={{ minWidth: 0 }}
              value={data.year}
              options={YEARS.map((y) => ({ value: y, label: `Year ${y}` }))}
              onChange={(v) => setLinkedField("year", v)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>Major</label>
            <HalfSelect
              h9
              style={{ minWidth: 0 }}
              value={data.major}
              options={majorChoices.map((m) => ({ value: m, label: m }))}
              onChange={(v) => setLinkedField("major", v)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>Field</label>
            <HalfSelect
              h9
              style={{ minWidth: 0 }}
              value={data.field || ""}
              options={fieldChoices.map((f) => ({ value: f, label: f }))}
              onChange={(v) => setLinkedField("field", v)}
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
              onChange={(v) => setLinkedField("shift", v)}
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
          <span
            className="flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold tabular-nums"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-2)" }}
            title="Current table size"
          >
            {data.subjects.length} columns · {data.teachers.length} rows
          </span>
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

      {/* copy-picker — reuse another schedule's columns/rows/times */}
      {copyFrom &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setCopyFrom(false)} />
            <div className="relative card w-full max-w-2xl p-6 shadow-2xl animate-fade-up">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold" style={{ color: "var(--text)" }}>
                  Copy from another schedule
                </h3>
                <button onClick={() => setCopyFrom(false)} className="btn btn-ghost h-8 w-8 p-0 rounded-lg" title="Close">
                  <X size={15} />
                </button>
              </div>
              <p className="text-xs" style={{ color: "var(--text-3)" }}>
                Reuse subjects, teachers and lesson times — no retyping.
              </p>

              {/* copy from another schedule into this one */}
              <div className="mt-3">
                <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-3)" }}>
                  Copy from another schedule into {data.className || "this schedule"}
                </p>
                {copySources.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--text-3)" }}>
                    No other schedules to copy from yet. Add another schedule first, then copy its subjects here.
                  </p>
                ) : (
                  <>
                    {/* search class */}
                    <div className="relative mb-2.5">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
                      <input
                        autoFocus
                        value={copyQ}
                        onChange={(e) => setCopyQ(e.target.value)}
                        placeholder="Search class…"
                        className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm outline-none transition-colors focus:border-[var(--primary)]"
                        style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
                      />
                    </div>

                    {/* source list — single select */}
                    <div className="max-h-80 overflow-y-auto thin-scroll mb-2 space-y-1.5">
                      {copyList.length === 0 ? (
                        <p className="px-2 py-4 text-xs" style={{ color: "var(--text-3)" }}>No class matches “{copyQ}”</p>
                      ) : (
                        copyList.map((s) => {
                          const active = copySrc === s.id;
                          return (
                            <button
                              key={s.id}
                              onClick={() => setCopySrc(s.id)}
                              className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-sm transition-colors"
                              style={{
                                background: active ? "var(--primary-soft)" : "transparent",
                                border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                                color: active ? "var(--primary-strong)" : "var(--text)",
                                fontWeight: active ? 700 : 500,
                              }}
                            >
                              <span className="truncate">{s.className || "Untitled"}</span>
                              <span className="ml-auto text-[11px] font-medium shrink-0 tabular-nums" style={{ color: active ? "var(--primary-strong)" : "var(--text-3)" }}>
                                {s.subjects.length}s · {s.teachers.length}t · {(SHIFTS[s.shift] || SHIFTS[DEFAULT_SHIFT]).label}
                              </span>
                              {active && <Check size={14} className="shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>

                    {/* what to copy */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2" style={{ color: "var(--text-2)" }}>
                      {[
                        { k: "subjects", label: "Subjects (columns)" },
                        { k: "teachers", label: "Teachers (rows)" },
                        { k: "cells", label: "Lesson times" },
                      ].map((o) => (
                        <label key={o.k} className="flex items-center gap-2 text-xs font-semibold" style={{ color: "var(--text-2)" }}>
                          <input
                            type="checkbox"
                            checked={copyOpts[o.k]}
                            onChange={(e) => setCopyOpts((c) => ({ ...c, [o.k]: e.target.checked }))}
                            className="accent-[var(--primary)]"
                          />
                          {o.label}
                        </label>
                      ))}
                    </div>

                    {/* footer */}
                    <div className="flex justify-end gap-2 mt-4">
                      <button className="btn btn-ghost h-9 px-4 text-sm" onClick={() => setCopyFrom(false)}>
                        Cancel
                      </button>
                      <button
                        onClick={applyCopy}
                        disabled={!copySrc}
                        className="btn btn-primary h-9 px-4 text-sm gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Copy size={14} /> Copy into {data.className || "this schedule"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
