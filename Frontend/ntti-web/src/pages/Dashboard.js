import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Users, CalendarCheck2, Percent, Building2, ChevronRight, ArrowUpRight, UserRoundCheck, Clock3 } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import StatCard from "../components/StatCard";
import PageHeader, { ProgressBar } from "../components/Page";
import { useApp } from "../context/AppContext";
import { MAJORS, addDays, todayISO, computeRate, weekdayLabel } from "../data/seed";
import { StudentAvatar } from "../components/Badge";

function ChartTooltip({ active, payload, label, unit = "" }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="font-semibold opacity-90">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="tl">
          <span className="chart-dot" style={{ background: p.color || p.fill }} />
          <span className="opacity-80">{p.name}: </span>
          <b className="tabular-nums">
            {p.value}
            {unit}
          </b>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { students, attendance, classes } = useApp();
  const today = todayISO();

  const stats = useMemo(() => {
    const todayRecs = attendance.filter((a) => a.date === today);
    const presentToday = todayRecs.filter((r) => r.status === "present").length;
    const rates = students.map((s) =>
      computeRate(attendance.filter((a) => a.studentId === s.id))
    );
    const avgRate = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;
    return { presentToday, avgRate };
  }, [students, attendance, today]);

  const trend = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const date = addDays(today, -(13 - i));
      const recs = attendance.filter((a) => a.date === date);
      return {
        date: `${weekdayLabel(date)} ${date.slice(8)}`,
        Present: recs.filter((r) => r.status === "present").length,
        Late: recs.filter((r) => r.status === "late").length,
        Absent: recs.filter((r) => r.status === "absent").length,
      };
    });
  }, [attendance, today]);

  const classStats = useMemo(() => {
    return classes.map((c) => {
      const studs = students.filter((s) => s.className === c.id);
      const recs = attendance.filter((a) => studs.some((s) => s.id === a.studentId));
      const attended = recs.filter((r) => r.status === "present" || r.status === "late").length;
      return {
        ...c,
        count: studs.length,
        rate: recs.length ? Math.round((attended / recs.length) * 100) : 0,
      };
    });
  }, [students, attendance, classes]);

  const majorStats = useMemo(() => {
    return MAJORS.map((m) => {
      const rates = classStats
        .filter((c) => c.major === m.id)
        .map((c) => c.rate);
      return {
        ...m,
        rate: rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0,
        count: classStats.filter((c) => c.major === m.id).reduce((a, c) => a + c.count, 0),
      };
    });
  }, [classStats]);

  const todayBoard = useMemo(() => {
    return students
      .map((s) => {
        const rec = attendance.find((a) => a.studentId === s.id && a.date === today);
        return { ...s, rec: rec || { status: "—", checkIn: null } };
      })
      .filter((s) => s.rec.status === "present" || s.rec.status === "late")
      .slice(0, 6);
  }, [students, attendance, today]);

  const topRate = () => Math.max(...classStats.map((c) => c.rate), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? "morning" : "afternoon"}, Admin`}
        subtitle="Here's what's happening across NTTI today."
        actions={
          <Link to="/attendance" className="btn btn-primary h-10 px-4 text-sm">
            <CalendarCheck2 size={17} /> Mark attendance
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total students" value={students.length} icon={Users} tone="brand" trend={{ up: true, value: 8 }} sub="vs last month" />
        <StatCard label="Present today" value={stats.presentToday} icon={UserRoundCheck} tone="success" sub={`of ${students.length} enrolled`} />
        <StatCard label="Attendance rate" value={stats.avgRate} suffix="%" icon={Percent} tone="info" trend={{ up: true, value: 2.4 }} sub="avg all students" />
        <StatCard label="Classes" value={classes.length} icon={Building2} tone="warning" suffix=" active" sub="3 shifts" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2 animate-fade-up" style={{ animationDelay: "120ms" }}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
                Attendance trend
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                Daily presence across all classes · last 14 days
              </p>
            </div>
            <Link to="/analytics" className="btn btn-ghost h-9 px-3 text-xs gap-1">
              Details <ChevronRight size={15} />
            </Link>
          </div>
          <div className="h-72" style={{ color: "var(--text-2)" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 6, right: 4, bottom: 0, left: -14 }}>
                <defs>
                  <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gLate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--text-3)", strokeDasharray: "4 4" }} />
                <Area type="monotone" dataKey="Present" stroke="#6366f1" strokeWidth={2.5} fill="url(#gPresent)" animationDuration={900} />
                <Area type="monotone" dataKey="Late" stroke="#f59e0b" strokeWidth={2} fill="url(#gLate)" animationDuration={900} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5 animate-fade-up" style={{ animationDelay: "200ms" }}>
          <div className="mb-4">
            <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
              Major attendance
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
              Average rate per major
            </p>
          </div>
          <div className="space-y-5">
            {majorStats.map((m, i) => (
              <div key={m.id} className="animate-fade-up" style={{ animationDelay: `${220 + i * 70}ms` }}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-semibold truncate pr-2" style={{ color: "var(--text)" }}>
                    {m.name}
                  </span>
                  <span className="tabular-nums text-xs font-semibold" style={{ color: m.rate >= 85 ? "var(--success)" : m.rate >= 70 ? "var(--warning)" : "var(--danger)" }}>
                    {m.rate}%
                  </span>
                </div>
                <ProgressBar
                  value={(m.rate / topRate()) * 100}
                  tone={m.rate >= 85 ? "success" : m.rate >= 70 ? "warning" : "danger"}
                />
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {classStats
                    .filter((c) => c.major === m.id)
                    .map((c) => (
                      <span key={c.id} className="badge !text-[10px]" tone="neutral">
                        {c.name} · {c.rate}%
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="card xl:col-span-3 overflow-hidden animate-fade-up" style={{ animationDelay: "260ms" }}>
          <div className="flex items-center justify-between px-5 pt-5">
            <div>
              <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
                Today's check-ins
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                First students arriving right now
              </p>
            </div>
            <Link to="/attendance" className="btn btn-ghost h-9 px-3 text-xs gap-1">
              View all <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="px-2 pb-3 pt-3">
            {todayBoard.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-3)" }}>
                No check-ins recorded yet today.
              </p>
            ) : (
              todayBoard.map((s, i) => (
                <Link
                  to={`/students/${s.id}`}
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--surface-2)] animate-fade-up"
                  style={{ animationDelay: `${280 + i * 60}ms` }}
                >
                  <StudentAvatar student={s} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                      {s.firstName} {s.lastName}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
                      {classes.find((c) => c.id === s.className)?.name} · {s.studentId}
                    </p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: s.rec.status === "late" ? "var(--warning)" : "var(--success)" }}>
                    {s.rec.status === "late" ? <Clock3 size={14} /> : <UserRoundCheck size={14} />}
                    {s.rec.checkIn || s.rec.status}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="card p-5 xl:col-span-2 animate-fade-up" style={{ animationDelay: "320ms" }}>
          <div className="mb-4">
            <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
              Students by major
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
              Enrolled per major
            </p>
          </div>
          <div className="h-60" style={{ color: "var(--text-2)" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={majorStats} margin={{ top: 4, right: 0, bottom: 0, left: -18 }} barSize={26}>
                <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "var(--text-3)", fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip unit=" stud" />} cursor={{ fill: "var(--primary-soft)" }} />
                <Bar dataKey="count" name="Students" fill="#8b5cf6" radius={[6, 6, 0, 0]} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}