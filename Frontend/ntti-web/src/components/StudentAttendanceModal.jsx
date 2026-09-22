import React from "react";
import Modal from "./Modal";
import AttendanceDayTable from "./AttendanceDayTable";

/** Pop-up week-by-week attendance for a single student. */
export default function StudentAttendanceModal({ student, records = [], weeks, onClose }) {
  return (
    <Modal
      open={!!student}
      onClose={onClose}
      size="xl"
      title={student ? `Attendance · ${student.khmerName || `${student.firstName} ${student.lastName}`}` : ""}
      subtitle={
        student
          ? `${student.khmerName ? `${student.firstName} ${student.lastName} · ` : ""}${student.studentId || ""} · week by week, Monday to Sunday`
          : ""
      }
      footer={
        <button onClick={onClose} className="btn btn-primary h-10 px-5 text-sm">
          Close
        </button>
      }
    >
      <AttendanceDayTable records={records} weeks={weeks} />
    </Modal>
  );
}
