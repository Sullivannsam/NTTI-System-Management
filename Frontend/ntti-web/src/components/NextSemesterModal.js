import React, { useEffect, useMemo, useState } from "react";
import { Check, Flag, UserRoundX } from "lucide-react";
import Modal from "./Modal";

/**
 * "Next semester" confirmation with a student roster so the admin chooses who
 * moves up. Everyone is selected by default; clearing the list advances nobody
 * and the new term starts empty (those students stay at the finished level and
 * can be imported again later).
 */
export default function NextSemesterModal({
  open,
  onClose,
  cls,
  students = [],
  currentLevel,
  nextLevelCode,
  onConfirm,
}) {
  const roster = useMemo(
    () => students.filter((s) => cls && s.className === cls.id && s.status !== "Graduate"),
    [students, cls]
  );

  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (open) setSelected(roster.map((s) => s.id));
  }, [open, roster]);

  const allOn = roster.length > 0 && selected.length === roster.length;
  const stays = roster.length - selected.length;

  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={nextLevelCode ? "Advance to the next semester" : "Finish the programme"}
      subtitle={cls ? `${currentLevel} → ${nextLevelCode || "Graduation"} · ${cls.name}` : ""}
      footer={
        <>
          <button onClick={onClose} className="btn btn-outline h-10 px-4 text-sm">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selected)}
            className="btn h-10 px-5 text-sm text-white gap-1.5"
            style={{ background: "var(--warning)" }}
          >
            <Flag size={16} /> Confirm · {selected.length} student{selected.length === 1 ? "" : "s"}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm" style={{ color: "var(--text-2)" }}>
        <div>
          <p>
            This finishes <b style={{ color: "var(--text)" }}>{currentLevel} · {cls?.year} {cls?.semester}</b> for{" "}
            <b style={{ color: "var(--text)" }}>{cls?.name}</b> and:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>keeps {currentLevel} as a <b>finished</b> record in the programme timeline;</li>
            <li>saves every student&apos;s scores and attendance — captured automatically, even without pressing Save;</li>
            <li>
              moves only the <b>selected</b> students {nextLevelCode ? <>to <b>{nextLevelCode}</b></> : <>to <b>graduation</b></>};
            </li>
            <li>
              leaves unselected students at {currentLevel} (no class) so they can be imported again —{" "}
              <b>select none and the new term starts empty</b>;
            </li>
            <li>clears the live score sheet, attendance sheet, and blanks the schedule for the new term.</li>
          </ul>
        </div>

        <div className="rounded-xl border" style={{ borderColor: "var(--border)" }}>
          <div
            className="flex items-center gap-2 px-3 py-2"
            style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}
          >
            <span className="font-semibold text-xs uppercase tracking-wide" style={{ color: "var(--text-2)" }}>
              Students to advance
            </span>
            <span className="text-xs tabular-nums" style={{ color: "var(--text-3)" }}>
              {selected.length}/{roster.length}
            </span>
            <button
              onClick={() => setSelected(allOn ? [] : roster.map((s) => s.id))}
              disabled={roster.length === 0}
              className="ml-auto btn btn-ghost h-8 px-2.5 text-xs gap-1.5 disabled:opacity-40"
              style={{ color: "var(--primary-strong)" }}
            >
              <Check size={14} /> {allOn ? "Clear all" : "Select all"}
            </button>
          </div>

          {roster.length === 0 ? (
            <p className="px-3 py-5 text-center text-xs" style={{ color: "var(--text-3)" }}>
              No students in this class. The new term will start empty.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto thin-scroll">
              {roster.map((s) => {
                const on = selected.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(s.id)}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold" style={{ color: "var(--text)" }}>
                        {s.khmerName || `${s.firstName} ${s.lastName}`}
                      </span>
                      <span className="block truncate text-[11px]" style={{ color: "var(--text-3)" }}>
                        {s.khmerName ? `${s.firstName} ${s.lastName}` : ""}
                        {s.studentId ? `${s.khmerName ? " · " : ""}${s.studentId}` : ""} · {s.level}
                      </span>
                    </span>
                    {!on && <UserRoundX size={15} style={{ color: "var(--text-3)" }} title="Will stay behind" />}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-xs" style={{ color: stays ? "var(--warning)" : "var(--text-3)" }}>
          {stays
            ? `${stays} student${stays === 1 ? "" : "s"} will stay at ${currentLevel} and can be imported again.`
            : "All students will advance."}
        </p>
        <p className="text-xs" style={{ color: "var(--text-3)" }}>This cannot be undone.</p>
      </div>
    </Modal>
  );
}
