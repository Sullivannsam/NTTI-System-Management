import React, { useState } from "react";
import { School, ChevronDown, Search } from "lucide-react";

/**
 * Searchable class picker.
 * `options` = [{ value, label, sub? }]
 */
export default function ClassSelect({
  options,
  value,
  onChange,
  placeholder = "Select a class",
  minWidth = 230,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const current = options.find((o) => o.value === value);

  const qq = q.trim().toLowerCase();
  const filtered = qq
    ? options.filter((o) => `${o.label} ${o.sub || ""}`.toLowerCase().includes(qq))
    : options;

  const pick = (v) => {
    onChange(v);
    setOpen(false);
    setQ("");
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center justify-between gap-3 rounded-xl border px-3.5 text-sm font-medium transition"
        style={{
          minWidth,
          maxWidth: "100%",
          background: "var(--surface)",
          borderColor: open ? "var(--primary)" : "var(--border)",
          color: "var(--text)",
          boxShadow: open ? "0 0 0 3px var(--ring)" : "none",
        }}
      >
        <span className="flex items-center gap-2 truncate">
          <School className="h-4 w-4 shrink-0" style={{ color: "var(--primary-strong)" }} />
          {current ? current.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "var(--text-3)" }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-[calc(100%+6px)] z-50 w-[min(320px,calc(100vw-20px))] rounded-2xl border p-2 shadow-lg animate-fade-up"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            {/* search */}
            <div className="relative mb-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--text-3)" }} />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filtered[0]) pick(filtered[0].value);
                  if (e.key === "Escape") {
                    setOpen(false);
                    setQ("");
                  }
                }}
                placeholder="Search class…"
                className="w-full rounded-lg border py-2 pl-8 pr-3 text-sm outline-none transition-colors focus:border-[var(--primary)]"
                style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
              />
            </div>
            {/* options */}
            <div className="max-h-64 overflow-y-auto thin-scroll">
              {filtered.length === 0 ? (
                <p className="px-3 py-3 text-xs" style={{ color: "var(--text-3)" }}>No class matches “{q}”</p>
              ) : (
                filtered.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => pick(o.value)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--surface-2)]"
                    style={{
                      color: o.value === value ? "var(--primary-strong)" : "var(--text)",
                      fontWeight: o.value === value ? 700 : 500,
                      background: o.value === value ? "var(--primary-soft)" : "transparent",
                    }}
                  >
                    <School className="h-4 w-4 shrink-0" />
                    <span className="truncate">{o.label}</span>
                    {o.sub && <span className="ml-auto text-[11px] font-medium shrink-0" style={{ color: "var(--text-3)" }}>{o.sub}</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
