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
  History,
  Flag,
  UserPlus,
} from "lucide-react";
import PageHeader, { EmptyState, ProgressBar } from "../components/Page";
import Modal from "../components/Modal";
import StudentFormModal from "../components/StudentFormModal";
import StudentImportModal from "../components/StudentImportModal";
import ImportStudentChooser from "../components/ImportStudentChooser";
import TermRecordModal from "../components/TermRecordModal";
import NextSemesterModal from "../components/NextSemesterModal";
import { useApp } from "../context/AppContext";
import { majorName, computeRate, lastNWeeks, shiftRange, prettyDate, levelsForMajor } from "../data/seed";
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

export default function ClassDetail() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { students, classes, attendance, deleteStudent, removeFromClass, endClassTerm, importStudents, addStudentsBatch, showToast } = useApp();

  const cls = classes.find((c) => c.id === classId);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [record, setRecord] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importQuery, setImportQuery] = useState("");
  const [importSel, setImportSel] = useState([]);
  const [importScope, setImportScope] = useState("prev");
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [excelOpen, setExcelOpen] = useState(false);

  const roster = useMemo(() => {
    return students
      .filter((s) => s.className === classId)
      .map((s) => ({
        ...s,
        rate: computeRate(attendance.filter((a) => a.studentId === s.id)),
      }))
      .filter((s) => {
        const q = query.trim().toLowerCase();
        const matchQ = !q || `${s.firstName} ${s.lastName} ${s.studentId}`.toLowerCase().includes(q);
        const matchS = statusFilter === "all" || s.status === statusFilter;
        return matchQ && matchS;
      });
  }, [students, attendance, classId, query, statusFilter]);

  const candidates = useMemo(() => {
    const c = classes.find((x) => x.id === classId);
    const levels = levelsForMajor(c?.major);
    const yr = String(c?.year || "").match(/\d+/)?.[0] || "1";
    const sem = String(c?.semester || "").match(/\d+/)?.[0] || "1";
    const cur = `S${sem}Y${yr}`;
    const idx = levels.indexOf(cur);
    const prev = idx > 0 ? levels[idx - 1] : null;
    const norm = (v) => String(v || "").trim().toLowerCase();
    const sameMajor = (s) => !c?.major || norm(s.major) === norm(c.major);
    const sameField = (s) => !c?.field || norm(s.field) === norm(c.field);
    const sameProgramme = (s) => sameMajor(s) && sameField(s);
    const q = importQuery.trim().toLowerCase();
    return students
      .filter((s) => s.className !== classId)
      .filter((s) => (importScope === "all" ? true : !prev ? sameProgramme(s) : s.level === prev && sameProgramme(s)))
      .filter(
        (s) =>
          !q ||
          `${s.firstName} ${s.lastName} ${s.khmerName || ""} ${s.studentId || ""} ${s.username || ""}`
            .toLowerCase()
            .includes(q)
      )
      .sort((a, b) => {
        const score = (s) => {
          let v = 0;
          if (s.level === prev) v -= 4;
          if (sameMajor(s)) v -= 2;
          if (sameField(s)) v -= 1;
          return v;
        };
        return score(a) - score(b) || String(a.studentId || "").localeCompare(String(b.studentId || ""), undefined, { numeric: true });
      });
  }, [students, classes, classId, importQuery, importScope]);

  const stats = useMemo(() => {
    const all = students.filter((s) => s.className === classId);
    const ids = new Set(all.map((s) => s.id));
    const wk = lastNWeeks(1)[0];
    const thisWeek = attendance.filter(
      (a) => ids.has(a.studentId) && a.date >= wk.start && a.date <= wk.end
    );
    const present = thisWeek.filter((r) => r.status === "present").length;
    const avg = all.length
      ? Math.round(
          all.reduce(
            (acc, s) => acc + computeRate(attendance.filter((a) => a.studentId === s.id)),
            0
          ) / all.length
        )
      : 0;
    return { total: all.length, present, avg };
  }, [students, attendance, classId]);

  /* "Import students" chooser → Excel file directly into this class */
  const onExcelImport = (rows, stats = {}) => {
    if (rows?.length) addStudentsBatch(rows);
    if (stats.linkIds?.length) importStudents(cls?.id, stats.linkIds);
    setExcelOpen(false);
    const total = (rows?.length || 0) + (stats.linkIds?.length || 0);
    showToast(
      total
        ? `${total} student${total === 1 ? "" : "s"} added to ${cls?.name} from Excel`
        : "No new students to import"
    );
  };

  const openSelectImport = () => {
    setImportMenuOpen(false);
    setImportSel([]);
    setImportQuery("");
    setImportScope("all");
    setImportOpen(true);
  };

  const openExcelImport = () => {
    setImportMenuOpen(false);
    setExcelOpen(true);
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
  const classYear = String(cls.year || "").match(/\d+/)?.[0] || "1";
  const classSem = String(cls.semester || "").match(/\d+/)?.[0] || "1";
  const currentLevel = `S${classSem}Y${classYear}`;
  const classLevels = levelsForMajor(cls.major);
  const ci = classLevels.indexOf(currentLevel);
  const nextLevelCode = ci >= 0 && ci < classLevels.length - 1 ? classLevels[ci + 1] : null;
  const prevLevelCode = ci > 0 ? classLevels[ci - 1] : null;
  /* S1Y1 is the intake — students are added, not imported. From S2Y1 on,
     students are imported from the previous semester. */
  const canImport = currentLevel !== "S1Y1";
  const termRecords = [...(cls.terms || [])].sort((a, b) =>
    String(b.endedOn || "").localeCompare(String(a.endedOn || ""))
  );
  const finishedLevels = new Set(termRecords.map((t) => t.level));

  return (
    <div>
      <button onClick={() => navigate("/classes")} className="btn btn-ghost h-9 px-3 text-sm gap-1 mb-2 animate-fade-up">
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
            <button onClick={() => setImportMenuOpen(true)} className="btn btn-outline h-10 px-4 text-sm">
              <UserPlus size={16} /> Import students
            </button>
            {canImport && (
              <button
                onClick={() => {
                  setImportSel([]);
                  setImportQuery("");
                  setImportScope("prev");
                  setImportOpen(true);
                }}
                className="btn btn-outline h-10 px-4 text-sm"
              >
                <UserPlus size={16} /> Import from {prevLevelCode}
              </button>
            )}
            <Link to={`/attendance?class=${cls.id}`} className="btn btn-outline h-10 px-4 text-sm">
              <CalendarCheck2 size={16} /> Attendance
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
              {roster.length} of {stats.total} students · attendance by day
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
          <Link to={`/attendance?class=${cls.id}`} className="text-[11px] font-semibold ml-auto" style={{ color: "var(--primary-strong)" }}>
            Mark attendance →
          </Link>
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
            <table className="table-w" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 210 }}>Student</th>
                  <th>ID</th>
                  <th>Status</th>
                  <th style={{ minWidth: 200 }}>Attendance</th>
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
                            {s.khmerName || `${s.firstName} ${s.lastName}`}
                          </span>
                          <span className="block text-[11px] text-[var(--text-3)]">
                            {s.khmerName ? `${s.firstName} ${s.lastName}` : s.gender}
                          </span>
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
                          title="Attendance"
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

      {/* term archive */}
      <div className="card overflow-hidden mt-6 animate-fade-up" style={{ animationDelay: "260ms" }}>
        <div className="flex flex-wrap items-center gap-3 px-5 pt-5 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--primary-soft)", color: "var(--primary-strong)" }}>
            <History size={18} />
          </span>
          <div>
            <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>Terms &amp; records</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
              Finished semesters are archived here so you can look back after the class moves on.
            </p>
          </div>
          <button
            onClick={() => setEndOpen(true)}
            disabled={cls.completed || !nextLevelCode}
            title={
              cls.completed
                ? "This class has completed its programme"
                : !nextLevelCode
                ? "No next semester is available for this class — nothing to advance to"
                : "Archive this term and open the next semester"
            }
            className="ml-auto btn btn-outline h-10 px-4 text-sm gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Flag size={16} />
            {cls.completed ? "Programme complete" : nextLevelCode ? `Next semester · ${nextLevelCode}` : "No next semester"}
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-3)" }}>
            Programme timeline · {classLevels.length / 2} years
          </p>
          <div className="flex items-center gap-1 overflow-x-auto thin-scroll pb-3 mb-1">
            {classLevels.map((lvl, i) => {
              const done = finishedLevels.has(lvl);
              const isCur = !cls.completed && lvl === currentLevel;
              const label = done ? "finished" : isCur ? "present" : "not yet";
              return (
                <div key={lvl} className="flex shrink-0 items-center gap-1">
                  <div
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 whitespace-nowrap text-[11px] font-bold"
                    style={{
                      background: done ? "var(--success-soft)" : isCur ? "var(--primary-strong)" : "var(--surface-2)",
                      color: done ? "var(--success)" : isCur ? "#fff" : "var(--text-3)",
                      border: done || isCur ? "none" : "1px solid var(--border)",
                    }}
                  >
                    {lvl}
                    <span className="font-semibold opacity-80">{label}</span>
                  </div>
                  {i < classLevels.length - 1 && (
                    <span className="h-px w-3.5 shrink-0" style={{ background: "var(--border)" }} />
                  )}
                </div>
              );
            })}
          </div>

          {termRecords.length === 0 ? (
            <p className="text-sm py-3" style={{ color: "var(--text-3)" }}>
              No terms archived yet. When you end a semester, every student&apos;s scores and attendance are saved here — captured automatically, even without pressing Save.
            </p>
          ) : (
            termRecords.map((t, i) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3"
                style={{ borderTop: i ? "1px solid var(--border)" : "none" }}
              >
                <div className="min-w-[150px]">
                  <p className="font-semibold text-sm" style={{ color: "var(--text)" }}>{t.level}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-3)" }}>{t.semester} · {t.year}</p>
                </div>
                <span className="text-xs" style={{ color: "var(--text-2)" }}>Ended {prettyDate(t.endedOn)}</span>
                <span className="text-xs" style={{ color: "var(--text-2)" }}>{t.classSize ?? (t.rows || []).length} students</span>
                <span className="text-xs" style={{ color: "var(--text-2)" }}>
                  Class average <b style={{ color: "var(--text)" }}>{t.classAvg == null ? "—" : t.classAvg.toFixed(2)}</b>
                </span>
                <button
                  onClick={() => setRecord(t)}
                  className="ml-auto btn btn-ghost h-9 px-3 text-sm gap-1.5 text-[var(--primary-strong)]"
                >
                  <ExternalLink size={15} /> View record
                </button>
              </div>
            ))
          )}
        </div>
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

      <NextSemesterModal
        open={endOpen}
        onClose={() => setEndOpen(false)}
        cls={cls}
        students={students}
        currentLevel={currentLevel}
        nextLevelCode={nextLevelCode}
        onConfirm={(advanceIds) => {
          const term = endClassTerm(cls.id, { advanceIds });
          setEndOpen(false);
          showToast(
            nextLevelCode
              ? `${currentLevel} finished · ${cls.name} is now ${nextLevelCode}`
              : `${currentLevel} finished · ${cls.name} programme complete`
          );
          if (term) setRecord(term);
        }}
      />

      <TermRecordModal term={record} onClose={() => setRecord(null)} attendance={attendance} />

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Remove student"
        subtitle={deleting ? `${deleting.firstName} ${deleting.lastName} · ${cls.name}` : ""}
        footer={
          <>
            <button onClick={() => setDeleting(null)} className="btn btn-outline h-10 px-4 text-sm">Cancel</button>
            <button
              onClick={() => {
                if (deleting) deleteStudent(deleting.id);
                setDeleting(null);
              }}
              className="btn h-10 px-4 text-sm"
              style={{ color: "var(--danger)" }}
              title="Delete the student permanently"
            >
              <Trash2 size={15} /> Delete permanently
            </button>
            <button
              onClick={() => {
                if (deleting) removeFromClass(cls.id, deleting.id);
                setDeleting(null);
              }}
              className="btn h-10 px-4 text-sm"
              style={{ background: "var(--danger)", color: "#fff" }}
            >
              <Trash2 size={15} /> Remove from class
            </button>
          </>
        }
      >
        <div className="space-y-2 text-sm" style={{ color: "var(--text-2)" }}>
          <p>
            <b style={{ color: "var(--text)" }}>Remove from class</b> keeps the student and their past records. They return to{" "}
            <b style={{ color: "var(--text)" }}>{prevLevelCode || currentLevel}</b> with no class, so you can import them again.
          </p>
          <p className="text-xs" style={{ color: "var(--text-3)" }}>
            <b>Delete permanently</b> erases the student and all of their attendance. This cannot be undone.
          </p>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        size="lg"
        title="Import students"
        subtitle={
          importScope === "all" || !prevLevelCode
            ? `Pick students to add to ${cls.name} (${currentLevel} · ${cls.year} ${cls.semester})`
            : `Import ${prevLevelCode} students into ${cls.name} (now ${currentLevel})`
        }
        footer={
          <>
            <button onClick={() => setImportOpen(false)} className="btn btn-outline h-10 px-4 text-sm">
              Cancel
            </button>
            <button
              onClick={() => {
                const n = importStudents(cls.id, importSel);
                setImportOpen(false);
                showToast(
                  n ? `${n} student${n === 1 ? "" : "s"} imported into ${cls.name}` : "No students selected"
                );
              }}
              disabled={importSel.length === 0}
              className="btn btn-primary h-10 px-5 text-sm gap-1.5 disabled:opacity-50"
            >
              <UserPlus size={16} /> Import{importSel.length ? ` ${importSel.length}` : ""}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
              <input
                value={importQuery}
                onChange={(e) => setImportQuery(e.target.value)}
                className="input pl-9"
                placeholder="Search students not in this class…"
              />
            </div>
            <button
              onClick={() =>
                setImportSel((sel) => (sel.length === candidates.length ? [] : candidates.map((s) => s.id)))
              }
              disabled={candidates.length === 0}
              className="btn btn-outline h-10 px-3 text-sm disabled:opacity-50"
            >
              {candidates.length > 0 && importSel.length === candidates.length ? "Clear all" : "Select all"}
            </button>
          </div>

          {prevLevelCode && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span style={{ color: "var(--text-3)" }}>Import from</span>
              <button
                onClick={() => { setImportScope("prev"); setImportSel([]); }}
                className="rounded-lg border px-2.5 py-1 text-xs font-semibold transition"
                style={
                  importScope === "prev"
                    ? { background: "var(--primary)", color: "#fff", borderColor: "var(--primary)" }
                    : { background: "var(--surface)", color: "var(--text-2)", borderColor: "var(--border)" }
                }
              >
                {prevLevelCode}
              </button>
              <button
                onClick={() => { setImportScope("all"); setImportSel([]); }}
                className="rounded-lg border px-2.5 py-1 text-xs font-semibold transition"
                style={
                  importScope === "all"
                    ? { background: "var(--primary)", color: "#fff", borderColor: "var(--primary)" }
                    : { background: "var(--surface)", color: "var(--text-2)", borderColor: "var(--border)" }
                }
              >
                All students
              </button>
              <span className="ml-1" style={{ color: "var(--text-3)" }}>
                matching {majorName(cls.major)}{cls.field ? ` · ${cls.field}` : ""}
              </span>
            </div>
          )}

          {candidates.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: "var(--text-3)" }}>
              {importScope === "prev" && prevLevelCode
                ? `No ${prevLevelCode} students match ${majorName(cls.major)}${cls.field ? ` · ${cls.field}` : ""}. Switch to “All students” for other programmes.`
                : "No students available to import."}
            </p>
          ) : (
            <div className="max-h-[46vh] overflow-y-auto thin-scroll rounded-xl border" style={{ borderColor: "var(--border)" }}>
              {candidates.map((s, idx) => {
                const on = importSel.includes(s.id);
                const cur = classes.find((c) => c.id === s.className);
                return (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm"
                    style={{ borderTop: idx ? "1px solid var(--border)" : "none" }}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setImportSel((sel) => (on ? sel.filter((x) => x !== s.id) : [...sel, s.id]))
                      }
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    <StudentAvatar student={s} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold" style={{ color: "var(--text)" }}>
                        {s.khmerName || `${s.firstName} ${s.lastName}`}
                      </span>
                      <span className="block truncate text-[11px]" style={{ color: "var(--text-3)" }}>
                        {s.khmerName ? `${s.firstName} ${s.lastName} · ` : ""}
                        {s.studentId}
                        {s.level ? ` · ${s.level}` : ""}
                        {` · ${majorName(s.major)}`}
                        {s.field ? ` · ${s.field}` : ""}
                        {cur ? ` · in ${cur.name}` : " · no class"}
                      </span>
                    </span>
                    <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* "Import students" chooser — Excel file or pick from the registry */}
      <ImportStudentChooser
        open={importMenuOpen}
        onClose={() => setImportMenuOpen(false)}
        onExcel={openExcelImport}
        onSelect={openSelectImport}
        className={cls.name}
      />
      <StudentImportModal
        open={excelOpen}
        onClose={() => setExcelOpen(false)}
        classes={classes}
        existing={students}
        lockedClass={cls}
        onImport={onExcelImport}
      />
    </div>
  );
}