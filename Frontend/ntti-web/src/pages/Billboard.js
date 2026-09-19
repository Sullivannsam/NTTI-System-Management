import React, { useEffect, useMemo, useState } from "react";
import { Trophy, ClipboardList, Link2, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { useApp } from "../context/AppContext";
import PageHeader, { EmptyState } from "../components/Page";
import ClassSelect from "../components/ClassSelect";

const SCORES_KEY = "ntti.scores.v1";
const SCHED_KEY = "ntti.schedule.v2";
const SEL_KEY = "ntti.billboard.selected.v1";

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

const gradeOf = (avg) => {
  if (avg == null) return null;
  if (avg >= 90) return { g: "A", tone: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" };
  if (avg >= 80) return { g: "B", tone: "bg-sky-500/15 text-sky-600 border-sky-500/30" };
  if (avg >= 70) return { g: "C", tone: "bg-amber-500/15 text-amber-600 border-amber-500/30" };
  if (avg >= 60) return { g: "D", tone: "bg-orange-500/15 text-orange-600 border-orange-500/30" };
  return { g: "F", tone: "bg-red-500/15 text-red-600 border-red-500/30" };
};

/* medal colors for the top three ranks */
const RANK_GRAD = {
  1: "linear-gradient(135deg,#f59e0b,#fbbf24)",
  2: "linear-gradient(135deg,#94a3b8,#cbd5e1)",
  3: "linear-gradient(135deg,#b45309,#f59e0b)",
};

const initialsOf = (s) =>
  `${String(s.firstName || "?")[0] || ""}${String(s.lastName || "")[0] || ""}`.toUpperCase();

export default function Billboard() {
  const { students, classes } = useApp();
  const [scores, setScores] = useState(loadScores);
  const [schedules, setSchedules] = useState(loadSchedules);
  const [classId, setClassId] = useState(() => localStorage.getItem(SEL_KEY) || "");

  // re-read latest scores/schedules when the page opens
  useEffect(() => {
    const t = setTimeout(() => {
      setScores(loadScores());
      setSchedules(loadSchedules());
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

  const rawOf = (studentId, subject) => {
    const v = ((scores[classId] || {})[studentId] || {})[subject];
    return v === undefined || v === null || v === "" ? "" : v;
  };

  const rows = useMemo(() => {
    if (!cls) return [];
    const roster = students
      .filter((s) => s.className === cls.id && s.status !== "Graduate")
      .sort((a, b) =>
        String(a.studentId || "").localeCompare(String(b.studentId || ""), undefined, { numeric: true })
      );
    const scored = [];
    for (const s of roster) {
      const vals = subjects
        .map((sub) => rawOf(s.id, sub))
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
    return scored.map((row, i) => {
      const rank = prevAvg !== null && Math.abs(row.avg - prevAvg) < 1e-9 ? prevRank : i + 1;
      prevAvg = row.avg;
      prevRank = rank;
      return { ...row, rank };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls, students, subjects, scores]);

  const classAvg = useMemo(
    () => (rows.length ? rows.reduce((a, r) => a + r.avg, 0) / rows.length : null),
    [rows]
  );

  return (
    <div className="max-w-[1500px] mx-auto space-y-5 animate-fade-up">
      <PageHeader
        title="Billboard"
        subtitle="Students ranked by average score — the highest score is on top."
        actions={
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
        }
      />

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
                  const grad = RANK_GRAD[row.rank];
                  return (
                    <tr key={row.student.id} className="border-t transition-colors hover:bg-[var(--surface-2)]" style={{ borderColor: "var(--border)" }}>
                      <td className="sticky left-0 z-10 px-5 py-2.5 text-center" style={{ background: "var(--surface)" }}>
                        <span
                          className={clsx("inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-extrabold", grad ? "text-white" : "")}
                          style={grad ? { background: grad } : { background: "var(--surface-2)", color: "var(--text-2)" }}
                        >
                          {row.rank}
                        </span>
                      </td>
                      <td className="sticky left-16 z-10 px-3 py-2.5" style={{ background: "var(--surface)" }}>
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold" style={{ background: "var(--primary-soft)", color: "var(--primary-strong)" }}>
                            {initialsOf(row.student)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-bold" style={{ color: "var(--text)" }}>
                              {row.student.khmerName || `${row.student.firstName} ${row.student.lastName}`}
                            </span>
                            <span className="block truncate text-[10.5px]" style={{ color: "var(--text-3)" }}>
                              {row.student.khmerName ? `${row.student.firstName} ${row.student.lastName} · ` : ""}{row.student.studentId}
                            </span>
                          </span>
                        </div>
                      </td>
                      {subjects.map((sub, si) => {
                        const v = rawOf(row.student.id, sub);
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
    </div>
  );
}
