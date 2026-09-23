import React from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";

/** Card-style confirmation dialog that matches the app's design system
    (no native window.confirm / alert). */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message = "",
  confirmLabel = "Confirm",
  tone = "danger",
}) {
  const danger = tone === "danger";
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={title}
      footer={
        <div className="flex items-center gap-2.5">
          <button onClick={onClose} className="btn btn-outline h-10 px-4 text-sm">
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="btn h-10 px-5 text-sm text-white transition hover:brightness-110"
            style={{
              background: danger ? "var(--danger)" : "var(--primary)",
              boxShadow: danger ? "0 8px 18px -6px rgba(239,68,68,.45)" : undefined,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div className="flex items-start gap-3.5">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
        >
          <AlertTriangle size={20} />
        </span>
        <div className="pt-0.5 text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
          {message}
        </div>
      </div>
    </Modal>
  );
}