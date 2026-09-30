import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import { useApp } from "../context/AppContext";
import { MAJORS, SHIFTS, YEARS, SEMESTERS, DEGREES, FIELDS_OF_STUDY } from "../data/seed";

const makeInitial = (ed) =>
  ed
    ? {
        name: ed.name,
        major: ed.major,
        field: ed.field || FIELDS_OF_STUDY[ed.major]?.[0] || "",
        shift: ed.shift,
        year: ed.year,
        semester: ed.semester,
        degree: ed.degree,
      }
    : {
        name: "",
        major: MAJORS[0].id,
        field: FIELDS_OF_STUDY[MAJORS[0].id][0],
        shift: SHIFTS[0],
        year: YEARS[0],
        semester: SEMESTERS[0],
        degree: DEGREES[0],
      };

export default function ClassFormModal({ open, onClose, editing = null }) {
  const { addClass, updateClass, showToast } = useApp();
  const [form, setForm] = useState(makeInitial(editing));

  useEffect(() => {
    if (open) setForm(makeInitial(editing));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleMajor = (e) => {
    const major = e.target.value;
    setForm((f) => ({ ...f, major, field: FIELDS_OF_STUDY[major]?.[0] || "" }));
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast("Class name is required", "error");
      return;
    }
    const payload = {
      name: form.name.trim(),
      major: form.major,
      field: form.field,
      shift: form.shift,
      year: form.year,
      semester: form.semester,
      degree: form.degree,
    };
    if (editing) {
      updateClass(editing.id, payload);
      showToast(`Class "${payload.name}" updated`);
    } else {
      addClass(payload);
      showToast(`Class "${payload.name}" created`);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit class" : "Add new class"}
      subtitle={
        editing
          ? "Update the class details — changes apply everywhere it's used."
          : "Create a class — it appears in the Classes table, in class pickers and on the Attendance page."
      }
      size="md"
      footer={
        <div className="flex gap-2 justify-end">
          <button 
            onClick={onClose} 
            className="px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 hover:bg-slate-100 text-slate-700"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            form="class-form" 
            className="px-5 py-2 rounded-lg font-medium text-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            {editing ? "Save changes" : "Create class"}
          </button>
        </div>
      }
    >
      <style>{`
        .modern-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          line-height: 1.4;
          border: 1px solid #e2e8f0;
          border-radius: 0.4rem;
          background: #ffffff;
          transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
          font-family: inherit;
        }
        
        .modern-input:hover {
          border-color: #cbd5e1;
        }
        
        .modern-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
          background: #fafbfc;
        }
        
        .modern-input:disabled {
          background: #f8fafc;
          border-color: #e2e8f0;
          color: #94a3b8;
          cursor: not-allowed;
        }

        .form-label {
          display: block;
          margin-bottom: 0.25rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: #334155;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .shift-button {
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          font-weight: 500;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          background: #f8fafc;
          color: #475569;
          cursor: pointer;
          transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        .shift-button:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
        }

        .shift-button.active {
          background: #3b82f6;
          color: #ffffff;
          border-color: #3b82f6;
          box-shadow: 0 4px 12px -2px rgba(59, 130, 246, 0.3);
        }
      `}</style>

      <form id="class-form" onSubmit={submit} className="flex flex-col gap-4">
        {/* Class name - full width */}
        <div className="form-group">
          <label className="form-label">Class name *</label>
          <input 
            className="modern-input" 
            value={form.name} 
            onChange={set("name")} 
            placeholder="e.g. IT09B3, AI Engineering" 
            autoFocus 
          />
        </div>

        {/* Row 1: Field of Study & Major */}
        <div className="grid grid-cols-2 gap-3">
          <div className="form-group">
            <label className="form-label">Field of study *</label>
            <select className="modern-input" value={form.field} onChange={set("field")}>
              {(FIELDS_OF_STUDY[form.major] || []).map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Major *</label>
            <select className="modern-input" value={form.major} onChange={handleMajor}>
              {MAJORS.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Degree & Year */}
        <div className="grid grid-cols-2 gap-3">
          <div className="form-group">
            <label className="form-label">Degree</label>
            <select className="modern-input" value={form.degree} onChange={set("degree")}>
              {DEGREES.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Year</label>
            <select className="modern-input" value={form.year} onChange={set("year")}>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3: Semester */}
        <div className="form-group">
          <label className="form-label">Semester</label>
          <select className="modern-input" value={form.semester} onChange={set("semester")}>
            {SEMESTERS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Row 4: Shift buttons */}
        <div className="form-group">
          <label className="form-label">Shift</label>
          <div className="flex gap-2">
            {SHIFTS.map((sh) => (
              <button
                key={sh}
                type="button"
                onClick={() => setForm((f) => ({ ...f, shift: sh }))}
                className={`shift-button flex-1 ${form.shift === sh ? 'active' : ''}`}
              >
                {sh}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}