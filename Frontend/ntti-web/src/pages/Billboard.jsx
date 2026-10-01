import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Trophy, ClipboardList, Link2, FileText, FileSpreadsheet, FileDown, X } from "lucide-react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { useApp } from "../context/AppContext";
import { EmptyState } from "../components/Page";
import ClassSelect from "../components/ClassSelect";

const SCORES_KEY = "ntti.scores.v1";
const SCHED_KEY = "ntti.schedule.v2";
const SEL_KEY = "ntti.billboard.selected.v1";
const LAYOUT_KEY = "ntti.scores.layout.v1";

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

/* per-class score sheet layouts (same shape the Scores page writes) — used to
   resolve a schedule subject to the actual column key the score lives under. */
function loadLayouts() {
  try {
    const raw = JSON.parse(localStorage.getItem(LAYOUT_KEY));
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ranked billboard tables for the chosen classes, as an HTML document that opens
   in Excel/Word (or prints to PDF) — mirrors the Attendance export. */
function billboardExportHTML(sheets) {
  return `<html><head><meta charset="utf-8"><title>Billboard</title></head><body>${sheets
    .map(({ cls, subjects, rows }) => {
      const meta = (label, val) => `<p style="margin:1px 0;font-size:12px"><b>${esc(label)}:</b> ${esc(val)}</p>`;
      const th = (inner, align = "left") => `<th style="background:#f1f1f1;padding:6px 8px;text-align:${align}">${inner}</th>`;
      const td = (inner, align = "left") => `<td style="padding:5px 8px;text-align:${align}">${inner}</td>`;
      const thead =
        `<tr>` +
        th("Rank", "center") +
        th("Student") +
        th("ID", "center") +
        subjects.map((s) => th(esc(s), "center")).join("") +
        th("Average", "center") +
        th("Grade", "center") +
        `</tr>`;
      const body = rows.length
        ? rows
            .map((row) => {
              const g = gradeOf(row.avg);
              const latin = [row.student.firstName, row.student.lastName].filter(Boolean).join(" ");
              return (
                `<tr>` +
                td(row.rank, "center") +
                td(esc(row.student.khmerName || latin)) +
                td(esc(row.student.studentId || ""), "center") +
                row.cells.map((v) => td(v === "" ? "–" : esc(v), "center")).join("") +
                td(row.avg.toFixed(2), "center") +
                td(g ? g.g : "–", "center") +
                `</tr>`
              );
            })
            .join("")
        : `<tr><td colspan="${subjects.length + 5}" align="center" style="padding:10px;color:#64748b">No scores yet for this class</td></tr>`;
      const clsAvg = rows.length ? (rows.reduce((a, r) => a + r.avg, 0) / rows.length).toFixed(2) : "—";
      return (
        `<h3 style="margin:22px 0 4px">${esc(cls.name)} — billboard</h3>` +
        meta("Class avg", clsAvg) +
        meta("Field", cls.field || "—") +
        meta("Shift", cls.shift || "—") +
        meta("Year", cls.year || "—") +
        meta("Semester", cls.semester || "—") +
        meta("Subjects", subjects.join(", ")) +
        `<table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse;white-space:nowrap">${thead}${body}</table>`
      );
    })
    .join("")}</body></html>`;
}

function downloadSheet(html, type, name) {
  const blob = new Blob(["\ufeff", html], {
    type: type === "word" ? "application/msword" : "application/vnd.ms-excel",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const gradeOf = (avg) => {
  if (avg == null) return null;
  if (avg >= 90) return { g: "A", tone: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" };
  if (avg >= 80) return { g: "B", tone: "bg-sky-500/15 text-sky-600 border-sky-500/30" };
  if (avg >= 70) return { g: "C", tone: "bg-amber-500/15 text-amber-600 border-amber-500/30" };
  if (avg >= 60) return { g: "D", tone: "bg-orange-500/15 text-orange-600 border-orange-500/30" };
  return { g: "F", tone: "bg-red-500/15 text-red-600 border-red-500/30" };
};

const initialsOf = (s) =>
  `${String(s.firstName || "?")[0] || ""}${String(s.lastName || "")[0] || ""}`.toUpperCase();

export default function Billboard() {
  const { students, classes, showToast, logAudit } = useApp();
  const [scores, setScores] = useState(loadScores);
  const [schedules, setSchedules] = useState(loadSchedules);
  const [layouts, setLayouts] = useState(loadLayouts);
  const [classId, setClassId] = useState(() => localStorage.getItem(SEL_KEY) || "");
  const [dlOpen, setDlOpen] = useState(false);
  const [dlAll, setDlAll] = useState(false);
  const [dlChecked, setDlChecked] = useState({});

  // re-read latest scores/schedules/layouts when the page opens
  useEffect(() => {
    const t = setTimeout(() => {
      setScores(loadScores());
      setSchedules(loadSchedules());
      setLayouts(loadLayouts());
    }, 60);
    return () => clearTimeout(t);
  }, []);

  const scheduleFor = (c) =>
    schedules.find((s) => (s.classId ? s.classId === c.id : s.className === c.name)) ||
    schedules.find((s) => s.className === c.id);

  const billboardClasses = useMemo(
    () => classes.filter((c) => scheduleFor(c) && (scheduleFor(c).subjects || []).filter(Boolean).length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classes, schedules]
  );

  // keep a valid selection
  useEffect(() => {
    if (!billboardClasses.length) return;
    if (!classId || !billboardClasses.some((c) => c.id === classId)) {
      setClassId(billboardClasses[0].id);
    }
  }, [billboardClasses, classId]);

  useEffect(() => {
    if (classId) {
      try {
        localStorage.setItem(SEL_KEY, classId);
      } catch {
        /* ignore */
      }
    }
  }, [classId]);

  const cls = classes.find((c) => c.id === classId);
  const sched = cls ? scheduleFor(cls) : null;
  const subjects = sched ? sched.subjects.filter(Boolean) : [];

  /* A score cell lives under the score sheet's COLUMN KEY, which only equals the
     schedule subject name for plain sheets. Imported or renamed sheets store the
     value under the layout's key — so map the subject to that key first. */
  const colKeyOf = (cid, subject) => {
    const want = String(subject ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    if (!want) return subject;
    const cols = layouts?.[cid]?.columns || [];
    const norm = (x) => String(x ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    const hit =
      cols.find((c) => norm(c.label) === want) ||
      cols.find((c) => norm(c.key) === want) ||
      cols.find((c) => {
        const cc = norm(c.label);
        return cc.includes(want) || want.includes(cc);
      });
    return hit ? hit.key : subject;
  };

  const scoreFor = (cid, studentId, subject) => {
    const cell = (scores[cid] || {})[studentId] || {};
    const k = colKeyOf(cid, subject);
    const v = cell[k];
    if (v !== undefined && v !== null && v !== "") return v;
    return cell[subject] ?? "";
  };

  /* ranking for any class — used for the live table and the export picker */
  const computeBillboard = (cid) => {
    const c = classes.find((x) => x.id === cid);
    if (!c) return { subjects: [], rows: [] };
    const subs = (scheduleFor(c)?.subjects || []).filter(Boolean);
    const roster = students
      .filter((s) => s.className === c.id && s.status !== "Graduate")
      .sort((a, b) =>
        String(a.studentId || "").localeCompare(String(b.studentId || ""), undefined, { numeric: true })
      );
    const scored = [];
    for (const s of roster) {
      const vals = subs
        .map((sub) => scoreFor(c.id, s.id, sub))
        .filter((v) => v !== "")
        .map((v) => Number(v))
        .filter((n) => !isNaN(n));
      if (!vals.length) continue;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      scored.push({ student: s, avg, scoredSubjects: vals.length });
    }
    scored.sort((a, b) => b.avg - a.avg || a.student.firstName.localeCompare(b.student.firstName));

    // competition ranking (ties share a rank)
    let prevAvg = null;
    let prevRank = 0;
    const rows = scored.map((row, i) => {
      const rank = prevAvg !== null && Math.abs(row.avg - prevAvg) < 1e-9 ? prevRank : i + 1;
      prevAvg = row.avg;
      prevRank = rank;
      return { ...row, rank };
    });
    return { subjects: subs, rows };
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rows = useMemo(() => computeBillboard(classId).rows, [classId, classes, students, scores, schedules, layouts]);

  const exportSheets = () => {
    const picked = dlAll ? billboardClasses : billboardClasses.filter((c) => dlChecked[c.id]);
    return picked.map((c) => {
      const { subjects: subs, rows: rs } = computeBillboard(c.id);
      return {
        cls: c,
        subjects: subs,
        rows: rs.map((row) => ({ ...row, cells: subs.map((s) => scoreFor(c.id, row.student.id, s)) })),
      };
    });
  };
  const noExportSel = dlOpen && !dlAll && !billboardClasses.some((c) => dlChecked[c.id]);

  const classAvg = useMemo(
    () => (rows.length ? rows.reduce((a, r) => a + r.avg, 0) / rows.length : null),
    [rows]
  );

  return (
    <div className="max-w-[1500px] mx-auto space-y-5 animate-fade-up">
      <div className="mb-6 space-y-3 animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
            Billboard
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-3)" }}>
            Students ranked by average score — the highest score is on top.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <ClassSelect
            value={classId}
            onChange={setClassId}
            placeholder="Select a class"
            options={billboardClasses.map((c) => ({
              value: c.id,
              label: c.name,
              sub: `${(scheduleFor(c)?.subjects || []).filter(Boolean).length} subjects`,
            }))}
          />
          <button
            type="button"
            onClick={() => {
              setDlAll(false);
              setDlChecked({});
              setDlOpen(true);
            }}
            disabled={billboardClasses.length === 0}
            className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: "var(--primary)" }}
            title="Export the billboard ranking for chosen classes — pick classes like the Attendance export"
          >
            <FileDown size={14} /> Export
          </button>
        </div>
      </div>

      {billboardClasses.length === 0 && (
        <div className="card">
          <EmptyState
            icon={Trophy}
            title="No classes to rank yet"
            subtitle="Create a class, give it subjects on the Schedule page, then enter scores — the billboard will rank its students automatically."
            action={
              <button onClick={() => (window.location.href = "/schedule")} className="btn btn-primary">
                <Link2 className="h-4 w-4" /> Open Schedule
              </button>
            }
          />
        </div>
      )}

      {cls && !sched && (
        <div className="card">
          <EmptyState
            icon={ClipboardList}
            title={`No schedule for ${cls.name}`}
            subtitle="Add subjects for this class on the Schedule page, then fill the score sheet — the billboard follows both."
            action={
              <button onClick={() => (window.location.href = "/schedule")} className="btn btn-primary">
                <Link2 className="h-4 w-4" /> Open Schedule
              </button>
            }
          />
        </div>
      )}

      {cls && sched && rows.length === 0 && (
        <div className="card">
          <EmptyState
            icon={ClipboardList}
            title={`No scores yet for ${cls.name}`}
            subtitle="Fill in the score sheet for this class, then come back — the billboard ranks students as soon as scores exist."
            action={
              <button onClick={() => (window.location.href = "/scores")} className="btn btn-primary">
                <ClipboardList className="h-4 w-4" /> Open Scores
              </button>
            }
          />
        </div>
      )}

      {cls && sched && rows.length > 0 && (
        <div className="card overflow-hidden">
          {/* header */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg" style={{ background: "linear-gradient(135deg,#f59e0b,#fbbf24)" }}>
                <Trophy size={19} />
              </span>
              <div>
                <p className="text-base font-bold" style={{ color: "var(--text)" }}>
                  {cls.name} — billboard
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-2)" }}>
                  {[cls.field, cls.shift].filter(Boolean).join(" · ")} · {cls.year || "Year 1"} · {cls.semester || "Semester 1"} · {subjects.length} subject{subjects.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <span className="rounded-lg border px-2.5 py-1 text-xs font-semibold" style={{ borderColor: "var(--border)", background: "var(--primary-soft)", color: "var(--primary-strong)" }}>
                {rows.length} ranked
              </span>
              {classAvg != null && (
                <span className="rounded-lg border px-2.5 py-1 text-xs font-semibold" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-2)" }}>
                  Class avg <span className="tabular-nums font-extrabold" style={{ color: "var(--text)" }}>{classAvg.toFixed(2)}</span>
                </span>
              )}
            </div>
          </div>

          {/* ranking table */}
          <div className="overflow-x-auto thin-scroll">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
                  <th className="sticky left-0 z-10 w-16 px-5 py-3.5 text-center" style={{ background: "var(--surface)" }}>
                    Rank
                  </th>
                  <th className="sticky left-16 z-10 min-w-[190px] px-3 py-3.5" style={{ background: "var(--surface)" }}>
                    Student
                  </th>
                  <th className="px-3 py-3.5 text-center whitespace-nowrap" style={{ minWidth: 120 }}>ID</th>
                  {subjects.map((sub, i) => (
                    <th
                      key={i}
                      className="px-2 py-3 text-center align-bottom"
                      title={sub}
                      style={{ minWidth: 108, maxWidth: 180, whiteSpace: "normal", lineHeight: 1.2, wordBreak: "break-word" }}
                    >
                      {sub}
                    </th>
                  ))}
                  <th className="px-3 py-3.5 text-center">Average</th>
                  <th className="px-5 py-3.5 text-center">Grade</th>
                  <th className="px-5 py-3.5 text-center">Transcript</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const gr = gradeOf(row.avg);
                  const latinName = [row.student.firstName, row.student.lastName].filter(Boolean).join(" ");
                  return (
                    <tr key={row.student.id} className="border-t transition-colors hover:bg-[var(--surface-2)]" style={{ borderColor: "var(--border)" }}>
                      <td className="sticky left-0 z-10 px-5 py-2.5 text-center" style={{ background: "var(--surface)" }}>
                        <span className="text-[13px] font-bold tabular-nums" style={{ color: "var(--text)" }}>
                          {row.rank}
                        </span>
                      </td>
                      <td className="sticky left-16 z-10 px-3 py-2.5" style={{ background: "var(--surface)" }}>
                        <Link
                          to={`/students/${row.student.id}`}
                          className="flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-75"
                          title="Open student profile"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold" style={{ background: "var(--primary-soft)", color: "var(--primary-strong)" }}>
                            {initialsOf(row.student)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-bold" style={{ color: "var(--text)" }}>
                              {row.student.khmerName || latinName}
                            </span>
                            {latinName && row.student.khmerName && (
                              <span className="block truncate text-[10.5px]" style={{ color: "var(--text-3)" }}>
                                {latinName}
                              </span>
                            )}
                          </span>
                        </Link>
                      </td>
                      <td
                        className="px-3 py-2.5 text-center text-[12.5px] font-semibold tabular-nums whitespace-nowrap"
                        style={{ minWidth: 120, color: row.student.studentId ? "var(--text-2)" : "var(--text-3)" }}
                        title={row.student.studentId || undefined}
                      >
                        {row.student.studentId || "–"}
                      </td>
                      {subjects.map((sub, si) => {
                        const v = scoreFor(classId, row.student.id, sub);
                        return (
                          <td key={si} className="px-2 py-2.5 text-center text-[13px] font-semibold tabular-nums" style={{ color: v === "" ? "var(--text-3)" : "var(--text)" }}>
                            {v === "" ? "–" : v}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-center font-extrabold tabular-nums" style={{ color: "var(--text)" }}>
                        {row.avg.toFixed(2)}
                      </td>
                      <td className="px-5 py-2.5 text-center">
                        {gr && (
                          <span className={clsx("inline-flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-extrabold", gr.tone)}>
                            {gr.g}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-center">
                        <Link
                          to={`/transcript?student=${row.student.id}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors hover:bg-[var(--surface-2)]"
                          style={{ borderColor: "var(--border)", color: "var(--primary-strong)" }}
                        >
                          <FileText size={14} /> View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-5 py-3 border-t text-[11px]" style={{ borderColor: "var(--border)", color: "var(--text-3)" }}>
            <span>Sorted by average — highest on top · ties share a rank</span>
            <span className="ml-auto">Subject scores come from the class schedule and score sheet</span>
          </div>
        </div>
      )}

      {dlOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setDlOpen(false)} />
            <div className="relative rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-fade-up" style={{ background: "#ffffff" }}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold" style={{ color: "#1e293b" }}>
                  Export billboard
                </h3>
                <button onClick={() => setDlOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100">
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
                {billboardClasses.length === 0 && (
                  <p className="px-2 py-3 text-sm" style={{ color: "#94a3b8" }}>
                    No classes with subjects yet — add subjects on the Schedule page first.
                  </p>
                )}
                {billboardClasses.map((c) => {
                  const on = dlAll || dlChecked[c.id];
                  const n = computeBillboard(c.id).rows.length;
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
                        {n} ranked
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: "#e2e8f0" }}>
                {[
                  { key: "excel", label: "Excel", icon: FileSpreadsheet, ext: "xls" },
                  { key: "word", label: "Word", icon: FileText, ext: "doc" },
                ].map(({ key, label, icon: Icon, ext }) => (
                  <button
                    key={key}
                    onClick={() => {
                      if (noExportSel) {
                        showToast("Pick at least one class");
                        return;
                      }
                      const sheets = exportSheets();
                      downloadSheet(billboardExportHTML(sheets), key, `billboard.${ext}`);
                      logAudit("export_billboard", `Exported billboard to ${label} (${sheets.length} class${sheets.length === 1 ? "" : "es"})`);
                      showToast(`Billboard exported to ${label}`);
                      setDlOpen(false);
                    }}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-all"
                    style={{ background: "#10b981" }}
                  >
                    <Icon size={14} /> {label}
                  </button>
                ))}
                <button
                  onClick={() => {
                    if (noExportSel) {
                      showToast("Pick at least one class");
                      return;
                    }
                    const sheets = exportSheets();
                    const w = window.open("", "_blank");
                    if (!w) {
                      showToast("Allow pop-ups to export as PDF");
                      return;
                    }
                    w.document.write(billboardExportHTML(sheets));
                    w.document.close();
                    w.focus();
                    setTimeout(() => w.print(), 250);
                    logAudit("export_billboard", `Exported billboard to PDF (${sheets.length} class${sheets.length === 1 ? "" : "es"})`);
                    setDlOpen(false);
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
