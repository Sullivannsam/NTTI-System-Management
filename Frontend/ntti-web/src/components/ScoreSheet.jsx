import React, { useEffect, useMemo, useRef, useState } from "react";
import { Columns3, Merge, Pin, PinOff, Split, Undo2 } from "lucide-react";
import { orderedGroups, groupSpan } from "./scoreSheetModel";

/* Click-to-rename header label (group or subject column). */
function EditableLabel({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef(null);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);
  const commit = () => {
    setEditing(false);
    const v = draft.trim();
    if (v && v !== value) onSave(v);
  };
  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        onFocus={(e) => e.target.select()}
        className="w-full min-w-[60px] max-w-[150px] rounded-md border px-1.5 py-0.5 text-center text-[11px] font-bold uppercase tracking-wide outline-none"
        style={{ borderColor: "var(--primary)", color: "var(--text)", background: "var(--surface)" }}
      />
    );
  }
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setDraft(value);
        setEditing(true);
      }}
      className="mx-auto inline-block max-w-[150px] truncate rounded-md px-1.5 py-0.5 text-center text-[11px] font-bold uppercase tracking-wide underline-offset-2 hover:underline"
      style={{ color: "var(--text-2)", cursor: "text" }}
      title="Click to rename"
    >
      {value}
    </button>
  );
}

/**
 * Shared score-sheet grid used by the class sheet and the "(No class)" cheatsheet:
 * Excel-style grid lines, an optional two-row grouped header (merge + rename) and
 * arrow-key cell navigation.
 */
