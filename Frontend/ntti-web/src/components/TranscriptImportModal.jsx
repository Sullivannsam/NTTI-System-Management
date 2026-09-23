import React, { useEffect, useMemo, useState } from "react";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, X, Search, Layers } from "lucide-react";
import Modal from "./Modal";
import * as XLSX from "xlsx";
import { ACADEMIC_LEVELS } from "../data/seed";

/* ── NTTI cheatsheet knowledge ──────────────────────────────
   The "GLOBAL" score sheet has a title row, a header row, optional label
   rows (group numbers, class code, "ពិន្ទុប្រឡងចេញ"…) and then one row
   per student: No · Code · Khmer name · Latin name · DOB · gender · place ·
   thesis topic · thesis score · {one column per subject, whole programme} ·
   exit-exam total.

   Subject columns are grouped into transcript levels by their position in
   the programme. Default mapping follows the IT bachelor's 8-semester blocks:
   [5, 3, 6, 6, 6, 8, 10, 13] = 57 subjects. Every column can be overridden
   in the preview. */

const CUMULATIVE = [5, 8, 14, 20, 26, 34, 44, 57];

const collapse = (s) =>
  String(s ?? "")
    .replace(/[\u200c\u200b\u200d\ufeff]/g, "")
    .trim()
    .replace(/\s+/g, " ");
const norm = (s) => collapse(s).toLowerCase();

