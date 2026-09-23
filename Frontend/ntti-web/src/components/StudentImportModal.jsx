import React, { useEffect, useMemo, useState } from "react";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, X, Download, Users, TableProperties } from "lucide-react";
import Modal from "./Modal";
import Avatar from "./Avatar";
import * as XLSX from "xlsx";
import {
  collapse,
  norm,
  classifyHeader,
  detectHeaderRow,
  pickBestSheet,
  rowToStudent,
  buildStudent,
  ROLES,
  TEMPLATE_HEADERS,
  TEMPLATE_SAMPLE,
} from "./studentImportHelpers";

/**
 * Import students from an Excel/CSV file. Columns are recognised automatically
 * from Khmer OR English headers (ឈ្មោះខ្មែរ / Khmer Name, ឈ្មោះអង់គ្លេស /
 * English Name, ថ្ងៃខែឆ្នាំកំណើត / Date of Birth, …) and every column can be
 * re-mapped or skipped before importing.
 */
export default function StudentImportModal({ open, onClose, onImport, classes = [], existing = [], defaultYear = new Date().getFullYear() }) {
  const [file, setFile] = useState(null);
  const [wb, setWb] = useState(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [rawRows, setRawRows] = useState([]);
  const [headerRow, setHeaderRow] = useState(0);
  const [roles, setRoles] = useState(null); // { [colIdx]: roleKey | null }
  const [defaultClass, setDefaultClass] = useState("");
  const [skipDup, setSkipDup] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setFile(null);
      setWb(null);
      setSheetIdx(0);
      setRawRows([]);
      setHeaderRow(0);
      setRoles(null);
      setDefaultClass("");
      setSkipDup(true);
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
        const idx = pickBestSheet(book);
        const ws = book.Sheets[book.SheetNames[idx]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        setWb(book);
        setSheetIdx(idx);
        setRawRows(rows);
        setHeaderRow(detectHeaderRow(rows));
        setRoles(null);
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
    try {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[idx]], { header: 1, defval: "" });
      setSheetIdx(idx);
      setRawRows(rows);
      setHeaderRow(detectHeaderRow(rows));
      setRoles(null);
    } catch (e) {
      setError(`Could not read sheet "${wb.SheetNames[idx]}": ${e.message}`);
    }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, TEMPLATE_SAMPLE]);
    ws["!cols"] = TEMPLATE_HEADERS.map(() => ({ wch: 24 }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, ws, "Students");
    XLSX.writeFile(book, "ntti-students-template.xlsx");
  };

  const header = rawRows[headerRow] || [];
  const effectiveRoles = useMemo(
    () =>
      header.map((h, i) => {
        const auto = classifyHeader(h);
        return roles ? roles[i] ?? auto : auto;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawRows, headerRow, roles]
  );

  /* parsed preview rows */
  const preview = useMemo(() => {
    if (!rawRows.length) return [];
    const out = [];
    for (let r = headerRow + 1; r < rawRows.length; r++) {
      const row = rawRows[r] || [];
      if (!row.some((c) => c != null && collapse(c) !== "")) continue;
      const p = rowToStudent(row, effectiveRoles, { classes, existing, defaultYear });
      if (!p) continue;
      p.row = row;
      out.push(p);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawRows, headerRow, effectiveRoles, classes, existing, defaultYear]);

  /* rows that will actually be added (dup / no-name rows filtered out) */
  const toImport = useMemo(() => {
    const usedSids = new Set(existing.map((s) => norm(s.studentId)).filter(Boolean));
    preview.forEach((p) => {
      if (p.sid) usedSids.add(norm(p.sid));
    });
    const maxSeq = Math.max(
      0,
      ...Array.from(usedSids)
        .map((id) => Number(String(id).match(/(\d+)\s*$/) || 0))
        .filter((n) => n > 1000)
    );
    const seq = { v: maxSeq + 1 };

    const rows = [];
    let skippedDup = 0;
    let skippedNoName = 0;
    for (const p of preview) {
      if (!p.firstName && !p.lastName && !p.kh && !p.latin) {
        skippedNoName++;
        continue;
      }
      if (p.dup && skipDup) {
        skippedDup++;
        continue;
      }
      rows.push(buildStudent(p, classes, defaultClass, defaultYear, usedSids, seq));
    }
    return { rows, skippedDup, skippedNoName };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, skipDup, defaultClass, classes, existing, defaultYear]);

  const doImport = () => {
    if (!toImport.rows.length) {
      setError("Nothing to import — every row was skipped. Check the column mapping or uncheck “Skip duplicates”.");
      return;
    }
    onImport(toImport.rows, {
      imported: toImport.rows.length,
      skippedDup: toImport.skippedDup,
      skippedNoName: toImport.skippedNoName,
    });
  };

  const shown = preview.slice(0, 80);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="2xl"
      title="Import students from Excel"
      subtitle="Upload .xlsx / .xls / .csv — columns are auto-matched from Khmer or English headers (ឈ្មោះខ្មែរ · ឈ្មោះអង់គ្លេស · ថ្ងៃខែឆ្នាំកំណើត · អ៊ីមែល · ថ្នាក់ …)."
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <span className="text-xs mr-auto" style={{ color: "var(--text-3)" }}>
            {rawRows.length
              ? `${preview.length} rows found · ${toImport.rows.length} to import` +
                (toImport.skippedDup ? ` · ${toImport.skippedDup} duplicate${toImport.skippedDup === 1 ? "" : "s"} skipped` : "") +
                (toImport.skippedNoName ? ` · ${toImport.skippedNoName} without a name` : "")
              : "No file loaded yet"}
          </span>
          <button onClick={onClose} className="btn btn-outline h-10 px-4 text-sm">
            Cancel
          </button>
          <button
            onClick={doImport}
            disabled={!rawRows.length || toImport.rows.length === 0}
            className="btn btn-primary h-10 px-5 text-sm gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            title={`Add ${toImport.rows.length} new student${toImport.rows.length === 1 ? "" : "s"}`}
          >
            <CheckCircle2 size={15} /> Import {toImport.rows.length} student{toImport.rows.length === 1 ? "" : "s"}
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
          <b style={{ color: "var(--text)" }}>Recognized columns:</b>{" "}
          <code className="px-1 py-0.5 rounded" style={{ background: "var(--surface)", color: "var(--primary-strong)" }}>លេខកូដ (Student ID)</code>,{" "}
          <code className="px-1 py-0.5 rounded" style={{ background: "var(--surface)", color: "var(--primary-strong)" }}>ឈ្មោះខ្មែរ (Khmer Name)</code>,{" "}
          <code className="px-1 py-0.5 rounded" style={{ background: "var(--surface)", color: "var(--primary-strong)" }}>ឈ្មោះអង់គ្លេស (English Name)</code>,{" "}
          <code className="px-1 py-0.5 rounded" style={{ background: "var(--surface)", color: "var(--primary-strong)" }}>ភេទ (Gender)</code>,{" "}
          <code className="px-1 py-0.5 rounded" style={{ background: "var(--surface)", color: "var(--primary-strong)" }}>ថ្ងៃខែឆ្នាំកំណើត (Date of Birth)</code>,{" "}
          <code className="px-1 py-0.5 rounded" style={{ background: "var(--surface)", color: "var(--primary-strong)" }}>អ៊ីមែល (Email)</code>,{" "}
          <code className="px-1 py-0.5 rounded" style={{ background: "var(--surface)", color: "var(--primary-strong)" }}>លេខទូរស័ព្ទ (Phone)</code>,{" "}
          <code className="px-1 py-0.5 rounded" style={{ background: "var(--surface)", color: "var(--primary-strong)" }}>ថ្នាក់ (Class)</code>… — every column can be re-mapped manually below.
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
          <>
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
                .xlsx · .xls · .csv — the sheet with the most student columns is chosen automatically
              </span>
            </label>
            <button
              onClick={downloadTemplate}
              className="btn btn-outline h-10 w-full justify-center px-4 text-sm"
            >
              <Download size={16} /> Download Excel template (with Khmer + English headers)
            </button>
          </>
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
                      <option key={n} value={i}>{i + 1}. {n}</option>
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
                    setRoles(null);
                  }}
                >
                  {rawRows.slice(0, 10).map((_, i) => (
                    <option key={i} value={i}>Row {i + 1}</option>
                  ))}
                </select>
              </label>
              <button onClick={() => { setRawRows([]); setFile(null); setWb(null); }} className="ml-auto btn btn-ghost h-8 px-2 text-xs" style={{ color: "var(--text-3)" }}>
                Choose another file
              </button>
            </div>

            {/* default class for rows whose file has no class / unknown class */}
            {classes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 text-xs" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                <span className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--text-2)" }}>
                  <Users size={13} style={{ color: "var(--primary-strong)" }} /> Apply to rows without a class:
                </span>
                <select className="input h-8 w-auto text-xs py-1" value={defaultClass} onChange={(e) => setDefaultClass(e.target.value)}>
                  <option value="">No class (kept unassigned)</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} · {c.shift}</option>
                  ))}
                </select>
                <label className="ml-auto flex items-center gap-1.5 font-medium" style={{ color: "var(--text-2)" }}>
                  <input
                    type="checkbox"
                    checked={skipDup}
                    onChange={(e) => setSkipDup(e.target.checked)}
                    className="h-3.5 w-3.5 accent-indigo-500"
                  />
                  Skip duplicates
                </label>
              </div>
            )}

            {/* column mapping */}
            <div className="rounded-xl border p-3.5" style={{ borderColor: "var(--border)" }}>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-3)" }}>
                <TableProperties size={13} /> Column mapping ({header.length} columns)
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 max-h-52 overflow-y-auto thin-scroll">
                {header.map((h, i) => {
                  const role = effectiveRoles[i] || "";
                  const meta = ROLES.find((r) => r.key === role);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 rounded-lg border px-2 py-1.5"
                      style={{ borderColor: meta ? "var(--primary-soft)" : "var(--border)", background: meta ? "var(--surface-2)" : "var(--surface)" }}
                      title={`Column ${i + 1}: ${collapse(h) || "empty"}`}
                    >
                      <span className="min-w-0 flex-1 truncate text-[11px] font-medium" style={{ color: "var(--text-2)" }}>
                        {collapse(h) || `Column ${i + 1}`}
                      </span>
                      <select
                        className="input h-7 w-[150px] text-[11px] px-1.5 py-0 font-semibold"
                        value={role}
                        onChange={(e) =>
                          setRoles((prev) => ({ ...(prev || {}), [i]: e.target.value || null }))
                        }
                      >
                        <option value="">— Skip column —</option>
                        {ROLES.map((r) => (
                          <option key={r.key} value={r.key}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
                {!header.length && (
                  <span className="text-xs" style={{ color: "var(--text-3)" }}>
                    This header row looks empty — try another row above.
                  </span>
                )}
              </div>
            </div>

            {/* preview */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-3)" }}>
                Preview ({preview.length} rows)
              </p>
              <div className="overflow-auto thin-scroll rounded-xl border max-h-80" style={{ borderColor: "var(--border)" }}>
                <table className="w-full text-xs" style={{ minWidth: 720 }}>
                  <thead className="sticky top-0 z-10">
                    <tr className="text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-3)", background: "var(--surface)" }}>
                      <th className="px-3 py-2">No</th>
                      <th className="px-3 py-2">Student</th>
                      <th className="px-3 py-2">ID / Class</th>
                      <th className="px-3 py-2">Contact</th>
                      <th className="px-3 py-2">DOB / Gender</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-xs" style={{ color: "var(--text-3)" }}>
                          No student rows found under the chosen header row.
                        </td>
                      </tr>
                    )}
                    {shown.map((p, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="px-3 py-1.5" style={{ color: "var(--text-3)" }}>{i + 1}</td>
                        <td className="px-3 py-1.5">
                          <span className="flex items-center gap-2 min-w-0">
                            <Avatar name={`${p.firstName} ${p.lastName}`} size="sm" />
                            <span className="min-w-0">
                              <span className="block font-semibold leading-tight truncate" style={{ color: "var(--text)" }}>
                                {p.kh || `${p.firstName} ${p.lastName}`}
                              </span>
                              {(p.latin || `${p.firstName} ${p.lastName}`) && (
                                <span className="block text-[10px] leading-tight truncate" style={{ color: "var(--text-3)" }}>
                                  {p.latin || `${p.firstName} ${p.lastName}`}
                                </span>
                              )}
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-1.5">
                          <span className="block font-semibold" style={{ color: "var(--text-2)" }}>{p.sid || "auto"}</span>
                          <span className="block text-[10px]" style={{ color: "var(--text-3)" }}>{p.classNameRaw || "no class"}</span>
                        </td>
                        <td className="px-3 py-1.5" style={{ color: "var(--text-3)" }}>
                          {p.email ? <span className="block truncate max-w-[180px]">{p.email}</span> : null}
                          {p.phone ? <span className="block text-[10px]">{p.phone}</span> : null}
                          {!p.email && !p.phone && "—"}
                        </td>
                        <td className="px-3 py-1.5" style={{ color: "var(--text-3)" }}>
                          {p.dob || "—"}
                          {p.gender ? <span className="block text-[10px]">{p.gender}</span> : null}
                        </td>
                        <td className="px-3 py-1.5">
                          {p.dup ? (
                            <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>
                              <AlertTriangle size={11} /> Duplicate
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
                              <CheckCircle2 size={11} /> New
                            </span>
                          )}
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