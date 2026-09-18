import React, { useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Mail,
  Phone,
  Cake,
  MapPin,
  CalendarDays,
  User2,
  Languages,
  Target,
  CheckCircle2,
  XCircle,
  BookOpen,
  MessageCircle,
  GraduationCap,
} from "lucide-react";
import StatCard from "../components/StatCard";
import { EmptyState } from "../components/Page";
import { Badge, StatusBadge, StudentAvatar, statusTone } from "../components/Badge";
import { useApp } from "../context/AppContext";
import { addDays, todayISO, weekdayLabel, prettyDate, computeRate, majorName, ACADEMIC_LEVELS, nextLevel } from "../data/seed";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="font-semibold opacity-90">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="tl">
          <span className="chart-dot" style={{ background: p.color || p.fill }} />
          <span className="opacity-80">{p.name}: </span>
          <b className="tabular-nums">{p.value}</b>
        </div>
      ))}
    </div>
  );
}

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { students, attendance, classes, promoteStudent, showToast } = useApp();
  const student = students.find((s) => s.id === Number(id));

  const recs = useMemo(
    () => (student ? attendance.filter((a) => a.studentId === student.id).sort((a, b) => b.date.localeCompare(a.date)) : []),
    [student, attendance]
  );

  const stats = useMemo(() => {
    const present = recs.filter((r) => r.status === "present").length;
    const late = recs.filter((r) => r.status === "late").length;
    const absent = recs.filter((r) => r.status === "absent").length;
    const leave = recs.filter((r) => r.status === "leave").length;
    return { present, late, absent, leave };
  }, [recs]);

  const trend = useMemo(() => {
    if (!student) return [];
    return Array.from({ length: 14 }, (_, i) => {
      const date = addDays(todayISO(), -(13 - i));
      const rec = recs.find((r) => r.date === date);
      return {
        date: `${weekdayLabel(date)} ${date.slice(8)}`,
        Present: rec?.status === "present" ? 1 : 0,
        Late: rec?.status === "late" ? 1 : 0,
        Absent: rec?.status === "absent" ? 1 : 0,
        Leave: rec?.status === "leave" ? 1 : 0,
      };
    });
  }, [student, recs]);

  if (!student) {
    return (
      <div className="card">
        <EmptyState
          icon={User2}
          title="Student not found"
          subtitle="This student may have been removed from the registry."
          action={
            <Link to="/students" className="btn btn-primary px-4 h-10">
              Back to students
            </Link>
          }
        />
      </div>
    );
  }

  const className = classes.find((c) => c.id === student.className);
  const rate = computeRate(recs);

  const infoRows = [
    { icon: Languages, label: "Khmer name", value: student.khmerName || "—" },
    { icon: Mail, label: "Email", value: student.email },
    { icon: Phone, label: "Phone", value: student.phone },
    { icon: Cake, label: "Date of birth", value: prettyDate(student.dob) },
    { icon: MapPin, label: "Address", value: student.address },
    { icon: CalendarDays, label: "Enrolled", value: student.enrollmentYear ? `Cohort ${student.enrollmentYear}` : prettyDate(student.enrollmentDate) },
    { icon: User2, label: "Guardian", value: student.guardian },
  ];

  const currentLevel = ACADEMIC_LEVELS.includes(student.level) ? student.level : "S1Y1";
  const next = nextLevel(currentLevel);
  const progressHistory = [...(student.history || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const historySet = new Set(progressHistory.map((h) => h.level));
  const handlePromote = () => {
    promoteStudent(student.id);
    showToast(next ? `Exam passed · ${currentLevel} archived · now ${next}` : "All four years complete — student has graduated");
  };

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="btn btn-ghost h-9 px-3 text-sm gap-1 -mb-2 animate-fade-up">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="card overflow-hidden animate-fade-up" style={{ animationDelay: "40ms" }}>
        <div className="h-24 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 relative">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
        </div>
        <div className="px-6 pb-6">
          <div className="-mt-10 flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="rounded-full p-1.5 shrink-0" style={{ background: "var(--surface)" }}>
              <StudentAvatar student={student} size="xl" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
                <h2 className="text-xl font-bold" style={{ color: "var(--text)" }}>
                  {student.firstName} {student.lastName}
                </h2>
                <Badge tone={statusTone(student.status)}>
                  {student.status}
                </Badge>
                <Badge tone="neutral" className="ml-1">
                  {student.level || "S1Y1"}
                </Badge>
              </div>
              <p className="text-sm" style={{ color: "var(--text-3)" }}>
                {student.studentId} · {majorName(student.major)} — {className?.name} · {className?.shift} shift
              </p>
            </div>
            <Link to={`/attendance`} className="btn btn-outline h-10 px-4 text-sm gap-1.5">
              <BookOpen size={16} /> Attendance
            </Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {infoRows.map(({ icon: Icon, label, value }, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0" style={{ background: "var(--primary-soft)", color: "var(--primary-strong)" }}>
                  <Icon size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>
                    {label}
                  </p>
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                    {value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Attendance rate" value={rate} suffix="%" icon={Target} tone="info" delay={80} />
        <StatCard label="Days present" value={stats.present} icon={CheckCircle2} tone="success" sub={`+ ${stats.late} late`} delay={140} />
        <StatCard label="Days absent" value={stats.absent} icon={XCircle} tone="danger" sub={`+ ${stats.leave} leave`} delay={200} />
        <StatCard label="Days enrolled" value={recs.length} icon={CalendarDays} tone="brand" delay={260} />
      </div>

      <div className="card p-5 animate-fade-up" style={{ animationDelay: "165ms" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
              Academic progress
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
              1 semester = 15 weeks · finished semesters are archived when the exam is passed
            </p>
          </div>
          <button
            onClick={handlePromote}
            disabled={student.status === "Graduate" || !next}
            className="btn btn-primary h-10 px-4 text-sm gap-1.5 disabled:opacity-50"
          >
            <GraduationCap size={16} />
            {student.status === "Graduate" ? "Graduated" : `Pass exam · go to ${next}`}
          </button>
        </div>

        <div className="mt-5 flex items-center gap-1 overflow-x-auto thin-scroll pb-2">
          {ACADEMIC_LEVELS.map((lvl, i) => {
            const done = historySet.has(lvl);
            const isCur = lvl === currentLevel;
            return (
              <div key={lvl} className="flex shrink-0 items-center gap-1">
                <div
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 whitespace-nowrap"
                  style={{
                    background: isCur ? "var(--primary-strong)" : done ? "var(--success-soft)" : "var(--surface-2)",
                    color: isCur ? "#fff" : done ? "var(--success)" : "var(--text-3)",
                    border: isCur ? "none" : "1px solid var(--border)",
                  }}
                >
                  <span className="text-[11px] font-bold">{lvl}</span>
                  <span className={`text-[9px] ${isCur ? "opacity-80" : "opacity-70"}`}>
                    {isCur ? "now" : done ? "✓ passed" : `Sem ${lvl[1]} · Y${lvl[3]}`}
                  </span>
                </div>
                {i < ACADEMIC_LEVELS.length - 1 && (
                  <span className="h-px w-3.5 shrink-0" style={{ background: "var(--border)" }} />
                )}
              </div>
            );
          })}
        </div>

        <div className="overflow-x-auto thin-scroll mt-4">
          {progressHistory.length > 0 ? (
            <table className="table-w" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th>Semester</th>
                  <th>Year</th>
                  <th>Class</th>
                  <th>Passed exam on</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {progressHistory.map((h, i) => {
                  const cls = classes.find((c) => c.id === h.className);
                  return (
                    <tr key={h.id} style={{ animationDelay: `${i * 30}ms` }}>
                      <td>
                        <span className="inline-flex rounded-lg px-2 py-0.5 text-[11px] font-bold" style={{ background: "var(--primary-soft)", color: "var(--primary-strong)" }}>
                          {h.level}
                        </span>
                      </td>
                      <td className="font-medium" style={{ color: "var(--text)" }}>{h.semester}</td>
                      <td style={{ color: "var(--text-2)" }}>{h.year}</td>
                      <td style={{ color: "var(--text-2)" }}>{cls?.name || h.className || "—"}</td>
                      <td className="tabular-nums" style={{ color: "var(--text-2)" }}>{prettyDate(h.date)}</td>
                      <td><Badge tone="success">{h.result || "Passed"}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="rounded-xl p-6 text-center text-sm" style={{ background: "var(--surface-2)", color: "var(--text-3)" }}>
              No semesters archived yet — press <b className="text-[var(--text-2)]">"Pass exam · go to {next || "Graduation"}"</b> above when the final exam is passed.
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2 animate-fade-up" style={{ animationDelay: "180ms" }}>
          <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
            Daily pattern
          </h3>
          <p className="text-xs mt-0.5 mb-4" style={{ color: "var(--text-3)" }}>
            Attendance behaviour · last 14 school days
          </p>
          <div className="h-64" style={{ color: "var(--text-2)" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 4, right: 0, bottom: 0, left: -20 }} barSize={14}>
                <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "var(--text-3)", fontSize: 10 }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, 1]} ticks={[0, 1]} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--primary-soft)" }} />
                <Bar dataKey="Present" stackId="a" fill="#10b981" animationDuration={700} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Late" stackId="a" fill="#f59e0b" animationDuration={700} />
                <Bar dataKey="Absent" stackId="a" fill="#ef4444" animationDuration={700} />
                <Bar dataKey="Leave" stackId="a" fill="#3b82f6" animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5 animate-fade-up" style={{ animationDelay: "240ms" }}>
          <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
            Summary
          </h3>
          <div className="mt-4 space-y-3">
            {[
              { label: "Present", value: stats.present, color: "var(--success)" },
              { label: "Late", value: stats.late, color: "var(--warning)" },
              { label: "Absent", value: stats.absent, color: "var(--danger)" },
              { label: "On leave", value: stats.leave, color: "var(--info)" },
            ].map((d, i) => {
              const pct = recs.length ? Math.round((d.value / recs.length) * 100) : 0;
              return (
                <div key={i}>
                  <div className="mb-1 flex items-center justify-between text-xs font-medium" style={{ color: "var(--text-2)" }}>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                      {d.label}
                    </span>
                    <span className="tabular-nums" style={{ color: "var(--text-3)" }}>
                      {d.value} · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--surface-3)" }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: d.color }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 rounded-xl p-3.5 flex gap-3 items-start" style={{ background: "var(--primary-soft)" }}>
            <MessageCircle size={16} className="mt-0.5 shrink-0" style={{ color: "var(--primary-strong)" }} />
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
              {rate >= 90
                ? "Excellent attendance. This student is an example worth recognising."
                : rate >= 75
                ? "Good attendance, but a few days are slipping. A gentle nudge could help."
                : "Attendance is low. Consider scheduling a meeting with the guardian."}
            </p>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden animate-fade-up" style={{ animationDelay: "300ms" }}>
        <div className="flex items-center justify-between px-5 pt-5">
          <div>
            <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
              Attendance history
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
              Most recent {Math.min(recs.length, 15)} records
            </p>
          </div>
        </div>
        <div className="overflow-x-auto thin-scroll mt-3">
          <table className="table-w" style={{ minWidth: 460 }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th>Check-in</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recs.slice(0, 15).map((r, i) => (
                <tr key={r.id} style={{ animationDelay: `${i * 30}ms` }}>
                  <td className="font-medium tabular-nums" style={{ color: "var(--text)" }}>
                    {r.date}
                  </td>
                  <td>{prettyDate(r.date, { weekday: true })}</td>
                  <td className="tabular-nums">{r.checkIn || "—"}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}