import React from "react";
import clsx from "clsx";
import Avatar from "./Avatar";

const MAP = {
  present: { label: "Present", color: "success", icon: null },
  late: { label: "Late", color: "warning", icon: null },
  absent: { label: "Absent", color: "danger", icon: null },
  leave: { label: "On Leave", color: "info", icon: null },
};

const COLOR_CLS = {
  success: "bg-[var(--success-soft)] text-[var(--success)]",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
  info: "bg-[var(--info-soft)] text-[var(--info)]",
  active: "bg-[var(--primary-soft)] text-[var(--primary-strong)]",
  neutral: "bg-[var(--surface-2)] text-[var(--text-2)]",
};

export function StatusBadge({ status }) {
  const meta = MAP[status] || { label: status, color: "neutral" };
  return (
    <span className={clsx("badge", COLOR_CLS[meta.color])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}

export function Badge({ tone = "neutral", children, className }) {
  return <span className={clsx("badge", COLOR_CLS[tone], className)}>{children}</span>;
}

export function StudentAvatar({ student, size }) {
  const fallback = ["#6366f1", "#8b5cf6", "#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#14b8a6", "#f97316"];
  const hash = String(student.id || 0).split("").reduce((a, b) => a + b.charCodeAt(0) * 7, 0);
  const color = student.avatarColor || fallback[hash % fallback.length];
  return (
    <Avatar
      name={`${student.firstName} ${student.lastName}`}
      color={color}
      size={size}
    />
  );
}