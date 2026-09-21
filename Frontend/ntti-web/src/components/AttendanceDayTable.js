import React, { useMemo } from "react";
import { lastNWeeks, weekKeyOf } from "../data/seed";

const STATUS = {
  present: { label: "Present", short: "P", color: "var(--success)", soft: "var(--success-soft)" },
  late: { label: "Late", short: "L", color: "var(--warning)", soft: "var(--warning-soft)" },
  absent: { label: "Absent", short: "A", color: "var(--danger)", soft: "var(--danger-soft)" },
  leave: { label: "Permission", short: "PE", color: "var(--info)", soft: "var(--info-soft)" },
};

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const pad2 = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const shortMonth = (d) => d.toLocaleDateString("en-US", { month: "short" });

/** { key, start, end, range } for the week that starts on key (a Monday ISO date). */
function weekFromKey(key) {
  const start = new Date(key + "T00:00:00");
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return {
    key,
    start: iso(start),
    end: iso(end),
    range: `${shortMonth(start)} ${start.getDate()} – ${shortMonth(end)} ${end.getDate()}`,
  };
}

/** The seven days (Monday–Sunday) of the week starting at startISO. */
function daysOfWeek(startISO) {
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

export function summarizeAttendance(recs = []) {
  const present = recs.filter((r) => r.status === "present").length;
  const late = recs.filter((r) => r.status === "late").length;
  const absent = recs.filter((r) => r.status === "absent").length;
  const leave = recs.filter((r) => r.status === "leave").length;
  const total = recs.length;
  return { present, late, absent, leave, total, rate: total ? Math.round(((present + late) / total) * 100) : 0 };
}

/**
 * Attendance for one student laid out week by week: every row is a week (W1…)
 * and every column is a day (Monday–Sunday), with the check-in time on each
 * marked day. Read-only.
 *
 * `weeks` (optional) lets the caller force the week list/numbering — e.g. the
 * Attendance sheet's own W1…W15. When omitted, the weeks are derived from the
 * records (oldest first), so archived terms line up too.
 */
export default function AttendanceDayTable({ records = [], weeks, maxHeight = 460 }) {
  const summary = useMemo(() => summarizeAttendance(records), [records]);

  const byDate = useMemo(() => {
    const map = {};
    records.forEach((r) => {
      (map[r.date] = map[r.date] || []).push(r);
    });
    return map;
  }, [records]);

  const weekList = useMemo(() => {
    if (Array.isArray(weeks) && weeks.length) return weeks.map((w) => (w && w.key ? w : weekFromKey(w)));
    const keys = Array.from(new Set(records.map((r) => weekKeyOf(r.date)))).sort();
    if (keys.length) return keys.map(weekFromKey);
    return lastNWeeks(15);
  }, [weeks, records]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {[
          ["Present", summary.present, "var(--success)"],
          ["Late", summary.late, "var(--warning)"],
          ["Absent", summary.absent, "var(--danger)"],
          ["Permission", summary.leave, "var(--info)"],
          ["Attendance", summary.total ? `${summary.rate}%` : "—", "var(--text)"],
        ].map(([k, v, color]) => (
          <span
            key={k}
            className="rounded-xl px-3 py-1.5 text-xs font-semibold"
            style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
          >
            {k}: <b style={{ color }}>{v}</b>
          </span>
        ))}
      </div>

      <div className="overflow-auto thin-scroll" style={{ maxHeight }}>
        <table className="table-w" style={{ minWidth: 760 }}>
          <thead>
            <tr>
              <th style={{ minWidth: 66 }}>Week</th>
              {DAY_NAMES.map((d) => (
                <th key={d} className="text-center" style={{ minWidth: 74 }}>
                  {d}
                </th>
              ))}
              <th className="text-center" style={{ minWidth: 64 }}>
                Rate
              </th>
            </tr>
          </thead>
          <tbody>
            {weekList.map((w, i) => {
              const days = daysOfWeek(w.start);
              const marked = days.flatMap((d) => byDate[d.date] || []);
              const pres = marked.filter((r) => r.status === "present" || r.status === "late").length;
              const rate = marked.length ? Math.round((pres / marked.length) * 100) : null;
              return (
                <tr key={w.key}>
                  <td>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold" style={{ color: "var(--text-2)" }}>
                        W{i + 1}
                      </span>
                      <span className="text-[9px] tabular-nums" style={{ color: "var(--text-3)" }}>
                        {w.range}
                      </span>
                    </div>
                  </td>
                  {days.map((d) => {
                    const recs = byDate[d.date] || [];
                    return (
                      <td
                        key={d.date}
                        className="text-center"
                        title={
                          recs.length
                            ? `${d.name} ${d.short} · ` +
                              recs
                                .map((r) => `${r.subject && r.subject !== "general" ? `${r.subject}: ` : ""}${STATUS[r.status]?.label || r.status}${r.checkIn ? ` (${r.checkIn})` : ""}`)
                                .join(" · ")
                            : `${d.name} ${d.short} · no record`
                        }
                      >
                        {recs.length ? (
                          <div className="flex flex-col items-center gap-1">
                            {recs.map((rec, ri) => {
                              const meta = STATUS[rec.status];
                              return (
                                <div key={ri} className="flex flex-col items-center gap-0.5">
                                  {rec.subject && rec.subject !== "general" ? (
                                    <span className="text-[8px] font-semibold leading-none truncate max-w-[54px]" style={{ color: "var(--text-3)" }}>
                                      {rec.subject}
                                    </span>
                                  ) : null}
                                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ color: meta?.color, background: meta?.soft }}>
                                    {meta?.short || rec.status}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
                            ·
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-center">
                    {rate == null ? (
                      <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
                        —
                      </span>
                    ) : (
                      <span
                        className="text-[11px] font-bold tabular-nums"
                        style={{ color: rate >= 85 ? "var(--success)" : rate >= 70 ? "var(--warning)" : "var(--danger)" }}
                      >
                        {rate}%
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
