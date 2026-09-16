import React, { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock3,
  Palmtree,
  PlusCircle,
  Save,
  RotateCcw,
  UserCheck,
} from "lucide-react";
import PageHeader, { ProgressBar, EmptyState } from "../components/Page";
import { useApp } from "../context/AppContext";
import { CLASSES, MAJORS, classesOfMajor, todayISO, weekdayLabel, prettyDate, formatTime } from "../data/seed";
import { StudentAvatar } from "../components/Badge";

const STATUSES = [
  { key: "present", label: "Present", icon: CheckCircle2, color: "var(--success)", soft: "var(--success-soft)" },
  { key: "late", label: "Late", icon: Clock3, color: "var(--warning)", soft: "var(--warning-soft)" },
  { key: "absent", label: "Absent", icon: XCircle, color: "var(--danger)", soft: "var(--danger-soft)" },
  { key: "leave", label: "On leave", icon: Palmtree, color: "var(--info)", soft: "var(--info-soft)" },
];

function nowTime() {
  const d = new Date();
  return formatTime(d.getHours(), d.getMinutes());
}

export default function Attendance() {
  const { students, attendance, saveAttendance, showToast } = useApp();
  const [date, setDate] = useState(todayISO());
  const [classFilter, setClassFilter] = useState("all");
  const [marks, setMarks] = useState(() => {
    const init = {};
    attendance.filter((a) => a.date === todayISO()).forEach((a) => (init[a.studentId] = a));
    return init;
  });

  const roster = useMemo(() => {
    const list = students.filter(
      (s) => classFilter === "all" || s.className === classFilter
    );
    return list;
  }, [students, classFilter]);

  const switchDate = (d) => {
    setDate(d);
    const init = {};
    attendance.filter((a) => a.date === d).forEach((a) => (init[a.studentId] = a));
    setMarks(init);
  };

  const setStatus = (sid, status) => {
    setMarks((prev) => {
      const existing = prev[sid];
      const next = { ...prev };
      if (status === "present" || status === "late") {
        next[sid] = { studentId: sid, date, status, checkIn: existing?.checkIn || nowTime() };
      } else {
        next[sid] = { studentId: sid, date, status, checkIn: null };
      }
      return next;
    });
  };

  const markAll = (status) => {
    const next = { ...marks };
    roster.forEach((s) => {
      next[s.id] = {
        studentId: s.id,
        date,
        status,
        checkIn: status === "present" || status === "late" ? nowTime() : null,
      };
    });
    setMarks(next);
  };

  const reset = () => switchDate(date);

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, leave: 0 };
    roster.forEach((s) => {
      const st = marks[s.id]?.status;
      if (st) c[st]++;
    });
    c.done = c.present + c.late + c.absent + c.leave;
    c.rate = c.done ? Math.round(((c.present + c.late) / c.done) * 100) : 0;
    return c;
  }, [roster, marks]);

  const save = () => {
    const ids = new Set(roster.map((s) => s.id));
    const records = Object.values(marks).filter((m) => ids.has(m.studentId));
    saveAttendance(records);
    showToast(`Attendance saved for ${records.length} students`);
  };

  return (
    <div>
      <PageHeader
        title="Daily attendance"
        subtitle={`Marking for ${prettyDate(date, { weekday: true })}`}
        actions={
          <button onClick={save} className="btn btn-primary h-10 px-4 text-sm">
            <Save size={17} /> Save attendance
          </button>
        }
      />

      <div className="card p-4 mb-5 animate-fade-up" style={{ animationDelay: "40ms" }}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative md:w-56">
            <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
            <input
              type="date"
              value={date}
              onChange={(e) => switchDate(e.target.value)}
              className="input pl-9"
              max={todayISO()}
            />
          </div>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="input md:w-60"
          >
            <option value="all">All classes</option>
            {MAJORS.map((m) => (
              <optgroup key={m.id} label={m.name}>
                {classesOfMajor(m.id).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium md:ml-auto" style={{ background: "var(--primary-soft)", color: "var(--primary-strong)" }}>
            <CalendarDays size={13} /> {weekdayLabel(date)} · {date}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 mb-5">
        {STATUSES.map((s, i) => (
          <div key={s.key} className="card p-3.5 flex items-center gap-3 animate-fade-up" style={{ animationDelay: `${60 + i * 50}ms` }}>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: s.soft, color: s.color }}>
              <s.icon size={17} />
            </span>
            <div>
              <p className="text-lg font-bold tabular-nums leading-none" style={{ color: "var(--text)" }}>
                {counts[s.key]}
              </p>
              <p className="text-[11px] mt-1" style={{ color: "var(--text-3)" }}>{s.label}</p>
            </div>
          </div>
        ))}
        <div className="card p-3.5 flex items-center gap-3 animate-fade-up" style={{ animationDelay: "260ms" }}>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "var(--primary-soft)", color: "var(--primary-strong)" }}>
            <UserCheck size={17} />
          </span>
          <div>
            <p className="text-lg font-bold tabular-nums leading-none" style={{ color: "var(--text)" }}>
              {counts.rate}%
            </p>
            <p className="text-[11px] mt-1" style={{ color: "var(--text-3)" }}>Rate</p>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden animate-fade-up" style={{ animationDelay: "140ms" }}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
              Class roster
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
              {roster.length} students · {counts.done} marked
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => markAll("present")} className="btn btn-soft h-9 px-3 text-xs">
              <PlusCircle size={15} /> Mark all present
            </button>
            <button onClick={reset} className="btn btn-ghost h-9 px-3 text-xs" title="Clear all marks">
              <RotateCcw size={15} /> Reset
            </button>
          </div>
        </div>

        {roster.length === 0 ? (
          <div className="px-2">
            <EmptyState icon={CalendarDays} title="No students in this class" />
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {roster.map((s, i) => {
              const current = marks[s.id]?.status || "none";
              return (
                <div key={s.id} className="px-5 py-4 animate-fade-up" style={{ animationDelay: `${180 + i * 30}ms` }}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <StudentAvatar student={s} size="md" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
                          {s.firstName} {s.lastName}
                        </p>
                        <p className="text-[11px] tabular-nums" style={{ color: "var(--text-3)" }}>
                          {s.studentId} · {CLASSES.find((c) => c.id === s.className)?.name}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 lg:w-[440px]">
                      {STATUSES.map((opt) => {
                        const active = current === opt.key;
                        return (
                          <button
                            key={opt.key}
                            onClick={() => setStatus(s.id, opt.key)}
                            className="btn h-9 rounded-lg text-xs transition-all duration-200"
                            style={
                              active
                                ? { background: opt.color, color: "#fff", boxShadow: `0 6px 14px -4px ${opt.color}66` }
                                : { background: "var(--surface-2)", color: "var(--text-2)" }
                            }
                          >
                            <opt.icon size={14} /> {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    <span className="hidden lg:flex items-center gap-1.5 text-xs tabular-nums w-16 justify-end" style={{ color: "var(--text-3)" }}>
                      {marks[s.id]?.checkIn || "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
        <div className="w-full sm:flex-1">
          <div className="mb-1.5 flex justify-between text-xs font-medium" style={{ color: "var(--text-3)" }}>
            <span>Attendance progress · {counts.done}/{roster.length} marked</span>
            <span className="tabular-nums font-semibold" style={{ color: "var(--text-2)" }}>{counts.rate}%</span>
          </div>
          <ProgressBar value={counts.rate} tone={counts.rate >= 85 ? "success" : counts.rate >= 70 ? "warning" : "danger"} />
        </div>
        <button onClick={save} className="btn btn-primary h-11 px-6 text-sm shrink-0 w-full sm:w-auto">
          <Save size={17} /> Save attendance
        </button>
      </div>
    </div>
  );
}