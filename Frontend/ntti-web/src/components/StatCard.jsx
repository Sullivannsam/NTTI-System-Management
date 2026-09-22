import React from "react";
import useCountUp from "../hooks/useCountUp";

export default function StatCard({ label, value, icon: Icon, tone = "brand", trend, suffix = "", sub, delay = 0 }) {
  const animated = useCountUp(value);

  const tones = {
    brand: { bg: "var(--primary-soft)", fg: "var(--primary-strong)", grad: "linear-gradient(135deg,#6366f1,#8b5cf6)" },
    success: { bg: "var(--success-soft)", fg: "var(--success)", grad: "linear-gradient(135deg,#10b981,#14b8a6)" },
    warning: { bg: "var(--warning-soft)", fg: "var(--warning)", grad: "linear-gradient(135deg,#f59e0b,#f97316)" },
    danger: { bg: "var(--danger-soft)", fg: "var(--danger)", grad: "linear-gradient(135deg,#ef4444,#ec4899)" },
    info: { bg: "var(--info-soft)", fg: "var(--info)", grad: "linear-gradient(135deg,#3b82f6,#06b6d4)" },
  };

  const t = tones[tone];

  return (
    <div
      className="card card-hover p-5 animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium" style={{ color: "var(--text-2)" }}>
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums" style={{ color: "var(--text)" }}>
            {animated.toLocaleString()}
            {suffix && <span className="text-base font-semibold ml-1" style={{ color: "var(--text-3)" }}>{suffix}</span>}
          </p>
        </div>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: t.bg, color: t.fg }}
        >
          {Icon && <Icon size={22} />}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {trend && (
          <span
            className="badge px-1.5"
            style={{
              background: trend.up ? "var(--success-soft)" : "var(--danger-soft)",
              color: trend.up ? "var(--success)" : "var(--danger)",
            }}
          >
            {trend.up ? "↑" : "↓"} {trend.value}%
          </span>
        )}
        {sub && (
          <span className="text-xs" style={{ color: "var(--text-3)" }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}