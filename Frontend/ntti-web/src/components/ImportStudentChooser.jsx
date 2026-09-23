import React from "react";
import Modal from "./Modal";
import { FileSpreadsheet, Search } from "lucide-react";

/**
 * "Import students" chooser shown inside a class detail — lets the user pick
 * one of the two ways to fill a class:
 *   1. Import from Excel (every row is added straight into the class)
 *   2. Select & search students (tick students already in the student panel)
 *
 * `className` is only used for the descriptive text.
 */
export default function ImportStudentChooser({ open, onClose, onExcel, onSelect, className }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import students"
      subtitle={`How do you want to add students to ${className || "this class"}?`}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onExcel}
          className="flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-soft"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "var(--primary-soft)", color: "var(--primary-strong)" }}
          >
            <FileSpreadsheet size={20} />
          </span>
          <span>
            <span className="block text-sm font-semibold" style={{ color: "var(--text)" }}>
              Import from Excel
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed" style={{ color: "var(--text-3)" }}>
              Upload an .xlsx / .xls / .csv file — every student in it is added straight into this
              class. Students already in the system are linked, not duplicated.
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={onSelect}
          className="flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-soft"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "var(--info-soft)", color: "var(--info)" }}
          >
            <Search size={20} />
          </span>
          <span>
            <span className="block text-sm font-semibold" style={{ color: "var(--text)" }}>
              Select &amp; search students
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed" style={{ color: "var(--text-3)" }}>
              Tick students that are already in the student panel (search by name, ID or username)
              and add them to this class.
            </span>
          </span>
        </button>
      </div>
    </Modal>
  );
}