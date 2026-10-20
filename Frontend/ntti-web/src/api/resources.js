/**
 * One entry per piece of data the app reads or writes.
 *
 *   path  REST endpoint on the backend (implement these against client.js).
 *   ls    the localStorage key the app used before the API existed. It is kept
 *         as an offline fallback cache, so this table is also the map between
 *         "what the app calls a resource" and "what it used to call a key".
 *
 * Collection endpoints are intentionally simple: GET returns the whole value
 * and PUT replaces it. The school dataset is small (hundreds of rows), and the
 * frontend already thinks in whole collections, so this keeps the backend
 * trivial to implement. Item-level paths are listed where they make sense.
 */
export const RESOURCES = {
  students: { path: "/api/students", ls: "ntti.students.v2", label: "Students" },
  classes: { path: "/api/classes", ls: "ntti.classes.v1", label: "Classes" },
  classDrafts: { path: "/api/classes/drafts", ls: "ntti.classes.drafts.v1", label: "Class drafts" },
  attendance: { path: "/api/attendance", ls: "ntti.attendance.v2", label: "Attendance" },
  weekly: { path: "/api/attendance/weekly", ls: "ntti.weekly.v1", label: "Weekly attendance" },
  weeklyWeeks: { path: "/api/attendance/weeks", ls: "ntti.weekly.weeks.v1", label: "Week plan" },
  weeklyExtra: { path: "/api/attendance/weeks/extra", ls: "ntti.weekly.extra.v1", label: "Extra weeks" },
  scores: { path: "/api/scores", ls: "ntti.scores.v1", label: "Scores" },
  scoresLayout: { path: "/api/scores/layout", ls: "ntti.scores.layout.v1", label: "Score columns" },
  scoresNone: { path: "/api/scores/none", ls: "ntti.scores.none.v1", label: "Score exceptions" },
  scoresSelected: { path: "/api/scores/selected", ls: "ntti.scores.selected.v1", label: "Selected score sheet" },
  scoresSelectedClass: { path: "/api/scores/selected-class", ls: "ntti.scores.selectedClass.v1", label: "Selected class" },
  schedule: { path: "/api/schedule", ls: "ntti.schedule.v2", label: "Schedule" },
  scheduleLegacy: { path: "/api/schedule/legacy", ls: "ntti.schedule.v1", label: "Legacy schedule", readOnly: true },
  admins: { path: "/api/admins", ls: "ntti.admins.v1", label: "Administrators" },
  audit: { path: "/api/audit", ls: "ntti.audit.v1", label: "Audit log" },
  billboardSelected: { path: "/api/billboard/selected", ls: "ntti.billboard.selected.v1", label: "Billboard selection" },
  rankingsSelected: { path: "/api/rankings/selected", ls: "ntti.rankings.selected.v1", label: "Rankings selection" },
  attendanceClasses: { path: "/api/attendance/classes", ls: "ntti.attendance.classes.v1", label: "Attendance selection" },
};

/** localStorage key -> resource name, for the shim's lookups. */
export const RESOURCE_BY_LS = Object.entries(RESOURCES).reduce((acc, [name, r]) => {
  acc[r.ls] = { name, ...r };
  return acc;
}, {});

/**
 * Keys that stay on the device on purpose: pure UI preferences and the login
 * session. The backend is not the right home for these (a server-side session
 * belongs with real auth, which is a later step).
 */
export const LOCAL_ONLY_KEYS = new Set([
  "ntti.auth",
  "ntti.theme",
  "ntti.lastip.v1",
  "ntti.seed.v1",
  "ntti.sidebar.collapsed.v1",
  "ntti.students.v2.backup",
]);
