import React from "react";

export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm" style={{ color: "var(--text-3)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, subtitle, icon: Icon, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4"
        style={{ background: "var(--primary-soft)", color: "var(--primary-strong)" }}
      >
        {Icon && <Icon size={30} />}
      </div>
      <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
        {title}
      </h3>
      {subtitle && (
        <p className="mt-1 text-sm max-w-sm" style={{ color: "var(--text-3)" }}>
          {subtitle}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ProgressBar({ value, tone = "brand", className = "" }) {
  const colors = {
    brand: "linear-gradient(90deg,#6366f1,#8b5cf6)",
    success: "linear-gradient(90deg,#10b981,#34d399)",
    warning: "linear-gradient(90deg,#f59e0b,#fbbf24)",
    danger: "linear-gradient(90deg,#ef4444,#f87171)",
  };
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full ${className}`} style={{ background: "var(--surface-3)" }}>
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: colors[tone] || colors.brand }}
      />
    </div>
  );
}