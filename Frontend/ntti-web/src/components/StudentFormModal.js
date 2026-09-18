import React, { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { useApp } from "../context/AppContext";
import { MAJORS, classesOfMajor, ACADEMIC_LEVELS } from "../data/seed";
import Avatar from "./Avatar";

const makeForm = (classes, overrides = {}) => ({
  firstName: "",
  lastName: "",
  khmerName: "",
  photo: "",
  gender: "Male",
  dob: "",
  birthPlace: "",
  email: "",
  phone: "",
  fatherName: "",
  motherName: "",
  major: MAJORS[0].id,
  className: classesOfMajor(classes, MAJORS[0].id)[0]?.id || "",
  address: "Phnom Penh",
  status: "Learning",
  enrollmentYear: new Date().getFullYear(),
  level: "S1Y1",
  ...overrides,
});

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
          address: editing.address,
          status: editing.status,
          enrollmentYear: editing.enrollmentYear || new Date().getFullYear(),
          level: editing.level || "S1Y1",
        })
      );
    } else if (locked) {
      setForm(makeForm(classes, { major: locked.major, className: locked.id }));
    } else {
      setForm(makeForm(classes));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id, lockedClass]);

  const formClasses = useMemo(() => classesOfMajor(classes, form.major), [classes, form.major]);
  const classLocked = !!locked && !editing;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleMajorSelect = (e) => {
    const major = e.target.value;
    const firstClass = classesOfMajor(classes, major)[0]?.id || "";
    setForm((f) => ({ ...f, major, className: firstClass }));
  };

  const onPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // downscale so the data URL stays small enough for localStorage
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
      khmerName: form.khmerName.trim(),
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
      address: form.address,
      status: form.status,
      level: form.level,
      enrollmentYear: Number(form.enrollmentYear) || new Date().getFullYear(),
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
        <>
          <button onClick={onClose} className="btn btn-outline h-10 px-4 text-sm">Cancel</button>
          <button type="submit" form="student-form" className="btn btn-primary h-10 px-5 text-sm">
            {editing ? "Save changes" : "Add student"}
          </button>
        </>
      }
    >
      <form id="student-form" onSubmit={submit} className="flex flex-col gap-5 lg:flex-row">
        {/* left: personal photo */}
        <div
          className="flex shrink-0 flex-col items-center gap-3 rounded-xl p-4 lg:w-48"
          style={{ background: "var(--surface-2)" }}
        >
          <Avatar
            name={`${form.firstName} ${form.lastName}`}
            photo={form.photo || undefined}
            size="xl"
          />
          <label className="btn btn-outline h-9 w-full justify-center px-3 text-sm cursor-pointer">
            Upload photo
            <input type="file" accept="image/*" onChange={onPhoto} className="hidden" />
          </label>
          {form.photo && (
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, photo: "" }))}
              className="btn btn-ghost h-8 w-full justify-center px-3 text-sm !text-red-500"
            >
              Remove
            </button>
          )}
          <p className="text-center text-[10px]" style={{ color: "var(--text-3)" }}>
            JPG or PNG — auto-resized
          </p>
        </div>

        {/* right: fields */}
        <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4">
          {/* name in Khmer (primary) */}
          <div className="col-span-2 lg:col-span-4">
            <label className="label">Name in Khmer</label>
            <input
              className="input text-lg h-11"
              value={form.khmerName}
              onChange={set("khmerName")}
              placeholder="e.g. ជាប ចនារា"
            />
          </div>

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
            <label className="label">Place of birth</label>
            <input className="input" value={form.birthPlace} onChange={set("birthPlace")} placeholder="Province / city" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={set("phone")} placeholder="+855 …" />
          </div>
          <div className="col-span-2">
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={set("email")} placeholder="name@ntti.edu.kh" />
          </div>

          <div>
            <label className="label">Father's name</label>
            <input className="input" value={form.fatherName} onChange={set("fatherName")} placeholder="e.g. Chab Sopheak" />
          </div>
          <div>
            <label className="label">Mother's name</label>
            <input className="input" value={form.motherName} onChange={set("motherName")} placeholder="e.g. Sok Chanthy" />
          </div>
          <div className="col-span-2">
            <label className="label">Address</label>
            <input className="input" value={form.address} onChange={set("address")} placeholder="Province / city" />
          </div>

          <div>
            <label className="label">Major *</label>
            <select className="input" value={form.major} onChange={handleMajorSelect} disabled={classLocked}>
              {MAJORS.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Class *</label>
            <select className="input" value={form.className} onChange={set("className")} disabled={classLocked} key={form.major}>
              {formClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={set("status")}>
              <option>Learning</option>
              <option>Graduate</option>
              <option>Undergraduate</option>
            </select>
          </div>
          <div>
            <label className="label">Enrollment year</label>
            <select className="input" value={form.enrollmentYear} onChange={set("enrollmentYear")}>
              {Array.from({ length: 9 }, (_, i) => new Date().getFullYear() - (8 - i)).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2 lg:col-span-4">
            <label className="label">Academic level</label>
            <select className="input" value={form.level} onChange={set("level")}>
              {ACADEMIC_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>{lvl} · Semester {lvl[1]} · Year {lvl[3]}</option>
              ))}
            </select>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-3)" }}>
              Current position (1 semester = 15 weeks). Advance via "Pass exam" on the profile.
            </p>
          </div>
        </div>
      </form>
    </Modal>
  );
}