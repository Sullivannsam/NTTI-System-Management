import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import {
  GraduationCap,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  UsersRound,
  CalendarCheck2,
  ShieldCheck,
  Loader2,
} from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("admin@ntti.edu.kh");
  const [password, setPassword] = useState("password");

  if (localStorage.getItem("ntti.auth")) return <Navigate to="/dashboard" replace />;

  const submit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      localStorage.setItem("ntti.auth", "1");
      navigate("/dashboard");
    }, 900);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-5 bg-mesh">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl animate-float" />
        <div
          className="absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl animate-float"
          style={{ animationDelay: "-3.5s" }}
        />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500/10 blur-3xl animate-float" style={{ animationDelay: "-5s" }} />
      </div>

      <div className="relative w-full max-w-5xl animate-fade-up">
        <div className="mx-auto mb-8 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-soft shadow-indigo-500/30">
            <GraduationCap size={30} />
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
            NTTI <span className="text-gradient">Management Portal</span>
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: "var(--text-2)" }}>
            Student tracking &amp; attendance management for the National Technical Training Institute
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:mx-24">
          <div className="hidden md:flex flex-col justify-between rounded-3xl p-8 text-white"
            style={{ background: "linear-gradient(150deg,#4f46e5,#7c3aed 55%,#9333ea)", boxShadow: "0 25px 50px -12px rgba(99,102,241,.45)" }}
          >
            <div>
              <h2 className="text-2xl font-bold leading-snug">
                Track every student, every single day.
              </h2>
              <p className="mt-3 text-sm text-indigo-100">
                One dashboard to monitor enrollment, attendance trends and student performance across all classes.
              </p>
            </div>
            <div className="mt-10 space-y-4">
              {[
                { icon: UsersRound, text: "Live student enrollment overview" },
                { icon: CalendarCheck2, text: "One-tap daily attendance marking" },
                { icon: ShieldCheck, text: "Secure role-based access" },
              ].map(({ icon: Icon, text }, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm animate-fade-up"
                  style={{ animationDelay: `${200 + i * 120}ms` }}
                >
                  <Icon size={18} />
                  <span className="text-sm font-medium">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={submit}
            className="glass-card rounded-3xl p-8 shadow-soft animate-fade-up"
            style={{ animationDelay: "150ms", background: "var(--surface)" }}
          >
            <h2 className="text-xl font-bold" style={{ color: "var(--text)" }}>
              Welcome back
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--text-3)" }}>
              Sign in to your administrator account
            </p>

            <div className="mt-7 space-y-4">
              <div>
                <label className="label">Email address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input pl-10"
                    placeholder="you@ntti.edu.kh"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
                  <input
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pl-10 pr-11"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 btn btn-ghost h-8 w-8 p-0 rounded-lg"
                  >
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium" style={{ color: "var(--text-2)" }}>
                <input type="checkbox" defaultChecked className="h-4 w-4 rounded accent-[var(--primary)]" />
                Remember me
              </label>
              <button type="button" className="text-xs font-semibold" style={{ color: "var(--primary-strong)" }}>
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary mt-6 h-12 w-full rounded-xl text-sm font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Signing in…
                </>
              ) : (
                <>
                  Sign in <ArrowRight size={18} />
                </>
              )}
            </button>

            <p className="mt-6 rounded-xl px-4 py-3 text-center text-[11px] leading-relaxed" style={{ background: "var(--primary-soft)", color: "var(--text-2)" }}>
              Demo credentials are pre-filled. Press <span className="font-semibold">Sign in</span> to continue.
            </p>
          </form>
        </div>

        <p className="mt-8 text-center text-[11px]" style={{ color: "var(--text-3)" }}>
          © {new Date().getFullYear()} NTTI — National Technical Training Institute. All rights reserved.
        </p>
      </div>
    </div>
  );
}