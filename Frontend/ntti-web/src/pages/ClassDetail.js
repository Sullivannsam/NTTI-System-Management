import React, { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  UsersRound,
  Percent,
  CalendarCheck2,
  Pencil,
  Trash2,
  ExternalLink,
  UserRoundCheck,
  BookOpen,
  X,
} from "lucide-react";
import PageHeader, { EmptyState, ProgressBar } from "../components/Page";
import Modal from "../components/Modal";
import StudentFormModal from "../components/StudentFormModal";
import { useApp } from "../context/AppContext";
import { majorName, todayISO, computeRate, lastNWeeks, weekKeyOf, shiftRange } from "../data/seed";
import { StudentAvatar, Badge, statusTone } from "../components/Badge";

const MAJOR_ACCENT = {
  it: "linear-gradient(135deg,#6366f1,#8b5cf6)",
  el: "linear-gradient(135deg,#f59e0b,#f97316)",
  arc: "linear-gradient(135deg,#10b981,#14b8a6)",
};

const WEEK_STATUS = {
  present: { label: "Present", color: "var(--success)", soft: "var(--success-soft)" },
  late: { label: "Late", color: "var(--warning)", soft: "var(--warning-soft)" },
  absent: { label: "Absent", color: "var(--danger)", soft: "var(--danger-soft)" },
  leave: { label: "Permission", color: "var(--info)", soft: "var(--info-soft)" },
};

const CYCLE = ["", "present", "late", "absent", "leave"];

