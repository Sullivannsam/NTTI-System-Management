import React, { useEffect, useMemo, useState } from "react";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, X, Search } from "lucide-react";
import Modal from "./Modal";
import { StudentAvatar } from "./Badge";
import * as XLSX from "xlsx";

const isIdCol = (h) => {
  const s = String(h ?? "").trim();
  return (
    /(student\s*id|student\s*code|(^|\s)(id|code|roll|stt|ord|no|num)s?\.?(\s|$)|nº|លេខកូដ|ល\.រ|ល\.កូដ)/i.test(s) &&
    !/name|ឈ្មោះ|នាម/i.test(s)
  );
};
const isNameCol = (h) => /(name|ឈ្មោះ|នាម|អក្សរឡាតាំង)/i.test(String(h ?? ""));
/* administrative columns (DOB, gender, birth place, thesis, exit exam…) — NOT score subjects */
const isMetaCol = (h) =>
  /(ភេទ|gender|ថ្ងៃខែ|ឆ្នាំកំនើត|birth|ទីកន្លែង|ប្រធានបទសារណា|ពិន្ទុសារណា|ពិន្ទុប្រឡងចេញ|ហត្ថលេខា|signature)/i.test(
    String(h ?? "")
  );

/** First row that looks like a column header (ID / Name / subject), skipping title rows. Falls back to the widest row. */
function detectHeader(rows) {
  let widest = -1;
  let widestCells = 0;
  for (let r = 0; r < Math.min(rows.length, 8); r++) {
    const cells = (rows[r] || []).filter((c) => c != null && String(c).trim() !== "");
    if (cells.length < 2) continue;
    if (cells.some((c) => isIdCol(c) || isNameCol(c))) return r;
    if (cells.length > widestCells) {
      widestCells = cells.length;
      widest = r;
    }
  }
  return widest >= 0 ? widest : 0;
}

/**
 * Upload an Excel (.xlsx/.xls) or CSV file with one subject per column and
 * import every student's scores into the score sheet for a class — no typing
 * per student. Expects a header row like:  No | Student Name | Mathematics | Khmer | …
 */
