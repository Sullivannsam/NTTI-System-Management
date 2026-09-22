import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Printer,
  FileSpreadsheet,
  FileDown,
  ArrowLeft,
  Search,
  ChevronDown,
  User2,
  Link2,
  Upload,
} from "lucide-react";
import clsx from "clsx";
import * as XLSX from "xlsx";
import { useApp } from "../context/AppContext";
import PageHeader, { EmptyState } from "../components/Page";
import ClassSelect from "../components/ClassSelect";
import { useDropPos, DropdownPanel } from "../components/Dropdown";
import TranscriptImportModal from "../components/TranscriptImportModal";
import { ACADEMIC_LEVELS, levelMeta, majorName, prettyDate, computeRate, todayISO, programYears, maxLevelForMajor } from "../data/seed";

const SCORES_KEY = "ntti.scores.v1";
const SCHED_KEY = "ntti.schedule.v2";
const INSTITUTION_KM = "វិទ្យាស្ថានជាតិបណ្តុះបណ្តាលបច្ចេកទេស";
const INSTITUTION_EN = "National Technical Training Institute";
const LOGO_SRC = "/ntti-logo.png";

/* ── official NTTI transcript layout (mirrors the “ex” sheet of the office file) ── */
const INSTITUTION_LINES = {
  country: "KINGDOM OF CAMBODIA",
  motto: "Nation Religion King",
  ministry: "Ministry of Labour and Vocational Training",
  institute: "National Technical Training Institute",
  noLine: "N0: ……………………….NTTI",
  certNo: "ISO  9001 : 2015 / Cert NO : 720466/NTTI/DDA/PR-012/FR-004",
  address1:
    "National Technical Training Institute (NTTI), along Russian Federation Blvd, Teuk Thlar Commune, Sen Sok District, Phnom Penh",
  address2: "Cambodia, Phone/Fax: (855)23 883039, website: www.ntti.edu.kh, E-mail:info@ntti.edu.kh",
};

/* official grading scale printed on the transcript */
const NTTI_SCALE = [
  { min: 85, max: 100, grade: "A", meaning: "Excellent", point: "4" },
  { min: 80, max: 84, grade: "B+", meaning: "Very good", point: "3.5" },
  { min: 70, max: 79, grade: "B", meaning: "Good", point: "3" },
  { min: 65, max: 69, grade: "C+", meaning: "Fairly Good", point: "2.5" },
  { min: 50, max: 64, grade: "C", meaning: "Fair", point: "2" },
  { min: 0, max: 49, grade: "F", meaning: "Fail", point: "1.5" },
];
const GRADE_POINTS = { A: 4, "B+": 3.5, B: 3, "C+": 2.5, C: 2, F: 1.5 };

/* document ink colours — fixed (not theme vars) so dark mode still prints correctly */
const INK = "#0f172a";
const MUTED = "#475569";
const LINE = "#cbd5e1";
const SOFT = "#f1f5f9";

