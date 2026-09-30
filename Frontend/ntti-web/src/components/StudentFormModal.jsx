import React, { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { useApp } from "../context/AppContext";
import { MAJORS, classesOfMajor, SHIFTS, FIELDS_OF_STUDY, latinToKhmer, levelsForMajor } from "../data/seed";
import Avatar from "./Avatar";

const makeForm = (classes, overrides = {}) => {
  const hasClass = overrides.className !== undefined && overrides.className !== "";
  const cls = hasClass
    ? classes.find((c) => c.id === overrides.className) || null
    : classesOfMajor(classes, overrides.major || MAJORS[0].id)[0] || classes[0] || null;
  const majorId = cls?.major || overrides.major || MAJORS[0].id;
  const classFields = cls
    ? { major: cls.major, className: cls.id, field: cls.field || FIELDS_OF_STUDY[cls.major]?.[0] || "", shift: cls.shift }
    : {};
  return {
    firstName: "",
    lastName: "",
    khmerName: "",
    studentId: "",
    username: "",
    photo: "",
    gender: "Male",
    dob: "",
    birthPlace: "",
    email: "",
    phone: "",
    fatherName: "",
    motherName: "",
    major: majorId,
    className: overrides.className || cls?.id || "",
    field: overrides.field || cls?.field || FIELDS_OF_STUDY[majorId]?.[0] || "",
    shift: overrides.shift || cls?.shift || SHIFTS[0],
    address: "Phnom Penh",
    status: "Learning",
    enrollmentYear: new Date().getFullYear(),
    graduationDate: "",
    level: "S1Y1",
    ...overrides,
    ...(cls ? classFields : {}),
  };
};

export default function StudentFormModal({ open, onClose, editing = null, lockedClass = null }) {
  const { students, classes, addStudent, updateStudent, showToast } = useApp();
  const locked = lockedClass ? classes.find((c) => c.id === lockedClass) : null;
  const [form, setForm] = useState(() => makeForm(classes));

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm(
        makeForm(classes, {
          firstName: editing.firstName,
          lastName: editing.lastName,
          khmerName: editing.khmerName || "",
          studentId: editing.studentId || "",
          username: editing.username || "",
          photo: editing.photo || "",
          gender: editing.gender,
          dob: editing.dob,
          birthPlace: editing.birthPlace || "",
          email: editing.email,
          phone: editing.phone,
          fatherName: editing.fatherName || "",
          motherName: editing.motherName || "",
          major: editing.major || (locked?.major ?? MAJORS[0].id),
          className: editing.className,
          field: editing.field || (locked?.field ?? (FIELDS_OF_STUDY[editing.major || locked?.major || MAJORS[0].id]?.[0] || "")),
          shift: editing.shift || locked?.shift || SHIFTS[0],
          address: editing.address,
          status: editing.status,
          enrollmentYear: editing.enrollmentYear || new Date().getFullYear(),
          graduationDate: editing.graduationDate || "",
          level: editing.level || "S1Y1",
        })
      );
    } else if (locked) {
      setForm(
        makeForm(classes, {
          major: locked.major,
          className: locked.id,
          field: locked.field || FIELDS_OF_STUDY[locked.major]?.[0] || "",
          shift: locked.shift || SHIFTS[0],
        })
      );
    } else {
      setForm(makeForm(classes));
    }
  }, [open, editing?.id, lockedClass]);

  const formClasses = useMemo(() => classesOfMajor(classes, form.major), [classes, form.major]);
  const classLocked = !!locked && !editing;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleMajorSelect = (e) => {
    const major = e.target.value;
    const firstClass = classesOfMajor(classes, major)[0] || null;
    const nextLevels = levelsForMajor(major);
    setForm((f) => ({
      ...f,
      major,
      className: firstClass?.id || "",
      field: firstClass?.field || FIELDS_OF_STUDY[major]?.[0] || "",
      shift: firstClass?.shift || f.shift,
      level: nextLevels.includes(f.level) ? f.level : nextLevels[0],
    }));
  };

  const handleClassSelect = (e) => {
    const cls = classes.find((c) => c.id === e.target.value);
    setForm((f) => ({
      ...f,
      className: e.target.value,
      major: cls?.major || f.major,
      field: cls?.field || f.field,
      shift: cls?.shift || f.shift,
    }));
  };

  const onPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 400;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        setForm((f) => ({ ...f, photo: canvas.toDataURL("image/jpeg", 0.85) }));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      showToast("First and last name are required", "error");
      return;
    }
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      khmerName:
        form.khmerName.trim() || latinToKhmer(`${form.lastName.trim()} ${form.firstName.trim()}`),
      photo: form.photo || "",
      gender: form.gender,
      dob: form.dob,
      birthPlace: form.birthPlace.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      fatherName: form.fatherName.trim(),
      motherName: form.motherName.trim(),
      major: form.major,
      className: form.className,
      field: form.field,
      shift: form.shift,
      username: form.username.trim(),
      address: form.address,
      status: form.status,
      level: form.level,
      enrollmentYear: Number(form.enrollmentYear) || new Date().getFullYear(),
      graduationDate: form.graduationDate || "",
    };
    if (editing) {
      updateStudent(editing.id, payload);
      showToast("Student updated");
    } else {
      addStudent({
        ...payload,
        studentId: `NTTI-${payload.enrollmentYear}-${String(students.length + 1).padStart(4, "0")}`,
        enrollmentDate: `${payload.enrollmentYear}-09-01`,
      });
      showToast("Student added successfully");
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? editing.khmerName || `${editing.firstName} ${editing.lastName}` : "Add new student"}
      subtitle={editing ? `${editing.firstName} ${editing.lastName}` : "Create a new enrollment record"}
      size="2xl"
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
            form="student-form" 
            className="px-5 py-2 rounded-lg font-medium text-sm bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            {editing ? "Save changes" : "Add student"}
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
          border-color: #10b981;
          box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.1);
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
          text-transform: none;
          letter-spacing: 0;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .form-section-title {
          font-size: 0.75rem;
          font-weight: 700;
          color: #0f172a;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-top: 0.875rem;
          margin-bottom: 0.5rem;
          padding-top: 0.625rem;
          border-top: 1px solid #e2e8f0;
        }

        .form-section-title:first-child {
          margin-top: 0;
          padding-top: 0;
          border-top: none;
        }

        .photo-card {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border: 1px solid #e2e8f0;
          border-radius: 0.6rem;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
        }

        .upload-button {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: #475569;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 0.4rem;
          cursor: pointer;
          transition: all 200ms;
        }

        .upload-button:hover {
          background: #f1f5f9;
          border-color: #94a3b8;
        }

        .upload-button:active {
          background: #e2e8f0;
        }

        .remove-button {
          width: 100%;
          padding: 0.5rem 0.75rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: #ef4444;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 0.4rem;
          cursor: pointer;
          transition: all 200ms;
        }

        .remove-button:hover {
          background: #fee2e2;
          border-color: #fca5a5;
        }

        .form-hint {
          font-size: 0.7rem;
          color: #64748b;
          margin-top: 0.15rem;
        }
      `}</style>

      <form id="student-form" onSubmit={submit} className="flex flex-col gap-3 lg:gap-4">
        <div className="flex flex-col lg:flex-row lg:gap-5">
          {/* Left: Photo section */}
          <div className="lg:w-48 shrink-0">
            <div className="photo-card">
              <Avatar
                name={`${form.firstName} ${form.lastName}`}
                photo={form.photo || undefined}
                size="xl"
              />
              <label className="upload-button">
                Upload photo
                <input type="file" accept="image/*" onChange={onPhoto} className="hidden" />
              </label>
              {form.photo && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, photo: "" }))}
                  className="remove-button"
                >
                  Remove photo
                </button>
              )}
              <p className="form-hint text-center">
                JPG or PNG, max 400px
              </p>
            </div>
          </div>

<<<<<<< HEAD
          {/* Right: Form fields */}
          <div className="flex-1">
            <div className="space-y-3">
              {/* Khmer name and Student ID */}
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Khmer Name</label>
                  <input
                    className="modern-input text-sm py-1.5"
                    value={form.khmerName}
                    onChange={set("khmerName")}
                    placeholder="ឧ. ជាប ចនារា"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Student ID</label>
                  <input
                    className="modern-input text-sm py-1.5"
                    value={form.studentId}
                    onChange={set("studentId")}
                    placeholder={editing ? "Auto-assigned" : "Auto-generated"}
                    disabled={editing}
                  />
                  {!editing && (
                    <p className="form-hint">
                      Auto-generated on save
                    </p>
                  )}
                </div>
              </div>
=======
          <div>
            <label className="label">First name (EN) *</label>
            <input className="input" value={form.firstName} onChange={set("firstName")} placeholder="e.g. Chab" />
          </div>
          <div>
            <label className="label">Last name (EN) *</label>
            <input className="input" value={form.lastName} onChange={set("lastName")} placeholder="e.g. Channara" />
          </div>
          <div>
            <label className="label">Gender</label>
            <select className="input" value={form.gender} onChange={set("gender")}>
              <option>Male</option>
              <option>Female</option>
            </select>
          </div>
          <div>
            <label className="label">Date of birth</label>
            <input type="date" className="input" value={form.dob} onChange={set("dob")} />
          </div>
          <div>
            <label className="label">Date of graduation</label>
            <input type="date" className="input" value={form.graduationDate} onChange={set("graduationDate")} />
          </div>
>>>>>>> 95d396a80ae72a6c8937119cb840ba74ea90d8b8

              {/* Personal info */}
              <div className="form-section-title">Personal Information</div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">First name English *</label>
                  <input 
                    className="modern-input" 
                    value={form.firstName} 
                    onChange={set("firstName")} 
                    placeholder="Chab" 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Last name English *</label>
                  <input 
                    className="modern-input" 
                    value={form.lastName} 
                    onChange={set("lastName")} 
                    placeholder="Channara" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select className="modern-input" value={form.gender} onChange={set("gender")}>
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date of birth</label>
                  <input type="date" className="modern-input" value={form.dob} onChange={set("dob")} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Place of birth</label>
                  <input 
                    className="modern-input" 
                    value={form.birthPlace} 
                    onChange={set("birthPlace")} 
                    placeholder="Province" 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input 
                    className="modern-input" 
                    value={form.phone} 
                    onChange={set("phone")} 
                    placeholder="+855 …" 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input 
                  type="email" 
                  className="modern-input" 
                  value={form.email} 
                  onChange={set("email")} 
                  placeholder="name@ntti.edu.kh" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Father's name</label>
                  <input 
                    className="modern-input" 
                    value={form.fatherName} 
                    onChange={set("fatherName")} 
                    placeholder="Chab Sopheak" 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Mother's name</label>
                  <input 
                    className="modern-input" 
                    value={form.motherName} 
                    onChange={set("motherName")} 
                    placeholder="Sok Chanthy" 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <input 
                  className="modern-input" 
                  value={form.address} 
                  onChange={set("address")} 
                  placeholder="Province / city" 
                />
              </div>

              {/* Academic info */}
              <div className="form-section-title">Academic Information</div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Major *</label>
                  <select 
                    className="modern-input" 
                    value={form.major} 
                    onChange={handleMajorSelect} 
                    disabled={classLocked}
                  >
                    {MAJORS.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Class *</label>
                  <select 
                    className="modern-input" 
                    value={form.className} 
                    onChange={handleClassSelect} 
                    disabled={classLocked} 
                    key={form.major}
                  >
                    {formClasses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Field of study</label>
                  <select className="modern-input" value={form.field} onChange={set("field")} key={form.major}>
                    {(FIELDS_OF_STUDY[form.major] || []).map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Shift</label>
                  <select className="modern-input" value={form.shift} onChange={set("shift")}>
                    {SHIFTS.map((sh) => (
                      <option key={sh} value={sh}>{sh}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="modern-input" value={form.status} onChange={set("status")}>
                    <option>Learning</option>
                    <option>Graduate</option>
                    <option>Undergraduate</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Enrollment year</label>
                  <select className="modern-input" value={form.enrollmentYear} onChange={set("enrollmentYear")}>
                    {Array.from({ length: 9 }, (_, i) => new Date().getFullYear() - (8 - i)).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Username</label>
                <input 
                  className="modern-input" 
                  value={form.username} 
                  onChange={set("username")} 
                  placeholder="chab.channara" 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Academic level</label>
                <select className="modern-input" value={form.level} onChange={set("level")}>
                  {levelsForMajor(form.major).map((lvl) => (
                    <option key={lvl} value={lvl}>{lvl} · Semester {lvl[1]} · Year {lvl[3]}</option>
                  ))}
                </select>
                <p className="form-hint">
                  Current position (1 semester = 15 weeks). Students advance via "Next semester".
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}