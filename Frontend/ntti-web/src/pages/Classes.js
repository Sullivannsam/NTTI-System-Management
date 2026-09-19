import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Plus,
  UsersRound,
  Pencil,
  Trash2,
  ExternalLink,
  CalendarCheck2,
  BookOpen,
  X,
  UserRoundPlus,
  ArrowLeft,
  ChevronRight,
  History,
  Flag,
  UserPlus,
} from "lucide-react";
import PageHeader, { EmptyState } from "../components/Page";
import Modal from "../components/Modal";
import ClassFormModal from "../components/ClassFormModal";
import StudentFormModal from "../components/StudentFormModal";
import TermRecordModal from "../components/TermRecordModal";
import NextSemesterModal from "../components/NextSemesterModal";
import { useApp } from "../context/AppContext";
import { majorName, shiftRange, prettyDate, levelsForMajor } from "../data/seed";
import { StudentAvatar, Badge, statusTone } from "../components/Badge";

const ACCENT = {
  it: "linear-gradient(135deg,#6366f1,#8b5cf6)",
  el: "linear-gradient(135deg,#f59e0b,#f97316)",
  arc: "linear-gradient(135deg,#10b981,#14b8a6)",
};

export default function Classes() {
  const { classes, students, attendance, deleteStudent, removeFromClass, endClassTerm, importStudents, showToast } = useApp();

  const [view, setView] = useState("list"); // "list" | "detail"
  const [selId, setSelId] = useState(null);

  const [classQuery, setClassQuery] = useState("");
  const [studentQuery, setStudentQuery] = useState("");

  const [addClassOpen, setAddClassOpen] = useState(false);
  const [editClass, setEditClass] = useState(null);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [editStudent, setEditStudent] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [endOpen, setEndOpen] = useState(false);
  const [recordTerm, setRecordTerm] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importQuery, setImportQuery] = useState("");
  const [importSel, setImportSel] = useState([]);
  const [importScope, setImportScope] = useState("prev");

  const sel = classes.find((c) => c.id === selId) || null;

  const countOf = (clsId) => students.filter((s) => s.className === clsId).length;

  /* top search: classes + students (name / ID / username) */
  const q = classQuery.trim().toLowerCase();
  const filteredClasses = useMemo(() => {
    if (!q) return classes;
    return classes.filter(
      (c) =>
        `${c.name} ${majorName(c.major)} ${c.field || ""} ${c.shift || ""}`
          .toLowerCase()
          .includes(q)
    );
  }, [classes, q]);

  const studentMatches = useMemo(() => {
    if (!q) return [];
    return students
      .filter((s) =>
        `${s.firstName} ${s.lastName} ${s.khmerName || ""} ${s.studentId || ""} ${s.username || ""}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 8);
  }, [students, q]);

  /* roster of the selected class */
  const roster = useMemo(() => {
    if (!sel) return [];
    const sq = studentQuery.trim().toLowerCase();
    return students
      .filter((s) => s.className === sel.id)
      .filter((s) =>
        !sq ||
        `${s.firstName} ${s.lastName} ${s.khmerName || ""} ${s.studentId || ""} ${s.username || ""}`
          .toLowerCase()
          .includes(sq)
      )
      .sort((a, b) => String(a.studentId || "").localeCompare(String(b.studentId || "")));
  }, [students, sel, studentQuery]);

  /* students available to import into the selected class — by default only
     those who match the class's MAJOR + FIELD and are at the previous semester
     (e.g. IT/Cyber S1Y1 → IT/Cyber S2Y1). S1Y1 itself has no previous level,
     so new students are simply added there. */
  const importCandidates = useMemo(() => {
    const s = classes.find((c) => c.id === selId);
    const levels = levelsForMajor(s?.major);
    const yr = String(s?.year || "").match(/\d+/)?.[0] || "1";
    const sem = String(s?.semester || "").match(/\d+/)?.[0] || "1";
    const cur = `S${sem}Y${yr}`;
    const idx = levels.indexOf(cur);
    const prev = idx > 0 ? levels[idx - 1] : null;
    const norm = (v) => String(v || "").trim().toLowerCase();
    const sameMajor = (st) => !s?.major || norm(st.major) === norm(s.major);
    const sameField = (st) => !s?.field || norm(st.field) === norm(s.field);
    const sameProgramme = (st) => sameMajor(st) && sameField(st);
    const iq = importQuery.trim().toLowerCase();
    return students
      .filter((st) => st.className !== selId)
      .filter((st) =>
        importScope === "all" ? true : !prev ? sameProgramme(st) : st.level === prev && sameProgramme(st)
      )
      .filter(
        (st) =>
          !iq ||
          `${st.firstName} ${st.lastName} ${st.khmerName || ""} ${st.studentId || ""} ${st.username || ""}`
            .toLowerCase()
            .includes(iq)
      )
      .sort((a, b) => {
        const score = (st) => {
          let v = 0;
          if (st.level === prev) v -= 4;
          if (sameMajor(st)) v -= 2;
          if (sameField(st)) v -= 1;
          return v;
        };
        return score(a) - score(b) || String(a.studentId || "").localeCompare(String(b.studentId || ""), undefined, { numeric: true });
      });
  }, [students, selId, importQuery, importScope, classes]);

  const openClass = (id, focusStudent) => {
    setSelId(id);
    setStudentQuery(focusStudent || "");
    setView("detail");
  };

  const accent = sel?.major ? (ACCENT[sel.major] || ACCENT.it) : ACCENT.it;

  /* current / next semester for the selected class + its finished-term archive */
  const classYear = String(sel?.year || "").match(/\d+/)?.[0] || "1";
  const classSem = String(sel?.semester || "").match(/\d+/)?.[0] || "1";
  const currentLevel = `S${classSem}Y${classYear}`;
  const classLevels = levelsForMajor(sel?.major);
  const ci = classLevels.indexOf(currentLevel);
  const nextLevelCode = ci >= 0 && ci < classLevels.length - 1 ? classLevels[ci + 1] : null;
  const prevLevelCode = ci > 0 ? classLevels[ci - 1] : null;
  /* S1Y1 is the intake — students are added, not imported. From S2Y1 on,
     students are imported from the previous semester. */
  const canImport = currentLevel !== "S1Y1";
  const termRecords = [...(sel?.terms || [])].sort((a, b) =>
    String(b.endedOn || "").localeCompare(String(a.endedOn || ""))
  );
  const finishedLevels = new Set(termRecords.map((t) => t.level));

  /* ══════════════════════ LIST VIEW ══════════════════════ */
  const listView = (
    <>
      <PageHeader
        title="Classes"
        subtitle="All classes · click a class to see its students, rename it, or add new students. Classes you create show up on the Attendance page."
        actions={
          <button onClick={() => setAddClassOpen(true)} className="btn btn-primary h-10 px-4 text-sm">
            <Plus size={16} /> New class
          </button>
        }
      />

      {/* global search — classes + students */}
      <div className="card p-4 mb-5 animate-fade-up">
        <div className="relative w-full sm:max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
          <input
            value={classQuery}
            onChange={(e) => setClassQuery(e.target.value)}
            className="input pl-9 pr-8"
            placeholder="Search class or student…"
          />
          {classQuery && (
            <button
              onClick={() => setClassQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost h-6 w-6 p-0 rounded-full"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {studentMatches.length > 0 && (
          <div className="mt-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
              Students
            </p>
            <div className="flex flex-wrap gap-2">
              {studentMatches.map((s) => (
                <button
                  key={s.id}
                  onClick={() =>
                    openClass(s.className, `${s.firstName} ${s.lastName}`.trim())
                  }
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 transition-colors hover:bg-[var(--surface-2)] border"
                  style={{ background: "var(--surface-1)", borderColor: "var(--border)" }}
                >
                  <StudentAvatar student={s} size="sm" />
                  <span className="text-left">
                    <span className="block text-xs font-semibold" style={{ color: "var(--text)" }}>
                      {s.khmerName || `${s.firstName} ${s.lastName}`}
                    </span>
                    <span className="block text-[10px]" style={{ color: "var(--text-3)" }}>
                      {s.studentId || s.username || `${s.firstName} ${s.lastName}`}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
                    {classes.find((c) => c.id === s.className)?.name || "—"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* class cards grid */}
      {classes.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={BookOpen}
            title="No classes yet"
            subtitle="Create your first class — it will appear here and on the Attendance page."
            action={
              <button onClick={() => setAddClassOpen(true)} className="btn btn-primary px-4 h-10">
                <Plus size={16} /> New class
              </button>
            }
          />
        </div>
      ) : filteredClasses.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={UsersRound}
            title="No classes match"
            subtitle={`Nothing matches “${classQuery}”. Try a class name, field, major or shift.`}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredClasses.map((c) => (
            <button
              key={c.id}
              onClick={() => openClass(c.id)}
              className="card p-5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-soft animate-fade-up group"
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white text-xs font-bold shadow-soft"
                  style={{ background: ACCENT[c.major] || ACCENT.it }}
                >
                  {c.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold truncate group-hover:text-[var(--primary-strong)] transition-colors" style={{ color: "var(--text)" }}>
                    {c.name}
                  </p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-3)" }}>
                    {c.field || c.name} · {c.shift} shift
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {c.field && <Badge tone="neutral">{c.field}</Badge>}
                <Badge tone="neutral">{c.year}</Badge>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs">
                <span style={{ color: "var(--text-2)" }}>
                  <b className="tabular-nums" style={{ color: "var(--text)" }}>{countOf(c.id)}</b>{" "}
                  student{countOf(c.id) === 1 ? "" : "s"}
                </span>
                <span className="flex items-center gap-1 font-semibold transition-transform duration-150 group-hover:translate-x-0.5" style={{ color: "var(--primary-strong)" }}>
                  View students <ChevronRight size={14} />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );

  /* ══════════════════════ CLASS DETAIL VIEW ══════════════════════ */
  const detailView = sel && (
    <div className="animate-fade-up">
      <button onClick={() => setView("list")} className="btn btn-ghost h-9 px-3 text-sm gap-1 mb-3">
        <ArrowLeft size={16} /> All classes
      </button>

      {/* class header */}
      <div className="card overflow-hidden">
        <div className="h-16" style={{ background: accent }}>
          <div className="h-full w-full" style={{ backgroundImage: "radial-gradient(circle at 25% 40%, rgba(255,255,255,.18) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
        </div>
        <div className="p-5 -mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-3.5 min-w-0">
            <span className="hidden sm:flex h-[52px] w-[52px] items-center justify-center rounded-2xl text-white shadow-soft shrink-0 ring-4" style={{ background: accent, "--tw-ring-color": "var(--surface)" }}>
              <BookOpen size={22} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold truncate" style={{ color: "var(--text)" }}>{sel.name}</h2>
                <Badge tone="active">{majorName(sel.major)}</Badge>
                {sel.field && <Badge tone="neutral">{sel.field}</Badge>}
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
                {countOf(sel.id)} students · {sel.year} · {sel.semester} · {sel.shift} shift ({shiftRange(sel.shift)}) · {sel.degree}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setEditClass(sel)} className="btn h-9 px-3 text-xs font-medium transition-colors border bg-[var(--surface-2)] hover:bg-[var(--primary-soft)]" style={{ borderColor: "var(--border)", color: "var(--text-2)" }}>
              <Pencil size={13} /> Rename class
            </button>
            <Link to={`/attendance?class=${sel.id}`} className="btn h-9 px-3 text-xs font-medium transition-colors border bg-[var(--surface-2)] hover:bg-[var(--primary-soft)]" style={{ borderColor: "var(--border)", color: "var(--text-2)" }}>
              <CalendarCheck2 size={13} /> Attendance
            </Link>
            {canImport && (
              <button
                onClick={() => {
                  setImportSel([]);
                  setImportQuery("");
                  setImportScope("prev");
                  setImportOpen(true);
                }}
                className="btn h-9 px-3 text-xs font-medium transition-colors border bg-[var(--surface-2)] hover:bg-[var(--primary-soft)]"
                style={{ borderColor: "var(--border)", color: "var(--text-2)" }}
              >
                <UserPlus size={13} /> Import from {prevLevelCode}
              </button>
            )}
            <button
              onClick={() => setEndOpen(true)}
              disabled={sel.completed}
              title={sel.completed ? "This class has completed its programme" : "Archive this term and open the next semester"}
              className="btn h-9 px-3 text-xs font-medium transition-colors border bg-[var(--surface-2)] hover:bg-[var(--primary-soft)] disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--text-2)" }}
            >
              <Flag size={13} />
              {sel.completed ? "Programme complete" : nextLevelCode ? `Next semester · ${nextLevelCode}` : "Finish programme"}
            </button>
            <button onClick={() => setAddStudentOpen(true)} className="btn btn-primary h-9 px-3 text-xs">
              <UserRoundPlus size={14} /> Add student
            </button>
          </div>
        </div>
      </div>

      {/* roster */}
      <div className="card overflow-hidden mt-5">
        <div className="flex flex-wrap items-center gap-3 px-5 pt-5 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
              Students in {sel.name}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
              {roster.length} of {countOf(sel.id)} shown
            </p>
          </div>
          <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
            <input
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
              className="input pl-9 pr-8"
              placeholder="Search name, ID or username…"
            />
            {studentQuery && (
              <button onClick={() => setStudentQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost h-6 w-6 p-0 rounded-full" aria-label="Clear">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {roster.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title={countOf(sel.id) ? "No students match" : "No students in this class yet"}
            subtitle={
              countOf(sel.id)
                ? "Try a different search, or add a new student to this class."
                : `Add the first student to ${sel.name} — you can pick a major, shift, field, username and names.`
            }
            action={
              <button onClick={() => setAddStudentOpen(true)} className="btn btn-primary px-4 h-10">
                <UserRoundPlus size={16} /> Add student
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto thin-scroll">
            <table className="table-w" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>Student</th>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Gender</th>
                  <th style={{ minWidth: 170 }}>Major · Field</th>
                  <th>Shift</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <StudentAvatar student={s} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
                            {s.khmerName || `${s.firstName} ${s.lastName}`}
                          </p>
                          {s.khmerName ? (
                            <p className="text-[11px] truncate" style={{ color: "var(--text-3)" }}>
                              {s.firstName} {s.lastName}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="text-xs tabular-nums">{s.studentId || "—"}</td>
                    <td className="text-xs">{s.username || "—"}</td>
                    <td className="text-xs">{s.gender || "—"}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge tone="active">{majorName(s.major || sel.major)}</Badge>
                        <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
                          {s.field || sel.field || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="text-xs">{s.shift || sel.shift || "—"}</td>
                    <td><Badge tone={statusTone(s.status)}>{s.status}</Badge></td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/students/${s.id}`} className="btn btn-ghost h-8 w-8 p-0 rounded-lg" title="Open profile">
                          <ExternalLink size={14} />
                        </Link>
                        <button onClick={() => setEditStudent(s)} className="btn btn-ghost h-8 w-8 p-0 rounded-lg" title="Edit student">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleting(s)} className="btn btn-ghost h-8 w-8 p-0 rounded-lg" title="Remove student" style={{ color: "var(--danger)" }}>
                          <Trash2 size={14} />
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

      {/* term records */}
      <div className="card overflow-hidden mt-5">
        <div className="flex flex-wrap items-center gap-3 px-5 pt-5 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--primary-soft)", color: "var(--primary-strong)" }}>
            <History size={18} />
          </span>
          <div>
            <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>Terms &amp; records</h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
              Every finished semester is kept here so the class can move on without losing its history.
            </p>
          </div>
        </div>

        <div className="px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-3)" }}>
            Programme timeline · {classLevels.length / 2} years
          </p>
          <div className="flex items-center gap-1 overflow-x-auto thin-scroll pb-3 mb-1">
            {classLevels.map((lvl, i) => {
              const done = finishedLevels.has(lvl);
              const isCur = !sel.completed && lvl === currentLevel;
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
              No terms archived yet. Use <b>Next semester</b> to finish {currentLevel} and keep it as a record.
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
                  onClick={() => setRecordTerm(t)}
                  className="ml-auto btn btn-ghost h-9 px-3 text-sm gap-1.5 text-[var(--primary-strong)]"
                >
                  <ExternalLink size={15} /> View record
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {view === "detail" && sel ? detailView : listView}

      {/* modals */}
      <ClassFormModal open={addClassOpen} onClose={() => setAddClassOpen(false)} />
      <ClassFormModal open={!!editClass} onClose={() => setEditClass(null)} editing={editClass} />
      <StudentFormModal
        open={addStudentOpen || !!editStudent}
        onClose={() => {
          setAddStudentOpen(false);
          setEditStudent(null);
        }}
        lockedClass={addStudentOpen ? sel?.id : null}
        editing={editStudent}
      />
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Remove student"
        subtitle={deleting ? `${deleting.firstName} ${deleting.lastName} · ${sel?.name}` : ""}
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
                if (deleting) removeFromClass(sel.id, deleting.id);
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

      {/* advance to next semester — pick who moves up, then verify */}
      <NextSemesterModal
        open={endOpen}
        onClose={() => setEndOpen(false)}
        cls={sel}
        students={students}
        currentLevel={currentLevel}
        nextLevelCode={nextLevelCode}
        onConfirm={(advanceIds) => {
          const term = endClassTerm(sel.id, { advanceIds });
          setEndOpen(false);
          showToast(
            nextLevelCode
              ? `${currentLevel} finished · ${sel.name} is now ${nextLevelCode}`
              : `${currentLevel} finished · ${sel.name} programme complete`
          );
          if (term) setRecordTerm(term);
        }}
      />

      {/* import students */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        size="lg"
        title="Import students"
        subtitle={sel ? `Import ${prevLevelCode || "previous"} students into ${sel.name} (now ${currentLevel} · ${sel.year} ${sel.semester})` : ""}
        footer={
          <>
            <button onClick={() => setImportOpen(false)} className="btn btn-outline h-10 px-4 text-sm">Cancel</button>
            <button
              onClick={() => {
                const n = importStudents(sel.id, importSel);
                setImportOpen(false);
                showToast(n ? `${n} student${n === 1 ? "" : "s"} imported into ${sel.name}` : "No students selected");
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
                placeholder="Search students…"
              />
            </div>
            <button
              onClick={() => setImportSel((s) => (s.length === importCandidates.length ? [] : importCandidates.map((x) => x.id)))}
              disabled={importCandidates.length === 0}
              className="btn btn-outline h-10 px-3 text-sm disabled:opacity-50"
            >
              {importCandidates.length > 0 && importSel.length === importCandidates.length ? "Clear all" : "Select all"}
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
                matching {majorName(sel?.major)}{sel?.field ? ` · ${sel.field}` : ""}
              </span>
            </div>
          )}

          {importCandidates.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: "var(--text-3)" }}>
              {importScope === "prev" && prevLevelCode
                ? `No ${prevLevelCode} students match ${majorName(sel?.major)}${sel?.field ? ` · ${sel.field}` : ""}. Switch to “All students” for other programmes.`
                : "No students available to import."}
            </p>
          ) : (
            <div className="max-h-[46vh] overflow-y-auto thin-scroll rounded-xl border" style={{ borderColor: "var(--border)" }}>
              {importCandidates.map((s, idx) => {
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
                      onChange={() => setImportSel((list) => (on ? list.filter((x) => x !== s.id) : [...list, s.id]))}
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

      <TermRecordModal term={recordTerm} onClose={() => setRecordTerm(null)} attendance={attendance} />
    </div>
  );
}