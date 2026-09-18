import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import clsx from "clsx";

export default function Modal({ open, onClose, title, subtitle, children, size = "md", footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-6">
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={clsx(
          "relative w-full animate-scale-in rounded-t-3xl sm:rounded-2xl",
          "shadow-soft max-h-[92vh] flex flex-col outline-none",
          {
            "sm:max-w-lg": size === "md",
            "sm:max-w-2xl": size === "lg",
            "sm:max-w-3xl": size === "xl",
            "sm:max-w-5xl": size === "2xl",
          }
        )}
        style={{ background: "var(--surface)" }}
        role="dialog"
        aria-modal
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <h3 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
              {title}
            </h3>
            {subtitle && (
              <p className="text-sm mt-0.5" style={{ color: "var(--text-3)" }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost h-9 w-9 p-0 rounded-lg"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto thin-scroll">{children}</div>
        {footer && (
          <div className="px-6 py-4 flex items-center gap-3 justify-end border-t" style={{ borderColor: "var(--border)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}