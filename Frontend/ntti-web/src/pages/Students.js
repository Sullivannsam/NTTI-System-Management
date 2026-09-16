import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  UsersRound,
  Pencil,
  Trash2,
  ExternalLink,
  Filter,
} from "lucide-react";
import PageHeader, { EmptyState, ProgressBar } from "../components/Page";
import Modal from "../components/Modal";
import { useApp } from "../context/AppContext";
import {
  MAJORS,
  CLASSES,
  classesOfMajor,
  majorName,
  todayISO,
  computeRate,
} from "../data/seed";
import { StudentAvatar, Badge } from "../components/Badge";

const makeForm = (overrides = {}) => ({
  firstName: "",
  lastName: "",
  gender: "Male",
  dob: "",
  email: "",
  phone: "",
  major: MAJORS[0].id,
  className: classesOfMajor(MAJORS[0].id)[0]?.id || CLASSES[0].id,
  address: "Phnom Penh",
  status: "Active",
  ...overrides,
});

const STATUS_TONE = {
  Active: "active",
  Graduated: "neutral",
  Suspended: "danger",
};

export default function Students() {
  const {
    students,
    attendance,
    addStudent,
    updateStudent,
    deleteStudent,
    showToast,
  } = useApp();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [majorFilter, setMajorFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(makeForm);
  const [showFilt, setShowFilt] = useState(false);

  const filterClasses = useMemo(
    () => (majorFilter === "all" ? CLASSES : classesOfMajor(majorFilter)),
    [majorFilter]
  );

  const formClasses = useMemo(
    () => classesOfMajor(form.major),
    [form.major]
  );

  const rows = useMemo(() => {
    return students
      .map((s) => ({
        ...s,
        rate: computeRate(attendance.filter((a) => a.studentId === s.id)),
      }))
      .filter((s) => {
        const q = query.trim().toLowerCase();
        return (
          (!q ||
            `${s.firstName} ${s.lastName} ${s.studentId}`
              .toLowerCase()
              .includes(q)) &&
          (majorFilter === "all" || s.major === majorFilter) &&
          (classFilter === "all" || s.className === classFilter) &&
          (statusFilter === "all" || s.status === statusFilter)
        );
      });
  }, [students, attendance, query, majorFilter, classFilter, statusFilter]);

  const openAdd = () => {
    setEditing(null);
    setForm(makeForm());
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm(
      makeForm({
        firstName: s.firstName,
        lastName: s.lastName,
        gender: s.gender,
        dob: s.dob,
        email: s.email,
        phone: s.phone,
        major: s.major || "it",
        className: s.className,
        address: s.address,
        status: s.status,
      })
    );
    setModalOpen(true);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      showToast("First and last name are required", "error");
      return;
    }
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      gender: form.gender,
      dob: form.dob,
      email: form.email.trim(),
      phone: form.phone.trim(),
      major: form.major,
      className: form.className,
      address: form.address,
      status: form.status,
    };
    if (editing) {
      updateStudent(editing.id, payload);
      showToast("Student updated");
    } else {
      const n = students.length;
      addStudent({
        ...payload,
        studentId: `NTTI-${new Date().getFullYear()}-${String(n + 1).padStart(4, "0")}`,
        enrollmentDate: todayISO(),
      });
      showToast("Student added successfully");
    }
    setModalOpen(false);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleMajorSelect = (e) => {
    const major = e.target.value;
    const firstClass = classesOfMajor(major)[0]?.id || CLASSES[0].id;
    setForm((f) => ({ ...f, major, className: firstClass }));
  };

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={`${rows.length} of ${students.length} students · searchable, filterable registry`}
        actions={
          <button onClick={openAdd} className="btn btn-primary h-10 px-4 text-sm">
            <Plus size={17} /> Add student
          </button>
        }
      />

      <div className="card p-4 mb-5 animate-fade-up" style={{ animationDelay: "60ms" }}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-3)" }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input pl-9"
              placeholder="Search by name or ID…"
            />
          </div>
          <button
            onClick={() => setShowFilt((v) => !v)}
            className="btn btn-outline h-[42px] px-4 text-sm md:hidden"
          >
            <Filter size={16} /> Filters
          </button>
          <div
            className={`${showFilt ? "flex" : "hidden"} md:flex flex-col gap-3 sm:flex-row`}
          >
            <select
              value={majorFilter}
              onChange={(e) => {
                setMajorFilter(e.target.value);
                setClassFilter("all");
              }}
              className="input md:w-44"
            >
              <option value="all">All majors</option>
              {MAJORS.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="input md:w-52"
            >
              <option value="all">All classes</option>
              {filterClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input md:w-44"
            >
              <option value="all">All statuses</option>
              {["Active", "Graduated", "Suspended"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card animate-fade-up">
          <EmptyState
            icon={UsersRound}
            title="No students found"
            subtitle="Try adjusting your search or filters, or add a new student to the registry."
            action={
              <button onClick={openAdd} className="btn btn-primary px-4 h-10 text-sm">
                <Plus size={16} /> Add student
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((s, i) => (
            <div
              key={s.id}
              className="card card-hover p-5 group cursor-pointer animate-fade-up"
              style={{ animationDelay: `${i * 45}ms` }}
              onClick={() => navigate(`/students/${s.id}`)}
            >
              <div className="flex items-start gap-3.5">
                <StudentAvatar student={s} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate" style={{ color: "var(--text)" }}>
                      {s.firstName} {s.lastName}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/students/${s.id}`);
                      }}
                      className="opacity-0 transition-opacity group-hover:opacity-100 text-[var(--text-3)] hover:text-[var(--primary)]"
                      title="Open profile"
                    >
                      <ExternalLink size={15} />
                    </button>
                  </div>
                  <p className="text-xs mt-0.5 tabular-nums" style={{ color: "var(--text-3)" }}>
                    {s.studentId}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge tone="active" className="!text-[10px] !px-2 !py-[1px]">
                      {majorName(s.major)}
                    </Badge>
                    <span className="text-[11px] font-medium" style={{ color: "var(--text-2)" }}>
                      {CLASSES.find((c) => c.id === s.className)?.name}
                    </span>
                  </div>
                </div>
                <Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1">
                  <div className="mb-1 flex justify-between text-[11px] font-medium" style={{ color: "var(--text-3)" }}>
                    <span>Attendance</span>
                    <span className="tabular-nums font-semibold" style={{ color: "var(--text-2)" }}>
                      {s.rate}%
                    </span>
                  </div>
                  <ProgressBar
                    value={s.rate}
                    tone={s.rate >= 85 ? "success" : s.rate >= 70 ? "warning" : "danger"}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--border)" }}>
                <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-3)" }}>
                  <UsersRound size={13} /> {s.gender}
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(s); }}
                    className="btn btn-ghost h-8 px-2.5 text-xs rounded-lg"
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleting(s); }}
                    className="btn btn-ghost h-8 px-2.5 text-xs rounded-lg hover:!text-rose-500 hover:!bg-rose-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit student" : "Add new student"}
        subtitle={
          editing
            ? `Updating ${editing.firstName} ${editing.lastName}`
            : "Create a new enrollment record"
        }
        size="lg"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn btn-outline h-10 px-4 text-sm">
              Cancel
            </button>
            <button type="submit" form="student-form" className="btn btn-primary h-10 px-5 text-sm">
              {editing ? "Save changes" : "Add student"}
            </button>
          </>
        }
      >
        <form id="student-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">First name *</label>
            <input className="input" value={form.firstName} onChange={set("firstName")} placeholder="e.g. Sokha" />
          </div>
          <div>
            <label className="label">Last name *</label>
            <input className="input" value={form.lastName} onChange={set("lastName")} placeholder="e.g. Phan" />
          </div>
          <div>
            <label className="label">Major *</label>
            <select className="input" value={form.major} onChange={handleMajorSelect}>
              {MAJORS.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Class *</label>
            <select className="input" value={form.className} onChange={set("className")} key={form.major}>
              {formClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Gender</label>
            <select className="input" value={form.gender} onChange={set("gender")}>
              <option>Male</option>
              <option>Female</option>
            </select>
          </div>
          <div>
            <label className="label">Date of birth</label>
            <input type="date" className="input" value={form.dob} onChange={set("dob")} />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={set("email")} placeholder="name@ntti.edu.kh" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={set("phone")} placeholder="+855 …" />
          </div>
          <div>
            <label className="label">Address</label>
            <input className="input" value={form.address} onChange={set("address")} placeholder="Province / city" />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={set("status")}>
              <option>Active</option>
              <option>Graduated</option>
              <option>Suspended</option>
            </select>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete student"
        size="md"
        footer={
          <>
            <button onClick={() => setDeleting(null)} className="btn btn-outline h-10 px-4 text-sm">
              Cancel
            </button>
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
          Are you sure you want to permanently remove{" "}
          <b style={{ color: "var(--text)" }}>
            {deleting?.firstName} {deleting?.lastName}
          </b>{" "}
          from the registry? Their attendance history will also be deleted. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}