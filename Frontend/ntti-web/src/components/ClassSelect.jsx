import React, { useRef, useState } from "react";
import { School, ChevronDown, Search } from "lucide-react";
import { useDropPos, DropdownPanel } from "./Dropdown";

/**
 * Searchable class picker.
 * `options` = [{ value, label, sub? }]
 *
 * The menu is portaled and clamped to the viewport, so it stays on screen
 * even when the trigger sits at the right edge of a page header or inside a
 * card with `overflow: hidden`.
 */
export default function ClassSelect({
  options,
  value,
  onChange,
  placeholder = "Select a class",
  minWidth = 230,
}) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const current = options.find((o) => o.value === value);

  const close = () => {
    setOpen(false);
    setQ("");
  };

  const qq = q.trim().toLowerCase();
  const filtered = qq
    ? options.filter((o) => `${o.label} ${o.sub || ""}`.toLowerCase().includes(qq))
    : options;

  const { pos, menuRef } = useDropPos(ref, open, {
    rows: Math.min(filtered.length + 1, 7),
    rowHeight: 40,
    extraHeight: 62,
    minWidth: 240,
    maxWidth: 340,
    maxHeight: 360,
    onClose: close,
  });

  const pick = (v) => {
    onChange(v);
    close();
  };

  return (
    <div className="relative min-w-0 max-w-full">
      <button
        ref={ref}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        className="flex h-10 w-full max-w-full items-center justify-between gap-3 rounded-xl border px-3.5 text-sm font-medium transition"
        style={{
          minWidth: `min(${typeof minWidth === "number" ? `${minWidth}px` : minWidth}, 100%)`,
          background: "var(--surface)",
          borderColor: open ? "var(--primary)" : "var(--border)",
          color: "var(--text)",
          boxShadow: open ? "0 0 0 3px var(--ring)" : "none",
        }}
      >
        <span className="flex min-w-0 items-center gap-2">
          <School className="h-4 w-4 shrink-0" style={{ color: "var(--primary-strong)" }} />
          <span className="truncate">{current ? current.label : placeholder}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "var(--text-3)" }} />
      </button>

      <DropdownPanel pos={pos} menuRef={menuRef} onClose={close} className="p-2">
        {/* search */}
        <div className="relative mb-1.5 shrink-0">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: "var(--text-3)" }}
          />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered[0]) pick(filtered[0].value);
              if (e.key === "Escape") close();
            }}
            placeholder="Search class…"
            className="w-full rounded-lg border py-2 pl-8 pr-3 text-sm outline-none transition-colors focus:border-[var(--primary)]"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
          />
        </div>
        {/* options */}
        <div className="min-h-0 flex-1 overflow-y-auto thin-scroll">
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-xs" style={{ color: "var(--text-3)" }}>
              No class matches “{q}”
            </p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
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
                {o.sub && (
                  <span
                    className="ml-auto max-w-[40%] shrink-0 truncate text-[11px] font-medium"
                    style={{ color: "var(--text-3)" }}
                  >
                    {o.sub}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </DropdownPanel>
    </div>
  );
}
