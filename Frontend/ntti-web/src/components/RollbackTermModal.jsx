import React, { useEffect, useState } from "react";
import { Undo2 } from "lucide-react";
import Modal from "./Modal";

/**
 * "Undo last semester" confirmation. Rolls a class back to the level before its
 * most recent rollover, so an accidental "Next semester" is not a one-way trip.
 * Lists exactly what goes back — class level, students, score sheet, schedule —
 * and warns when the archive is too old to restore attendance days.
 */
export default function RollbackTermModal({ open, onClose, cls, term, currentLevel, onConfirm }) {
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) setConfirmed(false);
  }, [open]);

  const rows = term?.rows || [];
  const withScores = rows.filter((r) => Object.keys(r.scores || {}).length).length;
  const recs = term?.attendanceRecords || [];
  /* archives taken before the subject was stored cannot be filed back to a
     subject column, so those days stay gone */
  const unfiled = recs.filter((r) => !(r && r.subject)).length;
  const fileable = recs.length - unfiled;
  const prevLevel = term?.level || "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Roll back to the previous semester"
      subtitle={cls ? `${currentLevel || "Now"} → ${prevLevel} · ${cls.name}` : ""}
      footer={
        <>
          <button onClick={onClose} className="btn btn-outline h-10 px-4 text-sm">
            Cancel
          </button>
          <button
            onClick={() => onConfirm()}
            disabled={!confirmed}
            className="btn h-10 px-5 text-sm text-white gap-1.5 disabled:cursor-not-allowed"
            style={{ background: "var(--warning)", opacity: confirmed ? 1 : 0.45 }}
            title={confirmed ? "Roll this class back one semester" : "Tick the confirmation box first"}
          >
            <Undo2 size={16} /> Roll back to {prevLevel}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm" style={{ color: "var(--text-2)" }}>
        <p>
          This undoes the last <b style={{ color: "var(--text)" }}>Next semester</b> on{" "}
          <b style={{ color: "var(--text)" }}>{cls?.name}</b>. Everything that rollover changed is taken from
          its own archive, so nothing has to be retyped:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            puts the class back to <b>{prevLevel}</b> ({term?.year} · {term?.semester});
          </li>
          <li>
            moves its students back to {prevLevel}, undoes their graduation where it happened, and returns the
            ones that were left behind to the class;
          </li>
          <li>
            removes the {prevLevel} entry from the programme timeline, so it is no longer marked finished;
          </li>
          <li>
            restores the score sheet
            {withScores > 0 && (
              <>
                {" "}
                (<b>{withScores}</b> of {rows.length} students had scores saved)
              </>
            )}
            ;
          </li>
          <li>
            puts the timetable back — {term?.subjects?.filter(Boolean).length || 0} subjects, their teachers and
            their day/time slots;
          </li>
          {fileable > 0 && (
            <li>
              brings back <b>{fileable}</b> cleared attendance day{fileable === 1 ? "" : "s"};
            </li>
          )}
        </ul>

        {unfiled > 0 && (
          <p
            className="rounded-lg border px-3 py-2 text-xs"
            style={{ borderColor: "var(--warning)", color: "var(--text-2)", background: "rgba(245,158,11,.08)" }}
          >
            <b>{unfiled}</b> attendance day{unfiled === 1 ? "" : "s"} in this archive cannot be brought back —
            it was saved without the subject they belong to. Scores, levels and the timetable still roll back.
          </p>
        )}

        <p className="text-xs" style={{ color: "var(--text-3)" }}>
          The archive entry is removed, so this can only be done once per rollover. Students moved to the next
          semester since then are not affected.
        </p>

        <button
          onClick={() => setConfirmed((c) => !c)}
          className="flex w-full items-start gap-2.5 rounded-xl border px-3 py-3 text-left transition-colors"
          style={{
            borderColor: confirmed ? "var(--warning)" : "var(--border)",
            background: confirmed ? "rgba(245,158,11,.08)" : "transparent",
          }}
        >
          <span
            className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-md border"
            style={{
              borderColor: confirmed ? "var(--warning)" : "var(--border)",
              background: confirmed ? "var(--warning)" : "transparent",
            }}
          >
            {confirmed && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold leading-snug" style={{ color: "var(--text)" }}>
              Yes — roll {cls?.name} back to {prevLevel}
            </span>
            <span className="block text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
              Students, scores and the timetable go back one semester.
            </span>
          </span>
        </button>
      </div>
    </Modal>
  );
}