function loadScores() {
  try {
    const raw = JSON.parse(localStorage.getItem(SCORES_KEY));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function loadSchedules() {
  try {
    const raw = JSON.parse(localStorage.getItem(SCHED_KEY));
    return raw && Array.isArray(raw.schedules) ? raw.schedules : [];
  } catch {
    return [];
  }
}

const letterOf = (n) => (n == null ? null : NTTI_SCALE.find((g) => n >= g.min)?.grade ?? "F");

const numOrNull = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
};

/** One row per subject for a term: { subject, score, grade, hour }. */
const rowsOf = (term) =>
  (term.subjects || []).map((sub) => {
    const n = numOrNull((term.scores || {})[sub]);
    const h = numOrNull((term.hours || {})[sub]);
    return { subject: sub, score: n, grade: letterOf(n), hour: h };
  });

/** Term average + grade + how many subjects actually have a score. */
const statsOf = (term) => {
  const vals = rowsOf(term)
    .map((r) => r.score)
    .filter((n) => n != null);
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  return { avg, grade: letterOf(avg), count: vals.length, total: (term.subjects || []).length };
};

const gradeTone = (g) =>
  g === "A"
    ? { color: "#047857", background: "rgba(16,185,129,.12)", border: "1px solid rgba(16,185,129,.35)" }
    : g === "B+"
    ? { color: "#0369a1", background: "rgba(14,165,233,.16)", border: "1px solid rgba(14,165,233,.45)" }
    : g === "B"
    ? { color: "#0369a1", background: "rgba(14,165,233,.12)", border: "1px solid rgba(14,165,233,.35)" }
    : g === "C+"
    ? { color: "#b45309", background: "rgba(245,158,11,.18)", border: "1px solid rgba(245,158,11,.45)" }
    : g === "C"
    ? { color: "#b45309", background: "rgba(245,158,11,.14)", border: "1px solid rgba(245,158,11,.35)" }
    : g === "D"
    ? { color: "#c2410c", background: "rgba(249,115,22,.14)", border: "1px solid rgba(249,115,22,.35)" }
    : g === "F"
    ? { color: "#b91c1c", background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.35)" }
    : { color: MUTED, background: SOFT, border: `1px solid ${LINE}` };

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ── student picker (searchable) ─────────────────────────── */
function StudentSelect({ students, value, onChange, placeholder = "Select a student" }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const current = students.find((s) => s.id === value);
  const label = (s) => (s.khmerName ? `${s.khmerName} · ${s.firstName} ${s.lastName}` : `${s.firstName} ${s.lastName}`);

  const close = () => {
    setOpen(false);
    setQ("");
  };

  const qq = q.trim().toLowerCase();
  const filtered = qq
    ? students.filter((s) => `${s.firstName} ${s.lastName} ${s.khmerName || ""} ${s.studentId || ""}`.toLowerCase().includes(qq))
    : students;

  const { pos, menuRef } = useDropPos(ref, open, {
    rows: Math.min(filtered.length + 1, 7),
    rowHeight: 46,
    extraHeight: 62,
    minWidth: 260,
    maxWidth: 360,
    maxHeight: 380,
    onClose: close,
  });

  const pick = (id) => {
    onChange(id);
    close();
  };

  return (
    <div className="relative min-w-0 max-w-full">
      <button
        ref={ref}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        className="flex h-10 w-full max-w-full items-center justify-between gap-3 rounded-xl border px-3.5 text-sm font-medium transition"
        style={{
          minWidth: "min(210px, 100%)",
          background: "var(--surface)",
          borderColor: open ? "var(--primary)" : "var(--border)",
          color: "var(--text)",
          boxShadow: open ? "0 0 0 3px var(--ring)" : "none",
        }}
      >
        <span className="flex min-w-0 items-center gap-2">
          <User2 className="h-4 w-4 shrink-0" style={{ color: "var(--primary-strong)" }} />
          <span className="truncate">{current ? label(current) : placeholder}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "var(--text-3)" }} />
      </button>

      <DropdownPanel pos={pos} menuRef={menuRef} onClose={close} className="p-2">
        <div className="relative mb-1.5 shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered[0]) pick(filtered[0].id);
              if (e.key === "Escape") close();
            }}
            placeholder="Search student…"
            className="w-full rounded-lg border py-2 pl-8 pr-3 text-sm outline-none transition-colors focus:border-[var(--primary)]"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto thin-scroll">
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-xs" style={{ color: "var(--text-3)" }}>No student matches “{q}”</p>
          ) : (
            filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(s.id)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--surface-2)]"
                style={{
                  color: s.id === value ? "var(--primary-strong)" : "var(--text)",
                  fontWeight: s.id === value ? 700 : 500,
                  background: s.id === value ? "var(--primary-soft)" : "transparent",
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate">{label(s)}</span>
                  <span className="block truncate text-[10.5px]" style={{ color: "var(--text-3)" }}>{s.studentId}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </DropdownPanel>
    </div>
  );
}