export default function ClassDetail() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { students, classes, weekly, saveWeekly, deleteStudent, showToast } = useApp();

  const cls = classes.find((c) => c.id === classId);
  const weeks = useMemo(() => lastNWeeks(15), []);
  const currentWeekKey = useMemo(() => weekKeyOf(todayISO()), []);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const weeklyOf = useMemo(() => {
    const map = {};
    weekly.forEach((r) => {
      (map[r.studentId] ||= {})[r.week] = r.status;
    });
    return map;
  }, [weekly]);

  const roster = useMemo(() => {
    return students
      .filter((s) => s.className === classId)
      .map((s) => ({
        ...s,
        rate: computeRate(weekly.filter((a) => a.studentId === s.id)),
        cells: weeks.map((w) => weeklyOf[s.id]?.[w.key] || ""),
      }))
      .filter((s) => {
        const q = query.trim().toLowerCase();
        const matchQ = !q || `${s.firstName} ${s.lastName} ${s.studentId}`.toLowerCase().includes(q);
        const matchS = statusFilter === "all" || s.status === statusFilter;
        return matchQ && matchS;
      });
  }, [students, weekly, weeklyOf, classId, query, statusFilter, weeks]);

  const stats = useMemo(() => {
    const all = students.filter((s) => s.className === classId);
    const thisWeek = weekly.filter(
      (a) => a.week === currentWeekKey && all.some((s) => s.id === a.studentId)
    );
    const present = thisWeek.filter((r) => r.status === "present").length;
    const avg = all.length
      ? Math.round(
          all.reduce(
            (acc, s) => acc + computeRate(weekly.filter((a) => a.studentId === s.id)),
            0
          ) / all.length
        )
      : 0;
    return { total: all.length, present, avg };
  }, [students, weekly, classId, currentWeekKey]);

  const cycle = (s, wk) => {
    const cur = weeklyOf[s.id]?.[wk.key] || "";
    const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
    saveWeekly([{ week: wk.key, studentId: s.id, status: next }]);
  };

  if (!cls) {
    return (
      <div>
        <PageHeader title="Class not found" />
        <div className="card">
          <EmptyState
            icon={BookOpen}
            title="Unknown class"
            subtitle="This class does not exist in the registry."
            action={
              <Link to="/students" className="btn btn-primary px-4 h-10">Back to classes</Link>
            }
          />
        </div>
      </div>
    );
  }

  const accent = MAJOR_ACCENT[cls.major] || MAJOR_ACCENT.it;

  return (
    <div>
      <button onClick={() => navigate("/students")} className="btn btn-ghost h-9 px-3 text-sm gap-1 mb-2 animate-fade-up">
        <ArrowLeft size={16} /> All classes
      </button>

      <div className="card overflow-hidden mb-6 animate-fade-up" style={{ animationDelay: "40ms" }}>
        <div className="h-20" style={{ background: accent }}>
          <div className="h-full w-full" style={{ backgroundImage: "radial-gradient(circle at 25% 40%, rgba(255,255,255,.18) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
        </div>
        <div className="p-6 -mt-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <span className="hidden sm:flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-soft shrink-0 ring-4" style={{ background: accent, "--tw-ring-color": "var(--surface)" }}>
              <BookOpen size={26} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold" style={{ color: "var(--text)" }}>{cls.name}</h2>
                <Badge tone="active">{majorName(cls.major)}</Badge>
                {cls.field && <Badge tone="neutral">{cls.field}</Badge>}
                <Badge tone="neutral">{cls.degree}</Badge>
              </div>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
                {stats.total} students · {cls.year} · {cls.semester} · {cls.shift} shift ({shiftRange(cls.shift)})
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => setAddOpen(true)} className="btn btn-primary h-10 px-4 text-sm">
              <UsersRound size={16} /> Add student
            </button>
            <Link to={`/attendance?class=${cls.id}`} className="btn btn-outline h-10 px-4 text-sm">
              <CalendarCheck2 size={16} /> Daily attendance
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-3">
        {[
          { label: "Students in class", value: stats.total, icon: UsersRound, bg: "var(--primary-soft)", fg: "var(--primary-strong)" },
          { label: "Present this week", value: stats.present, icon: UserRoundCheck, bg: "var(--success-soft)", fg: "var(--success)" },
          { label: "Class attendance rate", value: `${stats.avg}%`, icon: Percent, bg: "var(--info-soft)", fg: "var(--info)" },
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

      <div className="card overflow-hidden animate-fade-up" style={{ animationDelay: "200ms" }}>
        <div className="flex flex-wrap items-center gap-3 px-5 pt-5 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
              Class roster
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
              {roster.length} of {stats.total} students · weekly attendance (15 weeks)
            </p>
          </div>
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="relative sm:w-64">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="input pl-9 pr-8"
                placeholder={`Search ${cls.name} students…`}
              />
              {query && (
                <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost h-6 w-6 p-0 rounded-full" aria-label="Clear">
                  <X size={13} />
                </button>
              )}
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input sm:w-40">
              <option value="all">All statuses</option>
              <option>Learning</option>
              <option>Graduate</option>
              <option>Undergraduate</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
          {Object.entries(WEEK_STATUS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-2)" }}>
              <span className="h-2 w-2 rounded-full" style={{ background: v.color }} /> {v.label}
            </span>
          ))}
          <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
            Click a week cell to cycle Present → Late → Absent → Permission → clear
          </span>
        </div>

        {roster.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title="No students match"
            subtitle="Try a different search, clear the status filter, or add a new student to this class."
            action={
              <button onClick={() => setAddOpen(true)} className="btn btn-primary px-4 h-10">
                <UsersRound size={16} /> Add student
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto thin-scroll">
            <table className="table-w" style={{ minWidth: 1420 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 210 }}>Student</th>
                  <th>ID</th>
                  <th>Status</th>
                  <th style={{ minWidth: 130 }}>Attendance</th>
                  {weeks.map((w, i) => (
                    <th
                      key={w.key}
                      className="!p-1 text-center"
                      title={`Week ${i + 1}: ${w.range}`}
                    >
                      <span
                        className="block w-10 mx-auto rounded-lg px-1 py-1 text-[11px] font-bold"
                        style={
                          w.key === currentWeekKey
                            ? { background: "var(--primary)", color: "#fff" }
                            : { background: "var(--surface-2)", color: "var(--text-2)" }
                        }
                      >
                        W{i + 1}
                      </span>
                    </th>
                  ))}
                  <th className="text-right" style={{ minWidth: 140 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((s, i) => (
                  <tr key={s.id} style={{ animationDelay: `${i * 40}ms` }}>
                    <td>
                      <button
                        onClick={() => navigate(`/students/${s.id}`)}
                        className="flex items-center gap-3 text-left group"
                      >
                        <StudentAvatar student={s} size="md" />
                        <span>
                          <span className="block font-semibold text-[var(--text)] group-hover:text-[var(--primary-strong)] transition-colors">
                            {s.firstName} {s.lastName}
                          </span>
                          <span className="block text-[11px] text-[var(--text-3)]">{s.gender}</span>
                        </span>
                      </button>
                    </td>
                    <td className="tabular-nums whitespace-nowrap">{s.studentId}</td>
                    <td>
                      <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                    </td>
                    <td>
                      <div className="flex items-center gap-2 min-w-[110px]">
                        <ProgressBar
                          value={s.rate}
                          tone={s.rate >= 85 ? "success" : s.rate >= 70 ? "warning" : "danger"}
                          className="flex-1 h-1.5"
                        />
                        <span className="text-xs font-semibold tabular-nums w-9 text-right" style={{ color: "var(--text-2)" }}>
                          {s.rate}%
                        </span>
                      </div>
                    </td>
                    {weeks.map((w) => {
                      const st = weeklyOf[s.id]?.[w.key] || "";
                      const meta = WEEK_STATUS[st];
                      return (
                        <td key={w.key} className="!p-1 text-center">
                          <button
                            onClick={() => cycle(s, w)}
                            title={st ? `${meta.label} — ${w.range}` : `Mark ${w.range}`}
                            className="h-8 w-8 mx-auto rounded-lg border transition-all duration-150 flex items-center justify-center"
                            style={
                              meta
                                ? { background: meta.soft, borderColor: "transparent", boxShadow: "0 4px 10px -6px var(--text-2)" }
                                : { borderStyle: "dashed", borderColor: "var(--border)", background: "var(--surface-1)" }
                            }
                          >
                            {meta && <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />}
                          </button>
                        </td>
                      );
                    })}
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/students/${s.id}`)}
                          className="btn btn-ghost h-8 w-8 p-0 rounded-lg"
                          title="View profile"
                        >
                          <ExternalLink size={15} />
                        </button>
                        <button
                          onClick={() => navigate(`/attendance?class=${cls.id}`)}
                          className="btn btn-ghost h-8 w-8 p-0 rounded-lg text-[var(--primary-strong)]"
                          title="Daily attendance"
                        >
                          <CalendarCheck2 size={15} />
                        </button>
                        <button
                          onClick={() => setEditing(s)}
                          className="btn btn-ghost h-8 w-8 p-0 rounded-lg"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeleting(s)}
                          className="btn btn-ghost h-8 w-8 p-0 rounded-lg hover:!text-rose-500 hover:!bg-rose-50"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StudentFormModal
        open={addOpen || !!editing}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
        }}
        editing={editing}
        lockedClass={cls.id}
      />

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete student"
        footer={
          <>
            <button onClick={() => setDeleting(null)} className="btn btn-outline h-10 px-4 text-sm">Cancel</button>
            <button
              onClick={() => {
                deleteStudent(deleting.id);
                showToast(`${deleting.firstName} ${deleting.lastName} removed`, "error");
                setDeleting(null);
              }}
              className="btn h-10 px-5 text-sm text-white"
              style={{ background: "var(--danger)" }}
            >
              <Trash2 size={16} /> Delete
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
          Remove{" "}
          <b style={{ color: "var(--text)" }}>{deleting?.firstName} {deleting?.lastName}</b>{" "}
          from {cls.name}? Their attendance history will also be deleted. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}