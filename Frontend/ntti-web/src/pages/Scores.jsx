import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardList,
  Plus,
  Save,
  RotateCcw,
  AlertTriangle,
  FileSpreadsheet,
  Link2,
  Pin,
  PinOff,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import PageHeader, { EmptyState } from "../components/Page";
import ClassSelect from "../components/ClassSelect";
import ScoreImportModal from "../components/ScoreImportModal";

const SCORES_KEY = "ntti.scores.v1";
const SCHED_KEY = "ntti.schedule.v2";
const NONE_META_KEY = "ntti.scores.none.v1";

function loadScores() {
  try {
    const raw = JSON.parse(localStorage.getItem(SCORES_KEY));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function loadSchedules() {
  try {
    const raw = JSON.parse(localStorage.getItem(SCHED_KEY));
    return raw && Array.isArray(raw.schedules) ? raw.schedules : [];
  } catch {
    return [];
  }
}

/* the "(No class)" cheatsheet — subjects + rows come straight from an imported file */
function loadNoneMeta() {
  try {
    const raw = JSON.parse(localStorage.getItem(NONE_META_KEY));
    if (raw && Array.isArray(raw.subjects) && Array.isArray(raw.rows)) return raw;
  } catch {
    /* ignore */
  }
  return null;
}

const gradeOf = (avg) => {
  if (avg == null) return null;
  if (avg >= 90) return { g: "A", tone: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" };
  if (avg >= 80) return { g: "B", tone: "bg-sky-500/15 text-sky-600 border-sky-500/30" };
  if (avg >= 70) return { g: "C", tone: "bg-amber-500/15 text-amber-600 border-amber-500/30" };
  if (avg >= 60) return { g: "D", tone: "bg-orange-500/15 text-orange-600 border-orange-500/30" };
  return { g: "F", tone: "bg-red-500/15 text-red-600 border-red-500/30" };
};

/* "(No class)" cheatsheet — built from an imported file, so the subjects and
   student names are exactly what the file contains (nothing guessed). */
function NoneSheet({ meta, onScore, onClear }) {
  const { subjects = [], rows = [], scores = {} } = meta || {};
  const [frozen, setFrozen] = useState(false);
  const noneRefs = useRef({});
  if (!rows.length) return null;

  /* spreadsheet-style cell navigation: arrow keys + Enter jump between cells */
  const noneOrder = [];
  rows.forEach((r) => subjects.forEach((sub, si) => noneOrder.push({ key: `${r.key}:${si}`, si })));
  const focusNoneCell = (key) => {
    const el = noneRefs.current[key];
    if (el) {
      el.focus();
      try {
        el.select();
      } catch {
        /* ignore */
      }
    }
  };
  const noneKeyDown = (e, key) => {
    const idx = noneOrder.findIndex((c) => c.key === key);
    if (idx === -1) return;
    const el = e.currentTarget;
    const len = el.value.length;
    const sel = (el.selectionEnd || 0) - (el.selectionStart || 0);
    const move = (delta) => {
      e.preventDefault();
      const next = noneOrder[idx + delta];
      if (next) focusNoneCell(next.key);
    };
    switch (e.key) {
      case "ArrowRight":
        if (sel > 0 || (el.selectionEnd || 0) >= len) move(1);
        break;
      case "ArrowLeft":
        if (sel > 0 || (el.selectionStart || 0) <= 0) move(-1);
        break;
      case "ArrowUp":
        move(-subjects.length);
        break;
      case "ArrowDown":
        move(subjects.length);
        break;
      case "Enter":
        move(1);
        break;
      default:
        break;
    }
  };

  return (
    <div className="overflow-hidden">
      {/* header bar */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div>
          <p className="text-base font-bold" style={{ color: "var(--text)" }}>(No class) — cheatsheet</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-2)" }}>
            {subjects.length} subject{subjects.length === 1 ? "" : "s"} · {rows.length} student{rows.length === 1 ? "" : "s"} — columns and names come straight from the imported file
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFrozen((f) => !f)}
            className={`btn h-9 px-3 text-sm gap-1.5 ${frozen ? "btn-primary" : "btn-outline"}`}
            title={
              frozen
                ? "Unlock the header — the subject row and name column scroll away again"
                : "Freeze header like Excel — the subject row and name column stay fixed while you scroll"
            }
          >
            {frozen ? <><PinOff size={14} /> Unfreeze</> : <><Pin size={14} /> Freeze</>}
          </button>
          <button
            onClick={onClear}
            className="btn btn-outline h-9 px-3 text-sm gap-1.5 !text-red-500"
            title="Remove this (No class) cheatsheet"
          >
            <RotateCcw size={14} /> Clear
          </button>
        </div>
      </div>

      <div className={frozen ? "max-h-[62vh] overflow-auto thin-scroll" : "overflow-x-auto thin-scroll"}>
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
              <th
                className={`sticky left-0 min-w-[190px] px-5 py-3.5 ${frozen ? "top-0 z-30" : "z-10"}`}
                style={{ background: "var(--surface)", ...(frozen ? { borderBottom: "1px solid var(--border)" } : {}) }}
              >
                Student
              </th>
              {subjects.map((sub, i) => (
                <th
                  key={i}
                  className={`px-2 py-3 text-center align-bottom${frozen ? " sticky top-0 z-20" : ""}`}
                  title={sub}
                  style={{
                    minWidth: 108,
                    maxWidth: 180,
                    whiteSpace: "normal",
                    lineHeight: 1.2,
                    wordBreak: "break-word",
                    background: frozen ? "var(--surface)" : undefined,
                    ...(frozen ? { borderBottom: "1px solid var(--border)" } : {}),
                  }}
                >
                  {sub}
                </th>
              ))}
              <th
                className={`px-2 py-3.5 text-center${frozen ? " sticky top-0 z-20" : ""}`}
                style={{ background: frozen ? "var(--surface)" : undefined, ...(frozen ? { borderBottom: "1px solid var(--border)" } : {}) }}
              >
                Avg
              </th>
              <th
                className={`px-4 py-3.5 text-center${frozen ? " sticky top-0 z-20" : ""}`}
                style={{ paddingRight: 20, background: frozen ? "var(--surface)" : undefined, ...(frozen ? { borderBottom: "1px solid var(--border)" } : {}) }}
              >
                Grade
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const nums = subjects
                .map((sub) => Number((scores[r.key] || {})[sub]))
                .filter((n) => Number.isFinite(n));
              const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
              const gr = gradeOf(avg);
              return (
                <tr key={r.key} className="border-t transition-colors hover:bg-[var(--surface-2)]" style={{ borderColor: "var(--border)" }}>
                  <td className="sticky left-0 z-10 px-5 py-2.5" style={{ background: "var(--surface)" }}>
                    <div className="min-w-0">
                      <span className="block truncate text-[13px] font-bold" style={{ color: "var(--text)" }}>
                        {r.name || "—"}
                      </span>
                      {r.sidRaw && (
                        <span className="block truncate text-[10.5px]" style={{ color: "var(--text-3)" }}>
                          {r.sidRaw}
                        </span>
                      )}
                    </div>
                  </td>
                  {subjects.map((sub, si) => {
                    const v = (scores[r.key] || {})[sub] ?? "";
                    return (
                      <td key={si} className="px-2 py-2">
                        <div className="mx-auto w-full min-w-[68px] max-w-[130px]">
                          <input
                            ref={(el) => {
                              if (el) noneRefs.current[`${r.key}:${si}`] = el;
                            }}
                            type="text"
                            inputMode="decimal"
                            maxLength={6}
                            value={v}
                            onChange={(e) => onScore(r.key, sub, e.target.value)}
                            onKeyDown={(e) => noneKeyDown(e, `${r.key}:${si}`)}
                            onFocus={(e) => e.target.select()}
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

      <div
        className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-5 py-3 border-t text-[11px]"
        style={{ borderColor: "var(--border)", color: "var(--text-3)" }}
      >
        <span>Scores 0–100 · auto-saved as you type · arrow keys / Enter move between cells</span>
        <span className="ml-auto">Subjects match the imported file exactly</span>
      </div>
    </div>
  );
}

export default function Scores() {
  const { students, classes, logAudit, showToast } = useApp();
  const [scores, setScores] = useState(loadScores);
  const [schedules, setSchedules] = useState(loadSchedules);
  const [noneMeta, setNoneMeta] = useState(loadNoneMeta);
  const [classId, setClassId] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [frozen, setFrozen] = useState(false);

  // re-read latest schedules (subjects follow the Schedule page after Save)
  useEffect(() => {
    const t = setTimeout(() => setSchedules(loadSchedules()), 60);
    return () => clearTimeout(t);
  }, []);

  // persist drafts continuously so nothing is lost while filling
  useEffect(() => {
    try {
      localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
    } catch {
      /* ignore */
    }
  }, [scores]);

  const scheduleFor = (c) =>
    schedules.find((s) => (s.classId ? s.classId === c.id : s.className === c.name)) ||
    schedules.find((s) => s.className === c.id);

  const scoredClasses = useMemo(
    () => classes.filter((c) => scheduleFor(c) && (scheduleFor(c).subjects || []).filter(Boolean).length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classes, schedules]
  );

  // Selection always starts empty ("None"). If the chosen class vanishes, go back
  // to None rather than forcing a class — the sheet stays hidden until the user picks one.
  useEffect(() => {
    if (classId && !scoredClasses.some((c) => c.id === classId)) setClassId("");
  }, [classes, schedules, classId, scoredClasses]);

  // persist the "(No class)" cheatsheet so it survives a refresh
  useEffect(() => {
    try {
      if (noneMeta) localStorage.setItem(NONE_META_KEY, JSON.stringify(noneMeta));
      else localStorage.removeItem(NONE_META_KEY);
    } catch {
      /* ignore */
    }
  }, [noneMeta]);

  const cls = classes.find((c) => c.id === classId);
  const sched = cls ? scheduleFor(cls) : null;
  const subjects = sched ? sched.subjects.filter(Boolean) : [];

  /* class dropdown starts with "None" so the sheet can (re)start empty */
  const classOptions = [
    { value: "", label: "None", sub: "no class" },
    ...scoredClasses.map((c) => ({
      value: c.id,
      label: c.name,
      sub: `${(scheduleFor(c)?.subjects || []).filter(Boolean).length} subjects`,
    })),
  ];

  const roster = useMemo(() => {
    if (!cls) return [];
    return students
      .filter((s) => s.className === cls.id && s.status !== "Graduate")
      .sort((a, b) => String(a.studentId || "").localeCompare(String(b.studentId || ""), undefined, { numeric: true }));
  }, [students, cls]);

  const setScore = (studentId, subject, value) => {
    setScores((prev) => {
      const next = { ...prev, [classId]: { ...(prev[classId] || {}), [studentId]: { ...((prev[classId] || {})[studentId] || {}), [subject]: value } } };
      // persist on every keystroke so a semester rollover can never miss unsaved scores
      try {
        localStorage.setItem(SCORES_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  /* keep only digits + one dot + ≤2 decimals, integer part capped at 100 */
  const cleanScore = (raw) => {
    let v = raw.replace(/[^0-9.]/g, "");
    const [ip, dp] = v.split(".");
    let int = (ip || "").slice(0, 3);
    if (int && Number(int) > 100) int = "100";
    if (dp === undefined) return int;
    return `${int}.${(dp || "").replace(/\./g, "").slice(0, 2)}`;
  };

  /* blur: pad to two decimals → "1" becomes "1.00" */
  const onScoreBlur = (sid, subject) => {
    const cur = ((scores[classId] || {})[sid] || {})[subject];
    if (cur == null || cur === "") return;
    const n = Number(cur);
    setScore(sid, subject, (isNaN(n) ? 0 : Math.min(100, n)).toFixed(2));
  };

  const valueOf = (studentId, subject) =>
    ((scores[classId] || {})[studentId] || {})[subject] ?? "";

  const subjectValues = (studentId) =>
    subjects.map((sub) => {
      const raw = valueOf(studentId, sub);
      return raw === "" ? null : Number(raw);
    });

  const avgOf = (studentId) => {
    const vals = subjectValues(studentId).filter((n) => n != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const filledCount = roster.filter((s) => subjectValues(s.id).some((n) => n != null)).length;

  /* ── spreadsheet-style cell navigation (arrow keys + Enter) ── */
  const cellRefs = useRef({});
  const cellOrder = [];
  roster.forEach((s) => subjects.forEach((sub, si) => cellOrder.push({ key: `${s.id}:${si}`, y: s.id, x: si, sub })));

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
        move(-subjects.length);
        break;
      case "ArrowDown":
        move(subjects.length);
        break;
      case "Enter":
        move(1);
        break;
      default:
        break;
    }
  };

  const save = () => {
    logAudit("save_scores", `Saved scores for ${cls?.name || "class"} (${roster.length} students · ${subjects.length} subjects)`);
    showToast("Scores saved");
  };

  const resetClass = () => {
    setScores((prev) => {
      const { [classId]: _drop, ...rest } = prev;
      return rest;
    });
    setConfirmReset(false);
    showToast(`Scores cleared for ${cls?.name || "class"}`, "info");
  };

  /* append new subject columns to this class's schedule so the new score columns exist
     next time (used by import and by the "Add subject" button) */
  const extendSubjects = (names) => {
    const clean = Array.from(new Set((names || []).map((n) => String(n ?? "").trim()).filter(Boolean)));
    if (!clean.length || !sched) return 0;
    const current = (sched.subjects || []).filter(Boolean);
    const merged = Array.from(new Set([...current, ...clean]));
    if (merged.length === current.length) return 0;
    setSchedules((prev) => {
      const next = prev.map((s) => {
        const same = s.id ? s.id === sched.id : s === sched;
        return same ? { ...s, subjects: merged } : s;
      });
      try {
        const raw = JSON.parse(localStorage.getItem(SCHED_KEY) || "{}");
        localStorage.setItem(SCHED_KEY, JSON.stringify({ ...raw, schedules: next }));
      } catch {
        /* ignore */
      }
      return next;
    });
    return clean.length;
  };

  /* a brand-new empty score column, ready for typing or import */
  const addSubjectColumn = () => {
    const n = `Subject ${(sched?.subjects || []).filter(Boolean).length + 1}`;
    if (extendSubjects([n])) showToast(`Added empty column "${n}" — scores go in here`);
    else showToast("That column already exists", "info");
  };

  /* edit one cell of the "(No class)" cheatsheet */
  const setNoneMetaScore = (rowKey, subject, raw) => {
    const v = cleanScore(raw);
    setNoneMeta((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        scores: { ...(prev.scores || {}), [rowKey]: { ...((prev.scores || {})[rowKey] || {}), [subject]: v } },
      };
    });
  };

  const clearNone = () => {
    setNoneMeta(null);
    showToast("Cheatsheet cleared", "info");
  };

  /* merge imported rows ({ studentId: { subject: "score" } }) into the class sheet */
  const applyImport = (rows, { matched, cells }, newSubjects = [], extras) => {
    /* no class selected → "(No class)" cheatsheet: the sheet mirrors the file */
    if (!cls) {
      const fileRows = extras?.fileRows || [];
      const keep = fileRows.filter((fr) => rows[fr.key] && Object.keys(rows[fr.key]).length);
      const meta = {
        subjects: newSubjects.length ? newSubjects : [],
        rows: keep.map((fr) => ({ key: fr.key, name: fr.name, sidRaw: fr.sidRaw })),
        scores: Object.fromEntries(keep.map((fr) => [fr.key, rows[fr.key]])),
      };
      setNoneMeta(meta);
      /* explicit save so the import is durable the moment it lands (not only via the effect) */
      try {
        localStorage.setItem(NONE_META_KEY, JSON.stringify(meta));
      } catch {
        /* ignore */
      }
      showToast(
        `Cheatsheet imported & saved — ${meta.subjects.length} subject${meta.subjects.length === 1 ? "" : "s"} · ${meta.rows.length} student${meta.rows.length === 1 ? "" : "s"} (columns match the file)`
      );
      logAudit("import_scores_none", `Imported cheatsheet: ${meta.subjects.length} subjects, ${meta.rows.length} rows`);
      setImportOpen(false);
      return;
    }
    setScores((prev) => {
      const next = { ...prev, [classId]: { ...(prev[classId] || {}) } };
      Object.entries(rows).forEach(([sid, subjMap]) => {
        next[classId][sid] = { ...(next[classId][sid] || {}), ...subjMap };
      });
      try {
        localStorage.setItem(SCORES_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    const added = extendSubjects(newSubjects);
    logAudit(
      "import_scores",
      `Imported ${cells} score cells for ${matched} students into ${cls?.name || "class"}` +
        (added ? ` (+${added} new subject column${added === 1 ? "" : "s"})` : "")
    );
    showToast(
      `Imported & saved ${cells} scores for ${matched} students` +
        (added ? ` · added ${added} new subject column${added === 1 ? "" : "s"}` : "")
    );
    setImportOpen(false);
  };

  return (
    <div className="max-w-[1500px] mx-auto space-y-5 animate-fade-up">
      <PageHeader
        title="Scores"
        subtitle="Pick a class for a live score sheet, or keep None and import a cheatsheet — its columns become the subjects exactly as written in the file."
        actions={
          <>
            <button
              onClick={() => setImportOpen(true)}
              className="btn btn-outline h-10 shrink-0 px-3.5 text-sm gap-1.5"
              title={
                classId
                  ? "Import scores for this class from an Excel or CSV file (one subject per column, one row per student)"
                  : "Import an Excel cheatsheet — its columns become the score subjects exactly as written in the file"
              }
            >
              <FileSpreadsheet size={15} /> Import Excel
            </button>
            <div className="min-w-0 flex-1 basis-[200px] sm:flex-none sm:basis-auto">
              <ClassSelect value={classId} onChange={setClassId} minWidth={200} options={classOptions} />
            </div>
          </>
        }
      />

      {!classId && (
        <div className="card">
          {noneMeta ? (
            <NoneSheet meta={noneMeta} onScore={setNoneMetaScore} onClear={clearNone} />
          ) : (
            <EmptyState
              icon={ClipboardList}
              title="No class selected"
              subtitle={
                scoredClasses.length === 0
                  ? "Create a class and give it subjects on the Schedule page for a live score sheet — or import an Excel cheatsheet and its columns become the score subjects exactly as written in the file."
                  : "Subject columns and student names stay hidden until you pick a class — or import an Excel cheatsheet and its columns become the score subjects exactly as written in the file."
              }
              action={
                <button onClick={() => setImportOpen(true)} className="btn btn-primary">
                  <FileSpreadsheet className="h-4 w-4" /> Import Excel
                </button>
              }
            />
          )}
        </div>
      )}

      {cls && !sched && (
        <div className="card">
          <EmptyState
            icon={AlertTriangle}
            title={`No schedule for ${cls.name}`}
            subtitle="Add subjects (columns) for this class on the Schedule page, then come back — the score sheet will follow them."
            action={
              <button
                onClick={() => (window.location.href = "/schedule")}
                className="btn btn-primary"
              >
                <Link2 className="h-4 w-4" /> Open Schedule
              </button>
            }
          />
        </div>
      )}

      {cls && sched && (
        <div className="card overflow-hidden">
          {/* header bar */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <div>
              <p className="text-base font-bold" style={{ color: "var(--text)" }}>
                {cls.name} — score sheet
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-2)" }}>
                {[cls.field, cls.shift].filter(Boolean).join(" · ")} · {cls.year || "Year 1"} · {cls.semester || "Semester 1"} · {subjects.length} subject{subjects.length === 1 ? "" : "s"} · {roster.length} student{roster.length === 1 ? "" : "s"}
              </p>
            </div>
            {filledCount > 0 && (
              <span className="rounded-lg border px-2.5 py-1 text-xs font-semibold" style={{ borderColor: "var(--border)", background: "var(--primary-soft)", color: "var(--primary-strong)" }}>
                {filledCount}/{roster.length} scored
              </span>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {subjects.length > 0 && (
                <button
                  onClick={() => setFrozen((f) => !f)}
                  className={`btn h-9 px-3 text-sm gap-1.5 ${frozen ? "btn-primary" : "btn-outline"}`}
                  title={
                    frozen
                      ? "Unlock the header — the subject row and name column scroll away again"
                      : "Freeze header like Excel — the subject row and name column stay fixed while you scroll"
                  }
                >
                  {frozen ? <><PinOff size={14} /> Unfreeze</> : <><Pin size={14} /> Freeze</>}
                </button>
              )}
              <button
                onClick={addSubjectColumn}
                className="btn btn-outline h-9 px-3 text-sm gap-1.5"
                title="Add a new empty score column (subject) for this class — scores go in here for everyone"
              >
                <Plus size={14} /> Add subject
              </button>
              <button
                onClick={() => setConfirmReset(true)}
                className="btn btn-outline h-9 px-3 text-sm gap-1.5 !text-red-500"
                title="Clear all scores for this class"
              >
                <RotateCcw size={14} /> Reset
              </button>
              <button onClick={save} className="btn btn-primary h-9 px-4 text-sm gap-1.5" title="Save the score sheet (also auto-saves as you type)">
                <Save size={14} /> Save scores
              </button>
            </div>
          </div>

          {subjects.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm" style={{ color: "var(--text-3)" }}>
              This class has a schedule but no subjects yet — click <b style={{ color: "var(--text-2)" }}>+ Add subject</b> above, or add subject columns on the Schedule page.
            </p>
          ) : (
            <div className={frozen ? "max-h-[62vh] overflow-auto thin-scroll" : "overflow-x-auto thin-scroll"}>
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
                    <th
                      className={`sticky left-0 min-w-[190px] px-5 py-3.5 ${frozen ? "top-0 z-30" : "z-10"}`}
                      style={{ background: "var(--surface)", ...(frozen ? { borderBottom: "1px solid var(--border)" } : {}) }}
                    >
                      Student
                    </th>
                    {subjects.map((sub, i) => (
                      <th
                        key={i}
                        className={`px-2 py-3 text-center align-bottom${frozen ? " sticky top-0 z-20" : ""}`}
                        title={sub}
                        style={{
                          minWidth: 108,
                          maxWidth: 180,
                          whiteSpace: "normal",
                          lineHeight: 1.2,
                          wordBreak: "break-word",
                          background: frozen ? "var(--surface)" : undefined,
                          ...(frozen ? { borderBottom: "1px solid var(--border)" } : {}),
                        }}
                      >
                        {sub}
                      </th>
                    ))}
                    <th
                      className={`px-2 py-3.5 text-center${frozen ? " sticky top-0 z-20" : ""}`}
                      style={{ background: frozen ? "var(--surface)" : undefined, ...(frozen ? { borderBottom: "1px solid var(--border)" } : {}) }}
                    >
                      Avg
                    </th>
                    <th
                      className={`px-4 py-3.5 text-center${frozen ? " sticky top-0 z-20" : ""}`}
                      style={{ paddingRight: 20, background: frozen ? "var(--surface)" : undefined, ...(frozen ? { borderBottom: "1px solid var(--border)" } : {}) }}
                    >
                      Grade
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {roster.length === 0 && (
                    <tr>
                      <td colSpan={subjects.length + 3} className="px-5 py-12 text-center" style={{ color: "var(--text-3)" }}>
                        No active students in {cls.name} yet — add them from the Classes page.
                      </td>
                    </tr>
                  )}
                  {roster.map((s) => {
                    const avg = avgOf(s.id);
                    const gr = gradeOf(avg);
                    return (
                      <tr key={s.id} className="border-t transition-colors hover:bg-[var(--surface-2)]" style={{ borderColor: "var(--border)" }}>
                        <td className="sticky left-0 z-10 px-5 py-2.5" style={{ background: "var(--surface)" }}>
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold" style={{ background: "var(--primary-soft)", color: "var(--primary-strong)" }}>
                              {String(s.firstName || "?")[0]}{String(s.lastName || "")[0] || ""}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-bold" style={{ color: "var(--text)" }}>
                                {s.khmerName || `${s.firstName} ${s.lastName}`}
                              </span>
                              <span className="block truncate text-[10.5px]" style={{ color: "var(--text-3)" }}>
                                {s.khmerName ? `${s.firstName} ${s.lastName} · ` : ""}{s.studentId}
                              </span>
                            </span>
                          </div>
                        </td>
                        {subjects.map((sub, si) => {
                          const cellKey = `${s.id}:${si}`;
                          return (
                            <td key={si} className="px-2 py-2">
                              <div className="mx-auto w-full min-w-[68px] max-w-[130px]">
                                <input
                                  ref={(el) => {
                                    if (el) cellRefs.current[cellKey] = el;
                                  }}
                                  type="text"
                                  inputMode="decimal"
                                  maxLength={6}
                                  value={valueOf(s.id, sub)}
                                  onChange={(e) => setScore(s.id, sub, cleanScore(e.target.value))}
                                  onKeyDown={(e) => onCellKeyDown(e, cellKey)}
                                  onFocus={(e) => e.target.select()}
                                  onBlur={() => onScoreBlur(s.id, sub)}
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
          )}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-5 py-3 border-t text-[11px]" style={{ borderColor: "var(--border)", color: "var(--text-3)" }}>
            <span>Scores 0–100 · auto-saved as you type · arrow keys / Enter move between cells</span>
            <span className="ml-auto">Subjects follow the class schedule · edit on the Schedule page</span>
          </div>
        </div>
      )}

      {/* reset confirm */}
      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setConfirmReset(false)} />
          <div className="relative card w-full max-w-md p-6 shadow-2xl animate-fade-up">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold" style={{ color: "var(--text)" }}>Reset scores?</h3>
                <p className="mt-1 text-xs" style={{ color: "var(--text-2)" }}>
                  This clears every score entered for <b>{cls?.name}</b>. The class schedule and students are untouched.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button className="btn" style={{ background: "var(--danger)", color: "#fff" }} onClick={resetClass}>
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
            </div>
          </div>
        </div>
      )}

      <ScoreImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        cls={cls}
        subjects={subjects}
        roster={roster}
        noneMode={!cls}
        onImport={applyImport}
      />
    </div>
  );
}