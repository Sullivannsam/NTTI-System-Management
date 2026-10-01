import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UsersRound,
  CalendarCheck,
  CalendarRange,
  BarChart3,
  Search,
  Bell,
  Moon,
  Sun,
  X,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Sparkles,
  Plus,
  UserPlus,
  BookOpen,
  ShieldCheck,
  ClipboardList,
  Trophy,
  FileText,
  Archive,
} from "lucide-react";
import clsx from "clsx";
import { useApp } from "../context/AppContext";
import StudentFormModal from "./StudentFormModal";
import ClassFormModal from "./ClassFormModal";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/students", label: "Students", icon: Users },
  { to: "/classes", label: "Classes", icon: UsersRound },
  { to: "/attendance", label: "Attendance", icon: CalendarCheck },
  { to: "/schedule", label: "Schedule", icon: CalendarRange },
  { to: "/scores", label: "Scores", icon: ClipboardList },
  { to: "/billboard", label: "Billboard", icon: Trophy },
  { to: "/transcript", label: "Transcript", icon: FileText },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin", label: "Admin", icon: ShieldCheck },
  { to: "/draft", label: "Draft", icon: Archive },
];

function Brand() {
  return (
    <NavLink to="/dashboard" className="flex items-center gap-3 px-1">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: "var(--surface-2)" }}
      >
        <img src="/ntti-logo.png" alt="NTTI" className="h-9 w-9 object-contain" />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="text-[12.5px] font-bold leading-snug" style={{ color: "var(--text)" }}>
          ការិយាល័យអប់រំបណ្ដុះបណ្ដាល
        </p>
      </div>
    </NavLink>
  );
}

function Sidebar({ open, onClose, collapsed }) {
  const { students, drafts, theme, toggleTheme, showToast, logout, currentAdmin } = useApp();
  const navigate = useNavigate();
  const active = students.filter((s) => s.status !== "Graduate").length;

  const handleLogout = () => {
    logout();
    showToast("Signed out", "info");
    navigate("/login");
  };

  const adminName = currentAdmin?.name || "Admin User";
  const adminRole = currentAdmin?.role || "System Administrator";
  const initials = (adminName || "AD")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <div
        className={clsx(
          "fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r transition-transform duration-300 print:hidden",
          open ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:-translate-x-full" : "lg:translate-x-0"
        )}
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between px-5 h-[68px] border-b" style={{ borderColor: "var(--border)" }}>
          <Brand />
          <button onClick={onClose} className="btn btn-ghost h-9 w-9 p-0 rounded-lg lg:hidden">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto thin-scroll px-4 py-5 space-y-1">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
            Main Menu
          </p>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) => clsx("nav-link", isActive && "active")}
            >
              <span className="nav-dot" />
              <Icon size={19} strokeWidth={2} />
              <span className="flex-1">{label}</span>
              {to === "/draft" && drafts.length > 0 && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
                  style={{ background: "var(--surface-2)", color: "var(--danger)" }}
                  title={`${drafts.length} classe${drafts.length === 1 ? "" : "s"} in Draft`}
                >
                  {drafts.length}
                </span>
              )}
            </NavLink>
          ))}

          <p className="px-3 pt-6 pb-2 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
            Overview
          </p>
          <div className="rounded-2xl p-4 mx-1 mt-1" style={{ background: "var(--primary-soft)" }}>
            <div className="flex items-center justify-between text-[13px] font-semibold" style={{ color: "var(--primary-strong)" }}>
              <span>Active students</span>
              <span className="tabular-nums">{active}</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/40">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${students.length ? Math.round((active / students.length) * 100) : 0}%`,
                  background: "linear-gradient(90deg,var(--primary),var(--accent))",
                }}
              />
            </div>
            <p className="mt-2 text-[11px]" style={{ color: "var(--text-2)" }}>
              of {students.length} enrolled total
            </p>
          </div>
        </nav>

        <div className="border-t px-4 py-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-white text-xs font-bold"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
                {adminName}
              </p>
              <p className="text-[11px] truncate" style={{ color: "var(--text-3)" }}>
                {adminRole.replace(/\b\w/g, (c) => c.toUpperCase())}
              </p>
            </div>
            <button
              onClick={() => toggleTheme()}
              className="btn btn-ghost h-9 w-9 p-0 rounded-lg"
              title="Toggle theme"
            >
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <button
              onClick={handleLogout}
              className="btn btn-ghost h-9 w-9 p-0 rounded-lg"
              title="Sign out"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function TopBar({ onMenu, onToggleCollapse, collapsed, onAddStudent, onAddClass }) {
  const [query, setQuery] = useState("");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const { students, theme, toggleTheme } = useApp();
  const navigate = useNavigate();

  const results = query.trim()
    ? students
        .filter((s) =>
          `${s.firstName} ${s.lastName} ${s.studentId}`
            .toLowerCase()
            .includes(query.trim().toLowerCase())
        )
        .slice(0, 6)
    : [];

  return (
    <header
      className="sticky top-0 z-30 glass border-b print:hidden"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex h-[68px] items-center gap-3 px-4 sm:px-6">
        <button
          onClick={() => {
            if (window.matchMedia("(min-width: 1024px)").matches) onToggleCollapse();
            else onMenu();
          }}
          className="btn btn-ghost h-10 w-10 p-0 rounded-xl"
          title={collapsed ? "Show the menu panel" : "Hide the menu panel"}
          aria-label={collapsed ? "Show the menu panel" : "Hide the menu panel"}
        >
          {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>

        <div className="relative hidden sm:block w-full max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={(e) => e.target.closest?.(".relative")?.classList?.add("search-open")}
            onBlur={(e) => setTimeout(() => e.target.closest?.(".relative")?.classList?.remove("search-open"), 150)}
            className="input pl-9 pr-4"
            placeholder="Search students…"
          />
          {query.trim() && (
            <div
              className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl shadow-soft"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              {results.length === 0 ? (
                <p className="px-4 py-3 text-sm" style={{ color: "var(--text-3)" }}>
                  No students found
                </p>
              ) : (
                results.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setQuery("");
                      navigate(`/students/${s.id}`);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full text-white text-[11px] font-bold"
                      style={{ background: "var(--primary)" }}
                    >
                      {s.firstName[0]}
                      {s.lastName[0]}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium truncate" style={{ color: "var(--text)" }}>
                        {s.khmerName || `${s.firstName} ${s.lastName}`}
                      </span>
                      <span className="block text-[11px]" style={{ color: "var(--text-3)" }}>
                        {s.khmerName ? `${s.firstName} ${s.lastName} · ` : ""}{s.studentId}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setAddMenuOpen((o) => !o)}
              className="btn btn-primary h-10 px-3 rounded-xl text-sm"
              title="Quick add"
            >
              <Plus size={17} /> <span className="hidden sm:inline">Add</span>
            </button>
            {addMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAddMenuOpen(false)} />
                <div
                  className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 overflow-hidden rounded-2xl shadow-soft animate-fade-up"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <p className="px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-3)" }}>
                    Quick add
                  </p>
                  <button
                    onClick={() => {
                      setAddMenuOpen(false);
                      onAddStudent();
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-[var(--surface-2)]"
                    style={{ color: "var(--text)" }}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: "var(--primary)" }}>
                      <UserPlus size={15} />
                    </span>
                    Add student
                  </button>
                  <button
                    onClick={() => {
                      setAddMenuOpen(false);
                      onAddClass();
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-[var(--surface-2)]"
                    style={{ color: "var(--text)" }}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: "linear-gradient(135deg,#10b981,#14b8a6)" }}>
                      <BookOpen size={15} />
                    </span>
                    Add class
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => toggleTheme()}
            className="btn btn-ghost h-10 w-10 p-0 rounded-xl"
            title={theme === "light" ? "Dark mode" : "Light mode"}
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button className="btn btn-ghost relative h-10 w-10 p-0 rounded-xl" title="Notifications">
            <Bell size={18} />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white animate-pulse-soft" />
          </button>
          <span className="hidden md:inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium" style={{ background: "var(--primary-soft)", color: "var(--primary-strong)" }}>
            <Sparkles size={14} /> {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </span>
        </div>
      </div>
    </header>
  );
}

function ToastStack() {
  const { toasts } = useApp();
  const icons = {
    success: "linear-gradient(135deg,#10b981,#34d399)",
    error: "linear-gradient(135deg,#ef4444,#f87171)",
    info: "linear-gradient(135deg,#3b82f6,#06b6d4)",
  };
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[70] flex w-[calc(100vw-2.5rem)] max-w-sm flex-col gap-2.5 print:hidden">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3 shadow-soft animate-toast-in"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: icons[t.type] }} />
          <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
            {t.message}
          </p>
        </div>
      ))}
    </div>
  );
}

