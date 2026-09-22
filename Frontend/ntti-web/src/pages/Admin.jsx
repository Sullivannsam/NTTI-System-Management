import React, { useMemo, useState } from "react";
import {
  ShieldCheck,
  UsersRound,
  History,
  Plus,
  Pencil,
  Trash2,
  Search,
  MonitorSmartphone,
  KeyRound,
  UserRoundPlus,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import Modal from "../components/Modal";

const fmtTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};

const ACTION_META = {
  login: { label: "Sign in", tone: "success" },
  logout: { label: "Sign out", tone: "muted" },
  login_failed: { label: "Sign-in failed", tone: "danger" },
  create_admin: { label: "Create admin", tone: "info" },
  update_admin: { label: "Update admin", tone: "info" },
  delete_admin: { label: "Delete admin", tone: "danger" },
  create_student: { label: "Create student", tone: "info" },
  update_student: { label: "Update student", tone: "muted" },
  delete_student: { label: "Delete student", tone: "danger" },
  create_class: { label: "Create class", tone: "info" },
  rename_class: { label: "Rename class", tone: "info" },
  update_class: { label: "Update class", tone: "muted" },
  save_weekly_attendance: { label: "Save weekly attendance", tone: "success" },
  save_daily_attendance: { label: "Save daily attendance", tone: "success" },
  export_attendance: { label: "Export attendance", tone: "muted" },
};

const toneClass = {
  success: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  danger: "bg-red-500/15 text-red-600 border-red-500/30",
  info: "bg-sky-500/15 text-sky-600 border-sky-500/30",
  muted: "bg-slate-400/15 text-slate-500 border-slate-400/30",
};

function AdminForm({ open, onClose, existing }) {
  const { addAdmin, updateAdmin, showToast } = useApp();
  const [name, setName] = useState(existing?.name || "");
  const [username, setUsername] = useState(existing?.username || "");
  const [email, setEmail] = useState(existing?.email || "");
  const [role, setRole] = useState(existing?.role || "admin");
  const [status, setStatus] = useState(existing?.status || "active");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const save = () => {
    setError("");
    if (!name.trim()) return setError("Display name is required.");
    if (!username.trim()) return setError("Username is required.");
    if (!existing && password.length < 4) return setError("Password must be at least 4 characters.");
    if (!email.trim()) return setError("Email is required.");
    const payload = {
      name: name.trim(),
      username: username.trim(),
      email: email.trim(),
      role,
      status,
    };
    if (password) payload.password = password;
    if (existing) {
      updateAdmin(existing.id, payload);
      showToast("Admin account updated");
    } else {
      if (!password) return setError("Password is required for new accounts.");
      addAdmin({ ...payload, password });
      showToast("Admin account created");
    }
    onClose();
  };

  const inputCls =
    "w-full rounded-xl border bg-[var(--surface-2)] px-3.5 py-2.5 text-sm outline-none transition focus:ring-4 focus:ring-[var(--primary-soft)] focus:border-[var(--primary)]";
  const labelCls = "mb-1.5 block text-xs font-medium text-[var(--text-2)]";

  return (
    <Modal open={open} onClose={onClose} title={existing ? "Edit admin" : "New admin account"} subtitle={existing ? `Editing ${existing.username}` : "Add a trusted admin to the portal"}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>
            {existing ? "Save changes" : "Create admin"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Full name</label>
          <input className={inputCls} value={name} placeholder="e.g. Sokha Phan"
            onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Username</label>
          <input className={inputCls} value={username} placeholder="e.g. sokha"
            onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Email</label>
          <input className={inputCls} value={email} placeholder="sokha@ntti.edu.kh" type="email"
            onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Role</label>
          <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="admin">Admin</option>
            <option value="superadmin">Super Admin</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>
            {existing ? "New password (leave blank to keep current)" : "Password"}
          </label>
          <input className={inputCls} type="password" value={password} placeholder="••••••••"
            onChange={(e) => setPassword(e.target.value)} />
        </div>
      </div>
      {error && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" /> {error}
        </p>
      )}
    </Modal>
  );
}

