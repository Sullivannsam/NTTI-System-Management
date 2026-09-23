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
  { min: 85, max: 100, grade: "A", meaning: "Excellent", point: "4.00" },
  { min: 80, max: 84, grade: "B+", meaning: "Verygood", point: "3.50" },
  { min: 70, max: 79, grade: "B", meaning: "Good", point: "3.00" },
  { min: 65, max: 69, grade: "C+", meaning: "Fairly Good", point: "2.50" },
  { min: 50, max: 64, grade: "C", meaning: "Fair", point: "2.00" },
  { min: 0, max: 49, grade: "F", meaning: "Fail", point: "1.50" },
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
    .map(
      ([k, v]) =>
        `<td style="padding:4px 10px;border:1px solid #cbd5e1;color:#475569"><b>${esc(k)}</b></td><td style="padding:4px 10px;border:1px solid #cbd5e1;color:#0f172a">${esc(v)}</td>`
    )
    .join("");

  /* group terms into YEAR | SEMESTER I | SEMESTER II blocks (mirrors the on-screen yearBlocks) */
  const byYear = {};
  terms.forEach((t) => {
    const y = String(t.level || "")[3];
    if (!y) return;
    (byYear[y] ||= {})[String(t.level).slice(0, 2)] = t; // "S1" / "S2"
  });
  const blocks = Object.entries(byYear)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([y, m]) => ({ y, s1: m.S1 || null, s2: m.S2 || null }));
  const ordinal = (n) => {
    const j = Number(n) % 100;
    if (j >= 11 && j <= 13) return `${n} th`;
    const r = j % 10;
    return `${n}${r === 1 ? "st" : r === 2 ? "nd" : r === 3 ? "rd" : "th"}`;
  };
  const cell = "border:1px solid #cbd5e1;padding:4px 6px";
  const subjectHTML = (r) =>
    `<td style="${cell};text-align:left">${esc(r?.subject || "")}</td>` +
    `<td style="${cell};text-align:center">${r?.hour == null ? "" : r.hour}</td>` +
    `<td style="${cell};text-align:center">${r?.score == null ? "" : Number(r.score).toFixed(2)}</td>` +
    `<td style="${cell};text-align:center;font-weight:700">${r?.grade || ""}</td>`;
  const yearsHTML = blocks
    .map((b) => {
      const r1 = rowsOf(b.s1 || {});
      const r2 = rowsOf(b.s2 || {});
      const max = Math.max(r1.length, r2.length, 1);
      const st1 = b.s1 ? statsOf(b.s1) : null;
      const st2 = b.s2 ? statsOf(b.s2) : null;
      const yearLabel = ordinal(Number(b.y)).replace(/(\d+)(st|nd|rd|th)/, "$1 $2");
      const uncompleted = !(st1?.count) && !(st2?.count); // a year with subjects but no grades yet
      if (uncompleted) {
        return (
          `<tr><td style="${cell};text-align:center;font-weight:800;background:#f1f5f9">${yearLabel}</td>` +
          `<td colspan="4" style="${cell};text-align:center;color:#64748b">Uncompleted</td>` +
          `<td colspan="4" style="${cell};text-align:center;color:#64748b">Uncompleted</td></tr>`
        );
      }
      const rows = Array.from({ length: max })
        .map(
          (_, i) =>
            `<tr>${i === 0 ? `<td rowspan="${max + 1}" style="${cell};text-align:center;font-weight:800;background:#f1f5f9">${yearLabel}</td>` : ""}` +
            subjectHTML(r1[i]) +
            subjectHTML(r2[i]) +
            `</tr>`
        )
        .join("");
      const avg = (st) =>
        `<td style="${cell};text-align:left">Term average</td>` +
        `<td style="${cell};text-align:center">—</td>` +
        `<td style="${cell};text-align:center;font-weight:700">${st?.avg == null ? "—" : st.avg.toFixed(2)}</td>` +
        `<td style="${cell};text-align:center;font-weight:800">${st?.grade || "—"}</td>`;
      return `${rows}<tr style="background:#f1f5f9">${avg(st1)}${avg(st2)}</tr>`;
    })
    .join("");

  const stateExam =
    student.exitExam != null && student.exitExam !== ""
      ? `Exit / State Examination · Score: ${Number(student.exitExam).toFixed(2)} · Grade: ${letterOf(Number(student.exitExam))}`
      : "—";
  const practicalExam =
    student.thesisScore != null && student.thesisScore !== ""
      ? `${student.thesisTitle || "Thesis / Practical project"} · Score: ${Number(student.thesisScore).toFixed(2)} · Grade: ${letterOf(Number(student.thesisScore))}`
      : "—";

  const legendRows = NTTI_SCALE.map(
    (g) =>
      `<tr><td style="${cell};text-align:center">${g.min === 0 ? "Less than 50" : `${g.min} - ${g.max}`}</td>` +
      `<td style="${cell};text-align:center;font-weight:700">${g.grade}</td>` +
      `<td style="${cell};text-align:left">${g.meaning}</td>` +
      `<td style="${cell};text-align:center">${g.point}</td></tr>`
  ).join("");

  const logoUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${LOGO_SRC}`;
  return `<html><head><meta charset="utf-8"><title>Academic transcript</title></head><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:820px">
  <table style="width:100%;border-collapse:collapse;border-bottom:3px double #0f172a">
    <tr>
      <td style="width:74px;vertical-align:middle;padding-bottom:10px"><img src="${logoUrl}" alt="NTTI" width="64" height="64" /></td>
      <td style="vertical-align:middle;padding-bottom:10px;text-align:center">
        <h1 style="margin:0;font-size:16px;color:#0f172a">${esc(INSTITUTION_LINES.country)}</h1>
        <p style="margin:2px 0 0;font-size:12px;color:#0f172a">${esc(INSTITUTION_LINES.motto)}</p>
        <p style="margin:2px 0 0;font-size:12px;color:#0f172a">${esc(INSTITUTION_LINES.ministry)}</p>
        <p style="margin:4px 0 0;font-size:15px;font-weight:800;color:#0f172a">${esc(INSTITUTION_LINES.institute)}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#475569">${esc(INSTITUTION_LINES.noLine)}</p>
      </td>
    </tr>
  </table>
  <h2 style="text-align:center;margin:14px 0 4px;letter-spacing:.25em;font-size:16px;color:#0f172a">OFFICIAL TRANSCRIPT</h2>
  <p style="display:flex;justify-content:space-between;font-size:12px;color:#475569"><span>Transcript No: <b>${esc(refNo)}</b></span><span>Issued: <b>${esc(issued)}</b></span></p>
  <table style="border-collapse:collapse;width:100%;font-size:12px"><tr>${infoCells}</tr></table>
  <p style="font-size:12px;margin:8px 0;color:#0f172a">Has successfully completed Diploma of Technology in the field of <b>${esc(cls?.field || majorName(student.major))}</b> in academic year <b>${student.enrollmentYear || "—"} - ${student.enrollmentYear ? Number(student.enrollmentYear) + (programYears(student.major) - 1) : "—"}</b></p>
  <table style="border-collapse:collapse;width:100%;font-size:12px">
    <tr><th rowspan="2" style="${cell};background:#f1f5f9;width:56px">YEAR</th><th colspan="4" style="${cell};background:#f1f5f9">SEMESTER I</th><th colspan="4" style="${cell};background:#f1f5f9">SEMESTER II</th></tr>
    <tr>${[0, 1].map(() => `<th style="${cell};background:#f1f5f9;text-align:left">Subjects</th><th style="${cell};background:#f1f5f9">HOUR</th><th style="${cell};background:#f1f5f9">Score (100/100)</th><th style="${cell};background:#f1f5f9">Grade</th>`).join("")}</tr>
    ${yearsHTML}
    <tr><td style="${cell};background:#f1f5f9;font-weight:800;text-align:center">State Exam</td><td colspan="8" style="${cell}">${esc(stateExam)}</td></tr>
    <tr><td style="${cell};background:#f1f5f9;font-weight:800;text-align:center">Practical Exam</td><td colspan="8" style="${cell}">${esc(practicalExam)}</td></tr>
  </table>
  <table style="border-collapse:collapse;margin-top:12px;font-size:11px">
    <tr><th style="${cell};background:#f1f5f9">Mark Obtained</th><th style="${cell};background:#f1f5f9">Grade</th><th style="${cell};background:#f1f5f9">Meaning</th><th style="${cell};background:#f1f5f9">Grade Point</th></tr>
    ${legendRows}
  </table>
  <p style="font-size:12px;margin-top:10px;color:#0f172a"><b>REMARKS:</b> <span style="color:#475569;font-size:11px">${overall.grade && overall.grade !== "F" ? "Overall result: PASSED" : overall.grade === "F" ? "Overall result: NOT PASSED" : "Overall result: IN PROGRESS"} · Average ${overall.avg == null ? "—" : overall.avg.toFixed(1)} · GPA ${overall.gpa == null ? "—" : overall.gpa.toFixed(2)}</span></p>
  <table style="width:100%;margin-top:28px;font-size:12px;color:#475569"><tr>
    <td style="text-align:center;padding-top:30px">_____________________________<br/>Deputy Director</td>
    <td style="text-align:center;padding-top:30px"><span style="font-size:10px">Phnom Penh, Date ..................<br/>${esc(issued)}</span></td>
    <td style="text-align:center;padding-top:30px">_____________________________<br/>Director</td>
  </tr></table>
  <div style="margin-top:18px;border-top:1px solid #cbd5e1;text-align:center;font-size:10px;color:#475569">
    <p style="margin:6px 0 2px">${esc(INSTITUTION_LINES.certNo)}</p>
    <p style="margin:2px 0">${esc(INSTITUTION_LINES.address1)}</p>
    <p style="margin:2px 0">${esc(INSTITUTION_LINES.address2)}</p>
  </div>
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

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ── real .xlsx export mirroring the official “ex” cheatsheet grid ── */
function buildTranscriptWorkbook({ student, cls, terms, overall, att, refNo, issued }) {
  /* column grid mirrors the official sheet exactly (0-indexed):
     0 YEAR · 1-7 SEM I Subjects · 8 HOUR · 9 Score (100/100) · 10 Grade
     · 11-16 SEM II Subjects · 17 HOUR · 18 Score (100/100) · 19 Grade  */
  const W = 20; // column count A..T
  const aoa = [];
  const merges = [];
  const set = (r, c, v) => {
    (aoa[r] = aoa[r] || []);
    aoa[r][c] = v === undefined || v === null ? "" : v;
  };
  const thin = { style: "thin", color: { rgb: "9CA3AF" } };
  const border = { top: thin, bottom: thin, left: thin, right: thin };
  const st = (o) => ({ ...o, border });
  const H = (r, c, v, span = 1) => {
    const o = st({ font: { bold: true }, fill: { fgColor: { rgb: "E2E8F0" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true } });
    set(r, c, { t: "s", v: v ?? "", s: o });
    if (span > 1) merges.push({ s: { r, c }, e: { r, c: c + span - 1 } });
  };

  /* letterhead — mirrors official rows 0-4 (centred across A..T) */
  const L = (r, v, bold = false) => {
    set(r, 0, { t: "s", v, s: st({ font: bold ? { bold: true, sz: 13 } : { sz: 11 }, alignment: { horizontal: "center", vertical: "center" } }) });
    merges.push({ s: { r, c: 0 }, e: { r, c: W - 1 } });
  };
  L(0, INSTITUTION_LINES.country, true);
  L(1, INSTITUTION_LINES.motto, false);
  L(2, INSTITUTION_LINES.ministry, false);
  L(3, INSTITUTION_LINES.institute, true);
  L(4, INSTITUTION_LINES.noLine, false);
  set(5, 0, "");
  L(6, "OFFICIAL TRANSCRIPT", true);

  /* student block — official rows 7-10 */
  const pair = (r, c0, k, v) => {
    set(r, c0, { t: "s", v: k + " :", s: st({ font: { bold: true }, alignment: { horizontal: "right" } }) });
    set(r, c0 + 1, { t: "s", v: v || "—", s: st({ alignment: { horizontal: "left" } }) });
  };
  pair(7, 0, "Student", student.khmerName ? `${student.khmerName} (${student.firstName} ${student.lastName})` : `${student.firstName} ${student.lastName}`);
  set(7, 10, { t: "s", v: "Sex :", s: st({ font: { bold: true }, alignment: { horizontal: "right" } }) });
  set(7, 11, { t: "s", v: student.gender || "—", s: st({}) });
  set(7, 16, { t: "s", v: "Nationality :", s: st({ font: { bold: true }, alignment: { horizontal: "right" } }) });
  set(7, 17, { t: "s", v: "Khmer", s: st({}) });
  pair(8, 0, "Date of Birth", student.dob ? prettyDate(student.dob) : null);
  set(8, 10, { t: "s", v: "Date of Graduation :", s: st({ font: { bold: true }, alignment: { horizontal: "left" } }) });
  set(8, 11, {
    t: "s",
    v: student.enrollmentYear ? String(Number(student.enrollmentYear) + (programYears(student.major) - 1)) : "—",
    s: st({}),
  });
  pair(9, 0, "Place of Birth", "—");

  /* statement + StudentNo — official row 10 */
  set(10, 0, {
    t: "s",
    v: `Has successfully completed Diploma of Technology in the field of ${cls?.field || majorName(student.major)} in academic year ${student.enrollmentYear || "—"} - ${student.enrollmentYear ? Number(student.enrollmentYear) + (programYears(student.major) - 1) : "—"}`,
    s: st({ font: { bold: true }, alignment: { horizontal: "left" } }),
  });
  merges.push({ s: { r: 10, c: 0 }, e: { r: 10, c: 12 } });
  set(10, 13, { t: "s", v: "StudentNo:", s: st({ font: { bold: true }, alignment: { horizontal: "right" } }) });
  set(10, 14, { t: "s", v: String(student.studentId || "—"), s: st({}) });
  merges.push({ s: { r: 10, c: 14 }, e: { r: 10, c: 19 } });

  /* ----- main table header (official rows 12-13) ----- */
  const hdrR = 12;
  H(hdrR, 0, "YEAR");
  H(hdrR, 1, "SEMESTER I", 10);
  H(hdrR, 11, "SEMESTER II", 9);
  merges.push({ s: { r: hdrR, c: 0 }, e: { r: hdrR + 1, c: 0 } });
  const sub = hdrR + 1;
  H(sub, 1, "Subjects", 7);
  H(sub, 8, "HOUR", 1);
  H(sub, 9, "Score (100/100)", 1);
  H(sub, 10, "Grade", 1);
  H(sub, 11, "Subjects", 6);
  H(sub, 17, "HOUR", 1);
  H(sub, 18, "Score (100/100)", 1);
  H(sub, 19, "Grade", 1);

  /* ----- year blocks (official rows 14+) ----- */
  const byYear = {};
  terms.forEach((t) => {
    const y = String(t.level || "")[3];
    if (!y) return;
    (byYear[y] ||= {})[String(t.level).slice(0, 2)] = t; // matches yearBlocks logic
  });
  const blocks = Object.entries(byYear)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([y, m]) => ({ y, s1: m.S1 || null, s2: m.S2 || null }));

  const ordinalEx = (n) => {
    const j = Number(n) % 100;
    if (j >= 11 && j <= 13) return `${n} th`;
    const r = j % 10;
    return `${n}${r === 1 ? "st" : r === 2 ? "nd" : r === 3 ? "rd" : "th"}`;
  };

  let row = sub + 1;
  const yearCellStyle = st({ font: { bold: true }, alignment: { horizontal: "center", vertical: "center" } });
  const ordinalLabel = (n) => ordinalEx(n).replace(/(\d)(st|nd|rd|th)$/, "$1 $2"); // official "1 st"
  const numCell = (v) =>
    v == null
      ? { t: "s", v: "", s: st({ alignment: { horizontal: "center" } }) }
      : { t: "s", v: Number(v).toFixed(2), s: st({ alignment: { horizontal: "center" } }) };
  const hourCell = (v) =>
    v == null
      ? { t: "s", v: "", s: st({ alignment: { horizontal: "center" } }) }
      : { t: "n", v, s: st({ alignment: { horizontal: "center" } }) };
  const gradeCell = (g) => ({ t: "s", v: g || "", s: st({ font: { bold: true }, alignment: { horizontal: "center" } }) });
  blocks.forEach((b) => {
    const r1 = rowsOf(b.s1 || {});
    const r2 = rowsOf(b.s2 || {});
    const max = Math.max(r1.length, r2.length, 1);
    const st1 = b.s1 ? statsOf(b.s1) : null;
    const st2 = b.s2 ? statsOf(b.s2) : null;
    const y0 = row;
    // a year with subjects but no grades yet — official renders one merged "Uncompleted" block
    if (!(st1?.count) && !(st2?.count)) {
      merges.push({ s: { r: y0, c: 0 }, e: { r: y0 + max, c: 0 } });
      set(y0, 0, { t: "s", v: ordinalLabel(b.y), s: yearCellStyle });
      set(y0, 1, { t: "s", v: "Uncompleted", s: st({ alignment: { horizontal: "center", vertical: "center" } }) });
      merges.push({ s: { r: y0, c: 1 }, e: { r: y0 + max, c: 10 } });
      set(y0, 11, { t: "s", v: "Uncompleted", s: st({ alignment: { horizontal: "center", vertical: "center" } }) });
      merges.push({ s: { r: y0, c: 11 }, e: { r: y0 + max, c: 19 } });
      row += max + 1;
      return;
    }
    merges.push({ s: { r: y0, c: 0 }, e: { r: y0 + max, c: 0 } });
    set(y0, 0, { t: "s", v: ordinalLabel(b.y), s: yearCellStyle });
    for (let i = 0; i < max; i++) {
      const a = r1[i];
      const b = r2[i];
      set(row, 1, { t: "s", v: a?.subject || "", s: st({}) });
      merges.push({ s: { r: row, c: 1 }, e: { r: row, c: 7 } });
      set(row, 8, hourCell(a?.hour));
      set(row, 9, numCell(a ? a.score : null));
      set(row, 10, gradeCell(a?.grade));
      set(row, 11, { t: "s", v: b?.subject || "", s: st({}) });
      merges.push({ s: { r: row, c: 11 }, e: { r: row, c: 16 } });
      set(row, 17, hourCell(b?.hour));
      set(row, 18, numCell(b ? b.score : null));
      set(row, 19, gradeCell(b?.grade));
      row++;
    }
    // per-year average row
    const avgStyle = st({ font: { bold: true }, fill: { fgColor: { rgb: "E2E8F0" } }, alignment: { horizontal: "left" } });
    const avgNum = st({ font: { bold: true }, fill: { fgColor: { rgb: "E2E8F0" } }, alignment: { horizontal: "center" } });
    if (b.s1) {
      set(row, 1, { t: "s", v: "Term average", s: avgStyle });
      set(row, 9, st1?.avg != null ? { t: "s", v: st1.avg.toFixed(2), s: avgNum } : { t: "s", v: "—", s: avgNum });
      set(row, 10, { t: "s", v: st1?.grade || "—", s: avgNum });
    }
    merges.push({ s: { r: row, c: 1 }, e: { r: row, c: 7 } });
    if (b.s2) {
      set(row, 11, { t: "s", v: "Term average", s: avgStyle });
      set(row, 18, st2?.avg != null ? { t: "s", v: st2.avg.toFixed(2), s: avgNum } : { t: "s", v: "—", s: avgNum });
      set(row, 19, { t: "s", v: st2?.grade || "—", s: avgNum });
    }
    merges.push({ s: { r: row, c: 11 }, e: { r: row, c: 16 } });
    row++;
  });

  /* State Exam / Practical Exam rows (official 40-44 style) */
  const examLabel = () => st({ font: { bold: true }, fill: { fgColor: { rgb: "E2E8F0" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true } });
  merges.push({ s: { r: row, c: 0 }, e: { r: row + 1, c: 0 } });
  set(row, 0, { t: "s", v: "State\nExam", s: examLabel() });
  set(row, 1, { t: "s", v: "Exit / State Examination", s: st({}) });
  merges.push({ s: { r: row, c: 1 }, e: { r: row, c: 8 } });
  set(row, 9, { t: "s", v: student.exitExam != null && student.exitExam !== "" ? Number(student.exitExam).toFixed(2) : "—", s: st({ alignment: { horizontal: "center" } }) });
  set(row, 10, { t: "s", v: student.exitExam != null && student.exitExam !== "" ? letterOf(Number(student.exitExam)) : "—", s: st({ font: { bold: true }, alignment: { horizontal: "center" } }) });
  set(row, 11, { t: "s", v: "Practical Exam", s: examLabel() });
  merges.push({ s: { r: row, c: 11 }, e: { r: row, c: 12 } });
  set(row, 13, { t: "s", v: student.thesisTitle || "Thesis / Practical project", s: st({}) });
  merges.push({ s: { r: row, c: 13 }, e: { r: row, c: 17 } });
  set(row, 18, { t: "s", v: student.thesisScore != null && student.thesisScore !== "" ? Number(student.thesisScore).toFixed(2) : "—", s: st({ alignment: { horizontal: "center" } }) });
  set(row, 19, { t: "s", v: student.thesisScore != null && student.thesisScore !== "" ? letterOf(Number(student.thesisScore)) : "—", s: st({ font: { bold: true }, alignment: { horizontal: "center" } }) });
  row++;
  set(row, 1, { t: "s", v: overall.avg != null ? `Overall average: ${overall.avg.toFixed(1)}` : "Overall average: —", s: st({}) });
  merges.push({ s: { r: row, c: 1 }, e: { r: row, c: 10 } });
  row++;

  /* grade legend (official 48-55) */
  row++;
  set(row, 1, { t: "s", v: "REMARKS:", s: st({ font: { bold: true } }) });
  set(row, 2, {
    t: "s",
    v: `${overall.grade && overall.grade !== "F" ? "Overall result: PASSED" : overall.grade === "F" ? "Overall result: NOT PASSED" : "Overall result: IN PROGRESS"} · GPA ${overall.gpa != null ? overall.gpa.toFixed(2) : "—"}`,
    s: st({}),
  });
  merges.push({ s: { r: row, c: 2 }, e: { r: row, c: 10 } });
  row += 2;
  H(row, 1, "Mark Obtained", 2);
  H(row, 4, "Grade", 2);
  H(row, 6, "Meaning", 3);
  H(row, 9, "Grade Point", 1);
  set(row, 12, { t: "s", v: "Phnom Penh, Date ...............", s: st({ alignment: { horizontal: "center" } }) });
  merges.push({ s: { r: row, c: 12 }, e: { r: row, c: 15 } });
  set(row, 16, { t: "s", v: "Official Stamp", s: st({ alignment: { horizontal: "center" } }) });
  merges.push({ s: { r: row, c: 16 }, e: { r: row, c: 19 } });
  row++;
  NTTI_SCALE.forEach((g, i) => {
    set(row, 1, { t: "s", v: g.min === 0 ? "Less than 50" : `${g.min} - ${g.max}`, s: st({ alignment: { horizontal: "center" } }) });
    merges.push({ s: { r: row, c: 1 }, e: { r: row, c: 2 } });
    set(row, 4, { t: "s", v: g.grade, s: st({ font: { bold: true }, alignment: { horizontal: "center" } }) });
    merges.push({ s: { r: row, c: 4 }, e: { r: row, c: 5 } });
    set(row, 6, { t: "s", v: g.meaning, s: st({ alignment: { horizontal: "center" } }) });
    merges.push({ s: { r: row, c: 6 }, e: { r: row, c: 8 } });
    set(row, 9, { t: "s", v: g.point, s: st({ alignment: { horizontal: "center" } }) });
    if (i === 0) {
      set(row, 12, { t: "s", v: "Deputy Director", s: st({ alignment: { horizontal: "center" } }) });
      merges.push({ s: { r: row, c: 12 }, e: { r: row, c: 15 } });
    }
    if (i === 1) {
      set(row, 16, { t: "s", v: "Director", s: st({ alignment: { horizontal: "center" } }) });
      merges.push({ s: { r: row, c: 16 }, e: { r: row, c: 19 } });
    }
    row++;
  });

  /* ISO footer (official 70-72) */
  row++;
  const foot = (v) => {
    set(row, 0, { t: "s", v, s: st({ alignment: { horizontal: "center", vertical: "center" } }) });
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: W - 1 } });
    row++;
  };
  foot(INSTITUTION_LINES.certNo);
  foot(INSTITUTION_LINES.address1);
  foot(INSTITUTION_LINES.address2);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = merges;
  ws["!cols"] = [
    { wch: 7 }, // YEAR
    { wch: 24 }, { wch: 3 }, { wch: 3 }, { wch: 3 }, { wch: 3 }, { wch: 3 }, { wch: 3 }, // SEM I Subjects (1-7)
    { wch: 7 }, // HOUR
    { wch: 17 }, // Score
    { wch: 6 }, // Grade
    { wch: 24 }, { wch: 3 }, { wch: 3 }, { wch: 3 }, { wch: 3 }, { wch: 3 }, // SEM II Subjects (11-16)
    { wch: 7 }, // HOUR
    { wch: 17 }, // Score
    { wch: 6 }, // Grade
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ex");
  return wb;
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
    const base = student.studentId || `${student.firstName}-${student.lastName}`;
    if (type === "excel") {
      const wb = buildTranscriptWorkbook(exportData());
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      downloadBlob(
        new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        `${base}-transcript.xlsx`
      );
    } else {
      downloadFile(docHTML(exportData()), `${base}-transcript.doc`, "word");
    }
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

{/* letterhead — official KINGDOM OF CAMBODIA / NTTI “ex” cheatsheet */}
            <div className="flex items-start gap-4 pb-4 mb-4" style={{ borderBottom: `3px double ${INK}` }}>
              <img src={LOGO_SRC} alt="NTTI" className="h-16 w-16 shrink-0 object-contain" />
              <div className="min-w-0 flex-1 text-center">
                <p className="text-[13px] font-extrabold tracking-tight" style={{ color: INK }}>
                  {INSTITUTION_LINES.country}
                </p>
                <p className="text-[11px] font-semibold mt-0.5" style={{ color: INK }}>
                  {INSTITUTION_LINES.motto}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: INK }}>
                  {INSTITUTION_LINES.ministry}
                </p>
                <p className="text-[13px] font-extrabold mt-0.5" style={{ color: INK }}>
                  {INSTITUTION_LINES.institute}
                </p>
                <p className="text-[10px] mt-1 tabular-nums" style={{ color: MUTED }}>
                  {INSTITUTION_LINES.noLine}
                </p>
              </div>
            </div>

            {/* title + meta */}
            <div className="text-center mb-3">
              <h2 className="text-base font-extrabold tracking-[0.25em]" style={{ color: INK }}>
                OFFICIAL TRANSCRIPT
              </h2>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-[10px]" style={{ color: MUTED }}>
                <span>
                  Transcript No: <b style={{ color: INK }}>{refNo}</b>
                </span>
                <span>
                  Issued: <b style={{ color: INK }}>{issued}</b>
                </span>
              </div>
            </div>

            {/* student header block — mirrors official R7–R10 */}
            <table className="w-full text-[12px] mb-3" style={{ borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "2px 0", color: MUTED, width: 92 }}>Student</td>
                  <td style={{ padding: "2px 8px 2px 0", color: INK, fontWeight: 700 }}>
                    {student.khmerName ? `${student.khmerName} · ` : ""}
                    {student.firstName} {student.lastName}
                  </td>
                  <td style={{ padding: "2px 0", color: MUTED, width: 36 }}>Sex</td>
                  <td style={{ padding: "2px 8px 2px 0", color: INK }}>{student.gender || "—"}</td>
                  <td style={{ padding: "2px 0", color: MUTED, width: 78 }}>Nationality</td>
                  <td style={{ padding: "2px 0", color: INK }}>Khmer</td>
                </tr>
                <tr>
                  <td style={{ padding: "2px 0", color: MUTED }}>Date of Birth</td>
                  <td style={{ padding: "2px 8px 2px 0", color: INK }}>{student.dob ? prettyDate(student.dob) : "—"}</td>
                  <td style={{ padding: "2px 0", color: MUTED }}>Graduation</td>
                  <td style={{ padding: "2px 8px 2px 0", color: INK }}>
                    {student.enrollmentYear ? `${Number(student.enrollmentYear) + (yearsInProgram - 1)}` : "—"}
                  </td>
                  <td style={{ padding: "2px 0", color: MUTED }}>Place of Birth</td>
                  <td style={{ padding: "2px 0", color: INK }}>—</td>
                </tr>
                <tr>
                  <td style={{ padding: "2px 0", color: MUTED }}>Student No</td>
                  <td colSpan={5} style={{ padding: "2px 0", color: INK }}>{student.studentId || "—"}</td>
                </tr>
              </tbody>
            </table>

            {/* completion statement — official R10 */}
            <p className="text-[12px] mb-3" style={{ color: INK }}>
              Has successfully completed Diploma of Technology in the field of{" "}
              <b>{cls?.field || majorName(student.major)}</b> in academic year{" "}
              <b>
                {student.enrollmentYear || "—"} - {student.enrollmentYear ? Number(student.enrollmentYear) + (yearsInProgram - 1) : "—"}
              </b>
            </p>

            {/* ── YEAR | SEMESTER I | SEMESTER II cheatsheet table ── */}
            <style>{`
              #transcript-doc .ex-table { width: 100%; border-collapse: collapse; font-size: 11px; color: ${INK}; }
              #transcript-doc .ex-table th,
              #transcript-doc .ex-table td { border: 1px solid ${LINE}; padding: 3px 5px; vertical-align: middle; }
              #transcript-doc .ex-table th { background: ${SOFT}; font-weight: 800; text-align: center; }
              #transcript-doc .ex-table td.num { text-align: center; }
              #transcript-doc .ex-table td.grade { text-align: center; font-weight: 700; }
              #transcript-doc .ex-table td.year { text-align: center; font-weight: 800; vertical-align: middle; background: ${SOFT}; }
              #transcript-doc .ex-table tbody.transcript-term { page-break-inside: avoid; }
              #transcript-doc .ex-table tr.avg-row td { background: ${SOFT}; font-weight: 700; }
              #transcript-doc .ex-legend { border-collapse: collapse; font-size: 11px; color: ${INK}; }
              #transcript-doc .ex-legend th,
              #transcript-doc .ex-legend td { border: 1px solid ${LINE}; padding: 2px 8px; text-align: center; }
            `}</style>

            <table className="ex-table" style={{ marginBottom: 14 }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ width: 56 }}>YEAR</th>
                  <th colSpan={4} style={{ color: INK }}>SEMESTER I</th>
                  <th colSpan={4} style={{ color: INK }}>SEMESTER II</th>
                </tr>
                <tr>
                  {[0, 1].map((side) => (
                    <React.Fragment key={side}>
                      <th style={{ textAlign: "left" }}>Subjects</th>
                      <th>HOUR</th>
                      <th>Score (100/100)</th>
                      <th>Grade</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              {yearBlocks.map((block) => {
                const r1 = rowsOf(block.s1 || {});
                const r2 = rowsOf(block.s2 || {});
                const max = Math.max(r1.length, r2.length, 1);
                const st1 = block.s1 ? statsOf(block.s1) : null;
                const st2 = block.s2 ? statsOf(block.s2) : null;
                const yearLabel = ordinal(Number(block.y)).replace(/(\d+)(st|nd|rd|th)/, "$1 $2");
                const uncompleted = !(st1?.count) && !(st2?.count); // a year with subjects but no grades yet
                if (uncompleted) {
                  return (
                    <tbody key={`y-${block.y}`} className="transcript-term">
                      <tr>
                        <td className="year">{yearLabel}</td>
                        <td colSpan={4} style={{ textAlign: "center", color: MUTED }}>Uncompleted</td>
                        <td colSpan={4} style={{ textAlign: "center", color: MUTED }}>Uncompleted</td>
                      </tr>
                    </tbody>
                  );
                }
                return (
                  <tbody key={`y-${block.y}`} className="transcript-term">
                    {Array.from({ length: max }).map((_, i) => (
                      <tr key={`${block.y}-${i}`}>
                        {i === 0 && (
                          <td className="year" rowSpan={max + 1}>
                            {yearLabel}
                          </td>
                        )}
                        <td style={{ textAlign: "left" }}>{r1[i]?.subject ?? ""}</td>
                        <td className="num">{r1[i]?.hour ?? ""}</td>
                        <td className="num">{r1[i]?.score != null ? Number(r1[i].score).toFixed(2) : ""}</td>
                        <td className="grade">{r1[i]?.grade ?? ""}</td>
                        <td style={{ textAlign: "left" }}>{r2[i]?.subject ?? ""}</td>
                        <td className="num">{r2[i]?.hour ?? ""}</td>
                        <td className="num">{r2[i]?.score != null ? Number(r2[i].score).toFixed(2) : ""}</td>
                        <td className="grade">{r2[i]?.grade ?? ""}</td>
                      </tr>
                    ))}
                    <tr className="avg-row">
                      <td style={{ textAlign: "left" }}>Term average</td>
                      <td className="num">—</td>
                      <td className="num">{st1?.avg != null ? st1.avg.toFixed(2) : "—"}</td>
                      <td className="grade">{st1?.grade ?? "—"}</td>
                      <td style={{ textAlign: "left" }}>Term average</td>
                      <td className="num">—</td>
                      <td className="num">{st2?.avg != null ? st2.avg.toFixed(2) : "—"}</td>
                      <td className="grade">{st2?.grade ?? "—"}</td>
                    </tr>
                  </tbody>
                );
              })}
              {/* State Exam / Practical Exam — official R40–44 */}
              <tbody className="transcript-term">
                <tr>
                  <td className="year">State Exam</td>
                  <td colSpan={8} style={{ textAlign: "left" }}>
                    {student.exitExam != null && student.exitExam !== ""
                      ? `Exit / State Examination · Score: ${Number(student.exitExam).toFixed(2)} · Grade: ${letterOf(Number(student.exitExam))}`
                      : "—"}
                  </td>
                </tr>
                <tr>
                  <td className="year">Practical Exam</td>
                  <td colSpan={8} style={{ textAlign: "left" }}>
                    {student.thesisScore != null && student.thesisScore !== ""
                      ? `${student.thesisTitle || "Thesis / Practical project"} · Score: ${Number(student.thesisScore).toFixed(2)} · Grade: ${letterOf(Number(student.thesisScore))}`
                      : "—"}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* grade-scale legend — official R49–55 */}
            <div className="flex flex-wrap items-start gap-6 mb-3">
              <table className="ex-legend">
                <thead>
                  <tr>
                    <th style={{ color: INK }}>Mark Obtained</th>
                    <th style={{ color: INK }}>Grade</th>
                    <th style={{ color: INK }}>Meaning</th>
                    <th style={{ color: INK }}>Grade Point</th>
                  </tr>
                </thead>
                <tbody>
                  {NTTI_SCALE.map((g) => (
                    <tr key={g.grade}>
                      <td>{g.min === 0 ? "Less than 50" : `${g.min} - ${g.max}`}</td>
                      <td style={{ fontWeight: 700 }}>{g.grade}</td>
                      <td style={{ textAlign: "left" }}>{g.meaning}</td>
                      <td>{g.point}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[12px] mt-1" style={{ color: INK }}>
                <b>REMARKS:</b>
                <span className="ml-1 text-[11px]" style={{ color: MUTED }}>
                  {overall.grade && overall.grade !== "F" ? "Overall result: PASSED" : overall.grade === "F" ? "Overall result: NOT PASSED" : "Overall result: IN PROGRESS"}
                  {" · "}Average {overall.avg != null ? overall.avg.toFixed(1) : "—"}
                  {" · "}GPA {overall.gpa != null ? overall.gpa.toFixed(2) : "—"}
                </span>
              </p>
            </div>

            {/* place + date + signatures — official R49–55 signatures */}
            <div className="flex items-end justify-between gap-4 text-center text-[11px]" style={{ color: INK }}>
              <div className="min-w-0 flex-1">
                <div className="mx-auto w-full mb-1" style={{ borderBottom: `1px solid ${INK}`, height: 30 }} />
                <p className="font-semibold">Deputy Director</p>
              </div>
              <div className="shrink-0 px-6 text-[10px]" style={{ color: MUTED }}>
                Phnom Penh, Date ..................
                <br />
                {issued}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mx-auto w-full mb-1" style={{ borderBottom: `1px solid ${INK}`, height: 30 }} />
                <p className="font-semibold">Director</p>
              </div>
            </div>

            {/* ISO footer — official R70–72 */}
            <div className="mt-5 pt-3 text-center text-[10px]" style={{ borderTop: `1px solid ${LINE}`, color: MUTED }}>
              <p>{INSTITUTION_LINES.certNo}</p>
              <p className="mt-0.5">{INSTITUTION_LINES.address1}</p>
              <p>{INSTITUTION_LINES.address2}</p>
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
