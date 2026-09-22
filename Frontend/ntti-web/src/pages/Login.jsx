import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { User, Lock, Eye, EyeOff, ArrowRight, UsersRound, CalendarCheck2, ShieldCheck, Loader2, AlertTriangle } from "lucide-react";
import { useApp } from "../context/AppContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useApp();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState(null);
  const [lastIpHint, setLastIpHint] = useState("");

  if (localStorage.getItem("ntti.auth")) return <Navigate to="/dashboard" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLastIpHint("");
    setLoading(true);
    const res = await login(username, password);
    if (res.ok) {
      navigate("/dashboard");
      return;
    }
    setLoading(false);
    const msgs = {
      unknown: `Unknown user — access denied. IP ${res.ip || "unknown"} recorded and reported.`,
      suspended: "This account is suspended — access denied.",
      password: "Incorrect password — this attempt has been recorded.",
    };
    setError(msgs[res.reason]);
    if (res.reason === "unknown" || res.reason === "password") setLastIpHint(`Attempt logged · IP ${res.ip || "unknown"}`);
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
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/95 p-2 shadow-lg">
            <img src="/ntti-logo.png" alt="NTTI" className="h-full w-full object-contain" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-white">ការិយាល័យអប់រំបណ្ដុះបណ្ដាល</h1>
          <p className="mt-1 text-sm text-white/60">National Technical Training Institute · Admin Portal</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.05fr_1fr]">
          {/* Left panel */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/10 p-8 backdrop-blur-xl">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
              <ShieldCheck className="h-3.5 w-3.5" /> Secured admin access
            </span>
            <h2 className="mt-5 text-2xl font-semibold leading-snug text-white">
              Every sign-in is recorded — <span className="text-indigo-300">who, when, where.</span>
            </h2>
            <ul className="mt-6 space-y-4">
              {[
                { icon: UsersRound, text: "Manage classes, rosters and student records in one place." },
                { icon: CalendarCheck2, text: "Track daily and weekly attendance for every class." },
                { icon: ShieldCheck, text: "Full audit trail with client IP — unknown users are blocked and reported." },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-sm text-white/75">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
                    <Icon className="h-4 w-4" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
            <div className="mt-8 rounded-xl border border-white/10 bg-black/20 p-4 text-center">
              <p className="text-xs text-white/50">Demo admin account</p>
              <p className="mt-1 font-mono text-sm text-white">
                admin <span className="text-white/40">/</span> admin123
              </p>
            </div>
          </div>

          {/* Right panel — form */}
          <div className="rounded-3xl border border-white/10 bg-white p-8 shadow-2xl">
            <h3 className="text-xl font-semibold text-gray-900">Sign in to continue</h3>
            <p className="mt-1 text-sm text-gray-500">Use your admin account to access the portal.</p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Username</label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-gray-400" />
                  <input
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/15"
                    placeholder="e.g. admin"
                    value={username}
                    autoComplete="username"
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-gray-400" />
                  <input
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-11 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/15"
                    type={show ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    autoComplete="current-password"
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                  >
                    {show ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p>{error}</p>
                    {lastIpHint && <p className="mt-0.5 text-xs text-red-500">{lastIpHint}</p>}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:from-indigo-600 hover:to-violet-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                  </>
                ) : (
                  <>
                    Sign in <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <p className="text-center text-xs text-gray-400">
                Unauthorised access attempts are logged with the client IP.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}