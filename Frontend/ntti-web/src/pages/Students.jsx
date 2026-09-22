import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Pencil, Users, ExternalLink, Phone, Mail, MapPin } from "lucide-react";
import PageHeader, { EmptyState } from "../components/Page";
import StudentFormModal from "../components/StudentFormModal";
import { useApp } from "../context/AppContext";
import { Badge, StudentAvatar, statusTone } from "../components/Badge";

export default function Students() {
  const { students, classes } = useApp();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [query, setQuery] = useState("");

  const clsOf = (id) => classes.find((c) => c.id === id);

  const displayKh = (s) => s.khmerName || `${s.firstName} ${s.lastName}`;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students
      .filter(
        (s) =>
          !q ||
          `${s.firstName} ${s.lastName} ${s.khmerName || ""} ${s.studentId} ${s.email || ""} ${s.phone || ""}`
            .toLowerCase()
            .includes(q)
      )
      .sort((a, b) =>
        `${a.khmerName || ""}${a.firstName} ${a.lastName}`.localeCompare(
          `${b.khmerName || ""}${b.firstName} ${b.lastName}`
        )
      );
  }, [students, query]);

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={`${students.length} students · click a card to edit their information`}
        actions={
          <button onClick={() => setAddOpen(true)} className="btn btn-primary h-10 px-4 text-sm">
            <Plus size={17} /> Add student
          </button>
        }
      />

      {/* search */}
      <div className="card p-4 mb-5 animate-fade-up">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-3)" }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input pl-9 h-10 text-sm"
            placeholder="Search by Khmer name, English name, ID, email or phone…"
          />
        </div>
      </div>

      {/* list of all students */}
      {list.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students found"
          subtitle="Try a different search, or add a new student."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((s, i) => {
            const c = clsOf(s.className);
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => setEditingStudent(s)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setEditingStudent(s);
                  }
                }}
                className="card p-4 text-left cursor-pointer transition-transform hover:-translate-y-0.5 animate-fade-up focus:outline-none focus-visible:ring-2"
                style={{ animationDelay: `${Math.min(i * 20, 400)}ms` }}
              >
                <div className="flex items-start gap-3">
                  <StudentAvatar student={s} size="lg" />
                  <div className="min-w-0 flex-1">
                    {/* Khmer name first, larger */}
                    <p className="text-lg font-bold leading-tight truncate" style={{ color: "var(--text)" }}>
                      {displayKh(s)}
                    </p>
                    {/* English name below, smaller */}
                    <p className="text-sm truncate" style={{ color: "var(--text-3)" }}>
                      {s.firstName} {s.lastName}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                      <Badge tone="neutral">{s.studentId}</Badge>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/students/${s.id}`);
                    }}
                    className="btn btn-ghost h-8 w-8 p-0 rounded-lg shrink-0"
                    title="Open full profile"
                  >
                    <ExternalLink size={14} />
                  </button>
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
    </div>
  );
}
