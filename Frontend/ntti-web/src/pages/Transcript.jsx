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
  Pencil,
  Check,
  X,
} from "lucide-react";
import clsx from "clsx";
import * as XLSX from "xlsx-js-style";
import { useApp } from "../context/AppContext";
import PageHeader, { EmptyState } from "../components/Page";
import ClassSelect from "../components/ClassSelect";
import { useDropPos, DropdownPanel } from "../components/Dropdown";
import TranscriptImportModal from "../components/TranscriptImportModal";
import { ACADEMIC_LEVELS, levelMeta, majorName, prettyDate, computeRate, todayISO, programYears, maxLevelForMajor } from "../data/seed";
import { cleanName, isRollLabel } from "../components/studentImportHelpers";

const SCORES_KEY = "ntti.scores.v1";
const SCHED_KEY = "ntti.schedule.v2";
const INSTITUTION_KM = "វិទ្យាស្ថានជាតិបណ្តុះបណ្តាលបច្ចេកទេស";
const INSTITUTION_EN = "National Technical Training Institute";

/* ── official NTTI transcript layout (mirrors the "ex" sheet of the office file) ── */
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

/* The student's real graduation date (stamped on the student when they are
   moved to Graduate), formatted like the official sheet's "February 9, 2026". */
function graduationDate(student) {
  const d = student?.graduationDate;
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/* Times New Roman is used for the letterhead's country / motto / ministry lines. */
const SERIF = { fontFamily: "'Times New Roman', Times, serif" };

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

/* modern color palette */
const COLORS = {
  textPrimary: "#1e293b",
  textSecondary: "#64748b",
  textMuted: "#94a3b8",
  bgDefault: "#f8fafc",
  bgCard: "#ffffff",
  border: "#e2e8f0",
  accent: "#2563eb",
  accentHover: "#1d4ed8",
};

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
        className="flex h-10 w-full max-w-full items-center justify-between gap-3 rounded-lg border px-3 text-sm font-medium transition"
        style={{
          minWidth: "min(210px, 100%)",
          background: COLORS.bgCard,
          borderColor: open ? COLORS.accent : COLORS.border,
          color: COLORS.textPrimary,
          boxShadow: open ? `0 0 0 2px rgba(37, 99, 235, 0.1)` : "none",
        }}
      >
        <span className="flex min-w-0 items-center gap-2">
          <User2 className="h-4 w-4 shrink-0" style={{ color: COLORS.accent }} />
          <span className="truncate text-sm">{current ? label(current) : placeholder}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0" style={{ color: COLORS.textMuted }} />
      </button>

      <DropdownPanel pos={pos} menuRef={menuRef} onClose={close} className="p-2">
        <div className="relative mb-1.5 shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: COLORS.textMuted }} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered[0]) pick(filtered[0].id);
              if (e.key === "Escape") close();
            }}
            placeholder="Search student…"
            className="w-full rounded-md border py-2 pl-8 pr-3 text-sm outline-none transition-colors"
            style={{ 
              background: COLORS.bgDefault,
              borderColor: COLORS.border,
              color: COLORS.textPrimary,
            }}
            onFocus={(e) => (e.target.style.borderColor = COLORS.accent)}
            onBlur={(e) => (e.target.style.borderColor = COLORS.border)}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto thin-scroll">
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-xs" style={{ color: COLORS.textMuted }}>No student matches "{q}"</p>
          ) : (
            filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(s.id)}
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm transition-colors"
                style={{
                  color: s.id === value ? COLORS.accent : COLORS.textPrimary,
                  fontWeight: s.id === value ? 600 : 500,
                  background: s.id === value ? `rgba(37, 99, 235, 0.08)` : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (s.id !== value) e.currentTarget.style.background = COLORS.bgDefault;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = s.id === value ? `rgba(37, 99, 235, 0.08)` : "transparent";
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate">{label(s)}</span>
                  <span className="block truncate text-[11px]" style={{ color: COLORS.textMuted }}>{s.studentId}</span>
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
    ["Date of graduation", graduationDate(student)],
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
            `<tr>${i === 0 ? `<td rowspan="${max}" style="${cell};text-align:center;font-weight:800;background:#f1f5f9">${yearLabel}</td>` : ""}` +
            subjectHTML(r1[i]) +
            subjectHTML(r2[i]) +
            `</tr>`
        )
        .join("");
      return rows;
    })
    .join("");

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

  return `<html><head><meta charset="utf-8"><title>Academic transcript</title></head><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:820px">
  <div style="padding-bottom:10px;max-width:820px">
    <div style="float:right;text-align:center;white-space:nowrap">
      <h1 style="margin:0;font-size:14px;color:#0f172a;font-family:'Times New Roman',serif">${esc(INSTITUTION_LINES.country)}</h1>
      <p style="margin:2px 0 0;font-size:14px;color:#0f172a;font-family:'Times New Roman',serif">${esc(INSTITUTION_LINES.motto)}</p>
    </div>
    <div style="float:left;text-align:center">
      <p style="margin:0;font-size:13px;font-weight:800;color:#0f172a;font-family:'Times New Roman',serif">${esc(INSTITUTION_LINES.ministry)}</p>
      <p style="margin:4px 0 0;font-size:13px;font-weight:700;color:#0f172a;font-family:'Times New Roman',serif">${esc(INSTITUTION_LINES.institute)}</p>
      <p style="margin:2px 0 0;font-size:11px;color:#475569;font-family:'Times New Roman',serif">${esc(INSTITUTION_LINES.noLine)}</p>
    </div>
    <div style="clear:both"></div>
  </div>
  <h2 style="text-align:center;margin:14px 0 4px;font-size:16px;color:#0f172a;font-family:'Times New Roman',serif">OFFICIAL TRANSCRIPT</h2>
  <table style="border-collapse:collapse;width:100%;font-size:12px"><tr>${infoCells}</tr></table>
  <p style="font-size:12px;margin:8px 0;color:#0f172a;text-align:center">Has successfully completed Diploma of Technology in the field of <b>${esc(cls?.field || majorName(student.major))}</b> in academic year <b>${student.enrollmentYear || "—"} - ${student.enrollmentYear ? Number(student.enrollmentYear) + (programYears(student.major) - 1) : "—"}</b></p>
  <table style="border-collapse:collapse;width:100%;font-size:12px">
    <tr><th rowspan="2" style="${cell};background:#f1f5f9;width:56px">YEAR</th><th colspan="4" style="${cell};background:#f1f5f9">SEMESTER I</th><th colspan="4" style="${cell};background:#f1f5f9">SEMESTER II</th></tr>
    <tr>${[0, 1].map(() => `<th style="${cell};background:#f1f5f9;text-align:left">Subjects</th><th style="${cell};background:#f1f5f9">HOUR</th><th style="${cell};background:#f1f5f9">Score (100/100)</th><th style="${cell};background:#f1f5f9">Grade</th>`).join("")}</tr>
    ${yearsHTML}
    <tr><td colspan="5" style="${cell};background:#f1f5f9;font-weight:800;text-align:center">State Exam${student.stateExam ? ` : ${esc(student.stateExam)}` : ""}</td><td colspan="4" style="${cell}"><b style="white-space:nowrap">Practical Exam :</b> ${esc(practicalExam)}</td></tr>
  </table>
  <p style="margin:10px 0 4px;font-size:12px;color:#0f172a"><b>REMARKS:</b></p>
  <table style="width:100%"><tr>
    <td style="vertical-align:top;padding-right:24px">
      <table style="border-collapse:collapse;font-size:9px">
        <tr><th style="${cell};background:#f1f5f9">Mark Obtained</th><th style="${cell};background:#f1f5f9">Grade</th><th style="${cell};background:#f1f5f9">Meaning</th><th style="${cell};background:#f1f5f9">Grade Point</th></tr>
        ${legendRows}
      </table>
    </td>
    <td style="vertical-align:top;text-align:center;font-size:12px;color:#475569">
      <span style="font-size:10px">Phnom Penh, Date ..................</span><br/>
      <div style="text-align:right">Deputy Director</div>
    </td>
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

/* ── real .xlsx export — mirror of the official “ex” cheatsheet from
   (G)IT07D_new.xlsx: the same 20-column grid (A..T), the same narrow
   column widths and the same merges, so the table in Excel is exactly
   the same size as the office file’s cheatsheet. ── */
function buildTranscriptWorkbook({ student, cls, yearBlocks, ordinal, overall, att, refNo, issued }) {
  const W = 20; // A..T — YEAR | SEM I (Subjects·HOUR·Score·Grade) | SEM II (same)
  const aoa = [];
  const merges = [];
  const FONT = "Times New Roman";
  const set = (r, c, v) => {
    aoa[r] = aoa[r] || [];
    aoa[r][c] = v === undefined || v === null ? "" : v;
  };
  const thin = { style: "thin", color: { rgb: "9CA3AF" } };
  const border = { top: thin, bottom: thin, left: thin, right: thin };
  const st = (o = {}) => ({ border, ...o, font: { name: FONT, ...(o.font || {}) } });
  const cell = (v, o) => ({ t: "s", v: v ?? "", s: st(o) });
  const H = (r, c, v, span = 1, font = {}, align = {}) => {
    set(r, c, cell(v, { font: { name: "Arial", sz: 12, bold: true, ...font }, fill: { fgColor: { rgb: "F1F5F9" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true, ...align } }));
    if (span > 1) merges.push({ s: { r, c }, e: { r, c: c + span - 1 } });
  };
  const merge = (r, c0, c1, r2 = r) => merges.push({ s: { r, c: c0 }, e: { r: r2, c: c1 } });

  /* letterhead — same positions as the website: “KINGDOM OF CAMBODIA” +
     “Nation Religion King” top-RIGHT (merged M..T, centred on each other),
     the institute block (Ministry / Institute / N0) top-LEFT (merged A..J,
     centred on each other), then OFFICIAL TRANSCRIPT centred below. */
  const blockR = (r, v, bold, sz, color) => {
    set(r, 12, cell(v, { font: { bold, sz, color: color || "000000" }, alignment: { horizontal: "center", vertical: "center", wrapText: true } }));
    merge(r, 12, 19); // M..T
  };
  const blockL = (r, v, bold, sz, color) => {
    set(r, 0, cell(v, { font: { bold, sz, color: color || "000000" }, alignment: { horizontal: "center", vertical: "center", wrapText: true } }));
    merge(r, 0, 9); // A..J
  };
  blockR(0, INSTITUTION_LINES.country, true, 14);
  blockR(1, INSTITUTION_LINES.motto, false, 14);
  blockL(2, INSTITUTION_LINES.ministry, true, 13);
  blockL(3, INSTITUTION_LINES.institute, true, 12);
  blockL(4, INSTITUTION_LINES.noLine, false, 10, "475569");
  set(5, 0, cell("", {}));
  set(6, 0, cell("OFFICIAL TRANSCRIPT", { font: { bold: true, sz: 16 }, alignment: { horizontal: "center", vertical: "center" } }));
  merge(6, 0, W - 1);

  /* student block — official R8–R10: left = Student/DOB/Place, right = Sex/Nationality/Graduation */
  let row = 7;
  set(row, 0, cell("Student", { font: { bold: true }, alignment: { horizontal: "left" } }));
  set(row, 2, cell(":", { alignment: { horizontal: "left" } }));
  set(row, 3, cell(student.khmerName ? `${student.khmerName} · ${student.firstName} ${student.lastName}` : `${student.firstName} ${student.lastName}`, { alignment: { horizontal: "left" } }));
  merge(row, 3, 10);
  set(row, 12, cell("Sex :", { font: { bold: true }, alignment: { horizontal: "left" } }));
  set(row, 13, cell(student.gender || "—", { alignment: { horizontal: "left" } }));
  set(row, 16, cell("Nationality : Khmer", { alignment: { horizontal: "left" } }));
  merge(row, 16, 19);
  row++;
  set(row, 0, cell("Date of Birth", { font: { bold: true }, alignment: { horizontal: "left" } }));
  set(row, 2, cell(":", { alignment: { horizontal: "left" } }));
  set(row, 3, cell(student.dob ? prettyDate(student.dob) : "—", { alignment: { horizontal: "left" } }));
  merge(row, 3, 10);
  set(row, 12, cell("Date of Graduation :", { font: { bold: true }, alignment: { horizontal: "left" } }));
  set(row, 16, cell(graduationDate(student), { alignment: { horizontal: "left" } }));
  merge(row, 16, 19);
  row++;
  set(row, 0, cell("Place of Birth", { font: { bold: true }, alignment: { horizontal: "left" } }));
  set(row, 2, cell(":", { alignment: { horizontal: "left" } }));
  set(row, 3, cell("—", { alignment: { horizontal: "left" } }));
  merge(row, 3, 10);
  row++;

  /* completion statement — official R10–R11, centred */
  const yearsInProgram = programYears(student.major);
  const statement = `Has successfully completed Diploma of Technology in the field of ${cls?.field || majorName(student.major)} in academic year ${student.enrollmentYear || "—"} - ${student.enrollmentYear ? Number(student.enrollmentYear) + (yearsInProgram - 1) : "—"}`;
  set(row, 0, cell(statement, { font: { bold: true }, alignment: { horizontal: "center", vertical: "center", wrapText: true } }));
  merge(row, 0, W - 1, row + 1);
  row += 2;

  /* table header — official R12–R13 */
  const hdr = row;
  H(hdr, 0, "YEAR");
  merge(hdr, 0, 0, hdr + 1);
  H(hdr, 1, "SEMESTER I", 10);
  H(hdr, 11, "SEMESTER II", 9);
  const sub = hdr + 1;
  H(sub, 1, "Subjects", 7);
  H(sub, 8, "HOUR", 1, { sz: 8, bold: false }, { textRotation: 90 });
  H(sub, 9, "Score (100/100)", 1, { sz: 10 });
  H(sub, 10, "Grade", 1, { sz: 10 });
  H(sub, 11, "Subjects", 6);
  H(sub, 17, "HOUR", 1, { sz: 8, bold: false }, { textRotation: 90 });
  H(sub, 18, "Score (100/100)", 1, { sz: 10 });
  H(sub, 19, "Grade", 1, { sz: 10 });
  row = sub + 1;

  const yearCell = (v) => cell(v, { font: { name: "Arial", sz: 14, bold: true }, alignment: { horizontal: "center", vertical: "center" } });
  const subjCell = (v) => cell(v, { font: { name: "Arial", sz: 10 }, alignment: { horizontal: "left", vertical: "center", wrapText: true } });
  const numCell = (v) => cell(v == null ? "" : Number(v).toFixed(2), { font: { name: "Arial", sz: 10 }, alignment: { horizontal: "center", vertical: "center" } });
  const hourCell = (v) => {
    const o = { font: { name: "Arial", sz: 8 }, alignment: { horizontal: "center", vertical: "center" } };
    return v == null ? cell("", o) : { t: "n", v, s: st(o) };
  };
  const gradeCell = (g) => cell(g || "", { font: { name: "Arial", sz: 10, bold: true }, alignment: { horizontal: "center", vertical: "center" } });

  yearBlocks.forEach((block) => {
    const r1 = rowsOf(block.s1 || {});
    const r2 = rowsOf(block.s2 || {});
    const max = Math.max(r1.length, r2.length, 1);
    const st1 = block.s1 ? statsOf(block.s1) : null;
    const st2 = block.s2 ? statsOf(block.s2) : null;
    const yearLabel = ordinal(Number(block.y)).replace(/(\d+)(st|nd|rd|th)/, "$1 $2");
    const y0 = row;
    const uncompleted = !(st1?.count) && !(st2?.count);

    if (uncompleted) {
      set(y0, 0, yearCell(yearLabel));
      set(y0, 1, cell("Uncompleted", { alignment: { horizontal: "center", vertical: "center" } }));
      merge(y0, 1, 10);
      set(y0, 11, cell("Uncompleted", { alignment: { horizontal: "center", vertical: "center" } }));
      merge(y0, 11, 19);
      row += 1;
      return;
    }

    set(y0, 0, yearCell(yearLabel));
    if (max > 1) merge(y0, 0, 0, y0 + max - 1);
    for (let i = 0; i < max; i++) {
      const a = r1[i];
      const b = r2[i];
      set(row, 1, subjCell(a?.subject || ""));
      merge(row, 1, 7);
      set(row, 8, hourCell(a?.hour));
      set(row, 9, numCell(a ? a.score : null));
      set(row, 10, gradeCell(a?.grade));
      set(row, 11, subjCell(b?.subject || ""));
      merge(row, 11, 16);
      set(row, 17, hourCell(b?.hour));
      set(row, 18, numCell(b ? b.score : null));
      set(row, 19, gradeCell(b?.grade));
      row++;
    }
  });

  /* State Exam / Practical Exam row — official R41 */
  row++;
  const practical = student.thesisScore != null && student.thesisScore !== ""
    ? `Practical Exam : ${student.thesisTitle || "Thesis / Practical project"} · Score: ${Number(student.thesisScore).toFixed(2)} · Grade: ${letterOf(Number(student.thesisScore))}`
    : "Practical Exam : —";
  set(row, 0, cell(student.stateExam ? `State Exam : ${student.stateExam}` : "State Exam", {
    font: { bold: true }, fill: { fgColor: { rgb: "F1F5F9" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true },
  }));
  merge(row, 0, 10);
  set(row, 11, cell(practical, { alignment: { horizontal: "left", vertical: "center", wrapText: true } }));
  merge(row, 11, 19);
  row++;

<<<<<<< HEAD
  /* REMARKS + grade legend — like the web, "Phnom Penh, Date + Deputy Director"
     sits on the RIGHT of the legend (legend = cols A–I, signature = cols J–M) */
=======
  /* REMARKS + grade legend — official R49–R56; signature on the right.
     Everything in this table is 9pt with wrapText so the legend renders
     compactly and the rows expand instead of clipping the text. */
>>>>>>> e5a88eeeda5e95e92ae03ed0286432b8e07df674
  row++;
  set(row, 1, cell("REMARKS:", { font: { bold: true, sz: 9 }, alignment: { horizontal: "left" } }));
  merge(row, 1, 4);
  row++;
  const hRow = row;
  H(hRow, 1, "Mark Obtained", 3, { name: "Times New Roman", sz: 9 });
  H(hRow, 4, "Grade", 2, { name: "Times New Roman", sz: 9 });
  H(hRow, 6, "Meaning", 3, { name: "Times New Roman", sz: 9 });
  set(hRow, 9, cell("Grade Point", { font: { bold: true, sz: 9 }, fill: { fgColor: { rgb: "F1F5F9" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true } }));
  set(hRow, 12, cell("Phnom Penh, Date ..................", { font: { sz: 9 }, alignment: { horizontal: "center", vertical: "center" } }));
  merge(hRow, 12, 18);
  row++;
  const legendStart = row;
  NTTI_SCALE.forEach((g, i) => {
    set(row, 1, cell(g.min === 0 ? "Less than 50" : `${g.min} - ${g.max}`, { font: { sz: 9 }, alignment: { horizontal: "center", vertical: "center", wrapText: true } }));
    merge(row, 1, 3);
    set(row, 4, cell(g.grade, { font: { bold: true, sz: 9 }, alignment: { horizontal: "center", vertical: "center" } }));
    merge(row, 4, 5);
    set(row, 6, cell(g.meaning, { font: { sz: 9 }, alignment: { horizontal: "left", vertical: "center", wrapText: true } }));
    merge(row, 6, 8);
    set(row, 9, { t: "n", v: Number(g.point), s: st({ font: { sz: 9 }, alignment: { horizontal: "center" } }) });
    if (i === 0) {
      set(row, 12, cell("Deputy Director", { font: { bold: true, sz: 9 }, alignment: { horizontal: "right", vertical: "center" } }));
      merge(row, 12, 19);
    }
    row++;
  });

  /* ISO footer — official R71–R73 */
  row += 2;
  const foot = (v) => {
    set(row, 0, cell(v, { alignment: { horizontal: "center", vertical: "center" } }));
    merge(row, 0, W - 1);
    row++;
  };
  foot(INSTITUTION_LINES.certNo);
  foot(INSTITUTION_LINES.address1);
  foot(INSTITUTION_LINES.address2);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = merges;
  ws["!rows"] = [];
  ws["!rows"][hdr] = { hpt: 21.75 };
  ws["!rows"][sub] = { hpt: 39 };
  ws["!rows"][hRow] = { hpt: 17 };
  for (let rr = legendStart; rr < row; rr++) ws["!rows"][rr] = { hpt: 16 };
  ws["!cols"] = [
    { width: 7.57 }, // A  YEAR
    { width: 6.29 }, // B
    { width: 2.15 }, // C
    { width: 5.57 }, // D
    { width: 5.57 }, // E
    { width: 4.57 }, // F
    { width: 3.15 }, // G
    { width: 4.29 }, // H  Subjects I (B..H)
    { width: 3.86 }, // I  HOUR
    { width: 9.86 }, // J  Score
    { width: 6.43 }, // K  Grade
    { width: 5.57 }, // L
    { width: 5.57 }, // M
    { width: 5.57 }, // N
    { width: 5 },    // O
    { width: 5.57 }, // P
    { width: 5.57 }, // Q  Subjects II (L..Q)
    { width: 3.29 }, // R  HOUR
    { width: 9.86 }, // S  Score — same as Semester I so "Score (100/100)" fits on one line
    { width: 6.29 }, // T  Grade
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transcript");
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

  const [classId, setClassId] = useState(initialStudent?.className || "");
  const [studentId, setStudentId] = useState(initialStudent?.id || null);
  /* first opening starts "empty" (None class, no student); we only auto-select
     the first student after the user picks a class themselves */
  const [picked, setPicked] = useState(Boolean(initialStudent));
  const [scope, setScope] = useState("all");
  const [importOpen, setImportOpen] = useState(false);

  /* edit mode: type the fields that need manual entry (practical exam, state exam) */
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({ practicalTitle: "", practicalScore: "", stateExam: "" });

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

  // keep the selected student inside the selected class (only after the user picks)
  useEffect(() => {
    if (!picked) return;
    if (roster.length && !roster.some((s) => s.id === studentId)) setStudentId(roster[0].id);
    if (!roster.length) setStudentId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, picked]);

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

  /* fill the edit drafts from the current student (also when re-entering edit mode) */
  useEffect(() => {
    if (!student) return;
    setDraft({
      practicalTitle: student.thesisTitle || "",
      practicalScore: student.thesisScore != null && student.thesisScore !== "" ? String(student.thesisScore) : "",
      stateExam: student.stateExam != null ? String(student.stateExam) : "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id, editMode]);

  const draftScoreNum = (() => {
    const v = draft.practicalScore.trim();
    return v !== "" && !Number.isNaN(Number(v)) ? Number(v) : null;
  })();

  const saveTranscriptDraft = () => {
    if (!student) return;
    const pTitle = draft.practicalTitle.trim();
    const pScore = draft.practicalScore.trim();
    const pScoreNum = pScore !== "" && !Number.isNaN(Number(pScore)) ? Number(pScore) : null;
    const sExam = draft.stateExam.trim();
    updateStudent(student.id, {
      firstName: student.firstName,
      lastName: student.lastName,
      thesisTitle: pTitle || null,
      thesisScore: pScoreNum,
      stateExam: sExam || null,
    });
    logAudit("transcript_edit", `Edited practical/state exam details for "${student.firstName} ${student.lastName}"`);
    setEditMode(false);
    showToast("Transcript details saved");
  };

  /* every recorded term: archived history + the live (current) term */
  const allTerms = useMemo(() => {
    if (!student) return [];
    const currentLevel = ACADEMIC_LEVELS.includes(student.level) ? student.level : "S1Y1";
    const list = [];
    /* a stored "ល.រ" / "\" subject is the roll column, never a real class —
       drop it here so transcripts, exports and averages stay clean */
    const cleanEntry = (subjects, scores) => ({
      subjects: (subjects || []).filter((x) => !isRollLabel(x)),
      scores:
        scores && typeof scores === "object"
          ? Object.fromEntries(Object.entries(scores).filter(([k]) => !isRollLabel(k)))
          : scores,
    });
    (student.history || []).forEach((h) => {
      if (!h.level) return;
      const scores = h.scores && typeof h.scores === "object" ? h.scores : {};
      const subs =
        Array.isArray(h.subjects) && h.subjects.length ? h.subjects : Object.keys(scores);
      const { subjects, scores: cleanScores } = cleanEntry(subs, scores);
      list.push({
        level: h.level,
        year: h.year || levelMeta(h.level).year,
        semester: h.semester || levelMeta(h.level).semester,
        className: h.className,
        archived: true,
        subjects,
        scores: cleanScores,
      });
    });
    if (student.status !== "Graduate") {
      const live = (scores[student.className] || {})[student.id] || {};
      const sched = scheduleFor(student.className);
      const subjects = sched ? sched.subjects.filter(Boolean) : Object.keys(live);
      const { subjects: cleanSubjects, scores: cleanLive } = cleanEntry(subjects, live);
      list.push({
        level: currentLevel,
        year: levelMeta(currentLevel).year,
        semester: levelMeta(currentLevel).semester,
        className: student.className,
        archived: false,
        subjects: Array.from(new Set(cleanSubjects)),
        scores: cleanLive,
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
     so the document mirrors the official "ex" sheet exactly. */
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

  const exportData = () => ({ student, cls, terms, yearBlocks, ordinal, overall, att, refNo, issued });

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
        /* never store "Student" / សិស្ស / សតុដេនត placeholders — cleanName
           strips them so transcripts show the student's real name. */
        const fname = cleanName(i.firstName);
        const lname = cleanName(i.lastName);
        const khname = cleanName(i.khmerName);
        addStudent({
          firstName: fname || khname || "Student",
          lastName: lname || "",
          khmerName: khname || "",
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
    /* show the imported data immediately: jump to the first student this import
       touched (a newly created one first, otherwise the first matched one) —
       otherwise the page stays on "No student selected" after an all-update import */
    const firstId = createdIds[0] ?? rows.find((r) => r.matched)?.matched?.id ?? null;
    if (firstId) {
      setPicked(true);
      setStudentId(firstId);
    }
    logAudit(
      "import_transcript",
      `Imported transcript scores from cheatsheet: ${updated} student(s) updated, ${created} created (${stats?.scores || 0} scores)`
    );
    showToast(`${stats?.scores || 0} scores imported — ${updated} updated · ${created} new students`);
  };

  return (
    <div className="mx-auto space-y-6" style={{ maxWidth: 1100, paddingTop: 24, paddingBottom: 48 }}>
      {/* print rules + watermark styling: hide chrome, keep the document */}
      <style>{`
        #transcript-doc { position: relative; }
        @media print {
          .no-print { display: none !important; }
          .animate-fade-up { animation: none !important; transform: none !important; opacity: 1 !important; }
          #transcript-doc { box-shadow: none !important; border: none !important; border-radius: 0 !important; margin: 0 !important; position: relative !important; overflow: visible !important; }
          #transcript-doc .transcript-term { page-break-inside: avoid; }
        }
      `}</style>

      <div className="no-print">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ color: COLORS.textPrimary }}>
            Transcript
          </h1>
          <p className="text-base" style={{ color: COLORS.textSecondary }}>
            Select a student and time period, then print or export their official academic record.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1 basis-[240px] sm:flex-none sm:basis-auto">
              <ClassSelect
                value={classId}
                onChange={(id) => {
                  setPicked(true);
                  setClassId(id);
                }}
                placeholder="Select a class"
                minWidth={200}
                allowNone
                options={classes.map((c) => ({
                  value: c.id,
                  label: c.name,
                  sub: c.field || "",
                }))}
              />
            </div>
            <div className="min-w-0 flex-1 basis-[240px] sm:flex-none sm:basis-auto">
              <StudentSelect
                students={roster}
                value={studentId}
                onChange={(id) => {
                  setPicked(true);
                  setStudentId(id);
                }}
              />
            </div>
            <button
              onClick={() => setImportOpen(true)}
              className="h-10 px-4 text-sm font-medium rounded-lg border transition"
              style={{
                background: COLORS.bgCard,
                borderColor: COLORS.border,
                color: COLORS.textSecondary,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = COLORS.textMuted)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = COLORS.border)}
              title="Import a score cheatsheet (Excel/CSV) into student transcripts"
            >
              <Upload size={16} className="inline mr-2" /> Import
            </button>
          </div>
        </div>
      </div>

      <TranscriptImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        students={students}
        onImport={handleTranscriptImport}
      />

      {!student && (
        <div style={{ borderRadius: 12, border: `1px solid ${COLORS.border}`, background: COLORS.bgCard, padding: 48 }} className="no-print">
          <EmptyState
            icon={FileText}
            title="No student selected"
            subtitle="Choose a class and student above to view or export their transcript."
            action={
              <button
                onClick={() => navigate("/students")}
                className="px-6 py-2.5 text-sm font-medium rounded-lg text-white transition"
                style={{ background: COLORS.accent }}
                onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.accentHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = COLORS.accent)}
              >
                <Link2 className="h-4 w-4 inline mr-2" /> Go to Students
              </button>
            }
          />
        </div>
      )}

      {student && (
        <>
          {/* controls */}
          <div style={{ borderRadius: 12, border: `1px solid ${COLORS.border}`, background: COLORS.bgCard, padding: 20 }} className="no-print">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <button
                onClick={() => navigate(-1)}
                className="h-9 px-3 text-sm font-medium rounded-lg border transition"
                style={{
                  background: COLORS.bgCard,
                  borderColor: COLORS.border,
                  color: COLORS.textSecondary,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.bgDefault)}
                onMouseLeave={(e) => (e.currentTarget.style.background = COLORS.bgCard)}
              >
                <ArrowLeft size={16} className="inline mr-2" /> Back
              </button>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.textMuted }}>
                Showing
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setScope("all")}
                  className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition"
                  style={{
                    background: scope === "all" ? COLORS.accent : COLORS.bgDefault,
                    color: scope === "all" ? "#fff" : COLORS.textPrimary,
                    borderColor: scope === "all" ? COLORS.accent : COLORS.border,
                  }}
                >
                  All semesters
                </button>
                {yearsPresent.map((y) => (
                  <button
                    key={`y-${y}`}
                    onClick={() => setScope(`Y${y}`)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition"
                    style={{
                      background: scope === `Y${y}` ? COLORS.accent : COLORS.bgDefault,
                      color: scope === `Y${y}` ? "#fff" : COLORS.textPrimary,
                      borderColor: scope === `Y${y}` ? COLORS.accent : COLORS.border,
                    }}
                  >
                    Year {y}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {editMode && (
                <button
                  onClick={() => setEditMode(false)}
                  className="h-10 px-3.5 text-sm font-medium rounded-lg border transition"
                  style={{
                    background: COLORS.bgCard,
                    borderColor: COLORS.border,
                    color: COLORS.textSecondary,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.bgDefault)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = COLORS.bgCard)}
                >
                  <X size={16} className="inline mr-2" /> Cancel
                </button>
              )}
              <button
                onClick={editMode ? saveTranscriptDraft : () => setEditMode(true)}
                className="h-10 px-3.5 text-sm font-medium rounded-lg transition"
                style={{
                  background: editMode ? COLORS.accent : COLORS.bgCard,
                  color: editMode ? "#fff" : COLORS.textSecondary,
                  borderColor: editMode ? COLORS.accent : COLORS.border,
                  border: editMode ? "none" : `1px solid ${COLORS.border}`,
                }}
                onMouseEnter={(e) => {
                  if (!editMode) e.currentTarget.style.background = COLORS.bgDefault;
                  else e.currentTarget.style.background = COLORS.accentHover;
                }}
                onMouseLeave={(e) => {
                  if (!editMode) e.currentTarget.style.background = COLORS.bgCard;
                  else e.currentTarget.style.background = COLORS.accent;
                }}
              >
                {editMode ? (
                  <>
                    <Check size={16} className="inline mr-2" /> Save
                  </>
                ) : (
                  <>
                    <Pencil size={16} className="inline mr-2" /> Edit
                  </>
                )}
              </button>

              <div className="flex-1 sm:flex-none" />

              <button
                onClick={handlePrint}
                className="h-10 px-4 text-sm font-medium rounded-lg border transition"
                style={{
                  background: COLORS.bgCard,
                  borderColor: COLORS.border,
                  color: COLORS.textSecondary,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.bgDefault)}
                onMouseLeave={(e) => (e.currentTarget.style.background = COLORS.bgCard)}
              >
                <Printer size={16} className="inline mr-2" /> Print
              </button>
              <button
                onClick={() => handleDownload("word")}
                className="h-10 px-4 text-sm font-medium rounded-lg border transition"
                style={{
                  background: COLORS.bgCard,
                  borderColor: COLORS.border,
                  color: COLORS.textSecondary,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.bgDefault)}
                onMouseLeave={(e) => (e.currentTarget.style.background = COLORS.bgCard)}
              >
                <FileDown size={16} className="inline mr-2" /> Word
              </button>
              <button
                onClick={() => handleDownload("excel")}
                className="h-10 px-4 text-sm font-medium rounded-lg text-white transition"
                style={{ background: COLORS.accent }}
                onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.accentHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = COLORS.accent)}
              >
                <FileSpreadsheet size={16} className="inline mr-2" /> Excel
              </button>
            </div>
          </div>

          {/* ── the transcript document ── */}
          <div
            id="transcript-doc"
            style={{
              borderRadius: 12,
              border: `1px solid ${COLORS.border}`,
              background: "#ffffff",
              padding: 40,
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
            }}
          >
            {/* letterhead */}
            <div className="pb-4 mb-4">
              <div className="flex justify-end mb-3">
                <div className="w-fit text-center">
                  <p className="text-[14px] font-extrabold tracking-tight leading-snug" style={{ color: INK, ...SERIF }}>
                    {INSTITUTION_LINES.country}
                  </p>
                  <p className="text-[14px] font-semibold mt-0.5" style={{ color: INK, ...SERIF }}>
                    {INSTITUTION_LINES.motto}
                  </p>
                </div>
              </div>
              <div className="w-fit text-center">
                <p className="text-[13px] font-extrabold leading-tight" style={{ color: INK, ...SERIF }}>
                  {INSTITUTION_LINES.ministry}
                </p>
                <p className="text-[13px] font-bold mt-0.5" style={{ color: INK, ...SERIF }}>
                  {INSTITUTION_LINES.institute}
                </p>
                <p className="text-[10px] mt-1 tabular-nums" style={{ color: MUTED, ...SERIF }}>
                  {INSTITUTION_LINES.noLine}
                </p>
              </div>
            </div>

            {/* title */}
            <div className="text-center mb-3">
              <h2 className="text-base font-extrabold" style={{ color: INK, ...SERIF, fontSize: 16 }}>
                OFFICIAL TRANSCRIPT
              </h2>
            </div>

            {/* student header block */}
            <table className="w-full text-[12px] mb-3" style={{ borderCollapse: "collapse", ...SERIF }}>
              <tbody>
                <tr>
                  <td style={{ padding: "2px 0", color: MUTED, width: 118, whiteSpace: "nowrap" }}>Student :</td>
                  <td style={{ padding: "2px 8px 2px 0", color: INK, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {student.khmerName ? `${student.khmerName} · ` : ""}
                    {student.firstName} {student.lastName}
                  </td>
                  <td style={{ padding: "2px 0", color: MUTED, width: 150, whiteSpace: "nowrap" }}>Sex :</td>
                  <td style={{ padding: "2px 0", color: INK, whiteSpace: "nowrap" }}>{student.gender || "—"}</td>
                </tr>
                <tr>
                  <td style={{ padding: "2px 0", color: MUTED, whiteSpace: "nowrap" }}>Date of Birth :</td>
                  <td style={{ padding: "2px 8px 2px 0", color: INK, whiteSpace: "nowrap" }}>{student.dob ? prettyDate(student.dob) : "—"}</td>
                  <td style={{ padding: "2px 0", color: MUTED, width: 150, whiteSpace: "nowrap" }}>Nationality :</td>
                  <td style={{ padding: "2px 0", color: INK, whiteSpace: "nowrap" }}>Khmer</td>
                </tr>
                <tr>
                  <td style={{ padding: "2px 0", color: MUTED, whiteSpace: "nowrap" }}>Place of Birth :</td>
                  <td style={{ padding: "2px 8px 2px 0", color: INK, whiteSpace: "nowrap" }}>—</td>
                  <td style={{ padding: "2px 0", color: MUTED, width: 150, whiteSpace: "nowrap" }}>Date of Graduation :</td>
                  <td style={{ padding: "2px 0", color: INK, whiteSpace: "nowrap" }}>
                    {graduationDate(student)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* completion statement */}
            <p className="text-[12px] mb-3 text-center" style={{ color: INK, ...SERIF }}>
              Has successfully completed Diploma of Technology in the field of{" "}
              <b>{cls?.field || majorName(student.major)}</b> in academic year{" "}
              <b>
                {student.enrollmentYear || "—"} - {student.enrollmentYear ? Number(student.enrollmentYear) + (yearsInProgram - 1) : "—"}
              </b>
            </p>

            {/* main table */}
            <style>{`
              #transcript-doc .ex-table { width: 100%; border-collapse: collapse; font-size: 11px; color: ${INK}; font-family: 'Times New Roman', Times, serif; }
              #transcript-doc .ex-table th,
              #transcript-doc .ex-table td { border: 1px solid ${LINE}; padding: 3px 5px; vertical-align: middle; }
              #transcript-doc .ex-table th { background: ${SOFT}; font-weight: 800; text-align: center; }
              #transcript-doc .ex-table td.num { text-align: center; }
              #transcript-doc .ex-table td.grade { text-align: center; font-weight: 700; }
              #transcript-doc .ex-table td.year { text-align: center; font-weight: 800; vertical-align: middle; background: ${SOFT}; }
              #transcript-doc .ex-table tbody.transcript-term { page-break-inside: avoid; }
              #transcript-doc .ex-legend { border-collapse: collapse; font-size: 11px; color: ${INK}; font-family: 'Times New Roman', Times, serif; }
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
                const uncompleted = !(st1?.count) && !(st2?.count);
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
                          <td className="year" rowSpan={max}>
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
                  </tbody>
                );
              })}
              {/* State Exam / Practical Exam */}
              <tbody className="transcript-term">
                <tr>
                  <td className="year" colSpan={5}>
                    {editMode ? (
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <b style={{ whiteSpace: "nowrap" }}>State Exam :</b>
                        <input
                          value={draft.stateExam}
                          onChange={(e) => setDraft((d) => ({ ...d, stateExam: e.target.value }))}
                          placeholder="Score / remark…"
                          className="input h-6 w-28 px-1.5 py-0.5 text-center text-[10px]"
                          style={{ borderRadius: 4, border: `1px solid ${COLORS.border}` }}
                        />
                      </div>
                    ) : (
                      <>
                        State Exam
                        {student.stateExam ? ` : ${student.stateExam}` : ""}
                      </>
                    )}
                  </td>
                  <td colSpan={4} style={{ textAlign: "left" }}>
                    {editMode ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <b style={{ whiteSpace: "nowrap" }}>Practical Exam :</b>
                        <input
                          value={draft.practicalTitle}
                          onChange={(e) => setDraft((d) => ({ ...d, practicalTitle: e.target.value }))}
                          placeholder="Project / thesis title"
                          className="input h-6 min-w-[150px] flex-1 px-1.5 py-0.5 text-[10px]"
                          style={{ borderRadius: 4, border: `1px solid ${COLORS.border}` }}
                        />
                        <input
                          value={draft.practicalScore}
                          onChange={(e) => setDraft((d) => ({ ...d, practicalScore: e.target.value }))}
                          placeholder="Score"
                          className="input h-6 w-16 px-1.5 py-0.5 text-center text-[10px]"
                          style={{ borderRadius: 4, border: `1px solid ${COLORS.border}` }}
                        />
                        <span className="min-w-[60px] text-center text-[11px] font-bold">
                          {draftScoreNum != null ? `Grade: ${letterOf(draftScoreNum)}` : "Grade: —"}
                        </span>
                      </div>
                    ) : (
                      <>
                        <b style={{ whiteSpace: "nowrap" }}>Practical Exam :</b>
                        <span style={{ marginLeft: 4 }}>
                          {student.thesisScore != null && student.thesisScore !== ""
                            ? `${student.thesisTitle || "Thesis / Practical project"} · Score: ${Number(student.thesisScore).toFixed(2)} · Grade: ${letterOf(Number(student.thesisScore))}`
                            : "—"}
                        </span>
                      </>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* REMARKS */}
            <p className="text-[12px] mb-2" style={{ color: INK, ...SERIF }}>
              <b>REMARKS:</b>
            </p>

            {/* grade-scale legend */}
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-1">
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
              </div>
              <div className="shrink-0 text-center text-[11px]" style={{ color: INK, ...SERIF }}>
                <p className="whitespace-nowrap text-[10px]" style={{ color: MUTED }}>
                  Phnom Penh, Date ..................
                </p>
                <p className="mt-2 text-right font-semibold">Deputy Director</p>
              </div>
            </div>

            {/* ISO footer */}
            <div className="mt-5 pt-3 text-center text-[10px]" style={{ borderTop: `1px solid ${LINE}`, color: MUTED, ...SERIF }}>
              <p>{INSTITUTION_LINES.certNo}</p>
              <p className="mt-0.5">{INSTITUTION_LINES.address1}</p>
              <p>{INSTITUTION_LINES.address2}</p>
            </div>

            <p className="mt-6 text-[10px] text-center" style={{ color: "#94a3b8", ...SERIF }}>
              Computer-generated transcript · verify against the Office of the Registrar.
            </p>
          </div>
        </>
      )}
    </div>
  );
}