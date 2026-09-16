import React, { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  BarChart3,
  GraduationCap,
  Search,
  Bell,
  Moon,
  Sun,
  Menu,
  X,
  LogOut,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";
import { useApp } from "../context/AppContext";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/students", label: "Students", icon: Users },
  { to: "/attendance", label: "Attendance", icon: CalendarCheck },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
];

function Brand() {
  return (
    <NavLink to="/dashboard" className="flex items-center gap-3 px-1">
      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30">
        <GraduationCap size={22} />
      </div>
      <div className="leading-tight">
        <p className="text-[15px] font-bold tracking-tight" style={{ color: "var(--text)" }}>
          NTTI <span className="text-gradient">Portal</span>
        </p>
        <p className="text-[11px] font-medium" style={{ color: "var(--text-3)" }}>
          Management System
        </p>
      </div>
    </NavLink>
  );
}

function Sidebar({ open, onClose }) {
  const { students, theme, toggleTheme, showToast } = useApp();
  const navigate = useNavigate();
  const active = students.filter((s) => s.status === "Active").length;

  const handleLogout = () => {
    localStorage.removeItem("ntti.auth");
    showToast("Signed out", "info");
    navigate("/login");
  };

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
          "fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
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
              AD
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
                Admin User
              </p>
              <p className="text-[11px] truncate" style={{ color: "var(--text-3)" }}>
                System Administrator
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

function TopBar({ onMenu }) {
  const [query, setQuery] = useState("");
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
      className="sticky top-0 z-30 glass border-b"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex h-[68px] items-center gap-3 px-4 sm:px-6">
        <button onClick={onMenu} className="btn btn-ghost h-10 w-10 p-0 rounded-xl lg:hidden" aria-label="Menu">
          <Menu size={20} />
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
                        {s.firstName} {s.lastName}
                      </span>
                      <span className="block text-[11px]" style={{ color: "var(--text-3)" }}>
                        {s.studentId}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
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
    <div className="pointer-events-none fixed bottom-5 right-5 z-[70] flex w-[calc(100vw-2.5rem)] max-w-sm flex-col gap-2.5">
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

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <Sidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="lg:pl-[264px]">
        <TopBar onMenu={() => setMobileOpen(true)} />
        <main className="bg-mesh min-h-[calc(100vh-68px)] px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </main>
      </div>
      <ToastStack />
    </div>
  );
}