const SIDEBAR_LS = "ntti.sidebar.collapsed.v1";

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_LS) === "1";
    } catch {
      return false;
    }
  });
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddClass, setShowAddClass] = useState(false);

  useEffect(() => {
    try {
      if (collapsed) localStorage.setItem(SIDEBAR_LS, "1");
      else localStorage.removeItem(SIDEBAR_LS);
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const toggleCollapsed = () => setCollapsed((c) => !c);

  return (
    <div className="min-h-screen">
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} collapsed={collapsed} />
      <div className={clsx("print:pl-0 transition-[padding] duration-300", collapsed ? "" : "lg:pl-[264px]")}>
        <TopBar
          onMenu={() => setMobileOpen(true)}
          onToggleCollapse={toggleCollapsed}
          collapsed={collapsed}
          onAddStudent={() => setShowAddStudent(true)}
          onAddClass={() => setShowAddClass(true)}
        />
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="fixed left-0 top-1/2 z-40 hidden lg:flex h-16 w-6 -translate-y-1/2 flex-col items-center justify-center rounded-r-xl border border-l-0 shadow-md hover:bg-[var(--surface-2)]"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-2)" }}
            title="Reopen the menu panel"
            aria-label="Reopen the menu panel"
          >
            <ChevronRight size={16} />
          </button>
        )}
        <main className="bg-mesh min-h-[calc(100vh-68px)] px-4 sm:px-6 lg:px-8 py-6 print:px-0 print:py-0 print:bg-white">
          <Outlet />
        </main>
      </div>
      <StudentFormModal open={showAddStudent} onClose={() => setShowAddStudent(false)} />
      <ClassFormModal open={showAddClass} onClose={() => setShowAddClass(false)} />
      <ToastStack />
    </div>
  );
}