/* ── export HTML (used for Word + Excel downloads) ───────── */
function docHTML({ student, cls, terms, overall, att, refNo, issued }) {
  const info = [
    ["Student ID", student.studentId],
    ["Khmer name", student.khmerName || "—"],
    ["English name", `${student.firstName} ${student.lastName}`],
    ["Gender", student.gender || "—"],
    ["Date of birth", student.dob ? prettyDate(student.dob) : "—"],
    ["Enrolled", student.enrollmentYear ? `Cohort ${student.enrollmentYear}` : "—"],
    ["Class", cls?.name || "—"],
    ["Field of study", cls?.field || majorName(student.major)],
    ["Shift", cls?.shift || "—"],
    ["Degree", cls?.degree || "—"],
    ["Programme", `${majorName(student.major)} · ${programYears(student.major)} years`],
    ["Thesis", student.thesisTitle ? `${student.thesisTitle}${student.thesisScore != null ? ` · ${student.thesisScore}%` : ""}` : student.thesisScore != null ? `${student.thesisScore}%` : null],
    ["Exit exam", student.exitExam != null ? `${student.exitExam}%` : null],
  ].filter(([, v]) => v != null);

  const infoCells = info
    .map(([k, v]) => `<td style="padding:4px 10px;border:1px solid #cbd5e1;color:#475569"><b>${esc(k)}</b></td><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#0f172a">${esc(v)}</td>`)
    .join("");

  const termsHTML = terms
    .map((t) => {
      const st = statsOf(t);
      const rows = rowsOf(t)
        .map(
          (r, i) =>
            `<tr><td style="padding:4px 10px;border:1px solid #cbd5e1;text-align:center">${i + 1}</td><td style="padding:4px 10px;border:1px solid #cbd5e1">${esc(r.subject)}</td><td style="padding:4px 10px;border:1px solid #cbd5e1;text-align:center">${r.score == null ? "—" : r.score.toFixed(2)}</td><td style="padding:4px 10px;border:1px solid #cbd5e1;text-align:center"><b>${r.grade || "—"}</b></td></tr>`
        )
        .join("");
      return `<h3 style="margin:16px 0 4px;color:#0f172a">${esc(t.level)} — ${esc(t.semester)} · ${esc(t.year)}${
        t.archived ? "" : " (in progress)"
      }</h3><table style="border-collapse:collapse;width:100%;font-size:12px"><tr style="background:#f1f5f9;color:#334155"><th style="padding:5px 10px;border:1px solid #cbd5e1">No</th><th style="padding:5px 10px;border:1px solid #cbd5e1;text-align:left">Subject</th><th style="padding:5px 10px;border:1px solid #cbd5e1">Score</th><th style="padding:5px 10px;border:1px solid #cbd5e1">Grade</th></tr>${rows}<tr style="background:#f1f5f9"><td colspan="2" style="padding:5px 10px;border:1px solid #cbd5e1;text-align:right"><b>Term average</b></td><td style="padding:5px 10px;border:1px solid #cbd5e1;text-align:center"><b>${
        st.avg == null ? "—" : st.avg.toFixed(2)
      }</b></td><td style="padding:5px 10px;border:1px solid #cbd5e1;text-align:center"><b>${st.grade || "—"}</b></td></tr></table>`;
    })
    .join("");

  const logoUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${LOGO_SRC}`;
  return `<html><head><meta charset="utf-8"><title>Academic transcript</title></head><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:820px">
  <table style="width:100%;border-collapse:collapse;border-bottom:3px double #0f172a">
    <tr>
      <td style="width:74px;vertical-align:middle;padding-bottom:10px"><img src="${logoUrl}" alt="NTTI" width="64" height="64" /></td>
      <td style="vertical-align:middle;padding-bottom:10px">
        <h1 style="margin:0;font-size:20px">${esc(INSTITUTION_KM)}</h1>
        <p style="margin:2px 0 0;font-size:14px;font-weight:600">${esc(INSTITUTION_EN)}</p>
        <p style="margin:2px 0 0;color:#475569">Office of the Registrar · Official Academic Transcript</p>
      </td>
    </tr>
  </table>
  <p style="display:flex;justify-content:space-between;font-size:12px;color:#475569"><span>Transcript No: <b>${esc(refNo)}</b></span><span>Issued: <b>${esc(issued)}</b></span></p>
  <table style="border-collapse:collapse;width:100%;font-size:12px"><tr>${infoCells}</tr></table>
  ${termsHTML}
  <h3 style="margin:18px 0 4px;color:#0f172a">Cumulative summary</h3>
  <table style="border-collapse:collapse;width:100%;font-size:12px">
    <tr><td style="padding:6px 10px;border:1px solid #cbd5e1;color:#475569">Terms included</td><td style="padding:6px 10px;border:1px solid #cbd5e1"><b>${terms.length}</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#475569">Subjects recorded</td><td style="padding:6px 10px;border:1px solid #cbd5e1"><b>${overall.count}</b></td></tr>
    <tr><td style="padding:6px 10px;border:1px solid #cbd5e1;color:#475569">Overall average</td><td style="padding:6px 10px;border:1px solid #cbd5e1"><b>${overall.avg == null ? "—" : overall.avg.toFixed(2)}</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#475569">GPA (4.00)</td><td style="padding:6px 10px;border:1px solid #cbd5e1"><b>${overall.gpa == null ? "—" : overall.gpa.toFixed(2)}</b></td></tr>
    <tr><td style="padding:6px 10px;border:1px solid #cbd5e1;color:#475569">Overall grade</td><td style="padding:6px 10px;border:1px solid #cbd5e1"><b>${overall.grade || "—"}</b></td>
    <td style="padding:6px 10px;border:1px solid #cbd5e1;color:#475569">Attendance</td><td style="padding:6px 10px;border:1px solid #cbd5e1"><b>${att.rate}%</b> (${att.present} present · ${att.late} late · ${att.absent} absent · ${att.leave} leave)</td></tr>
  </table>
  <p style="margin-top:14px;font-size:11px;color:#475569">Result: <b>${overall.grade && overall.grade !== "F" ? "PASSED" : overall.grade === "F" ? "NOT PASSED" : "IN PROGRESS"}</b>. Grades: A ≥ 90, B ≥ 80, C ≥ 70, D ≥ 60, F &lt; 60.</p>
  <table style="width:100%;margin-top:34px;font-size:12px;color:#475569"><tr>
    <td style="text-align:center;padding-top:30px">_____________________________<br/>Registrar · Date</td>
    <td style="text-align:center;padding-top:30px">_____________________________<br/>Director · Date</td>
    <td style="text-align:center;padding-top:30px">( Official stamp )</td>
  </tr></table>
  <p style="margin-top:10px;font-size:10px;color:#94a3b8">Computer-generated transcript · verify against the Office of the Registrar.</p>
  </body></html>`;
}

function downloadFile(html, filename, type) {
  const blob = new Blob(["\ufeff", html], {
    type: type === "word" ? "application/msword" : "application/vnd.ms-excel",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ── main page ───────────────────────────────────────────── */
export default function Transcript() {
  const { students, classes, attendance, addStudent, updateStudent, logAudit, showToast } = useApp();
  const navigate = useNavigate();
  const [scores, setScores] = useState(loadScores);
  const [schedules, setSchedules] = useState(loadSchedules);

  const initialStudentId = Number(new URLSearchParams(window.location.search).get("student")) || null;
  const initialStudent = initialStudentId ? students.find((s) => s.id === initialStudentId) : null;

  const [classId, setClassId] = useState(initialStudent?.className || classes[0]?.id || "");
  const [studentId, setStudentId] = useState(initialStudent?.id || null);
  const [scope, setScope] = useState("all");
  const [importOpen, setImportOpen] = useState(false);

  // re-read latest scores/schedules when the page opens
  useEffect(() => {
    const t = setTimeout(() => {
      setScores(loadScores());
      setSchedules(loadSchedules());
    }, 60);
    return () => clearTimeout(t);
  }, []);

  const scheduleFor = (clsId) => {
    const klass = classes.find((c) => c.id === clsId);
    const ids = new Set([clsId, klass?.name].filter(Boolean));
    return schedules.find(
      (s) => (s.classId && ids.has(s.classId)) || (s.className && ids.has(s.className))
    );
  };

  const roster = useMemo(
    () =>
      students
        .filter((s) => s.className === classId || !s.className) // class students + class-less students (imported transcripts)
        .sort((a, b) => String(a.studentId || "").localeCompare(String(b.studentId || ""), undefined, { numeric: true })),
    [students, classId]
  );

  // keep the selected student inside the selected class
  useEffect(() => {
    if (roster.length && !roster.some((s) => s.id === studentId)) setStudentId(roster[0].id);
    if (!roster.length) setStudentId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster]);

  // choosing a student from the picker also follows them to their class
  useEffect(() => {
    const s = students.find((x) => x.id === studentId);
    if (s && s.className && s.className !== classId) setClassId(s.className);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const student = students.find((s) => s.id === studentId) || null;
  // class info comes from the student's own class (a class-less student → null)
  const cls = student
    ? classes.find((c) => c.id === student.className) || null
    : classes.find((c) => c.id === classId) || null;
  const yearsInProgram = student ? programYears(student.major) : 4;

  /* every recorded term: archived history + the live (current) term */
  const allTerms = useMemo(() => {
    if (!student) return [];
    const currentLevel = ACADEMIC_LEVELS.includes(student.level) ? student.level : "S1Y1";
    const list = [];
    (student.history || []).forEach((h) => {
      if (!h.level) return;
      const scores = h.scores && typeof h.scores === "object" ? h.scores : {};
      const subs =
        Array.isArray(h.subjects) && h.subjects.length ? h.subjects : Object.keys(scores);
      list.push({
        level: h.level,
        year: h.year || levelMeta(h.level).year,
        semester: h.semester || levelMeta(h.level).semester,
        className: h.className,
        archived: true,
        subjects: subs,
        scores,
      });
    });
    if (student.status !== "Graduate") {
      const live = (scores[student.className] || {})[student.id] || {};
      const sched = scheduleFor(student.className);
      const subjects = sched ? sched.subjects.filter(Boolean) : Object.keys(live);
      list.push({
        level: currentLevel,
        year: levelMeta(currentLevel).year,
        semester: levelMeta(currentLevel).semester,
        className: student.className,
        archived: false,
        subjects: Array.from(new Set(subjects)),
        scores: live,
      });
    }
    // one entry per level, chronological
    const seen = new Map();
    list.forEach((t) => {
      if (!seen.has(t.level)) seen.set(t.level, t);
    });
    return [...seen.values()].sort((a, b) => ACADEMIC_LEVELS.indexOf(a.level) - ACADEMIC_LEVELS.indexOf(b.level));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student, scores, schedules, classes]);

  const terms = useMemo(() => {
    if (scope === "all") return allTerms;
    if (/^Y\d+$/.test(scope)) {
      const y = scope.slice(1);
      return allTerms.filter((t) => t.level === `S1Y${y}` || t.level === `S2Y${y}`);
    }
    return allTerms.filter((t) => t.level === scope);
  }, [scope, allTerms]);

  // years that actually have a recorded term, e.g. ["1", "2"]
  const yearsPresent = useMemo(
    () =>
      [...new Set(allTerms.map((t) => String(t.level || "")[3]).filter(Boolean))].sort(
        (a, b) => Number(a) - Number(b)
      ),
    [allTerms]
  );

  const scopeLabel = scope === "all" ? "all semesters" : /^Y\d+$/.test(scope) ? `Year ${scope.slice(1)}` : scope;

  // if the chosen scope disappears (e.g. switched student), fall back to all semesters
  useEffect(() => {
    if (scope === "all") return;
    const ok = /^Y\d+$/.test(scope)
      ? allTerms.some((t) => t.level === `S1${scope}` || t.level === `S2${scope}`)
      : allTerms.some((t) => t.level === scope);
    if (!ok) setScope("all");
  }, [allTerms, scope]);

  const ysPresent = useMemo(
    () =>
      [...new Set(allTerms.map((t) => String(t.level || "")[3]).filter(Boolean))].sort((a, b) => Number(a) - Number(b)),
    [allTerms]
  );

  /* group scoped terms into YEAR blocks with Semester I (left) and Semester II (right),
     so the document mirrors the official “ex” sheet exactly. */
  const yearBlocks = useMemo(() => {
    const byYear = {};
    terms.forEach((t) => {
      const y = String(t.level || "")[3];
      if (!y) return;
      (byYear[y] ||= {})[String(t.level).slice(0, 2)] = t; // "S1" / "S2"
    });
    return Object.entries(byYear)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([y, m]) => ({ y, s1: m.S1 || null, s2: m.S2 || null }));
  }, [terms]);

  /* ordinal for the YEAR column: "1 st", "2 nd", "3 rd" … */
  const ordinal = (n) => {
    const j = Number(n) % 100;
    if (j >= 11 && j <= 13) return `${n} th`;
    const r = j % 10;
    return `${n}${r === 1 ? "st" : r === 2 ? "nd" : r === 3 ? "rd" : "th"}`;
  };

  const overall = useMemo(() => {
    const rows = terms.flatMap((t) => rowsOf(t)).filter((r) => r.score != null);
    const avg = rows.length ? rows.reduce((a, r) => a + r.score, 0) / rows.length : null;
    const gpa = rows.length ? rows.reduce((a, r) => a + (GRADE_POINTS[r.grade] ?? 0), 0) / rows.length : null;
    return { avg, gpa, grade: letterOf(avg), count: rows.length };
  }, [terms]);

  const att = useMemo(() => {
    const recs = student ? attendance.filter((a) => a.studentId === student.id) : [];
    return {
      present: recs.filter((r) => r.status === "present").length,
      late: recs.filter((r) => r.status === "late").length,
      absent: recs.filter((r) => r.status === "absent").length,
      leave: recs.filter((r) => r.status === "leave").length,
      total: recs.length,
      rate: computeRate(recs),
    };
  }, [student, attendance]);

  const refNo = useMemo(
    () => (student ? `TR-${student.studentId || student.id}-${String(Date.now()).slice(-6)}` : ""),
    [student]
  );
  const issued = prettyDate(todayISO());

  const exportData = () => ({ student, cls, terms, overall, att, refNo, issued });

  const handlePrint = () => {
    if (!student) return;
    logAudit("print_transcript", `Printed transcript for "${student.firstName} ${student.lastName}" (${scopeLabel})`);
    setTimeout(() => window.print(), 60);
  };

  const handleDownload = (type) => {
    if (!student) return;
    const html = docHTML(exportData());
    const base = student.studentId || `${student.firstName}-${student.lastName}`;
    downloadFile(html, `${base}-transcript.${type === "word" ? "doc" : "xls"}`, type);
    logAudit("export_transcript", `Exported ${type === "word" ? "Word" : "Excel"} transcript for "${student.firstName} ${student.lastName}" (${scopeLabel})`);
    showToast(`Transcript exported as ${type === "word" ? "Word" : "Excel"}`);
  };

  /** Merge imported cheatsheet terms into a student's transcript history. */
  const mergeTermsInto = (existing, entries) => {
    const map = new Map((existing || []).map((h) => [h.level, h]));
    entries.forEach((e) => {
      const cur = map.get(e.level);
      const subjects = Array.from(new Set([...(cur?.subjects || []), ...(e.subjects || [])]));
      map.set(e.level, {
        ...(cur || {
          level: e.level,
          year: levelMeta(e.level).year,
          semester: levelMeta(e.level).semester,
          archived: true,
        }),
        level: e.level,
        subjects,
        scores: { ...(cur?.scores || {}), ...(e.scores || {}) },
      });
    });
    return [...map.values()];
  };

  /** Apply the transcript import: update matched students, create class-less ones. */
  const handleTranscriptImport = (rows, stats) => {
    if (!rows.length) return;
    let updated = 0;
    let created = 0;
    let nextId = Math.max(0, ...students.map((s) => s.id));
    const createdIds = [];
    rows.forEach((row) => {
      const entries = (row.entries || [])
        .filter((e) => e.scores && Object.keys(e.scores).length)
        .map((e) => ({
          level: e.level,
          year: levelMeta(e.level).year,
          semester: levelMeta(e.level).semester,
          archived: true,
          subjects: e.subjects || Object.keys(e.scores),
          scores: e.scores,
        }));
      if (!entries.length) return;
      const extra = {};
      if (row.identity?.thesisTitle) extra.thesisTitle = row.identity.thesisTitle;
      if (row.identity?.thesisScore != null) extra.thesisScore = row.identity.thesisScore;
      if (row.identity?.exitExam != null) extra.exitExam = row.identity.exitExam;
      if (row.matched) {
        updateStudent(row.matched.id, {
          history: mergeTermsInto(row.matched.history, entries),
          ...extra,
        });
        updated++;
      } else {
        nextId += 1;
        createdIds.push(nextId);
        const i = row.identity || {};
        const lastLevel = entries[entries.length - 1]?.level || "S1Y1";
        const finished = entries.some((e) => e.level === maxLevelForMajor("it"));
        addStudent({
          firstName: i.firstName || i.khmerName || "Student",
          lastName: i.lastName || "",
          khmerName: i.khmerName || "",
          studentId: i.studentId || `NTTI-${String(nextId).padStart(3, "0")}`,
          gender: i.gender || "",
          dob: i.dob || "",
          major: "it",
          field: "Information Technology",
          level: lastLevel,
          status: finished ? "Graduate" : "Learning",
          className: "",
          ...extra,
          history: entries,
        });
        created++;
      }
    });
    setImportOpen(false);
    if (createdIds.length) {
      setStudentId(createdIds[0]);
      const fresh = students.find((s) => s.id === createdIds[0]);
      if (fresh && fresh.className) setClassId(fresh.className);
    }
    logAudit(
      "import_transcript",
      `Imported transcript scores from cheatsheet: ${updated} student(s) updated, ${created} created (${stats?.scores || 0} scores)`
    );
    showToast(`${stats?.scores || 0} scores imported — ${updated} updated · ${created} new students`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 animate-fade-up">
      {/* print rules + watermark styling: hide chrome, keep the document */}
      <style>{`
        #transcript-doc { position: relative; }
        #transcript-doc > *:not(.transcript-watermark) { position: relative; z-index: 1; }
        .transcript-watermark {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 66%;
          max-width: 560px;
          height: auto;
          transform: translate(-50%, -50%);
          opacity: 0.16;
          filter: blur(4px);
          pointer-events: none;
          user-select: none;
          z-index: 0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        @media print {
          .no-print { display: none !important; }
          /* kill ancestor transforms (fade-up keeps translateY(0)) so position:fixed
             is relative to the printed page and repeats on every page */
          .animate-fade-up { animation: none !important; transform: none !important; opacity: 1 !important; }
          #transcript-doc { box-shadow: none !important; border: none !important; border-radius: 0 !important; margin: 0 !important; position: relative !important; overflow: visible !important; }
          #transcript-doc .transcript-term { page-break-inside: avoid; }
          /* fixed => the blurred logo is centred on EVERY printed page */
          .transcript-watermark {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            width: 62% !important;
            max-width: 520px !important;
            transform: translate(-50%, -50%) !important;
            z-index: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="no-print">
        <PageHeader
          title="Transcript"
          subtitle="Pick a class and student, choose the term(s), then print or download the official record."
          actions={
            <>
              <button
                onClick={() => setImportOpen(true)}
                className="btn btn-outline h-10 shrink-0 px-3.5 text-sm gap-1.5"
                title="Import a score cheatsheet (Excel/CSV) into student transcripts — works for students without a class"
              >
                <Upload size={15} /> Import scores
              </button>
              <div className="min-w-0 flex-1 basis-[200px] sm:flex-none sm:basis-auto">
                <ClassSelect
                  value={classId}
                  onChange={setClassId}
                  placeholder="Select a class"
                  minWidth={200}
                  options={classes.map((c) => ({
                    value: c.id,
                    label: c.name,
                    sub: c.field || "",
                  }))}
                />
              </div>
              <div className="min-w-0 flex-1 basis-[210px] sm:flex-none sm:basis-auto">
                <StudentSelect students={roster} value={studentId} onChange={setStudentId} />
              </div>
            </>
          }
        />
      </div>

      <TranscriptImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        students={students}
        onImport={handleTranscriptImport}
      />

      {!student && (
        <div className="card no-print">
          <EmptyState
            icon={FileText}
            title="No student selected"
            subtitle="Choose a class and a student above to build the transcript."
            action={
              <button onClick={() => navigate("/students")} className="btn btn-primary">
                <Link2 className="h-4 w-4" /> Open Students
              </button>
            }
          />
        </div>
      )}

      {student && (
        <>
          {/* controls */}
          <div className="card p-4 no-print">
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => navigate(-1)} className="btn btn-ghost h-9 px-3 text-sm gap-1">
                <ArrowLeft size={16} /> Back
              </button>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>
                Include
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setScope("all")}
                  title={`Full programme · ${yearsInProgram} years`}
                  className={clsx("rounded-lg border px-3 py-1.5 text-xs font-semibold transition")}
                  style={
                    scope === "all"
                      ? { background: "var(--primary)", color: "#fff", borderColor: "var(--primary)" }
                      : { background: "var(--surface)", color: "var(--text-2)", borderColor: "var(--border)" }
                  }
                >
                  All semesters
                </button>
                {yearsPresent.map((y) => (
                  <button
                    key={`y-${y}`}
                    onClick={() => setScope(`Y${y}`)}
                    title={`Both semesters of Year ${y}`}
                    className={clsx("rounded-lg border px-3 py-1.5 text-xs font-semibold transition")}
                    style={
                      scope === `Y${y}`
                        ? { background: "var(--primary-strong)", color: "#fff", borderColor: "var(--primary-strong)" }
                        : { background: "var(--surface)", color: "var(--text-2)", borderColor: "var(--border)" }
                    }
                  >
                    Year {y}
                  </button>
                ))}
                <span className="mx-0.5 h-5 w-px" style={{ background: "var(--border)" }} />
                {allTerms.map((t) => (
                  <button
                    key={t.level}
                    onClick={() => setScope(t.level)}
                    title={`${t.semester} · ${t.year}`}
                    className={clsx("rounded-lg border px-3 py-1.5 text-xs font-semibold transition")}
                    style={
                      scope === t.level
                        ? { background: "var(--primary)", color: "#fff", borderColor: "var(--primary)" }
                        : { background: "var(--surface)", color: "var(--text-2)", borderColor: "var(--border)" }
                    }
                  >
                    {t.level}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <button onClick={handlePrint} className="btn btn-outline h-10 px-4 text-sm gap-1.5">
                  <Printer size={16} /> Print / PDF
                </button>
                <button onClick={() => handleDownload("word")} className="btn btn-outline h-10 px-4 text-sm gap-1.5">
                  <FileDown size={16} /> Word
                </button>
                <button onClick={() => handleDownload("excel")} className="btn btn-primary h-10 px-4 text-sm gap-1.5">
                  <FileSpreadsheet size={16} /> Excel
                </button>
              </div>
            </div>
          </div>

          {/* ── the transcript document ── */}
          <div
            id="transcript-doc"
            className="relative overflow-hidden rounded-2xl border p-6 sm:p-10"
            style={{ background: "#ffffff", borderColor: LINE, color: INK }}
          >
            {/* faint blurred logo behind the whole document */}
            <img src={LOGO_SRC} alt="" aria-hidden="true" className="transcript-watermark" />

            {/* letterhead — logo top-left, Khmer name, English name under it */}
            <div className="flex items-start gap-4 pb-4 mb-4" style={{ borderBottom: `3px double ${INK}` }}>
              <img src={LOGO_SRC} alt="NTTI" className="h-16 w-16 shrink-0 object-contain" />
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight" style={{ color: INK }}>
                  {INSTITUTION_KM}
                </h1>
                <p className="text-sm font-semibold mt-0.5" style={{ color: INK }}>
                  {INSTITUTION_EN}
                </p>
                <p className="text-xs mt-1" style={{ color: MUTED }}>
                  Office of the Registrar · Official Academic Transcript
                </p>
              </div>
            </div>

            {/* meta */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 text-[11px]" style={{ color: MUTED }}>
              <span>
                Transcript No: <b style={{ color: INK }}>{refNo}</b>
              </span>
              <span>
                Issued: <b style={{ color: INK }}>{issued}</b>
              </span>
              <span style={{ ...gradeTone(overall.grade), borderRadius: 6, padding: "2px 8px", fontWeight: 700 }}>
                {terms.length > 1 ? "Cumulative" : "Single semester"} · {overall.grade && overall.grade !== "F" ? "PASSED" : overall.grade === "F" ? "NOT PASSED" : "IN PROGRESS"}
              </span>
            </div>

            {/* student info */}
            <table className="w-full text-[12px] mb-2" style={{ borderCollapse: "collapse" }}>
              <tbody>
                {[
                  ["Student ID", student.studentId],
                  ["Khmer name", student.khmerName || "—"],
                  ["English name", `${student.firstName} ${student.lastName}`],
                  ["Gender", student.gender || "—"],
                  ["Date of birth", student.dob ? prettyDate(student.dob) : "—"],
                  ["Enrolled", student.enrollmentYear ? `Cohort ${student.enrollmentYear}` : "—"],
                  ["Class", cls?.name || "—"],
                  ["Field of study", cls?.field || majorName(student.major)],
                  ["Shift", cls?.shift || "—"],
                  ["Degree", cls?.degree || "—"],
                  ["Programme", `${majorName(student.major)} · ${yearsInProgram} years`],
                  ["Thesis", student.thesisTitle ? `${student.thesisTitle}${student.thesisScore != null ? ` · ${student.thesisScore}%` : ""}` : student.thesisScore != null ? `${student.thesisScore}%` : null],
                  ["Exit exam", student.exitExam != null ? `${student.exitExam}%` : null],
                ]
                  .filter(([, v]) => v != null)
                  .reduce((pairs, row, i) => {
                    if (i % 2 === 0) pairs.push([row]);
                    else pairs[pairs.length - 1].push(row);
                    return pairs;
                  }, [])
                  .map((pair, i) => (
                    <tr key={i}>
                      {pair.map(([k, v], j) => (
                        <React.Fragment key={j}>
                          <td className="px-2.5 py-1.5 w-[16%]" style={{ border: `1px solid ${LINE}`, color: MUTED, background: SOFT }}>
                            {k}
                          </td>
                          <td className="px-2.5 py-1.5" style={{ border: `1px solid ${LINE}`, color: INK, fontWeight: 600 }}>
                            {v}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>

            {/* terms */}
            {terms.length === 0 && (
              <p className="text-sm py-6 text-center" style={{ color: MUTED }}>
                No semesters recorded yet.
              </p>
            )}

            {terms.map((t) => {
              const st = statsOf(t);
              const rows = rowsOf(t);
              return (
                <div key={t.level} className="transcript-term mt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <p className="text-sm font-extrabold" style={{ color: INK }}>
                      {t.level} — {t.semester} · {t.year}
                      {!t.archived && <span className="ml-2 text-[10px] font-semibold" style={{ color: MUTED }}>(in progress)</span>}
                    </p>
                    <p className="text-[11px]" style={{ color: MUTED }}>
                      Term average{" "}
                      <b style={{ color: INK }}>{st.avg == null ? "—" : st.avg.toFixed(2)}</b>{" "}
                      {st.grade && (
                        <span className="ml-1 rounded px-1.5 py-0.5 font-bold" style={{ ...gradeTone(st.grade) }}>
                          {st.grade}
                        </span>
                      )}
                    </p>
                  </div>
                  <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: SOFT, color: "#334155" }}>
                        <th className="px-2.5 py-1.5 w-10" style={{ border: `1px solid ${LINE}` }}>No</th>
                        <th className="px-2.5 py-1.5 text-left" style={{ border: `1px solid ${LINE}` }}>Subject</th>
                        <th className="px-2.5 py-1.5 w-24" style={{ border: `1px solid ${LINE}` }}>Score</th>
                        <th className="px-2.5 py-1.5 w-20" style={{ border: `1px solid ${LINE}` }}>Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-2.5 py-2 text-center" style={{ border: `1px solid ${LINE}`, color: MUTED }}>
                            No subjects recorded for this semester.
                          </td>
                        </tr>
                      ) : (
                        rows.map((r, i) => (
                          <tr key={i}>
                            <td className="px-2.5 py-1.5 text-center" style={{ border: `1px solid ${LINE}`, color: MUTED }}>{i + 1}</td>
                            <td className="px-2.5 py-1.5" style={{ border: `1px solid ${LINE}`, color: INK }}>{r.subject}</td>
                            <td className="px-2.5 py-1.5 text-center tabular-nums" style={{ border: `1px solid ${LINE}`, color: r.score == null ? MUTED : INK, fontWeight: 700 }}>
                              {r.score == null ? "—" : r.score.toFixed(2)}
                            </td>
                            <td className="px-2.5 py-1.5 text-center" style={{ border: `1px solid ${LINE}`, color: r.grade ? INK : MUTED, fontWeight: 700 }}>
                              {r.grade || "—"}
                            </td>
                          </tr>
                        ))
                      )}
                      <tr style={{ background: SOFT }}>
                        <td colSpan={2} className="px-2.5 py-1.5 text-right font-bold" style={{ border: `1px solid ${LINE}`, color: INK }}>Term average</td>
                        <td className="px-2.5 py-1.5 text-center font-extrabold tabular-nums" style={{ border: `1px solid ${LINE}`, color: INK }}>
                          {st.avg == null ? "—" : st.avg.toFixed(2)}
                        </td>
                        <td className="px-2.5 py-1.5 text-center font-extrabold" style={{ border: `1px solid ${LINE}`, color: INK }}>{st.grade || "—"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}

            {/* cumulative summary + attendance */}
            <div className="grid gap-4 sm:grid-cols-2 mt-6">
              <div className="rounded-xl p-4" style={{ border: `1px solid ${LINE}`, background: "#fbfdff" }}>
                <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: MUTED }}>
                  Cumulative summary
                </p>
                <div className="space-y-1.5 text-[12px]">
                  {[
                    ["Terms included", terms.length],
                    ["Subjects recorded", overall.count],
                    ["Overall average", overall.avg == null ? "—" : overall.avg.toFixed(2)],
                    ["GPA (4.00)", overall.gpa == null ? "—" : overall.gpa.toFixed(2)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between">
                      <span style={{ color: MUTED }}>{k}</span>
                      <b style={{ color: INK }} className="tabular-nums">{v}</b>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1.5" style={{ borderTop: `1px dashed ${LINE}` }}>
                    <span style={{ color: MUTED }}>Overall grade</span>
                    {overall.grade ? (
                      <span className="rounded px-2 py-0.5 text-[12px] font-extrabold" style={gradeTone(overall.grade)}>
                        {overall.grade}
                      </span>
                    ) : (
                      <b style={{ color: MUTED }}>—</b>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-xl p-4" style={{ border: `1px solid ${LINE}`, background: "#fbfdff" }}>
                <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: MUTED }}>
                  Attendance summary
                </p>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-3xl font-extrabold tabular-nums" style={{ color: INK }}>
                    {att.rate}%
                  </span>
                  <span className="text-[11px]" style={{ color: MUTED }}>{att.total} school days</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                  {[
                    ["Present", att.present, "#047857"],
                    ["Late", att.late, "#b45309"],
                    ["Absent", att.absent, "#b91c1c"],
                    ["Leave", att.leave, "#1d4ed8"],
                  ].map(([k, v, c]) => (
                    <div key={k} className="rounded-lg py-1.5" style={{ background: SOFT }}>
                      <p className="font-extrabold tabular-nums" style={{ color: c }}>{v}</p>
                      <p style={{ color: MUTED }}>{k}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* signatures */}
            <div className="grid grid-cols-3 gap-4 mt-12 text-center text-[11px]" style={{ color: MUTED }}>
              {["Registrar", "Director", "Official stamp"].map((role) => (
                <div key={role}>
                  <div className="mx-auto mb-1.5 w-full" style={{ borderBottom: `1px solid ${INK}`, height: 34 }} />
                  <p>{role === "Official stamp" ? "( Official stamp )" : `${role} · Date`}</p>
                </div>
              ))}
            </div>

            <p className="mt-6 text-[10px] text-center" style={{ color: "#94a3b8" }}>
              Computer-generated transcript · verify against the Office of the Registrar.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