export default function ScoreImportModal({ open, onClose, cls, subjects, roster, onImport, noneMode = false }) {
  const [file, setFile] = useState(null);
  const [wb, setWb] = useState(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [rawRows, setRawRows] = useState([]);
  const [headerRow, setHeaderRow] = useState(0);
  const [colRoles, setColRoles] = useState(null);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  /* fresh state every time the modal opens */
  useEffect(() => {
    if (open) {
      setFile(null);
      setWb(null);
      setSheetIdx(0);
      setRawRows([]);
      setHeaderRow(0);
      setColRoles(null);
      setError("");
      setShowAll(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const fullName = (st) => norm(`${st.firstName} ${st.lastName}`);
  const khmerName = (st) => norm(st.khmerName);

  const matchById = (v) => {
    const n = norm(v);
    if (!n) return null;
    return (
      roster.find((st) => {
        const id = norm(st.studentId);
        return id === n || id.endsWith("-" + n) || (n.length >= 3 && id.includes(n));
      }) || null
    );
  };
  const matchByName = (v) => {
    const n = norm(v);
    if (!n) return null;
    return (
      roster.find(
        (st) => fullName(st) === n || khmerName(st) === n || (n.length >= 3 && (fullName(st).includes(n) || khmerName(st).includes(n)))
      ) || null
    );
  };

  /* a file column with no matching subject becomes a NEW score column in the sheet */
  const newSubjectName = (c) => {
    const t = String(c?.header ?? "").replace(/\s+/g, " ").trim();
    return t || `Subject ${subjects.length + 1}`;
  };
  /* existing subject name, new-subject name for "__new__" columns, or null when skipped */
  const subjectKeyOf = (c) => {
    if (c?.kind !== "subject" || !c.subject || c.subject === "_skip") return null;
    return c.subject === "__new__" ? newSubjectName(c) : c.subject;
  };

  const roleOfCell = (h, i) => {
    const s = String(h ?? "").trim();
    if (!s) return { kind: "idle" };
    if (isIdCol(s)) return { kind: "sid", header: s };
    if (isNameCol(s)) return { kind: "name", header: s };
    if (isMetaCol(s)) return { kind: "meta", header: s };
    const matched = subjects.find((x) => x.trim().toLowerCase() === s.toLowerCase());
    return { kind: "subject", header: s, subject: matched || "__new__" };
  };

  /* pick the sheet that looks most like a score sheet: most subject-ish columns + most data rows */
  const pickBestSheet = (book) => {
    let best = -1;
    let bestScore = 0;
    book.SheetNames.forEach((name, i) => {
      try {
        const rows = XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1, defval: "" });
        if (!rows.length) return;
        const hr = detectHeader(rows);
        if (hr < 0 || hr >= rows.length) return;
        const header = rows[hr] || [];
        let subjects = 0;
        for (const h of header) {
          const t = String(h ?? "").trim();
          if (!t || isIdCol(t) || isNameCol(t) || isMetaCol(t)) continue;
          subjects++;
        }
        if (!subjects) return;
        const subjectIdxs = [];
        header.forEach((h, i) => {
          const t = String(h ?? "").trim();
          if (t && !isIdCol(t) && !isNameCol(t) && !isMetaCol(t)) subjectIdxs.push(i);
        });
        const sidI = header.findIndex((h) => isIdCol(h));
        const nameI = header.findIndex((h) => isNameCol(h));
        let dataRows = 0;
        let content = 0;
        for (let r = hr + 1; r < rows.length; r++) {
          const row = rows[r] || [];
          const a = sidI >= 0 ? String(row[sidI] ?? "").trim() : "";
          const b = nameI >= 0 ? String(row[nameI] ?? "").trim() : "";
          if (a || b) dataRows++;
          for (const idx of subjectIdxs) {
            const raw = String(row[idx] ?? "").replace(/,/g, "").trim();
            if (raw !== "") {
              const n = Number(raw);
              if (Number.isFinite(n) && n >= 0 && n <= 100) content++;
            }
          }
        }
        const score = content * 1000 + dataRows * 10 + subjects;
        if (score > bestScore) {
          bestScore = score;
          best = i;
        }
      } catch {
        /* unreadable sheet — skip */
      }
    });
    return best;
  };

  /* parse the chosen file */
  const handleFile = (f) => {
    setFile(f);
    setError("");
    const readRows = (data) => {
      try {
        const book = XLSX.read(data, { type: data instanceof ArrayBuffer ? "array" : "string" });
        const idx = (() => {
          const best = pickBestSheet(book);
          return best >= 0 ? best : 0;
        })();
        const ws = book.Sheets[book.SheetNames[idx]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        setWb(book);
        setSheetIdx(idx);
        setRawRows(rows);
        setHeaderRow(detectHeader(rows));
        setColRoles(null);
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

  const sheetNames = wb ? wb.SheetNames : [];

  /* which column plays which role (auto-detected, editable in the preview) */
  const rawHeader = (rawRows[headerRow] || []).map((h) => String(h ?? ""));

  const effectiveCols = useMemo(() => {
    const header = rawRows[headerRow] || [];
    return header.map((h, i) => (colRoles ? colRoles[i] || roleOfCell(h, i) : roleOfCell(h, i)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawRows, headerRow, colRoles, subjects]);

  const setColRole = (i, subject) => {
    setColRoles((prev) => {
      const header = rawRows[headerRow] || [];
      const base = prev || header.map((h, j) => roleOfCell(h, j));
      const next = [...base];
      next[i] = { kind: "subject", header: String(header[i] ?? ""), subject: subject === "_skip" ? "_skip" : subject };
      return next;
    });
  };

  const switchSheet = (idx) => {
    if (!wb) return;
    try {
      const ws = wb.Sheets[wb.SheetNames[idx]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      setSheetIdx(idx);
      setRawRows(rows);
      setHeaderRow(detectHeader(rows));
      setColRoles(null);
    } catch (e) {
      setError(`Could not read sheet "${wb.SheetNames[idx]}": ${e.message}`);
    }
  };

  const preview = useMemo(() => {
    if (!effectiveCols.length) return [];
    const sidIdxs = [];
    const nameIdxs = [];
    effectiveCols.forEach((c, i) => {
      if (c.kind === "sid") sidIdxs.push(i);
      if (c.kind === "name") nameIdxs.push(i);
    });
    let sidIdx = sidIdxs[0] ?? -1;
    /* several ID columns (e.g. ល.រ sequence + លេខកូដ code): prefer the one whose values look like real student codes */
    if (sidIdxs.length > 1) {
      let bestI = sidIdxs[0];
      let bestScore = -1;
      for (const idx of sidIdxs) {
        let score = 0;
        for (let r = headerRow + 1; r < Math.min(headerRow + 6, rawRows.length); r++) {
          const v = String(rawRows[r]?.[idx] ?? "").trim();
          if (!v) continue;
          if (/[a-z-]/i.test(v)) score += 3;
          else if (/^[0-9]+$/.test(v) && v.length > 2) score += 1;
        }
        if (score > bestScore) {
          bestScore = score;
          bestI = idx;
        }
      }
      sidIdx = bestI;
    }
    const nameIdx = nameIdxs[0] ?? -1;
    const hasIdentity = sidIdx >= 0 || nameIdx >= 0;
    const out = [];
    for (let r = headerRow + 1; r < rawRows.length; r++) {
      const row = rawRows[r] || [];
      if (!row.some((c) => c != null && String(c).trim() !== "")) continue;
      const sidRaw = sidIdx >= 0 ? String(row[sidIdx] ?? "").trim() : "";
      const nameRaw = nameIdx >= 0 ? String(row[nameIdx] ?? "").trim() : "";
      /* when the file has ID/name columns, skip rows that carry neither (title rows, column-number rows, stray labels) */
      if (hasIdentity && !sidRaw && !nameRaw) continue;
      /* in "None" mode there is no class roster — every file row is kept as-is */
      let student = null;
      if (!noneMode) {
        student = sidRaw ? matchById(sidRaw) || matchByName(nameRaw) : matchByName(nameRaw);
      }
      const cells = effectiveCols.map((c, i) => {
        if (subjectKeyOf(c)) {
          const raw = String(row[i] ?? "").replace(/,/g, "").trim();
          if (raw !== "") {
            const n = Number(raw);
            if (Number.isFinite(n) && n >= 0 && n <= 100) return n.toFixed(2);
          }
        }
        return "";
      });
      out.push({ student, sidRaw, nameRaw, cells });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveCols, rawRows, headerRow, roster, noneMode]);

  const matchedStudents = preview.filter((p) => p.student).length;
  const totalCells = preview.reduce((a, p) => a + p.cells.filter((c) => c !== "").length, 0);
  const unmatched = preview.length - matchedStudents;
  const shown = showAll ? preview : preview.slice(0, 60);
  const newColCount = effectiveCols.filter((c) => c.subject === "__new__").length;

  const doImport = () => {
    /* every file column aimed at a new subject (default for unmatched subject columns) becomes a new score column */
    const created = new Set(
      effectiveCols
        .filter((c) => c.subject === "__new__")
        .map((c) => subjectKeyOf(c))
        .filter(Boolean)
    );

    if (noneMode) {
      /* "None" mode: no class roster — keep every file row and pass subjects straight through */
      const rows = {};
      const fileRows = [];
      preview.forEach((p, ri) => {
        const st = {};
        effectiveCols.forEach((c, i) => {
          const key = subjectKeyOf(c);
          if (!key) return;
          const v = p.cells[i];
          if (v !== "") st[key] = v;
        });
        if (!Object.keys(st).length) return;
        const key = `r:${ri}`;
        rows[key] = st;
        fileRows.push({ key, name: p.nameRaw || p.sidRaw || "—", sidRaw: p.sidRaw });
      });
      if (!Object.keys(rows).length) {
        setError("Nothing to import — no scores found in the file.");
        return;
      }
      onImport(rows, { matched: preview.length, cells: totalCells }, [...created], { fileRows });
      return;
    }

    const rows = {};
    preview.forEach((p) => {
      if (!p.student) return;
      const st = {};
      effectiveCols.forEach((c, i) => {
        const key = subjectKeyOf(c);
        if (!key) return;
        const v = p.cells[i];
        if (v !== "") st[key] = v;
      });
      if (Object.keys(st).length) rows[p.student.id] = st;
    });
    if (!Object.keys(rows).length) {
      setError("Nothing to import — no rows matched a student in this class.");
      return;
    }
    onImport(rows, { matched: matchedStudents, cells: totalCells }, [...created]);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={`Import scores · ${cls?.name || "no class"}`}
      subtitle={
        noneMode
          ? "No class selected — every data row is kept and every column becomes a score subject exactly as written in the file."
          : "Upload an Excel/CSV first (one subject per column), check the preview, then import — existing scores for the same student + subject are replaced."
      }
      footer={
        <div className="flex w-full items-center gap-2">
          <span className="text-xs mr-auto" style={{ color: "var(--text-3)" }}>
            {rawRows.length
              ? noneMode
                ? `${preview.length} rows · ${totalCells} scores` +
                  (newColCount ? ` · ${newColCount} subject${newColCount === 1 ? "" : "s"} straight from the file` : "")
                : `${preview.length} data rows · ${matchedStudents} matched · ${totalCells} scores` +
                  (newColCount ? ` · ${newColCount} new column${newColCount === 1 ? "" : "s"}` : "")
              : "No file loaded yet"}
          </span>
          <button onClick={onClose} className="btn btn-outline h-10 px-4 text-sm">
            Cancel
          </button>
          <button
            onClick={doImport}
            disabled={!rawRows.length || totalCells === 0}
            className="btn btn-primary h-10 px-5 text-sm gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              totalCells
                ? noneMode
                  ? `Create a cheatsheet with ${totalCells} scores — subjects straight from the file`
                  : `Write ${totalCells} scores into the ${subjects.length}-subject score sheet`
                : "Load a file with scores first"
            }
          >
            <CheckCircle2 size={15} /> Import {totalCells} scores
          </button>
        </div>
      }
    >
      <div className="px-6 py-5 space-y-4">
        {/* expected format hint */}
        <div
          className="rounded-xl p-3.5 text-xs leading-relaxed"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-2)" }}
        >
          <b style={{ color: "var(--text)" }}>Expected format:</b> a header row with a{" "}
          <b style={{ color: "var(--text)" }}>Student ID</b> or <b style={{ color: "var(--text)" }}>Name</b> column, then one column per
          subject — <code className="px-1 py-0.5 rounded" style={{ background: "var(--surface)", color: "var(--primary-strong)" }}>No | Student Name | Mathematics | Khmer | Physics | …</code>. Cheatsheet headings like{" "}
          <code className="px-1 py-0.5 rounded" style={{ background: "var(--surface)", color: "var(--primary-strong)" }}>ល.រ</code>,{" "}
          <code className="px-1 py-0.5 rounded" style={{ background: "var(--surface)", color: "var(--primary-strong)" }}>លេខកូដ</code> and{" "}
          <code className="px-1 py-0.5 rounded" style={{ background: "var(--surface)", color: "var(--primary-strong)" }}>គោត្តនាម-នាម</code> are
          recognized automatically. Each mark needs a single{" "}
          row per student.{" "}
          {noneMode ? (
            <>With <b style={{ color: "var(--text)" }}>None</b> selected, every column becomes a score subject from the file — nothing is guessed.</>
          ) : (
            <>Students are matched by ID first, then by name. Columns whose subject isn't in this class yet are{" "}
            <b style={{ color: "var(--primary-strong)" }}>created as new score columns automatically</b> — change a column to "Skip" if you
            don't want it. Unmatched rows are skipped (shown in red).</>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-medium" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
            <AlertTriangle size={14} /> {error}
            <button onClick={() => setError("")} className="ml-auto btn btn-ghost h-6 w-6 p-0 rounded-full" aria-label="Dismiss">
              <X size={13} />
            </button>
          </div>
        )}

        {/* file picker */}
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
              Click to choose your Excel file
            </span>
            <span className="text-xs" style={{ color: "var(--text-3)" }}>
              .xlsx · .xls · .csv — switch sheet or header row below if needed
            </span>
          </label>
        ) : (
          <>
            {/* parse controls */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-medium" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-2)" }}>
                <FileSpreadsheet size={13} style={{ color: "var(--primary-strong)" }} /> {file?.name}
              </span>
              {sheetNames.length > 1 && (
                <label className="flex items-center gap-1.5" style={{ color: "var(--text-3)" }}>
                  Sheet
                  <select className="input h-8 w-auto text-xs py-1" value={sheetIdx} onChange={(e) => switchSheet(Number(e.target.value))}>
                    {sheetNames.map((n, i) => (
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
                    setColRoles(null);
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

            {/* preview table */}
            <div className="overflow-x-auto thin-scroll rounded-xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full text-sm" style={{ minWidth: 500 }}>
                <thead>
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
                    <th className="sticky left-0 z-10 min-w-[190px] px-4 py-2.5" style={{ background: "var(--surface)" }}>
                      Student (match)
                    </th>
                    {effectiveCols.map((c, i) => (
                      <th key={i} className="px-2 py-2 align-top" style={{ minWidth: 120 }}>
                        <span className="block text-[10px] mb-1" style={{ color: "var(--text-3)" }}>
                          {c.kind === "sid" ? "→ Student ID" : c.kind === "name" ? "→ Name" : c.kind === "meta" ? "→ Info (skipped)" : "Column"}
                        </span>
                        {c.kind === "subject" ? (
                          <>
                            <select
                              className="input h-7 w-full min-w-[110px] text-[11px] py-0.5 font-semibold"
                              value={c.subject || "_skip"}
                              onChange={(e) => setColRole(i, e.target.value)}
                              title={rawHeader[i]}
                            >
                              <option value="_skip">— Skip column —</option>
                              {c.subject === "__new__" && (
                                <option value="__new__">＋ New subject: {newSubjectName(c)}</option>
                              )}
                              {subjects.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                            {c.subject === "__new__" && (
                              <span className="block text-[10px] font-bold uppercase tracking-wide mt-1" style={{ color: "var(--primary-strong)" }}>
                                ＋ new column
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="block max-w-[140px] truncate font-medium" style={{ color: "var(--text-2)" }} title={rawHeader[i]}>
                            {rawHeader[i] || "—"}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0 && (
                    <tr>
                      <td colSpan={Math.max(effectiveCols.length, 1) + 1} className="px-4 py-8 text-center text-xs" style={{ color: "var(--text-3)" }}>
                        No data rows found under the chosen header row.
                      </td>
                    </tr>
                  )}
                  {shown.map((p, ri) => (
                    <tr key={ri}>
                      <td className="sticky left-0 z-10 px-4 py-1.5" style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                        {p.student ? (
                          <span className="flex items-center gap-2 min-w-0">
                            <StudentAvatar student={p.student} size="sm" />
                            <span className="min-w-0">
                              <span className="block text-xs font-semibold leading-tight truncate" style={{ color: "var(--text)" }}>
                                {p.student.khmerName || `${p.student.firstName} ${p.student.lastName}`}
                              </span>
                              <span className="block text-[10px] leading-tight" style={{ color: "var(--text-3)" }}>
                                {p.student.studentId}
                              </span>
                            </span>
                          </span>
                        ) : noneMode ? (
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate text-xs font-semibold" style={{ color: "var(--text)" }}>
                              {p.nameRaw || "—"}
                            </span>
                            {p.sidRaw && (
                              <span className="truncate text-[10px]" style={{ color: "var(--text-3)" }}>
                                {p.sidRaw}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--danger)" }}>
                            <Search size={12} /> {[p.sidRaw, p.nameRaw].filter(Boolean).join(" · ") || "row"}
                            <span className="text-[10px] font-bold uppercase" style={{ color: "var(--danger)" }}>not matched</span>
                          </span>
                        )}
                      </td>
                      {p.cells.map((v, i) => (
                        <td key={i} className="px-2 py-1.5 text-center" style={{ borderBottom: "1px solid var(--border)" }}>
                          {v !== "" && (
                            <span className="inline-block rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
                              {v}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preview.length > 60 && (
              <button onClick={() => setShowAll((s) => !s)} className="text-xs font-semibold underline" style={{ color: "var(--primary-strong)" }}>
                {showAll ? "Show fewer rows" : `Show all ${preview.length} rows`}
              </button>
            )}

            {!noneMode && unmatched > 0 && (
              <p className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--warning)" }}>
                <AlertTriangle size={13} /> {unmatched} row{unmatched === 1 ? "" : "s"} didn't match a student in {cls?.name} and will be skipped.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}