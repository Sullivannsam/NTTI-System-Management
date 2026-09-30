import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Search, Pencil, Users, ExternalLink, Phone, Mail, MapPin, Trash2, Check,
  Upload, Table2, LayoutGrid, CalendarDays, GraduationCap,
} from "lucide-react";
import PageHeader, { EmptyState } from "../components/Page";
import StudentFormModal from "../components/StudentFormModal";
import StudentImportModal from "../components/StudentImportModal";
import ConfirmDialog from "../components/ConfirmDialog";
import { cleanName } from "../components/studentImportHelpers";
import { useApp } from "../context/AppContext";
import { Badge, StudentAvatar, statusTone } from "../components/Badge";

const STATUSES = ["Learning", "Undergraduate", "Graduate"];

const fmtDate = (d) => {
  if (!d) return "—";
  const [y, m, day] = String(d).split("-");
  if (!y || !m || !day) return d;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${day} ${months[Number(m) - 1]} ${y}`;
};

export default function Students() {
  const { students, classes, addStudentsBatch, deleteStudent, showToast } = useApp();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [view, setView] = useState("table"); // "table" | "cards"
  const [selecting, setSelecting] = useState(false); // select-&-delete mode
  const [selected, setSelected] = useState(() => new Set());
  const [bulkDelete, setBulkDelete] = useState(false);

  const clsOf = (id) => classes.find((c) => c.id === id);
  const displayName = (s) => cleanName(s.khmerName) || cleanName(`${s.firstName} ${s.lastName}`);
  const englishName = (s) => cleanName(`${s.firstName} ${s.lastName}`);

  const onDelete = (s) => setDeleteTarget(s);

  const confirmDelete = () => {
    const s = deleteTarget;
    if (!s) return;
    const who = displayName(s) || englishName(s) || s.studentId;
    deleteStudent(s.id);
    showToast(`Deleted ${who}`);
  };

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students
      .filter((s) => {
        if (classFilter !== "all" && s.className !== classFilter) return false;
        if (statusFilter !== "all" && s.status !== statusFilter) return false;
        return (
          !q ||
          `${s.firstName} ${s.lastName} ${s.khmerName || ""} ${s.studentId} ${s.email || ""} ${s.phone || ""} ${s.username || ""}`
            .toLowerCase()
            .includes(q)
        );
      })
      .sort((a, b) => {
        const ka = `${a.khmerName || ""}`.trim();
        const kb = `${b.khmerName || ""}`.trim();
        if (ka || kb) {
          const c = ka.localeCompare(kb, "km", { sensitivity: "base" });
          if (c !== 0) return c;
        }
        const ea = `${a.firstName || ""} ${a.lastName || ""}`.trim().toLowerCase();
        const eb = `${b.firstName || ""} ${b.lastName || ""}`.trim().toLowerCase();
        return (
          ea.localeCompare(eb, undefined, { numeric: true, sensitivity: "base" }) ||
          String(a.studentId || "").localeCompare(String(b.studentId || ""), undefined, { numeric: true })
        );
      });
  }, [students, query, classFilter, statusFilter]);

  /* ── select & delete mode ─────────────────────────── */
  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      const shown = list.map((s) => s.id);
      const allOn = shown.length > 0 && shown.every((id) => next.has(id));
      shown.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
      return next;
    });

  const exitSelect = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const confirmDeleteMany = () => {
    const ids = Array.from(selected);
    ids.forEach((id) => deleteStudent(id));
    showToast(`Deleted ${ids.length} student${ids.length === 1 ? "" : "s"}`);
    setBulkDelete(false);
    exitSelect();
  };

  const learning = students.filter((s) => s.status === "Learning").length;
  const classesWithStudents = classes.filter((c) => students.some((s) => s.className === c.id));

  const onExcelImport = (rows, stats) => {
    addStudentsBatch(rows);
    setImportOpen(false);
    showToast(
      `${stats.imported} student${stats.imported === 1 ? "" : "s"} imported from Excel` +
        (stats.skippedDup ? ` · ${stats.skippedDup} duplicate${stats.skippedDup === 1 ? "" : "s"} skipped` : "")
    );
  };

  const toolbar = (
    <div className="card p-4 mb-5 animate-fade-up">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {/* search */}
        <div className="relative min-w-0 flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-3)" }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input pl-9 h-10 text-sm"
            placeholder="Search by Khmer name, English name, ID, email, phone or username…"
          />
        </div>

        {/* filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input h-10 w-auto text-sm py-2 max-w-[180px]"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            title="Filter by class"
          >
            <option value="all">All classes</option>
            {classesWithStudents.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.shift}
              </option>
            ))}
          </select>
          <select
            className="input h-10 w-auto text-sm py-2 max-w-[160px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            title="Filter by status"
          >
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* view toggle */}
          <div className="flex items-center gap-1 rounded-xl border p-1" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <button
              onClick={() => setView("table")}
              className={`btn h-8 px-2.5 text-xs ${view === "table" ? "btn-soft" : "btn-ghost"}`}
              title="Table view"
            >
              <Table2 size={15} />
            </button>
            <button
              onClick={() => setView("cards")}
              className={`btn h-8 px-2.5 text-xs ${view === "cards" ? "btn-soft" : "btn-ghost"}`}
              title="Card view"
            >
              <LayoutGrid size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={`${students.length} students enrolled · ${learning} currently learning`}
        actions={
          <>
            <button
              onClick={() => (selecting ? exitSelect() : setSelecting(true))}
              className={`btn h-10 px-4 text-sm ${selecting ? "btn-ghost" : "btn-soft"}`}
              title="Mark students, then delete several at once"
            >
              <Trash2 size={16} /> {selecting ? "Cancel selection" : "Select & delete"}
            </button>
            <button onClick={() => setImportOpen(true)} className="btn btn-soft h-10 px-4 text-sm">
              <Upload size={16} /> Import Excel
            </button>
            <button onClick={() => setAddOpen(true)} className="btn btn-primary h-10 px-4 text-sm">
              <Plus size={17} /> Add student
            </button>
          </>
        }
      />

      {toolbar}

      {/* result count / selection bar */}
      {selecting ? (
        <div
          className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 animate-fade-up"
          style={{ borderColor: "var(--primary)", background: "var(--primary-soft)" }}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            <Check size={15} />
          </span>
          <span className="text-sm font-bold" style={{ color: "var(--text)" }}>
            {selected.size} selected
          </span>
          <button onClick={toggleSelectAll} className="btn btn-ghost h-8 px-3 text-xs">
            {list.length && list.every((s) => selected.has(s.id)) ? "Clear all shown" : "Select all shown"}
          </button>
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <button onClick={exitSelect} className="btn btn-ghost h-8 px-3 text-xs">
              Cancel
            </button>
            <button
              onClick={() => selected.size > 0 && setBulkDelete(true)}
              disabled={selected.size === 0}
              className="btn h-8 px-3 text-xs"
              style={{ background: "var(--danger)", color: "#fff" }}
              title="Permanently delete the selected students"
            >
              <Trash2 size={14} /> Delete {selected.size > 0 ? `${selected.size} ` : ""}student{selected.size === 1 ? "" : "s"}
            </button>
          </span>
        </div>
      ) : (
        <p className="mb-3 text-xs font-medium" style={{ color: "var(--text-3)" }}>
          {list.length === students.length
            ? `Showing all ${students.length} students`
            : `Showing ${list.length} of ${students.length} students`}
          {query && " · filtered by search"}
          {(classFilter !== "all" || statusFilter !== "all") && " · filtered by " + [classFilter !== "all" ? "class" : null, statusFilter !== "all" ? "status" : null].filter(Boolean).join(" + ")}
        </p>
      )}

      {list.length === 0 ? (
        <EmptyState
          icon={Users}
          title={query || classFilter !== "all" || statusFilter !== "all" ? "No matching students" : "No students found"}
          subtitle={
            query || classFilter !== "all" || statusFilter !== "all"
              ? "Try a different search or clear the filters."
              : "Add a student manually, or import a whole class from an Excel file."
          }
          action={
            !query && classFilter === "all" && statusFilter === "all" ? (
              <button onClick={() => setImportOpen(true)} className="btn btn-primary px-4 text-sm h-10">
                <Upload size={16} /> Import from Excel
              </button>
            ) : undefined
          }
        />
      ) : view === "table" ? (
        <div className="card overflow-hidden animate-fade-up">
          <div className="overflow-x-auto thin-scroll">
            <table className="table-w" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  {selecting && (
                    <th className="w-10 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={list.length > 0 && list.every((s) => selected.has(s.id))}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 cursor-pointer"
                        style={{ accentColor: "var(--primary)" }}
                        aria-label="Select all students shown"
                      />
                    </th>
                  )}
                  <th className="min-w-[220px]">Student</th>
                  <th>Student ID</th>
                  <th>Class</th>
                  <th className="min-w-[200px]">Contact</th>
                  <th>Date of birth</th>
                  <th>Status</th>
                  {!selecting && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {list.map((s, i) => {
                  const c = clsOf(s.className);
                  return (
                    <tr
                      key={s.id}
                      className="cursor-pointer"
                      style={{ animationDelay: `${Math.min(i * 15, 300)}ms` }}
                      onClick={() => (selecting ? toggleSelect(s.id) : setEditingStudent(s))}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (selecting) toggleSelect(s.id);
                          else setEditingStudent(s);
                        }
                      }}
                    >
                      {/* mark */}
                      {selecting && (
                        <td className="px-2 text-center">
                          <input
                            type="checkbox"
                            checked={selected.has(s.id)}
                            onChange={() => toggleSelect(s.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 cursor-pointer"
                            style={{ accentColor: "var(--primary)" }}
                            aria-label={`Select ${displayName(s)}`}
                          />
                        </td>
                      )}
                      {/* student */}
                      <td>
                        <span className="flex items-center gap-3 min-w-0">
                          <StudentAvatar student={s} size="md" />
                          <span className="min-w-0">
                            <span className="block text-sm font-bold leading-tight truncate" style={{ color: "var(--text)" }}>
                              {displayName(s)}
                            </span>
                            <span className="block text-xs truncate" style={{ color: "var(--text-3)" }}>
                              {englishName(s)}
                              {s.username && <span className="opacity-70"> · @{s.username}</span>}
                            </span>
                          </span>
                        </span>
                      </td>
                      {/* id */}
                      <td>
                        <Badge tone="neutral">{s.studentId}</Badge>
                      </td>
                      {/* class */}
                      <td>
                        {c ? (
                          <span className="flex flex-col leading-tight">
                            <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{c.name}</span>
                            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
                              {c.field || "General"} · {s.shift}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--text-3)" }}>No class</span>
                        )}
                      </td>
                      {/* contact */}
                      <td>
                        <span className="flex flex-col gap-0.5 text-xs leading-tight" style={{ color: "var(--text-2)" }}>
                          {s.email ? (
                            <span className="flex items-center gap-1.5 truncate max-w-[220px]">
                              <Mail size={11} className="shrink-0" style={{ color: "var(--text-3)" }} /> {s.email}
                            </span>
                          ) : null}
                          {s.phone ? (
                            <span className="flex items-center gap-1.5 truncate max-w-[220px]">
                              <Phone size={11} className="shrink-0" style={{ color: "var(--text-3)" }} /> {s.phone}
                            </span>
                          ) : null}
                          {!s.email && !s.phone && <span style={{ color: "var(--text-3)" }}>—</span>}
                        </span>
                      </td>
                      {/* dob */}
                      <td>
                        <span className="flex items-center gap-1.5 text-xs whitespace-nowrap" style={{ color: "var(--text-2)" }}>
                          <CalendarDays size={12} style={{ color: "var(--text-3)" }} />
                          {fmtDate(s.dob)}
                        </span>
                      </td>
                      {/* status */}
                      <td>
                        <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                        <span className="block text-[10px] mt-0.5" style={{ color: "var(--text-3)" }}>{s.level}</span>
                      </td>
                      {/* actions */}
                      {!selecting && (
                        <td className="text-right whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/students/${s.id}`);
                              }}
                              className="btn btn-ghost h-8 w-8 p-0 rounded-lg"
                              title="Open full profile"
                            >
                              <ExternalLink size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingStudent(s);
                              }}
                              className="btn btn-ghost h-8 w-8 p-0 rounded-lg"
                              title="Edit student"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(s);
                              }}
                              className="btn btn-ghost h-8 w-8 p-0 rounded-lg hover:!bg-red-50 hover:!text-red-500"
                              title="Delete student"
                            >
                              <Trash2 size={14} />
                            </button>
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── card view ───────────────────────────────────── */
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((s, i) => {
            const c = clsOf(s.className);
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => (selecting ? toggleSelect(s.id) : setEditingStudent(s))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (selecting) toggleSelect(s.id);
                    else setEditingStudent(s);
                  }
                }}
                className="card relative p-4 text-left cursor-pointer transition-transform hover:-translate-y-0.5 animate-fade-up focus:outline-none focus-visible:ring-2"
                style={{
                  animationDelay: `${Math.min(i * 20, 400)}ms`,
                  ...(selecting && selected.has(s.id)
                    ? { borderColor: "var(--primary)", boxShadow: "0 0 0 3px var(--ring)" }
                    : {}),
                }}
              >
                {selecting && (
                  <span
                    className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border"
                    style={{
                      background: selected.has(s.id) ? "var(--primary)" : "var(--surface)",
                      borderColor: selected.has(s.id) ? "var(--primary)" : "var(--border)",
                      color: "#fff",
                    }}
                  >
                    {selected.has(s.id) && <Check size={13} />}
                  </span>
                )}
                <div className="flex items-start gap-3">
                  <StudentAvatar student={s} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold leading-tight truncate" style={{ color: "var(--text)" }}>
                      {displayName(s)}
                    </p>
                    <p className="text-sm truncate" style={{ color: "var(--text-3)" }}>
                      {englishName(s)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                      <Badge tone="neutral">{s.studentId}</Badge>
                    </div>
                  </div>
                  {!selecting && (
                    <span className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/students/${s.id}`);
                        }}
                        className="btn btn-ghost h-8 w-8 p-0 rounded-lg"
                        title="Open full profile"
                      >
                        <ExternalLink size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(s);
                        }}
                        className="btn btn-ghost h-8 w-8 p-0 rounded-lg hover:!bg-red-50 hover:!text-red-500"
                        title="Delete student"
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-1 text-xs" style={{ color: "var(--text-2)" }}>
                  <p className="flex items-center gap-1.5 truncate">
                    <Mail size={12} className="shrink-0" /> {s.email || "—"}
                  </p>
                  <p className="flex items-center gap-1.5 truncate">
                    <Phone size={12} className="shrink-0" /> {s.phone || "—"}
                  </p>
                  <p className="flex items-center gap-1.5 truncate">
                    <MapPin size={12} className="shrink-0" /> {s.birthPlace || s.address || "—"}
                  </p>
                  <p className="flex items-center gap-1.5 truncate">
                    <GraduationCap size={12} className="shrink-0" /> {s.level} · Enrolled {s.enrollmentYear}
                  </p>
                </div>

                <div
                  className="mt-3 flex items-center justify-between border-t pt-3"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span className="text-[11px] truncate" style={{ color: "var(--text-3)" }}>
                    {c ? `${c.name} · ${c.field || "General"}` : "No class"}
                  </span>
                  <span
                    className="flex items-center gap-1 text-[11px] font-semibold shrink-0"
                    style={{ color: "var(--primary-strong)" }}
                  >
                    <Pencil size={12} /> Edit
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <StudentFormModal
        open={addOpen || !!editingStudent}
        onClose={() => {
          setAddOpen(false);
          setEditingStudent(null);
        }}
        editing={editingStudent}
      />

      <StudentImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        classes={classes}
        existing={students}
        onImport={onExcelImport}
      />

      <ConfirmDialog
        open={!!deleteTarget || bulkDelete}
        onClose={() => {
          setDeleteTarget(null);
          setBulkDelete(false);
        }}
        onConfirm={bulkDelete ? confirmDeleteMany : confirmDelete}
        title={bulkDelete ? "Delete selected students?" : "Delete student?"}
        confirmLabel="Delete"
        message={
          bulkDelete ? (
            <>
              <b style={{ color: "var(--text)" }}>{selected.size}</b> student
              {selected.size === 1 ? "" : "s"} will be permanently removed from the system,
              together with their attendance and weekly records. This cannot be undone.
              {selected.size > 0 && (
                <span className="mt-2 block text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
                  {students
                    .filter((s) => selected.has(s.id))
                    .slice(0, 4)
                    .map((s) => displayName(s) || englishName(s) || s.studentId)
                    .join(" · ")}
                  {selected.size > 4 ? ` · +${selected.size - 4} more` : ""}
                </span>
              )}
            </>
          ) : (
            deleteTarget && (
              <>
                <b style={{ color: "var(--text)" }}>
                  {displayName(deleteTarget) || englishName(deleteTarget) || deleteTarget.studentId}
                </b>{" "}
                will be permanently removed from the system, together with their attendance and
                weekly records. This cannot be undone.
              </>
            )
          )
        }
      />
    </div>
  );
}