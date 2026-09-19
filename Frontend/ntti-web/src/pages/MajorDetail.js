import React, { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Search, X, Code2, Cpu, Building2, UsersRound, BookOpen, CalendarRange, Percent, ChevronRight, ExternalLink } from "lucide-react";
import PageHeader, { EmptyState, ProgressBar } from "../components/Page";
import { useApp } from "../context/AppContext";
import { MAJORS, classesOfMajor, computeRate, shiftRange } from "../data/seed";
import { StudentAvatar, Badge, statusTone } from "../components/Badge";

const MAJOR_META = {
  it: { icon: Code2, color: "#6366f1", soft: "var(--primary-soft)", fg: "var(--primary-strong)" },
  el: { icon: Cpu, color: "#f59e0b", soft: "var(--warning-soft)", fg: "var(--warning)" },
  arc: { icon: Building2, color: "#10b981", soft: "var(--success-soft)", fg: "var(--success)" },
};

const rateTone = (r) => (r >= 85 ? "success" : r >= 70 ? "warning" : "danger");

export default function MajorDetail() {
  const { majorId } = useParams();
  const navigate = useNavigate();
  const { students, classes, attendance } = useApp();

  const [classQuery, setClassQuery] = useState("");
  const [studentQuery, setStudentQuery] = useState("");

  const major = MAJORS.find((m) => m.id === majorId);
  const meta = MAJOR_META[majorId] || MAJOR_META.it;
  const Icon = meta.icon;

  const rateById = useMemo(() => {
    const map = {};
    students.forEach((s) => {
      map[s.id] = computeRate(attendance.filter((a) => a.studentId === s.id));
    });
    return map;
  }, [students, attendance]);

  const classStats = useMemo(() => {
    return classesOfMajor(classes, majorId).map((c) => {
      const studs = students.filter((s) => s.className === c.id);
      return {
        ...c,
        count: studs.length,
        rate: studs.length
          ? Math.round(studs.reduce((acc, s) => acc + rateById[s.id], 0) / studs.length)
          : 0,
      };
    });
  }, [classes, majorId, students, rateById]);

  const classesShown = useMemo(() => {
    const q = classQuery.trim().toLowerCase();
    return classStats.filter((c) => !q || c.name.toLowerCase().includes(q) || c.degree.toLowerCase().includes(q));
  }, [classStats, classQuery]);

  const studentsShown = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    return students
      .filter((s) => s.major === majorId)
      .map((s) => ({ ...s, rate: rateById[s.id] }))
      .filter((s) => !q || `${s.firstName} ${s.lastName} ${s.studentId}`.toLowerCase().includes(q));
  }, [students, majorId, rateById, studentQuery]);

  if (!major) {
    return (
      <div>
        <PageHeader title="Major not found" />
        <div className="card">
          <EmptyState
            icon={BookOpen}
            title="Unknown major"
            subtitle="This major does not exist in the registry."
            action={<Link to="/students" className="btn btn-primary px-4 h-10">Back to students</Link>}
          />
        </div>
      </div>
    );
  }

  const avg =
    studentsShown.length
      ? Math.round(
          students
            .filter((s) => s.major === majorId)
            .reduce((acc, s) => acc + rateById[s.id], 0) /
            students.filter((s) => s.major === majorId).length
        )
      : 0;

  return (
    <div>
      <button onClick={() => navigate("/students")} className="btn btn-ghost h-9 px-3 text-sm gap-1 mb-2 animate-fade-up">
        <ArrowLeft size={16} /> All majors
      </button>

      <div className="card overflow-hidden mb-6 animate-fade-up" style={{ animationDelay: "40ms" }}>
        <div className="h-20" style={{ background: `linear-gradient(135deg, ${meta.color}, #00000022)` }}>
          <div className="h-full w-full" style={{ backgroundImage: "radial-gradient(circle at 25% 40%, rgba(255,255,255,.18) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
        </div>
        <div className="p-6 -mt-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <span className="hidden sm:flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-soft shrink-0 ring-4" style={{ background: meta.color, "--tw-ring-color": "var(--surface)" }}>
              <Icon size={26} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold" style={{ color: "var(--text)" }}>{major.name}</h2>
                <Badge tone="neutral">{classStats.length} classes</Badge>
              </div>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
                {students.filter((s) => s.major === majorId).length} students · {classStats.length} tracks
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-3">
        {[
          { label: "Classes", value: classStats.length, icon: CalendarRange, bg: "var(--primary-soft)", fg: "var(--primary-strong)" },
          { label: "Students", value: students.filter((s) => s.major === majorId).length, icon: UsersRound, bg: "var(--success-soft)", fg: "var(--success)" },
          { label: "Average attendance", value: `${avg}%`, icon: Percent, bg: "var(--info-soft)", fg: "var(--info)" },
        ].map((s, i) => (
          <div key={i} className="card p-4 flex items-center gap-3 animate-fade-up" style={{ animationDelay: `${100 + i * 60}ms` }}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: s.bg, color: s.fg }}>
              <s.icon size={18} />
            </span>
            <div>
              <p className="text-xl font-bold tabular-nums leading-none" style={{ color: "var(--text)" }}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden mb-6 animate-fade-up" style={{ animationDelay: "160ms" }}>
        <div className="flex flex-wrap items-center gap-3 px-5 pt-5 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <h3 className="text-sm font-bold" style={{ color: "var(--text)" }}>Classes · {major.name}</h3>
            <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
              {classesShown.length} of {classStats.length} classes
            </p>
          </div>
          <div className="relative sm:ml-auto sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
            <input
              value={classQuery}
              onChange={(e) => setClassQuery(e.target.value)}
              className="input pl-9 pr-8"
              placeholder="Search classes…"
            />
            {classQuery && (
              <button onClick={() => setClassQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost h-6 w-6 p-0 rounded-full" aria-label="Clear">
                <X size={13} />
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto thin-scroll">
          <table className="table-w" style={{ minWidth: 1120 }}>
            <thead>
              <tr>
                <th>Class</th>
                <th>Field</th>
                <th>Year</th>
                <th>Semester</th>
                <th>Degree</th>
                <th>Shift</th>
                <th>Students</th>
                <th>Attendance</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {classesShown.map((c, i) => (
                <tr key={c.id} className="cursor-pointer" style={{ animationDelay: `${i * 40}ms` }} onClick={() => navigate(`/classes/${c.id}`)}>
                  <td>
                    <span className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: meta.color }} />
                      <span className="font-semibold whitespace-nowrap" style={{ color: "var(--text)" }}>{c.name}</span>
                    </span>
                  </td>
                  <td style={{ color: "var(--text-2)" }}>{c.field || "—"}</td>
                  <td style={{ color: "var(--text-2)" }}>{c.year}</td>
                  <td style={{ color: "var(--text-2)" }}>{c.semester}</td>
                  <td><Badge tone={c.degree === "Bachelor" || c.degree === "Master" ? "active" : "neutral"}>{c.degree}</Badge></td>
                  <td>
                    <span className="block font-medium" style={{ color: "var(--text-2)" }}>{c.shift}</span>
                    <span className="block text-[10px]" style={{ color: "var(--text-3)" }}>{shiftRange(c.shift)}</span>
                  </td>
                  <td className="tabular-nums">{c.count}</td>
                  <td>
                    <span className="flex items-center gap-2.5 min-w-[120px]">
                      <ProgressBar value={c.rate} tone={rateTone(c.rate)} className="flex-1" />
                      <span className="text-xs font-semibold tabular-nums w-9 text-right" style={{ color: "var(--text-2)" }}>{c.rate}%</span>
                    </span>
                  </td>
                  <td className="text-right">
                    <ExternalLink
                      size={15}
                      style={{ color: "var(--text-3)", cursor: "pointer" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/classes/${c.id}`);
                      }}
                    />
                  </td>
                </tr>
              ))}
              {classesShown.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <EmptyState icon={Search} title="No classes match" subtitle="Try a different class search." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card overflow-hidden animate-fade-up" style={{ animationDelay: "220ms" }}>
        <div className="flex flex-wrap items-center gap-3 px-5 pt-5 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <h3 className="text-sm font-bold" style={{ color: "var(--text)" }}>Students · {major.name}</h3>
            <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
              {studentsShown.length} of {students.filter((s) => s.major === majorId).length} students
            </p>
          </div>
          <div className="relative sm:ml-auto sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
            <input
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              className="input pl-9 pr-8"
              placeholder="Search students…"
            />
            {studentQuery && (
              <button onClick={() => setStudentQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost h-6 w-6 p-0 rounded-full" aria-label="Clear">
                <X size={13} />
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto thin-scroll">
          <table className="table-w" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Student</th>
                <th>ID</th>
                <th>Class</th>
                <th>Status</th>
                <th>Attendance</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {studentsShown.map((s, i) => (
                <tr key={s.id} className="cursor-pointer" style={{ animationDelay: `${i * 25}ms` }} onClick={() => navigate(`/students/${s.id}`)}>
                  <td>
                    <span className="flex items-center gap-3">
                      <StudentAvatar student={s} size="md" />
                      <span>
                        <span className="block font-semibold" style={{ color: "var(--text)" }}>
                          {s.firstName} {s.lastName}
                        </span>
                        <span className="block text-[11px]" style={{ color: "var(--text-3)" }}>{s.gender}</span>
                      </span>
                    </span>
                  </td>
                  <td className="tabular-nums">{s.studentId}</td>
                  <td>{classes.find((c) => c.id === s.className)?.name || "—"}</td>
                  <td><Badge tone={statusTone(s.status)}>{s.status}</Badge></td>
                  <td>
                    <span className="flex items-center gap-2.5 min-w-[120px]">
                      <ProgressBar value={s.rate} tone={rateTone(s.rate)} className="flex-1 h-1.5" />
                      <span className="text-xs font-semibold tabular-nums w-9 text-right" style={{ color: "var(--text-2)" }}>{s.rate}%</span>
                    </span>
                  </td>
                  <td className="text-right">
                    <ChevronRight size={16} className="inline" style={{ color: "var(--text-3)" }} />
                  </td>
                </tr>
              ))}
              {studentsShown.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState icon={UsersRound} title="No students found" subtitle="No students in this major match your search." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}