export default function ScoreSheet({
  rows = [],
  columns = [],
  groups = null,
  frozen,
  setFrozen,
  getValue,
  setValue,
  onBlur,
  onRenameColumn,
  onRenameGroup,
  onMerge,
  onSplit,
  onClearGroups,
  emptyNote = null,
}) {
  const [mergeMode, setMergeMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [mergeName, setMergeName] = useState("");

  const displayedGroups = useMemo(() => (groups ? orderedGroups({ columns, groups }) : []), [columns, groups]);

  /* spreadsheet-style cell navigation (arrow keys + Enter) */
  const cellRefs = useRef({});
  const cellOrder = useMemo(() => {
    const out = [];
    rows.forEach((r) => columns.forEach((c, si) => out.push({ key: `${r.key}:${si}`, si })));
    return out;
  }, [rows, columns]);

  const focusCell = (key) => {
    const el = cellRefs.current[key];
    if (el) {
      el.focus();
      try {
        el.select();
      } catch {
        /* ignore */
      }
    }
  };

  const onCellKeyDown = (e, key) => {
    const idx = cellOrder.findIndex((c) => c.key === key);
    if (idx === -1) return;
    const el = e.currentTarget;
    const len = el.value.length;
    const sel = (el.selectionEnd || 0) - (el.selectionStart || 0);
    const move = (delta) => {
      e.preventDefault();
      const next = cellOrder[idx + delta];
      if (next) focusCell(next.key);
    };
    switch (e.key) {
      case "ArrowRight":
        if (sel > 0 || (el.selectionEnd || 0) >= len) move(1);
        break;
      case "ArrowLeft":
        if (sel > 0 || (el.selectionStart || 0) <= 0) move(-1);
        break;
      case "ArrowUp":
        move(-columns.length);
        break;
      case "ArrowDown":
        move(columns.length);
        break;
      case "Enter":
        move(1);
        break;
      default:
        break;
    }
  };

  const toggleSelect = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const exitMerge = () => {
    setMergeMode(false);
    setSelected(new Set());
    setMergeName("");
  };

  const doMerge = () => {
    if (!selected.size) return;
    onMerge([...selected], mergeName.trim() || undefined);
    exitMerge();
  };
  const doSplit = () => {
    if (!selected.size) return;
    onSplit([...selected]);
    exitMerge();
  };
  const doClear = () => {
    onClearGroups();
    exitMerge();
  };

  const avgOf = (r) => {
    const nums = columns
      .map((c) => Number(getValue(r.key, c.key)))
      .filter((n) => Number.isFinite(n));
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  };

  const gradeOf = (avg) => {
    if (avg == null) return null;
    if (avg >= 90) return { g: "A", tone: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" };
    if (avg >= 80) return { g: "B", tone: "bg-sky-500/15 text-sky-600 border-sky-500/30" };
    if (avg >= 70) return { g: "C", tone: "bg-amber-500/15 text-amber-600 border-amber-500/30" };
    if (avg >= 60) return { g: "D", tone: "bg-orange-500/15 text-orange-600 border-orange-500/30" };
    return { g: "F", tone: "bg-red-500/15 text-red-600 border-red-500/30" };
  };

  const thStyle = (extra = {}) => ({
    background: "var(--surface)",
    textAlign: "center",
    ...extra,
  });

  const hasGroups = displayedGroups.length > 0;

  return (
    <div className="flex flex-col overflow-hidden">
      {/* header management bar */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
        {mergeMode ? (
          <>
            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-3)" }}>
              Merge headers
            </span>
            <input
              value={mergeName}
              onChange={(e) => setMergeName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doMerge()}
              placeholder="Group name (e.g. S1Y1)"
              className="input h-8 w-40 text-xs py-1"
            />
            <button
              onClick={doMerge}
              disabled={!selected.size}
              className="btn h-8 px-3 text-xs gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              <Merge size={13} /> Merge {selected.size || ""}
            </button>
            <button
              onClick={doSplit}
              disabled={!selected.size}
              className="btn btn-outline h-8 px-3 text-xs gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Split each selected column into its own group"
            >
              <Split size={13} /> Split
            </button>
            {hasGroups && (
              <button onClick={doClear} className="btn btn-ghost h-8 px-2.5 text-xs gap-1.5">
                <Undo2 size={13} /> Clear all
              </button>
            )}
            <button onClick={exitMerge} className="btn btn-ghost h-8 px-2.5 text-xs ml-auto">
              Cancel
            </button>
          </>
        ) : (
          <>
            {columns.length > 1 && (
              <button onClick={() => setMergeMode(true)} className="btn btn-ghost h-8 px-3 text-xs gap-1.5">
                <Columns3 size={13} /> Merge headers
              </button>
            )}
            <span className="hidden sm:inline text-[11px]" style={{ color: "var(--text-3)" }}>
              Click a header to rename it · select columns to group them under a merged heading
            </span>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setFrozen((f) => !f)}
            className={`btn h-8 px-2.5 text-xs gap-1.5 ${frozen ? "btn-primary" : "btn-outline"}`}
            title={frozen ? "Unlock the header — it scrolls away again" : "Freeze header like Excel — headers stay fixed while you scroll"}
          >
            {frozen ? <><PinOff size={13} /> Unfreeze</> : <><Pin size={13} /> Freeze</>}
          </button>
        </div>
      </div>

      {/* sheet */}
      <div className={frozen ? "max-h-[58vh] overflow-auto thin-scroll" : "overflow-x-auto thin-scroll"}>
        <table className="grid-table w-full min-w-[860px] text-sm">
          <thead className="sticky top-0 z-20">
            {hasGroups && (
              <tr>
                <th rowSpan={2} className="sticky left-0 z-30 text-left" style={{ minWidth: 190, padding: "0.875rem 1.25rem", background: "var(--surface)" }}>
                  Student
                </th>
                {displayedGroups.map((g) => {
                  const span = groupSpan(columns, g.id);
                  if (!span) return null;
                  return (
                    <th
                      key={g.id}
                      colSpan={span}
                      className="group"
                      style={{ ...thStyle({ padding: "0.4rem 0.5rem" }), minWidth: span * 108 }}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <EditableLabel value={g.name} onSave={(v) => onRenameGroup(g.id, v)} />
                        <button
                          onClick={() => onSplit(columns.filter((c) => c.group === g.id).map((c) => c.key))}
                          className="btn btn-ghost h-5 w-5 p-0 rounded opacity-0 group-hover:opacity-100"
                          title="Split this group so every column gets its own header"
                        >
                          <Split size={11} />
                        </button>
                      </div>
                    </th>
                  );
                })}
                <th rowSpan={2} style={thStyle({ padding: "0.875rem 0.5rem" })}>
                  Avg
                </th>
                <th rowSpan={2} style={thStyle({ padding: "0.875rem 0.75rem", paddingRight: 20 })}>
                  Grade
                </th>
              </tr>
            )}
            <tr>
              {!hasGroups && (
                <th className="sticky left-0 z-30 text-left" style={{ minWidth: 190, padding: "0.875rem 1.25rem", background: "var(--surface)" }}>
                  Student
                </th>
              )}
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="align-bottom"
                  title={c.label}
                  style={{
                    ...thStyle({ padding: hasGroups ? "0.5rem 0.35rem" : "0.875rem 0.5rem" }),
                    minWidth: 108,
                    maxWidth: 180,
                    whiteSpace: "normal",
                    lineHeight: 1.2,
                    wordBreak: "break-word",
                  }}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    {mergeMode && (
                      <input
                        type="checkbox"
                        checked={selected.has(c.key)}
                        onChange={() => toggleSelect(c.key)}
                        className="h-3.5 w-3.5 cursor-pointer"
                        title={selected.has(c.key) ? "Unselect" : "Select for merge"}
                      />
                    )}
                    <EditableLabel value={c.label} onSave={(v) => onRenameColumn(c.key, v)} />
                  </div>
                </th>
              ))}
              {!hasGroups && (
                <>
                  <th style={thStyle({ padding: "0.875rem 0.5rem" })}>Avg</th>
                  <th style={thStyle({ padding: "0.875rem 0.75rem", paddingRight: 20 })}>Grade</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="px-5 py-12 text-center" style={{ color: "var(--text-3)" }}>
                  {emptyNote}
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const avg = avgOf(r);
              const gr = gradeOf(avg);
              return (
                <tr key={r.key}>
                  <td className="sticky left-0 z-10 px-5 py-2.5" style={{ background: "var(--surface)" }}>
                    {r.node ? (
                      r.node
                    ) : (
                      <div className="min-w-0">
                        <span className="block truncate text-[13px] font-bold" style={{ color: "var(--text)" }}>
                          {r.name || "—"}
                        </span>
                        {r.sub && (
                          <span className="block truncate text-[10.5px]" style={{ color: "var(--text-3)" }}>
                            {r.sub}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  {columns.map((c, si) => {
                    const cellKey = `${r.key}:${si}`;
                    return (
                      <td key={c.key} className="px-2 py-2">
                        <div className="mx-auto w-full min-w-[68px] max-w-[130px]">
                          <input
                            ref={(el) => {
                              if (el) cellRefs.current[cellKey] = el;
                            }}
                            type="text"
                            inputMode="decimal"
                            maxLength={6}
                            value={getValue(r.key, c.key)}
                            onChange={(e) => setValue(r.key, c.key, e.target.value)}
                            onKeyDown={(e) => onCellKeyDown(e, cellKey)}
                            onFocus={(e) => e.target.select()}
                            onBlur={() => onBlur && onBlur(r.key, c.key)}
                            placeholder="–"
                            className="w-full bg-transparent border-b-2 border-transparent py-1.5 text-center text-[13px] font-bold outline-none transition-colors hover:border-[var(--border)] focus:border-[var(--primary)]"
                            style={{ color: "var(--text)" }}
                          />
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-2 py-2.5 text-center font-extrabold tabular-nums" style={{ color: avg == null ? "var(--text-3)" : "var(--text)" }}>
                    {avg == null ? "–" : avg.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-center" style={{ paddingRight: 20 }}>
                    {gr && (
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-extrabold ${gr.tone}`}>
                        {gr.g}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}