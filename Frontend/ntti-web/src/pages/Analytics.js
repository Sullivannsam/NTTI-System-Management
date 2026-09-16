import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Trophy,
  TrendingUp,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import PageHeader, { ProgressBar } from "../components/Page";
import StatCard from "../components/StatCard";
import { useApp } from "../context/AppContext";
import { CLASSES, addDays, todayISO, weekdayLabel, computeRate } from "../data/seed";
import { StudentAvatar } from "../components/Badge";

const PIE_COLORS = ["#10b981", "#f59e0b", "#ef4444", "#3b82f6"];
const PIE_KEYS = ["Present", "Late", "Absent", "On leave"];

function ChartTooltip({ active, payload, label, unit = "" }) {
  if (!active || !payload || !payload.length) return null;
  if (payload[0]?.payload?.payload) {
    const d = payload[0].payload.payload;
    return (
      <div className="chart-tooltip">
        <p className="font-semibold opacity-90">{d.name}</p>
        <div className="tl">
          <span className="chart-dot" style={{ background: d.color }} />
          <span className="opacity-80">Records: </span>
          <b className="tabular-nums">{d.value}</b>
        </div>
        <div className="tl">
          <span className="opacity-80">Share: </span>
          <b className="tabular-nums">{d.percent}%</b>
        </div>
      </div>
    );
  }
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

export default function Analytics() {
  const { students, attendance } = useApp();
  const today = todayISO();

  const distribution = useMemo(() => {
    const c = { Present: 0, Late: 0, Absent: 0, "On leave": 0 };
    attendance.forEach((a) => {
      if (a.status === "present") c.Present++;
      else if (a.status === "late") c.Late++;
      else if (a.status === "absent") c.Absent++;
      else c["On leave"]++;
    });
    const total = Object.values(c).reduce((a, b) => a + b, 0) || 1;
    return PIE_COLORS.map((color, i) => ({
      name: PIE_KEYS[i],
      value: c[PIE_KEYS[i]],
      color,
      percent: Math.round((c[PIE_KEYS[i]] / total) * 100),
    })).filter((d) => d.value > 0);
  }, [attendance]);

  const trend = useMemo(() => {
    return Array.from({ length: 21 }, (_, i) => {
      const date = addDays(today, -(20 - i));
      const recs = attendance.filter((a) => a.date === date);
      const marked = recs.length;
      const present = recs.filter((r) => r.status === "present" || r.status === "late").length;
      return {
        date: `${weekdayLabel(date)} ${date.slice(8)}`,
        Rate: marked ? Math.round((present / marked) * 100) : 0,
      };
    });
  }, [attendance, today]);

  const byClass = useMemo(() => {
    return CLASSES.map((c) => {
      const studs = students.filter((s) => s.className === c.id);
      const recs = attendance.filter((a) => studs.some((s) => s.id === a.studentId));
      const attended = recs.filter((r) => r.status === "present" || r.status === "late").length;
      return {
        name: c.name.length > 12 ? c.name.slice(0, 12) + "…" : c.name,
        Rate: recs.length ? Math.round((attended / recs.length) * 100) : 0,
        Students: studs.length,
      };
    });
  }, [students, attendance]);

  const ranked = useMemo(() => {
    return students
      .map((s) => ({ ...s, rate: computeRate(attendance.filter((a) => a.studentId === s.id)) }))
      .sort((a, b) => b.rate - a.rate);
  }, [students, attendance]);

  const top = ranked.slice(0, 5);
  const attention = ranked.filter((s) => s.rate < 75).slice(0, 5);
  const avg = Math.round(ranked.reduce((a, b) => a + b.rate, 0) / (ranked.length || 1));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="Aggregate insights across students, classes and attendance."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Average attendance" value={avg} suffix="%" icon={TrendingUp} tone="info" trend={{ up: true, value: 3 }} sub="this term" />
        <StatCard label="Students above 90%" value={ranked.filter((s) => s.rate >= 90).length} icon={Trophy} tone="success" sub={`of ${ranked.length}`} delay={70} />
        <StatCard label="Needs attention" value={attention.length} icon={AlertTriangle} tone="danger" sub="below 75% attendance" delay={140} />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="card p-5 xl:col-span-2 animate-fade-up" style={{ animationDelay: "120ms" }}>
          <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
            Attendance mix
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
            Distribution of all statuses
          </p>
          <div className="relative h-56 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={distribution} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={3} stroke="none" animationDuration={800}>
                  {distribution.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--text)" }}>
                  {distribution.find((d) => d.name === "Present")?.percent ?? 0}%
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-3)" }}>Present</p>
              </div>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {distribution.map((d) => (
              <div key={d.name} className="flex items-center gap-2 rounded-lg px-2.5 py-2" style={{ background: "var(--surface-2)" }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                <span className="text-xs font-medium flex-1 truncate" style={{ color: "var(--text-2)" }}>{d.name}</span>
                <span className="text-xs font-bold tabular-nums" style={{ color: "var(--text)" }}>{d.percent}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5 xl:col-span-3 animate-fade-up" style={{ animationDelay: "180ms" }}>
          <div className="mb-4">
            <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
              Daily attendance rate
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
              Percentage of students present · last 21 days
            </p>
          </div>
          <div className="h-64" style={{ color: "var(--text-2)" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 6, right: 4, bottom: 0, left: -14 }}>
                <defs>
                  <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "var(--text-3)", fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                <YAxis domain={[0, 100]} tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip content={<ChartTooltip unit="%" />} cursor={{ stroke: "var(--text-3)", strokeDasharray: "4 4" }} />
                <ReferenceLine y={90} stroke="var(--success)" strokeDasharray="6 6" />
                <Area type="monotone" dataKey="Rate" stroke="#6366f1" strokeWidth={2.5} fill="url(#rateGrad)" animationDuration={900} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-right text-[11px]" style={{ color: "var(--text-3)" }}>
            Dashed line = 90% target
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card p-5 animate-fade-up" style={{ animationDelay: "220ms" }}>
          <div className="mb-4">
            <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
              Attendance by class
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
              Average rate per class vs 90% target
            </p>
          </div>
          <div className="h-72" style={{ color: "var(--text-2)" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byClass} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }} barSize={18}>
                <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                <YAxis type="category" dataKey="name" tick={{ fill: "var(--text-2)", fontSize: 11 }} axisLine={false} tickLine={false} width={118} />
                <Tooltip content={<ChartTooltip unit="%" />} cursor={{ fill: "var(--primary-soft)" }} />
                <ReferenceLine x={90} stroke="var(--success)" strokeDasharray="6 6" />
                <Bar dataKey="Rate" name="Rate" radius={[0, 6, 6, 0]} animationDuration={900}>
                  {byClass.map((c, i) => (
                    <Cell key={i} fill={c.Rate >= 85 ? "#10b981" : c.Rate >= 70 ? "#f59e0b" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card overflow-hidden animate-fade-up" style={{ animationDelay: "260ms" }}>
            <div className="flex items-center justify-between px-5 pt-5">
              <div>
                <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
                  Top performers
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                  Best attendance this period
                </p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
                <Trophy size={18} />
              </span>
            </div>
            <div className="p-2 pt-3">
              {top.map((s, i) => (
                <Link key={s.id} to={`/students/${s.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--surface-2)]">
                  <span className="w-5 text-center text-sm font-bold tabular-nums" style={{ color: "var(--text-3)" }}>
                    {i + 1}
                  </span>
                  <StudentAvatar student={s} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                      {s.firstName} {s.lastName}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
                      {CLASSES.find((c) => c.id === s.className)?.name}
                    </p>
                  </div>
                  <span className="badge" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
                    {s.rate}%
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden animate-fade-up" style={{ animationDelay: "320ms" }}>
            <div className="flex items-center justify-between px-5 pt-5">
              <div>
                <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
                  Needs attention
                </h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                  Attendance below 75%
                </p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                <AlertTriangle size={18} />
              </span>
            </div>
            <div className="p-2 pt-3">
              {attention.length === 0 ? (
                <p className="px-4 py-6 text-sm text-center" style={{ color: "var(--text-3)" }}>
                  All students are above the threshold
                </p>
              ) : (
                attention.map((s) => (
                  <Link key={s.id} to={`/students/${s.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-[var(--surface-2)]">
                    <StudentAvatar student={s} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                        {s.firstName} {s.lastName}
                      </p>
                      <ProgressBar value={s.rate} tone="danger" className="mt-1.5 h-1.5" />
                    </div>
                    <span className="badge flex-none" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                      {s.rate}%
                    </span>
                    <ChevronRight size={15} style={{ color: "var(--text-3)" }} />
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}