const isFinCell = (v) => {
  const s = String(v ?? "").replace(/,/g, "").trim();
  if (!s) return null; // Number("") is 0 — empty cells must stay null
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const clampScore = (n) => Math.max(0, Math.min(100, Math.round(n * 100) / 100));

/* which role does this header cell play? */
const classifyHeader = (h) => {
  const s = String(h ?? "").trim();
  if (!s) return null;
  // real ID/code columns — these are allowed to become a student ID
  if (/លេខកូដ|លេខសំគាល់|student\s*id|student\s*code|^\s*(code|id)\s*$/i.test(s)) return "sid";
  // position / roll number — never a student ID
  if (/^\s*(no\.?|no|#|roll|number|លេខរៀង|លេខ|ล\.\s*រ)\s*$/i.test(s)) return "roll";
  if (/គោត្តនាម|ខ្មែរ|khmer/i.test(s)) return "khmer";
  if (/អក្សរឡាតាំង|latin|ឡាតាំង|អង់គ្លេស|english/i.test(s)) return "latin";
  if (/ថ្ងៃខែ|birth|dob|កំនើត|កំណើត/i.test(s)) return "dob";
  if (/ភេទ|gender|sex/i.test(s)) return "gender";
  if (/ទីកន្លែង|place/i.test(s)) return "place";
  if (/ប្រធានបទ|thesis/i.test(s) && !/ពិន្ទុ|score/i.test(s)) return "thesistopic";
  if (/ពិន្ទុសារណា|thesis.*score|score.*thesis|សារណា/i.test(s)) return "thesisscore";
  return "subject";
};

/* first row that carries an identity header (ID / Khmer name / Latin name) */
function detectIdentityRow(rows) {
  for (let r = 0; r < Math.min(rows.length, 8); r++) {
    const cells = (rows[r] || []).map((c) => classifyHeader(c)).filter(Boolean);
    const identity = cells.some((k) => k === "sid" || k === "khmer" || k === "latin");
    if (identity && cells.length >= 2) return r;
  }
  return 0;
}

/* sheet that looks most like a score cheatsheet: most subject columns */
function bestSheet(book) {
  let bestIdx = 0;
  let bestCount = -1;
  book.SheetNames.forEach((name, idx) => {
    const ws = book.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    const hr = detectIdentityRow(rows);
    const header = rows[hr] || [];
    let subjectCount = 0;
    for (const h of header) if (classifyHeader(h) === "subject") subjectCount++;
    if (subjectCount > bestCount) {
      bestCount = subjectCount;
      bestIdx = idx;
    }
  });
  return bestIdx;
}

const defaultLevelFor = (i, total) => {
  if (total <= 57) {
    for (let l = 0; l < 8; l++) if (i < CUMULATIVE[l]) return ACADEMIC_LEVELS[l];
  } else {
    const per = Math.ceil(total / 8);
    return ACADEMIC_LEVELS[Math.min(7, Math.floor(i / per))];
  }
  return ACADEMIC_LEVELS[7];
};

/* Excel serial / text → yyyy-mm-dd */
const dobToISO = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const n = Number(s);
  if (Number.isFinite(n) && n > 10000 && n < 80000) {
    const d = new Date(Math.round((n - 25569) * 86400 * 1000));
    if (!isNaN(d)) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  }
  const d = new Date(s);
  return isNaN(d) ? "" : d.toISOString().slice(0, 10);
};

const genderOf = (v) => {
  const s = String(v ?? "").trim().toLowerCase();
  if (/female|ស្រី|ស្\s*រ្/.test(s)) return "Female";
  if (/male|ប្រុស|ប្រ\b/.test(s)) return "Male";
  return s ? (s[0].toUpperCase() + s.slice(1)) : "";
};

const levelOptions = ACADEMIC_LEVELS;

/**
 * Import a programme-wide score sheet (an NTTI "GLOBAL" cheatsheet) directly
 * into student transcripts — history per level is written for every student
 * row, and rows that don't match an existing student are created as new
 * class-less students so they can still receive a transcript.
 */
export default function TranscriptImportModal({ open, onClose, students, onImport }) {
  const [file, setFile] = useState(null);
  const [wb, setWb] = useState(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [rawRows, setRawRows] = useState([]);
  const [headerRow, setHeaderRow] = useState(0);
  const [overrides, setOverrides] = useState(null); // { [colIdx]: level | "_skip" }
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setFile(null);
      setWb(null);
      setSheetIdx(0);
      setRawRows([]);
      setHeaderRow(0);
      setOverrides(null);
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleFile = (f) => {
    setFile(f);
    setError("");
    const readRows = (data) => {
      try {
        const book = XLSX.read(data, { type: data instanceof ArrayBuffer ? "array" : "string" });
        const idx = bestSheet(book);
        const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[idx]], { header: 1, defval: "" });
        setWb(book);
        setSheetIdx(idx);
        setRawRows(rows);
        setHeaderRow(detectIdentityRow(rows));
        setOverrides(null);
      } catch (e) {
        setError(`Could not read "${f.name}": ${e.message}`);
      }
    };
    try {
      const reader = new FileReader();
      reader.onload = () => readRows(reader.result);
      if (/\.csv$/i.test(f.name)) reader.readAsText(f);
      else reader.readAsArrayBuffer(f);
    } catch (e) {
      setError(`Could not open "${f.name}": ${e.message}`);
    }
  };

  const switchSheet = (idx) => {
    if (!wb) return;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[idx]], { header: 1, defval: "" });
    setSheetIdx(idx);
    setRawRows(rows);
    setHeaderRow(detectIdentityRow(rows));
    setOverrides(null);
  };

  /* column roles from the chosen header row */
  const colRoles = useMemo(() => {
    const header = rawRows[headerRow] || [];
    return header.map((h) => classifyHeader(h));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawRows, headerRow]);

  /* subject columns only, in order */
  const subjectCols = useMemo(
    () => colRoles.map((role, i) => (role === "subject" ? { idx: i, name: collapse(rawRows[headerRow]?.[i]) } : null)).filter(Boolean),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colRoles, rawRows, headerRow]
  );

  /* effective level per subject column (auto by position, overridable) */
  const colLevels = useMemo(() => {
    const out = {};
    subjectCols.forEach((c, i) => {
      out[c.idx] = overrides && overrides[c.idx] ? overrides[c.idx] : defaultLevelFor(i, subjectCols.length);
    });
    return out;
  }, [subjectCols, overrides]);

  /* special columns — prefer the *last* real ID/Code column. Roll-number columns
     are classified as "roll" and never used as identity. */
  const sidIdx = colRoles.lastIndexOf("sid");
  const khmerIdx = colRoles.indexOf("khmer");
  const latinIdx = colRoles.indexOf("latin");
  const dobIdx = colRoles.indexOf("dob");
  const genderIdx = colRoles.indexOf("gender");
  const thesisTopicIdx = colRoles.indexOf("thesistopic");
  const thesisScoreIdx = colRoles.indexOf("thesisscore");
  const lastSubjectIdx = subjectCols.length ? subjectCols[subjectCols.length - 1].idx : -1;

  /* exit-exam label may live on a sub-label row (e.g. a merged "ពិន្ទុប្រឡងចេញ") */
  const exitColumns = useMemo(() => {
    const found = [];
    for (let r = headerRow + 1; r < Math.min(rawRows.length, headerRow + 4); r++) {
      const row = rawRows[r] || [];
      row.forEach((v, i) => {
        if (/ប្រឡងចេញ|exit\s*exam|exit\s*score/i.test(String(v ?? "")) && i > lastSubjectIdx) found.push(i);
      });
    }
    return found;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawRows, headerRow, lastSubjectIdx]);

  const exitIdx = exitColumns.length ? exitColumns[exitColumns.length - 1] : -1;

  const exitOf = (row) => {
    if (exitIdx >= 0) {
      const n = isFinCell(row[exitIdx]);
      if (n != null) return clampScore(n);
    }
    // fallback: last numeric cell in the tail beyond the subject columns
    for (let i = row.length - 1; i > lastSubjectIdx; i--) {
      const n = isFinCell(row[i]);
      if (n != null) return clampScore(n);
    }
    return null;
  };

  /* matching against the student list */
  const khmerOf = (st) => collapse(st.khmerName);
  const latinFull = (st) => norm(`${st.firstName} ${st.lastName}`);

  const matchRow = (row) => {
    const kh = collapse(row[khmerIdx]);
    const lat = collapse(row[latinIdx]);
    const code = collapse(row[sidIdx]);
    const dob = row[dobIdx] != null ? dobToISO(row[dobIdx]) : "";
    const candidates = [];
    students.forEach((st) => {
      let score = 0;
      // name match — full-name compare only (never loose substrings: "MENGHONG" must not
      // match "KHIENG MENGHONG" or a different student whose name merely contains it)
      if (kh && kh.toLowerCase() === khmerOf(st).toLowerCase()) score = 100;
      else if (lat) {
        const lf = latinFull(st);
        if (lf === norm(lat)) score = 95;
        else if (lf === norm(`${row[latinIdx]?.toString().trim().split(/\s+/).reverse().join(" ")}`)) score = 90; // surname-first sheets
      }
      // same name + same date of birth = definitely the same person (breaks Khmer name ties)
      if (score >= 90 && dob && st.dob && dob === st.dob) score = 200;
      if (score >= 90) candidates.push({ st, score });
    });
    // ID fallback only when the name never matched, and only on an exact ID / "-CODE" suffix
    if (!candidates.length && code) {
      students.forEach((st) => {
        const id = collapse(st.studentId);
        if (id && (id === code || id.endsWith(`-${code}`))) candidates.push({ st, score: 60 });
      });
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] ? candidates[0].st : null;
  };

  /* build student preview rows: identity + entries grouped by level */
  const preview = useMemo(() => {
    if (!rawRows.length || !subjectCols.length) return [];
    const out = [];
    let started = false;
    let badStreak = 0;
    for (let r = headerRow + 1; r < rawRows.length; r++) {
      const row = rawRows[r] || [];
      const kh = collapse(row[khmerIdx]);
      const lat = collapse(row[latinIdx]);
      const code = collapse(row[sidIdx]);
      const hasIdentity = !!(kh || lat || code || isFinCell(row[0]) != null);
      if (!hasIdentity) {
        if (started) {
          badStreak++;
          if (badStreak >= 2) break; // end of the data block
        }
        continue; // label rows between header and data
      }
      started = true;
      badStreak = 0;

      // scores per level, subject names per level
      const scoresByLevel = {};
      const subjectsByLevel = {};
      let scoreCount = 0;
      subjectCols.forEach((c) => {
        const level = colLevels[c.idx];
        if (!level || level === "_skip") return;
        (subjectsByLevel[level] = subjectsByLevel[level] || []).push(c.name);
        const n = isFinCell(row[c.idx]);
        if (n != null) {
          (scoresByLevel[level] = scoresByLevel[level] || {})[c.name] = String(clampScore(n));
          scoreCount++;
        }
      });

      const entries = Object.keys(scoresByLevel)
        .sort((a, b) => ACADEMIC_LEVELS.indexOf(a) - ACADEMIC_LEVELS.indexOf(b))
        .map((level) => ({ level, subjects: subjectsByLevel[level], scores: scoresByLevel[level] }));

      const matched = matchRow(row);
      out.push({
        kh,
        lat,
        code,
        dob: dobToISO(row[dobIdx]),
        gender: genderOf(row[genderIdx]),
        thesisTitle: collapse(row[thesisTopicIdx]),
        thesisScore: isFinCell(row[thesisScoreIdx]),
        exitExam: exitOf(row),
        matched,
        entries,
        scoreCount,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawRows, headerRow, subjectCols, colLevels, students]);

  const withScores = preview.filter((p) => p.scoreCount > 0);
  const matchedCount = withScores.filter((p) => p.matched).length;
  const newCount = withScores.length - matchedCount;
  const totalScores = withScores.reduce((a, p) => a + p.scoreCount, 0);

  const doImport = () => {
    const rows = withScores.map((p) => {
      const parts = collapse(p.lat).split(/\s+/).filter(Boolean);
      return {
        matched: p.matched,
        identity: {
          studentId: p.code || "",
          khmerName: p.kh,
          firstName: parts.slice(0, -1).join(" ") || p.kh || "Student",
          lastName: parts[parts.length - 1] || "",
          gender: p.gender,
          dob: p.dob,
          thesisTitle: p.thesisTitle || "",
          thesisScore: p.thesisScore,
          exitExam: p.exitExam,
        },
        entries: p.entries,
      };
    });
    if (!rows.length) {
      setError("Nothing to import — no subject scores were found under the chosen header row.");
      return;
    }
    onImport(rows, { matched: matchedCount, created: newCount, scores: totalScores });
  };

  const shown = preview.slice(0, 120);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Import scores → transcripts"
      subtitle="Upload an NTTI score cheatsheet (e.g. IT09B-GLOBAL.xlsx). Every student row is matched to the system, or created as a new class-less student so they can still get a transcript."
      footer={
        <div className="flex w-full items-center gap-2">
          <span className="text-xs mr-auto" style={{ color: "var(--text-3)" }}>
            {rawRows.length
              ? `${withScores.length} students · ${matchedCount} found · ${newCount} new · ${totalScores} scores`
              : "No file loaded yet"}
          </span>
          <button onClick={onClose} className="btn btn-outline h-10 px-4 text-sm">
            Cancel
          </button>
          <button
            onClick={doImport}
            disabled={!rawRows.length || totalScores === 0}
            className="btn btn-primary h-10 px-5 text-sm gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            title={totalScores ? `Write scores into ${withScores.length} student transcripts, creating ${newCount} class-less student${newCount === 1 ? "" : "s"}` : "Load a file with scores first"}
          >
            <CheckCircle2 size={15} /> Import {withScores.length} transcripts
          </button>
        </div>
      }
    >
      <div className="px-6 py-5 space-y-4">
        <div
          className="rounded-xl p-3.5 text-xs leading-relaxed"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-2)" }}
        >
          <b style={{ color: "var(--text)" }}>What happens:</b> one column per subject is split into{" "}
          <b style={{ color: "var(--text)" }}>semesters (S1Y1 … S2Y4)</b> automatically and written into each student's{" "}
          <b style={{ color: "var(--text)" }}>transcript history</b>. Students already in the system are updated; others are{" "}
          <b style={{ color: "var(--text)" }}>created without a class</b> so you can print their transcript right away. Adjust the
          semester of any subject column below before importing.
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-medium" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
            <AlertTriangle size={14} /> {error}
            <button onClick={() => setError("")} className="ml-auto btn btn-ghost h-6 w-6 p-0 rounded-full" aria-label="Dismiss">
              <X size={13} />
            </button>
          </div>
        )}

        {!rawRows.length ? (
          <label
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          >
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files && e.target.files[0];
                if (f) handleFile(f);
              }}
            />
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "var(--primary-soft)", color: "var(--primary-strong)" }}>
              <Upload size={20} />
            </span>
            <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              Click to choose the cheatsheet Excel file
            </span>
            <span className="text-xs" style={{ color: "var(--text-3)" }}>
              .xlsx · .xls · .csv — the sheet with the most subject columns is chosen automatically
            </span>
          </label>
        ) : (
          <>
            {/* parse controls */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-medium" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-2)" }}>
                <FileSpreadsheet size={13} style={{ color: "var(--primary-strong)" }} /> {file?.name}
              </span>
              {wb && wb.SheetNames.length > 1 && (
                <label className="flex items-center gap-1.5" style={{ color: "var(--text-3)" }}>
                  Sheet
                  <select className="input h-8 w-auto text-xs py-1" value={sheetIdx} onChange={(e) => switchSheet(Number(e.target.value))}>
                    {wb.SheetNames.map((n, i) => (
                      <option key={n} value={i}>
                        {i + 1}. {n}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="flex items-center gap-1.5" style={{ color: "var(--text-3)" }}>
                Header row
                <select
                  className="input h-8 w-auto text-xs py-1"
                  value={headerRow}
                  onChange={(e) => {
                    setHeaderRow(Number(e.target.value));
                    setOverrides(null);
                  }}
                >
                  {rawRows.slice(0, 8).map((_, i) => (
                    <option key={i} value={i}>
                      Row {i + 1}
                    </option>
                  ))}
                </select>
              </label>
              <button onClick={() => { setRawRows([]); setFile(null); setWb(null); }} className="ml-auto btn btn-ghost h-8 px-2 text-xs" style={{ color: "var(--text-3)" }}>
                Choose another file
              </button>
            </div>

            {/* subject → semester mapping */}
            <div className="rounded-xl border p-3.5" style={{ borderColor: "var(--border)" }}>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-3)" }}>
                <Layers size={13} /> Subject → semester ({subjectCols.length} columns)
              </p>
              <div className="flex flex-wrap items-center gap-1.5 max-h-44 overflow-y-auto thin-scroll">
                {subjectCols.map((c, i) => (
                  <span key={c.idx} className="flex items-center gap-1 rounded-lg border px-2 py-1" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                    <span className="max-w-[150px] truncate text-[11px] font-medium" style={{ color: "var(--text-2)" }} title={c.name}>
                      {c.name || `Col ${c.idx + 1}`}
                    </span>
                    <select
                      className="input h-6 w-[74px] text-[10.5px] px-1 py-0 font-semibold"
                      value={colLevels[c.idx]}
                      onChange={(e) =>
                        setOverrides((prev) => ({ ...(prev || {}), [c.idx]: e.target.value }))
                      }
                      title="Semester this subject is recorded under"
                    >
                      <option value="_skip">skip</option>
                      {levelOptions.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </span>
                ))}
                {!subjectCols.length && (
                  <span className="text-xs" style={{ color: "var(--text-3)" }}>
                    No subject columns detected — try another header row.
                  </span>
                )}
              </div>
              <p className="text-[10.5px] mt-1.5" style={{ color: "var(--text-3)" }}>
                Auto-mapped by programme order (8 semesters). Change any subject if its semester is wrong.
              </p>
            </div>

            {/* student rows */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-3)" }}>
                Students ({preview.length})
              </p>
              <div className="overflow-auto thin-scroll rounded-xl border max-h-72" style={{ borderColor: "var(--border)" }}>
                <table className="w-full text-xs" style={{ minWidth: 560 }}>
                  <thead className="sticky top-0 z-10">
                    <tr className="text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)", background: "var(--surface)" }}>
                      <th className="px-3 py-2">No</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">ID / DOB</th>
                      <th className="px-3 py-2">Match</th>
                      <th className="px-3 py-2 text-center">Scores</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-xs" style={{ color: "var(--text-3)" }}>
                          No student rows found under the chosen header row.
                        </td>
                      </tr>
                    )}
                    {shown.map((p, i) => (
                      <tr key={i} className="odd:bg-white dark:odd:bg-slate-800" style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="px-3 py-1.5" style={{ color: "var(--text-3)" }}>{i + 1}</td>
                        <td className="px-3 py-1.5">
                          <span className="block font-semibold leading-tight" style={{ color: "var(--text)" }}>{p.kh || p.lat || "—"}</span>
                          {p.lat && <span className="block text-[10px] leading-tight" style={{ color: "var(--text-3)" }}>{p.lat}</span>}
                        </td>
                        <td className="px-3 py-1.5" style={{ color: "var(--text-3)" }}>
                          {p.code || "—"}
                          {p.dob && <span className="block text-[10px]">{p.dob}</span>}
                        </td>
                        <td className="px-3 py-1.5">
                          {p.matched ? (
                            <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
                              <CheckCircle2 size={11} /> {p.matched.khmerName || `${p.matched.firstName} ${p.matched.lastName}`}
                              <span className="opacity-70">({p.matched.studentId})</span>
                            </span>
                          ) : p.scoreCount > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: "var(--primary-soft)", color: "var(--primary-strong)" }}>
                              <Upload size={11} /> New student
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-medium" style={{ color: "var(--text-3)" }}>
                              <Search size={11} /> No scores
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-center font-bold tabular-nums" style={{ color: p.scoreCount ? "var(--text)" : "var(--text-3)" }}>
                          {p.scoreCount || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.length > shown.length && (
                <p className="text-[10.5px] mt-1" style={{ color: "var(--text-3)" }}>
                  Showing {shown.length} of {preview.length} rows — all of them are imported.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}