export default function Admin() {
  const { admins, audit, currentAdmin, deleteAdmin, showToast } = useApp();
  const [tab, setTab] = useState("admins");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  const activeCount = admins.filter((a) => a.status === "active").length;
  const failedCount = audit.filter((e) => e.action === "login_failed").length;
  const recentSignins = audit.filter((e) => e.action === "login").length;

  const filteredAudit = useMemo(() => {
    let rows = audit;
    if (filter !== "all") rows = rows.filter((e) => e.action === filter);
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      rows = rows.filter(
        (e) =>
          (e.adminName || "").toLowerCase().includes(t) ||
          (e.detail || "").toLowerCase().includes(t) ||
          (e.ip || "").toLowerCase().includes(t)
      );
    }
    return [...rows].reverse();
  }, [audit, q, filter]);

  const actionOptions = useMemo(() => {
    const seen = new Set();
    audit.forEach((e) => seen.add(e.action));
    return [...seen];
  }, [audit]);

  const initials = (n) =>
    (n || "?")
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const statCard = (label, value, icon, accent) => (
    <div className="rounded-2xl border bg-[var(--surface)] p-4 flex items-center gap-3" style={{ borderColor: "var(--border)" }}>
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${accent}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold leading-none" style={{ color: "var(--text)" }}>{value}</p>
        <p className="mt-1 text-xs font-medium" style={{ color: "var(--text-2)" }}>{label}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-up">
      {/* Header */}
      <div className="rounded-2xl border bg-gradient-to-r from-indigo-500/15 via-violet-500/10 to-transparent p-6" style={{ borderColor: "var(--border)" }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Admin & Security</h1>
              <p className="text-sm" style={{ color: "var(--text-2)" }}>
                Admin accounts, sign-in monitoring and the full audit trail with client IPs.
              </p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" /> New admin
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCard("Active admin accounts", activeCount, <UsersRound className="h-5 w-5 text-emerald-600" />, "bg-emerald-500/15")}
        {statCard("Admin sign-ins", recentSignins, <KeyRound className="h-5 w-5 text-indigo-600" />, "bg-indigo-500/15")}
        {statCard("Audit entries", audit.length, <History className="h-5 w-5 text-sky-600" />, "bg-sky-500/15")}
        {statCard("Blocked / failed attempts", failedCount, <AlertTriangle className="h-5 w-5 text-red-600" />, "bg-red-500/15")}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-xl border p-1 w-fit" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        {[
          { id: "admins", label: "Admin accounts", icon: <UsersRound className="h-4 w-4" /> },
          { id: "audit", label: "Audit log", icon: <History className="h-4 w-4" /> },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition"
            style={tab === t.id ? { background: "var(--primary)", color: "#fff" } : { color: "var(--text-2)" }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Admins tab ── */}
      {tab === "admins" && (
        <div className="space-y-3">
          {admins.map((a) => {
            const isSelf = currentAdmin?.adminId === a.id || currentAdmin?.id === a.id;
            const lastActive = admins.filter((x) => x.id !== a.id && x.status === "active").length === 0;
            return (
              <div key={a.id} className="rounded-2xl border bg-[var(--surface)] p-5 flex flex-wrap items-center gap-4" style={{ borderColor: "var(--border)" }}>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-strong))" }}>
                  {initials(a.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold" style={{ color: "var(--text)" }}>{a.name}</p>
                    {isSelf && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">you</span>
                    )}
                    {a.status === "suspended" && (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-600">suspended</span>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-xs" style={{ color: "var(--text-2)" }}>
                    @{a.username} · {a.email}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--text-3)" }}>
                    <span className="rounded-lg border px-2 py-0.5 font-medium" style={{ borderColor: "var(--border)" }}>{a.role}</span>
                    <span className="flex items-center gap-1"><MonitorSmartphone className="h-3.5 w-3.5" /> Last IP {a.lastIp || "—"}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Last sign-in {fmtTime(a.lastLogin)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn btn-ghost h-9 w-9 p-0 rounded-lg" title="Edit admin"
                    onClick={() => { setEditing(a); setFormOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    className="btn btn-ghost h-9 w-9 p-0 rounded-lg hover:!text-red-600"
                    title={lastActive ? "Cannot remove the last active admin" : "Delete admin"}
                    disabled={lastActive}
                    onClick={() => setConfirmDelete(a)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
          <p className="pt-1 text-xs" style={{ color: "var(--text-3)" }}>
            Client IPs are detected from the public network at sign-in and stored with every action.
          </p>
        </div>
      )}

      {/* ── Audit tab ── */}
      {tab === "audit" && (
        <div className="rounded-2xl border bg-[var(--surface)]" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-wrap items-center gap-3 p-4 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
              <input
                className="w-full rounded-xl border bg-[var(--surface-2)] py-2.5 pl-10 pr-3 text-sm outline-none transition focus:ring-4 focus:ring-[var(--primary-soft)]"
                style={{ borderColor: "var(--border)", color: "var(--text)" }}
                placeholder="Search admin, detail or IP…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <select
              className="rounded-xl border bg-[var(--surface-2)] px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All actions</option>
              {actionOptions.map((a) => (
                <option key={a} value={a}>{ACTION_META[a]?.label || a}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto thin-scroll">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Detail</th>
                  <th className="px-4 py-3">IP address</th>
                </tr>
              </thead>
              <tbody>
                {filteredAudit.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center" style={{ color: "var(--text-3)" }}>
                      <History className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      No audit entries match.
                    </td>
                  </tr>
                )}
                {filteredAudit.slice(0, 200).map((e) => {
                  const meta = ACTION_META[e.action] || { label: e.action, tone: "muted" };
                  return (
                    <tr key={e.id} className="border-t transition hover:bg-[var(--surface-2)]"
                      style={{ borderColor: "var(--border)" }}>
                      <td className="whitespace-nowrap px-4 py-3 text-xs" style={{ color: "var(--text-2)" }}>{fmtTime(e.ts)}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium" style={{ color: "var(--text)" }}>{e.adminName}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold ${toneClass[meta.tone] || toneClass.muted}`}>
                          {e.action === "login_failed" && <AlertTriangle className="h-3 w-3" />}
                          {e.newIp && <MonitorSmartphone className="h-3 w-3" />}
                          {meta.label}
                          {e.newIp && <span className="rounded bg-indigo-500/20 px-1 text-[10px] text-indigo-600">new IP</span>}
                        </span>
                      </td>
                      <td className="max-w-[280px] px-4 py-3" style={{ color: "var(--text-2)" }}>{e.detail}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs" style={{ color: "var(--text-2)" }}>{e.ip}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredAudit.length > 200 && (
            <p className="border-t px-4 py-3 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-3)" }}>
              Showing latest 200 of {filteredAudit.length} matching entries.
            </p>
          )}
        </div>
      )}

      {/* Admin form modal */}
      <AdminForm key={editing?.id || "new"} open={formOpen} existing={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }} />

      {/* Delete confirm */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete admin account"
        subtitle={confirmDelete ? `Remove ${confirmDelete.username} from the portal? This cannot be undone.` : ""}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button className="btn" style={{ background: "var(--danger)", color: "#fff" }}
              onClick={() => {
                const ok = deleteAdmin(confirmDelete.id);
                if (ok) showToast("Admin account removed");
                else showToast("Cannot remove the last active admin", "error");
                setConfirmDelete(null);
              }}>
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm" style={{}}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <p style={{ color: "var(--text-2)" }}>
            {confirmDelete?.name} will no longer be able to sign in. Their past audit entries remain for the record.
          </p>
        </div>
      </Modal>
    </div>
  );
}