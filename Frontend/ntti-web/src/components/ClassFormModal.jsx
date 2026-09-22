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
        <>
          <button onClick={onClose} className="btn btn-outline h-10 px-4 text-sm">Cancel</button>
          <button type="submit" form="class-form" className="btn btn-primary h-10 px-5 text-sm">
            {editing ? "Save changes" : "Create class"}
          </button>
        </>
      }
    >
      <form id="class-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Class name *</label>
          <input className="input" value={form.name} onChange={set("name")} placeholder="e.g. IT09B3, AI Engineering" autoFocus />
        </div>
        <div>
          <label className="label">Field of study *</label>
          <select className="input" value={form.field} onChange={set("field")}>
            {(FIELDS_OF_STUDY[form.major] || []).map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Major *</label>
          <select className="input" value={form.major} onChange={handleMajor}>
            {MAJORS.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Degree</label>
          <select className="input" value={form.degree} onChange={set("degree")}>
            {DEGREES.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Year</label>
          <select className="input" value={form.year} onChange={set("year")}>
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Semester</label>
          <select className="input" value={form.semester} onChange={set("semester")}>
            {SEMESTERS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <p className="w-full rounded-xl px-3 py-2.5 text-[11px] leading-relaxed" style={{ background: "var(--primary-soft)", color: "var(--primary-strong)" }}>
            Class hours are set automatically from the shift: Morning 7:30 AM – 12:00 PM · Evening 2:00 – 5:00 PM · Night 5:30 – 8:30 PM
          </p>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Shift</label>
          <div className="grid grid-cols-3 gap-2">
            {SHIFTS.map((sh) => (
              <button
                key={sh}
                type="button"
                onClick={() => setForm((f) => ({ ...f, shift: sh }))}
                className="btn h-10 rounded-xl text-sm transition-all duration-200"
                style={
                  form.shift === sh
                    ? { background: "var(--primary)", color: "#fff", boxShadow: "0 6px 14px -4px var(--ring)" }
                    : { background: "var(--surface-2)", color: "var(--text-2)" }
                }
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