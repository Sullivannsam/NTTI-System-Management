import React, { useRef, useState } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { useDropPos, DropdownPanel } from "./Dropdown";

/**
 * Generic styled dropdown — the plain-<select> replacement used everywhere
 * in the app that isn't a class picker (ClassSelect already covers that).
 *
 * `options` = [{ value, label, sub? }] or plain strings (auto-wrapped).
 * Same portaled, viewport-clamped panel as ClassSelect, so it behaves
 * identically: never clipped by an `overflow:hidden` card, never spills off
 * the edge of the screen, flips above the trigger when there's no room below.
 *
 * Pass `searchable` for long lists (20+ options); short lists skip the
 * search box entirely so a 3-option dropdown doesn't feel over-built.
 */
export default function Select({
  options,
  value,
  onChange,
  placeholder = "Select…",
  icon: Icon,
  searchable,
  disabled = false,
  allowNone = false,
  noneLabel = "— None —",
  className = "",
  minWidth = 160,
}) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const norm = (o) => (typeof o === "string" || typeof o === "number" ? { value: o, label: String(o) } : o);
  const base = (options || []).map(norm);
  const list = allowNone ? [{ value: "", label: noneLabel }, ...base] : base;
  const current = list.find((o) => String(o.value) === String(value));
  const useSearch = searchable ?? list.length > 8;

  const close = () => {
    setOpen(false);
    setQ("");
  };

  const qq = q.trim().toLowerCase();
  const filtered = qq ? list.filter((o) => `${o.label} ${o.sub || ""}`.toLowerCase().includes(qq)) : list;

  const { pos, menuRef } = useDropPos(ref, open, {
    rows: Math.min(filtered.length + (useSearch ? 1 : 0), 8),
    rowHeight: 38,
    extraHeight: useSearch ? 56 : 16,
    minWidth: Math.max(minWidth, 180),
    maxWidth: 420,
    maxHeight: 340,
    onClose: close,
  });

  const pick = (v) => {
    onChange(v);
    close();
  };

  return (
    <div className={`relative min-w-0 max-w-full ${className}`}>
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        className="flex h-10 w-full max-w-full items-center justify-between gap-2 rounded-xl border px-3.5 text-sm font-medium transition hover:border-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          minWidth: `min(${typeof minWidth === "number" ? `${minWidth}px` : minWidth}, 100%)`,
          background: disabled ? "var(--surface-2)" : "var(--surface)",
          borderColor: open ? "var(--primary)" : "var(--border)",
          color: current ? "var(--text)" : "var(--text-3)",
          boxShadow: open ? "0 0 0 3px var(--ring)" : "none",
        }}
      >
        <span className="flex min-w-0 items-center gap-2">
          {Icon && <Icon className="h-4 w-4 shrink-0" style={{ color: "var(--primary-strong)" }} />}
          <span className="truncate">{current ? current.label : placeholder}</span>
        </span>
        <ChevronDown className={`dd-chevron h-4 w-4 shrink-0 ${open ? "is-open" : ""}`} style={{ color: open ? "var(--primary)" : "var(--text-3)" }} />
      </button>

      <DropdownPanel pos={pos} menuRef={menuRef} onClose={close} className="p-1.5">
        {useSearch && (
          <div className="relative mb-1.5 shrink-0 px-0.5 pt-0.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filtered[0]) pick(filtered[0].value);
                if (e.key === "Escape") close();
              }}
              placeholder="Search…"
              className="w-full rounded-lg border py-2 pl-8 pr-3 text-sm outline-none transition-colors focus:border-[var(--primary)]"
              style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
            />
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto thin-scroll">
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-xs" style={{ color: "var(--text-3)" }}>
              No match{q ? ` for "${q}"` : ""}
            </p>
          ) : (
            filtered.map((o, i) => {
              const active = String(o.value) === String(value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => pick(o.value)}
                  className={`dd-item flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm ${active ? "is-active" : ""}`}
                  style={{ "--i": i }}
                >
                  <span className="truncate">{o.label}</span>
                  {o.sub && (
                    <span className="ml-auto max-w-[40%] shrink-0 truncate text-[11px] font-medium" style={{ color: "var(--text-3)" }}>
                      {o.sub}
                    </span>
                  )}
                  {active && <Check className="dd-check h-3.5 w-3.5 shrink-0" style={{ color: "var(--primary-strong)" }} />}
                </button>
              );
            })
          )}
        </div>
      </DropdownPanel>
    </div>
  );
}
