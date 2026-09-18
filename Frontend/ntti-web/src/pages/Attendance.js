import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock3,
  Palmtree,
  Search,
  BookOpen,
  PlusCircle,
  Save,
  RotateCcw,
  UserCheck,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import PageHeader, { ProgressBar, EmptyState } from "../components/Page";
import { useApp } from "../context/AppContext";
import { todayISO, weekdayLabel, formatTime, shiftRange } from "../data/seed";
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
  const { students, attendance, classes, saveAttendance, showToast } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const classParam = searchParams.get("class");

  const [date, setDate] = useState(todayISO());
  const [classFilter, setClassFilter] = useState(classParam || "all");
  const [q, setQ] = useState("");
  const [leftOpen, setLeftOpen] = useState(true);
  const [marks, setMarks] = useState(() => {
    const init = {};
    attendance.filter((a) => a.date === todayISO()).forEach((a) => (init[a.studentId] = a));
    return init;
  });

  /* ── Classes list (left column) ─────────────────────── */
  const classList = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return classes
      .map((c) => {
        const studs = students.filter((s) => s.className === c.id);
        const marked = studs.filter((s) => marks[s.id]).length;
        return { ...c, count: studs.length, marked };
      })
      .filter((c) => !qq || c.name.toLowerCase().includes(qq) || (c.field || "").toLowerCase().includes(qq))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [classes, students, marks, q]);

  const activeClass = classFilter !== "all" ? classes.find((c) => c.id === classFilter) || null : null;

  /* ── Roster ─────────────────────────────────────────── */
  const roster = useMemo(() => {
    const list = classFilter === "all" ? [...students] : students.filter((s) => s.className === classFilter);
    return list.sort((a, b) => {
      if (classFilter !== "all") return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      const ca = classes.find((c) => c.id === a.className)?.name || "";
      const cb = classes.find((c) => c.id === b.className)?.name || "";
      return ca.localeCompare(cb) || `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });
  }, [students, classes, classFilter]);

  const groups = useMemo(() => {
    if (activeClass) return [{ cls: activeClass, list: roster }];
    const map = {};
    roster.forEach((s) => {
      (map[s.className] = map[s.className] || []).push(s);
    });
    return Object.keys(map).map((id) => ({ cls: classes.find((c) => c.id === id), list: map[id] }));
  }, [roster, activeClass, classes]);

  const pickClass = (id) => {
    setClassFilter(id);
    if (id === "all") setSearchParams({}, { replace: true });
    else setSearchParams({ class: id }, { replace: true });
  };

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
        title="Attendance"
        subtitle="Pick a class on the left, then tick each student Present / Late / Absent / Leave."
        actions={
          <button onClick={save} className="btn btn-primary h-10 px-4 text-sm">
            <Save size={17} /> Save attendance
          </button>
        }
      />

      <div className={`relative grid gap-5 ${leftOpen ? "xl:grid-cols-[250px_minmax(0,1fr)]" : "xl:grid-cols-[44px_minmax(0,1fr)]"}`}>
        {!leftOpen && (
          <button
            onClick={() => setLeftOpen(true)}
            className="absolute left-8 top-[84px] z-30 btn btn-soft h-10 w-7 p-0 rounded-none rounded-r-lg"
            title="Expand panel"
          >
            <ChevronRight size={15} />
          </button>
        )}

        {/* ── Left: date + classes list ── */}
        <div className={`card overflow-hidden flex flex-col animate-fade-up xl:sticky xl:top-[84px] xl:self-start xl:max-h-[calc(100vh-150px)] transition-all duration-300 ${leftOpen ? "xl:w-[250px]" : "w-0 overflow-hidden"}`} style={{ animationDelay: "60ms" }}>
          <div className="p-3 border-b space-y-2.5" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--text-3)" }}>Classes</p>
              <button onClick={() => setLeftOpen(false)} className="btn btn-ghost h-6 w-6 p-0 rounded-md" title="Collapse panel">
                <ChevronLeft size={14} />
              </button>
            </div>
            <div className="relative">
              <CalendarDays size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
              <input type="date" value={date} onChange={(e) => switchDate(e.target.value)} className="input pl-9 h-9 text-sm" max={todayISO()} />
            </div>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} className="input pl-9 h-9 text-sm" placeholder="Search classes…" />
            </div>
          </div>
          <div className="overflow-y-auto thin-scroll flex-1 max-h-[420px] xl:max-h-none divide-y" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={() => pickClass("all")}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-2)]"
              style={{ background: classFilter === "all" ? "var(--primary-soft)" : "transparent" }}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0" style={{ background: "var(--primary)", color: "#fff" }}>
                <Users size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold" style={{ color: "var(--text)" }}>All classes</span>
                <span className="block text-[11px]" style={{ color: "var(--text-3)" }}>{students.length} students</span>
              </span>
              <span className="text-[10px] font-bold tabular-nums rounded-lg px-2 py-1" style={{ background: "var(--surface-3)", color: "var(--text-2)" }}>
                {Object.keys(marks).filter((id) => roster.some((s) => s.id === Number(id))).length}/{roster.length}
              </span>
            </button>
            {classList.map((c) => {
              const on = classFilter === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => pickClass(c.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-2)]"
                  style={{ background: on ? "var(--primary-soft)" : "transparent" }}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0 text-white" style={{ background: "var(--accent)" }}>
                    <BookOpen size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{c.name}</span>
                    <span className="block text-[11px] truncate" style={{ color: "var(--text-3)" }}>
                      {c.field || "General"} · {c.shift}{c.shift && shiftRange(c.shift) ? ` (${shiftRange(c.shift)})` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] font-bold tabular-nums rounded-lg px-2 py-1" style={{ background: "var(--surface-3)", color: "var(--text-2)" }}>
                    {c.marked}/{c.count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="border-t px-3 py-2 text-[11px]" style={{ borderColor: "var(--border)", color: "var(--text-3)" }}>
            {weekdayLabel(date)} · {date}
          </div>
        </div>

        {/* ── Right: roster with tick buttons ── */}
        <div className="space-y-5 animate-fade-up" style={{ animationDelay: "100ms" }}>
          {/* counts row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {STATUSES.map((s) => (
              <div key={s.key} className="card p-3.5 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0" style={{ background: s.soft, color: s.color }}>
                  <s.icon size={15} />
                </span>
                <div className="min-w-0">
                  <p className="text-base font-bold tabular-nums leading-none" style={{ color: "var(--text)" }}>{counts[s.key]}</p>
                  <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--text-3)" }}>{s.label}</p>
                </div>
              </div>
            ))}
            <div className="card p-3.5 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0" style={{ background: "var(--primary-soft)", color: "var(--primary-strong)" }}>
                <UserCheck size={15} />
              </span>
              <div className="min-w-0">
                <p className="text-base font-bold tabular-nums leading-none" style={{ color: "var(--text)" }}>{counts.rate}%</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-3)" }}>Rate</p>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3 border-b" style={{ borderColor: "var(--border)" }}>
              <div>
                <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
                  {activeClass ? `${activeClass.name} — ${activeClass.shift} shift` : "All classes"}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                  {roster.length} students · {counts.done} marked · {counts.rate}% rate
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
                {groups.map((g) => (
                  <div key={g.cls?.id || "group"}>
                    {classFilter === "all" && (
                      <div className="flex items-center gap-2 px-5 pt-3 pb-1">
                        <span className="h-2 w-2 rounded-full" style={{ background: "var(--primary)" }} />
                        <span className="text-[11px] font-bold" style={{ color: "var(--text-2)" }}>
                          {g.cls?.name || "—"} {g.cls?.shift ? `· ${g.cls.shift} shift` : ""}
                        </span>
                        <span className="text-[10px] tabular-nums" style={{ color: "var(--text-3)" }}>
                          {g.list.length} students
                        </span>
                      </div>
                    )}
                    {g.list.map((s) => {
                      const current = marks[s.id]?.status || "none";
                      return (
                        <div key={s.id} className="px-5 py-3.5">
                          <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <StudentAvatar student={s} size="md" />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
                                  {s.firstName} {s.lastName}
                                </p>
                                <p className="text-[11px] tabular-nums truncate" style={{ color: "var(--text-3)" }}>
                                  {s.studentId} · {classes.find((c) => c.id === s.className)?.name}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 md:w-[440px]">
                              {STATUSES.map((opt) => {
                                const active = current === opt.key;
                                return (
                                  <button
                                    key={opt.key}
                                    onClick={() => setStatus(s.id, opt.key)}
                                    className="btn h-9 flex-1 rounded-lg text-xs transition-all duration-200"
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
                              <span className="hidden w-14 text-right text-xs tabular-nums md:block" style={{ color: "var(--text-3)" }}>
                                {marks[s.id]?.checkIn || "—"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
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
      </div>
    </div>
  );
}