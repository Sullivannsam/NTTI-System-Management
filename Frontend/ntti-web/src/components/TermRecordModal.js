import React, { useEffect, useMemo, useState } from "react";
import { Search, ArrowLeft } from "lucide-react";
import Modal from "./Modal";
import AttendanceDayTable from "./AttendanceDayTable";
import { prettyDate } from "../data/seed";

const GRADE_TONE = {
  A: { color: "var(--success)", background: "var(--success-soft)" },
  B: { color: "var(--info)", background: "var(--info-soft)" },
  C: { color: "var(--warning)", background: "var(--warning-soft)" },
  D: { color: "var(--warning)", background: "var(--warning-soft)" },
  F: { color: "var(--danger)", background: "var(--danger-soft)" },
};

const summarize = (recs) => {
  const present = recs.filter((r) => r.status === "present").length;
  const late = recs.filter((r) => r.status === "late").length;
  const absent = recs.filter((r) => r.status === "absent").length;
  const leave = recs.filter((r) => r.status === "leave").length;
  const total = recs.length;
  return { present, late, absent, leave, total, rate: total ? Math.round(((present + late) / total) * 100) : 0 };
};

/** Read-only ranked snapshot of a finished semester: scores, average, grade, attendance %. */
export default function TermRecordModal({ term, onClose, attendance = [] }) {
  const [query, setQuery] = useState("");
  const [attRow, setAttRow] = useState(null); // student whose day log is shown

  useEffect(() => {
    setQuery("");
    setAttRow(null);
  }, [term?.id]);

  const allRows = useMemo(
    () =>
      [...(term?.rows || [])].sort((a, b) => {
        if (a.rank == null && b.rank == null) return String(a.name).localeCompare(String(b.name));
        if (a.rank == null) return 1;
        if (b.rank == null) return -1;
        return a.rank - b.rank;
      }),
    [term]
  );

  const subjects = useMemo(() => {
    if (term?.subjects && term.subjects.length) return term.subjects;
    return [...new Set(allRows.flatMap((r) => Object.keys(r.scores || {})))];
  }, [term, allRows]);

  /* attendance summary per student: stored snapshot first, else derived */
  const attMap = useMemo(() => {
    const map = {};
    allRows.forEach((r) => {
      if (r.attendance && r.attendance.total) {
        map[r.studentId] = r.attendance;
        return;
      }
      const recs = attendance.filter((a) => a.studentId === r.studentId && a.date && a.date <= term?.endedOn);
      map[r.studentId] = recs.length ? summarize(recs) : r.attendance || null;
    });
    return map;
  }, [allRows, attendance, term]);

  const classAtt = useMemo(() => {
    if (term?.classAttendance && term.classAttendance.total) return term.classAttendance;
    const ids = new Set(allRows.map((r) => r.studentId));
    return summarize(attendance.filter((a) => a.date && a.date <= term?.endedOn && ids.has(a.studentId)));
  }, [term, allRows, attendance]);

  /* daily records for the term: stored at rollover, else the live records up
     to the term end (for older records). */
  const baseRecords = useMemo(() => {
    const stored = term?.attendanceRecords;
    if (Array.isArray(stored) && stored.length) return stored;
    const ids = new Set(allRows.map((r) => r.studentId));
    return attendance.filter((a) => a.date && a.date <= term?.endedOn && ids.has(a.studentId));
  }, [term, allRows, attendance]);

  const studentRecords = useMemo(
    () => (attRow ? baseRecords.filter((a) => a.studentId === attRow.studentId) : []),
    [attRow, baseRecords]
  );

  const q = query.trim().toLowerCase();
  const rows = useMemo(() => {
    if (!q) return allRows;
    return allRows.filter((r) =>
      `${r.khmerName || ""} ${r.name || ""} ${r.studentCode || ""}`.toLowerCase().includes(q)
    );
  }, [allRows, q]);

  if (!term) return null;

  return (
    <Modal
      open
      onClose={onClose}
      size="2xl"
      title={attRow ? `Attendance · ${attRow.khmerName || attRow.name}` : `${term.level} — ${term.className}`}
      subtitle={
        attRow
          ? `${term.level} · ${attRow.studentCode || ""} · week by week, Monday to Sunday`
          : `${term.semester} · ${term.year} · ended ${prettyDate(term.endedOn)}`
      }
      footer={
        <button onClick={onClose} className="btn btn-primary h-10 px-5 text-sm">
          Close
        </button>
      }
    >
      {attRow ? (
        <div className="space-y-3">
          <button
            onClick={() => setAttRow(null)}
            className="btn btn-ghost h-9 px-3 text-sm gap-1.5"
            style={{ color: "var(--primary-strong)" }}
          >
            <ArrowLeft size={15} /> Back to scores
          </button>
          <AttendanceDayTable records={studentRecords} />
        </div>
      ) : (
        <>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        {[
          ["Students", term.classSize ?? allRows.length],
          ["Subjects", subjects.length],
          ["Class average", term.classAvg == null ? "—" : term.classAvg.toFixed(2)],
          ["Attendance", classAtt && classAtt.total ? `${classAtt.rate}%` : "—"],
        ].map(([k, v]) => (
          <span
            key={k}
            className="rounded-xl px-3 py-1.5 text-xs font-semibold"
            style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
          >
            {k}: <b style={{ color: "var(--text)" }}>{v}</b>
          </span>
        ))}
      </div>

      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input pl-9"
          placeholder="Search student by name, Khmer name or ID…"
        />
        {q && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums" style={{ color: "var(--text-3)" }}>
            {rows.length}/{allRows.length}
          </span>
        )}
      </div>

      <div className="overflow-x-auto thin-scroll">
        <table className="table-w" style={{ minWidth: 360 + subjects.length * 90 }}>
          <thead>
            <tr>
              <th className="text-center w-14">#</th>
              <th style={{ minWidth: 200 }}>Student</th>
              {subjects.map((sub) => (
                <th key={sub} className="text-center">{sub}</th>
              ))}
              <th className="text-center">Average</th>
              <th className="text-center">Grade</th>
              <th className="text-center">Attendance</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={subjects.length + 5} className="text-center py-6" style={{ color: "var(--text-3)" }}>
                  {allRows.length === 0 ? "No students were recorded for this semester." : "No students match your search."}
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const a = attMap[r.studentId];
                return (
                  <tr key={r.studentId}>
                    <td className="text-center font-bold tabular-nums">{r.rank ?? "—"}</td>
                    <td>
                      <button
                        onClick={() => setAttRow(r)}
                        className="text-left"
                        title="Click to see this student's attendance by day"
                      >
                        <span className="block font-semibold" style={{ color: "var(--text)" }}>
                          {r.khmerName || r.name}
                        </span>
                        <span className="block text-[11px]" style={{ color: "var(--text-3)" }}>
                          {r.khmerName ? r.name : ""} {r.studentCode ? `· ${r.studentCode}` : ""}
                        </span>
                      </button>
                    </td>
                    {subjects.map((sub) => {
                      const v = r.scores?.[sub];
                      const n = v === undefined || v === null || v === "" ? null : Number(v);
                      return (
                        <td
                          key={sub}
                          className="text-center tabular-nums"
                          style={{ color: n == null ? "var(--text-3)" : "var(--text-2)" }}
                        >
                          {n == null || isNaN(n) ? "—" : n.toFixed(2)}
                        </td>
                      );
                    })}
                    <td className="text-center font-bold tabular-nums">
                      {r.avg == null ? "—" : r.avg.toFixed(2)}
                    </td>
                    <td className="text-center">
                      {r.grade ? (
                        <span className="rounded px-2 py-0.5 text-xs font-extrabold" style={GRADE_TONE[r.grade]}>
                          {r.grade}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => setAttRow(r)}
                        className="rounded-lg px-2 py-1 text-xs font-bold tabular-nums transition hover:opacity-80"
                        style={{
                          background: "var(--surface-2)",
                          color: a && a.total ? "var(--text-2)" : "var(--text-3)",
                        }}
                        title={
                          a && a.total
                            ? `${a.present} present · ${a.late} late · ${a.absent} absent · ${a.leave} permission — click for days`
                            : "Click to see attendance by day"
                        }
                      >
                        {a && a.total ? `${a.rate}%` : "—"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
        </>
      )}
    </Modal>
  );
}
