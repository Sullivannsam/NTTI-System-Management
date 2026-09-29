import React, { useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Plus,
  Save,
  RotateCcw,
  AlertTriangle,
  FileSpreadsheet,
  Link2,
} from "lucide-react";
import { useApp } from "../context/AppContext";
import PageHeader, { EmptyState } from "../components/Page";
import ClassSelect from "../components/ClassSelect";
import ScoreImportModal from "../components/ScoreImportModal";
import ScoreSheet from "../components/ScoreSheet";
import { cleanName, splitLatin, norm, buildStudent } from "../components/studentImportHelpers";
import { SHIFTS, majorName } from "../data/seed";
import {
  bootstrapColumns,
  layoutFromColumns,
  renameColumn,
  renameGroup,
  mergeColumns,
  splitGroups,
  clearGroups,
  appendColumns,
  uniqueColumnKey,
  nextGroupId,
} from "../components/scoreSheetModel";

const SCORES_KEY = "ntti.scores.v1";
const SCHED_KEY = "ntti.schedule.v2";
const NONE_META_KEY = "ntti.scores.none.v1";
const LAYOUT_KEY = "ntti.scores.layout.v1";

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

/* blank auto-created fallback group headers (one column + name equal to that column's
   label) so the header row stops repeating every subject name — the user merges those
   columns and types the real group name. Idempotent: blank stays blank. */
function blankFallbackGroups(payload) {
  if (!payload || typeof payload !== "object") return payload;
  const next = { ...payload };
  Object.keys(next).forEach((k) => {
    const entry = next[k];
    if (!entry || !Array.isArray(entry.columns) || !Array.isArray(entry.groups)) return;
    const columns = entry.columns;
    next[k] = {
      ...entry,
      groups: entry.groups.map((g) => {
        const covered = columns.filter((c) => c.group === g.id);
        if (covered.length === 1 && String(covered[0].label || "").trim() === String(g.name || "").trim()) {
          return { ...g, name: "" };
        }
        return g;
      }),
    };
  });
  return next;
}

/* per-class column layouts: { [classId]: { columns: [{key,label,group}], groups: [{id,name}] } } */
function loadLayout() {
  try {
    const raw = JSON.parse(localStorage.getItem(LAYOUT_KEY));
    return raw && typeof raw === "object" && raw.version === 1 ? blankFallbackGroups(raw) : { version: 1 };
  } catch {
    return { version: 1 };
  }
}

/* the "(No class)" cheatsheet — subjects + rows come straight from an imported file */
function loadNoneMeta() {
  try {
    const raw = JSON.parse(localStorage.getItem(NONE_META_KEY));
    if (raw && Array.isArray(raw.subjects) && Array.isArray(raw.rows)) {
      if (raw.layout && Array.isArray(raw.layout.columns) && Array.isArray(raw.layout.groups)) {
        const columns = raw.layout.columns;
        return {
          ...raw,
          layout: {
            ...raw.layout,
            groups: raw.layout.groups.map((g) => {
              const covered = columns.filter((c) => c.group === g.id);
              if (covered.length === 1 && String(covered[0].label || "").trim() === String(g.name || "").trim()) {
                return { ...g, name: "" };
              }
              return g;
            }),
          },
        };
      }
      return raw;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/* "(No class)" cheatsheet card */
function NoneSheet({ meta, onScore, onClear, frozen, setFrozen, onRenameColumn, onRenameGroup, onMerge, onSplit, onClearGroups, onRenameName, onSave }) {
  const { rows = [], scores = {} } = meta || {};
  const layout = meta?.layout || null;
  const columns = layout ? layout.columns : bootstrapColumns(meta?.subjects || []);
  const groups = layout ? layout.groups : null;
  const listName = (meta?.name || "").trim();
  if (!rows.length) return null;

  return (
    <div className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="min-w-0">
          <input
            value={listName}
            onChange={(e) => onRenameName(e.target.value)}
            placeholder="Score list name…"
            aria-label="Score list name"
            className="input h-10 w-full min-w-[220px] max-w-[380px] !rounded-lg !px-3 text-base font-bold"
            style={{ color: "var(--text)" }}
          />
          <p className="mt-1 text-xs" style={{ color: "var(--text-2)" }}>
            {columns.length} subject{columns.length === 1 ? "" : "s"} · {rows.length} student{rows.length === 1 ? "" : "s"} — columns, groups and names come straight from the imported file
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            onClick={onSave}
            className="btn btn-primary h-9 px-3 text-sm gap-1.5"
            title="Save this score list under its name (it is also auto-saved as you type)"
          >
            <Save size={14} /> Save & name list
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

      <ScoreSheet
        key="none"
        rows={rows.map((r) => ({ key: r.key, name: r.name, sub: r.sidRaw }))}
        columns={columns}
        groups={groups}
        frozen={frozen}
        setFrozen={setFrozen}
        getValue={(rowKey, colKey) => (scores[rowKey] || {})[colKey] ?? ""}
        setValue={(rowKey, colKey, raw) => onScore(rowKey, colKey, raw)}
        onRenameColumn={onRenameColumn}
        onRenameGroup={onRenameGroup}
        onMerge={onMerge}
        onSplit={onSplit}
        onClearGroups={onClearGroups}
      />

      <div
        className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-5 py-3 border-t text-[11px]"
        style={{ borderColor: "var(--border)", color: "var(--text-3)" }}
      >
        <span>Scores 0–100 · auto-saved as you type · arrow keys / Enter move between cells</span>
        <span className="ml-auto">Columns match the imported file exactly · group headers are kept if the file has them</span>
      </div>
    </div>
  );
}

export default function Scores() {
  const { students, classes, logAudit, showToast, addStudentsBatch, importStudents } = useApp();
  const [scores, setScores] = useState(loadScores);
  const [schedules, setSchedules] = useState(loadSchedules);
  const [noneMeta, setNoneMeta] = useState(loadNoneMeta);
  const [layout, setLayout] = useState(loadLayout);
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

  // persist column layouts (groups + renames + new columns)
  useEffect(() => {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
    } catch {
      /* ignore */
    }
  }, [layout]);

  const scheduleFor = (c) =>
    schedules.find((s) => (s.classId ? s.classId === c.id : s.className === c.name)) ||
    schedules.find((s) => s.className === c.id);

  const scoredClasses = useMemo(
    () => classes.filter((c) => scheduleFor(c) && (scheduleFor(c).subjects || []).filter(Boolean).length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classes, schedules]
  );

  useEffect(() => {
    if (classId && !classes.some((c) => c.id === classId)) setClassId("");
  }, [classes, classId]);

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
  const schedSubjects = useMemo(
    () => (sched ? (sched.subjects || []).filter(Boolean) : []),
    [sched]
  );

  const classOptions = [
    { value: "", label: "None", sub: "no class" },
    ...classes.map((c) => ({
      value: c.id,
      label: c.name,
      sub: scoredClasses.some((x) => x.id === c.id)
        ? `${(scheduleFor(c)?.subjects || []).filter(Boolean).length} subjects`
        : "no schedule yet — importing creates it",
    })),
  ];

  const roster = useMemo(() => {
    if (!cls) return [];
    return students
      .filter((s) => s.className === cls.id && s.status !== "Graduate")
      .sort((a, b) => String(a.studentId || "").localeCompare(String(b.studentId || ""), undefined, { numeric: true }));
  }, [students, cls]);

  /* ── effective columns + groups for the selected class ── */
  const clsLayout = layout[classId] || null;
  const columns = useMemo(() => {
    if (!cls) return [];
    if (clsLayout) return clsLayout.columns;
    return bootstrapColumns(schedSubjects);
  }, [cls, clsLayout, schedSubjects]);
  const groups = clsLayout ? clsLayout.groups : null;

  const upsertLayout = (columns_, groups_) =>
    setLayout((prev) => ({ ...prev, [classId]: { columns: columns_, groups: groups_ } }));
  const ensureLayout = () => clsLayout || layoutFromColumns(columns, null);

  /* ── score cells ── */
  const setScore = (studentId, colKey, value) => {
    setScores((prev) => {
      const next = { ...prev, [classId]: { ...(prev[classId] || {}), [studentId]: { ...((prev[classId] || {})[studentId] || {}), [colKey]: value } } };
      try {
        localStorage.setItem(SCORES_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const cleanScore = (raw) => {
    let v = raw.replace(/[^0-9.]/g, "");
    const [ip, dp] = v.split(".");
    let int = (ip || "").slice(0, 3);
    if (int && Number(int) > 100) int = "100";
    if (dp === undefined) return int;
    return `${int}.${(dp || "").replace(/\./g, "").slice(0, 2)}`;
  };

  const onScoreBlur = (sid, colKey) => {
    const cur = ((scores[classId] || {})[sid] || {})[colKey];
    if (cur == null || cur === "") return;
    const n = Number(cur);
    setScore(sid, colKey, (isNaN(n) ? 0 : Math.min(100, n)).toFixed(2));
  };

  const valueOf = (studentId, colKey) => ((scores[classId] || {})[studentId] || {})[colKey] ?? "";

  const subjectValues = (studentId) =>
    columns.map((c) => {
      const raw = valueOf(studentId, c.key);
      return raw === "" ? null : Number(raw);
    });

  const filledCount = roster.filter((s) => subjectValues(s.id).some((n) => n != null)).length;

  const save = () => {
    logAudit("save_scores", `Saved scores for ${cls?.name || "class"} (${roster.length} students · ${columns.length} subjects)`);
    showToast("Scores saved");
  };

  const resetClass = () => {
    setScores((prev) => {
      const { [classId]: _drop, ...rest } = prev;
      return rest;
    });
    setLayout((prev) => {
      const { [classId]: _drop, ...rest } = prev;
      return rest;
    });
    setConfirmReset(false);
    showToast(`Scores cleared for ${cls?.name || "class"}`, "info");
  };

  /* a class with no schedule yet gets one created on the fly so the imported
   file's subjects have somewhere to live (mirrors the Schedule page's shape) */
  const shiftKeyOfClass = (c) => {
    const i = SHIFTS.findIndex((s) => s === c?.shift);
    return i >= 0 ? ["morning", "evening", "night"][i] : "morning";
  };
  const ensureSchedule = (subjectNames) => {
    const clean = Array.from(new Set((subjectNames || []).map((n) => String(n ?? "").trim()).filter(Boolean)));
    if (!clean.length || !cls || sched) return 0;
    const sem = String(cls.semester || "").match(/\d+/)?.[0] || "1";
    const year = String(cls.year || "").match(/\d+/)?.[0] || "1";
    const cal = new Date().getFullYear();
    const entry = {
      id: `sch_${cls.id}_${Date.now().toString(36)}`,
      className: cls.name || "",
      classId: cls.id,
      semester: sem,
      year,
      major: majorName(cls.major) || "IT",
      field: cls.field || "",
      studentYear: `${cal}-${cal + 1}`,
      shift: shiftKeyOfClass(cls),
      subjects: clean,
      teachers: ["Teacher 1", "Teacher 2", "Teacher 3", "Teacher 4", "Teacher 5", "Teacher 6", "Teacher 7"],
      cells: {},
    };
    setSchedules((prev) => {
      const next = [...prev, entry];
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

  /* append subject names to this class's schedule so the new score columns exist next time */
  const extendSubjects = (names) => {
    const clean = Array.from(new Set((names || []).map((n) => String(n ?? "").trim()).filter(Boolean)));
    if (!clean.length) return 0;
    if (!sched) return ensureSchedule(clean);
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

  const addSubjectColumn = () => {
    const n = `Subject ${columns.length + 1}`;
    const added = extendSubjects([n]);
    if (clsLayout) upsertLayout(appendColumns(clsLayout, [n]).columns, appendColumns(clsLayout, [n]).groups);
    if (added || clsLayout) showToast(`Added empty column "${n}" — scores go in here`);
    else showToast("That column already exists", "info");
  };

  /* ── header editing: rename + merge + split ── */
  const onRenameColumn = (colKey, label) => upsertLayout(renameColumn(ensureLayout(), colKey, label).columns, renameColumn(ensureLayout(), colKey, label).groups);
  const onMerge = (keys, name) => {
    const L = ensureLayout();
    upsertLayout(mergeColumns(L, keys, name).columns, mergeColumns(L, keys, name).groups);
    showToast(`Merged ${keys.length} column${keys.length === 1 ? "" : "s"} under one header`, "info");
  };
  const onSplit = (keys) => {
    const L = ensureLayout();
    upsertLayout(splitGroups(L, keys).columns, splitGroups(L, keys).groups);
  };
  const onClearGroups = () => {
    const L = ensureLayout();
    upsertLayout(clearGroups(L).columns, clearGroups(L).groups);
  };

  /* ── cheatsheet header editing ── */
  const noneLayout = noneMeta?.layout || null;
  const noneColumns = noneLayout ? noneLayout.columns : bootstrapColumns(noneMeta?.subjects || []);
  const setNoneLayout = (columns_, groups_) =>
    setNoneMeta((prev) => ({
      ...(prev || { subjects: [], rows: [], scores: {} }),
      layout: { columns: columns_, groups: groups_ },
      subjects: columns_.map((c) => c.label),
    }));
  const ensureNoneLayout = () => noneLayout || layoutFromColumns(noneColumns, null);
  const onNoneRenameColumn = (colKey, label) => {
    const L = ensureNoneLayout();
    setNoneLayout(renameColumn(L, colKey, label).columns, renameColumn(L, colKey, label).groups);
  };
  const onNoneRenameGroup = (id, name) => {
    const L = noneLayout;
    if (!L) return;
    setNoneLayout(renameGroup(L, id, name).columns, renameGroup(L, id, name).groups);
  };
  const onNoneMerge = (keys, name) => {
    const L = ensureNoneLayout();
    setNoneLayout(mergeColumns(L, keys, name).columns, mergeColumns(L, keys, name).groups);
  };
  const onNoneSplit = (keys) => {
    const L = ensureNoneLayout();
    setNoneLayout(splitGroups(L, keys).columns, splitGroups(L, keys).groups);
  };
  const onNoneClearGroups = () => {
    const L = ensureNoneLayout();
    setNoneLayout(clearGroups(L).columns, clearGroups(L).groups);
  };

  const setNoneMetaScore = (rowKey, colKey, raw) => {
    const v = cleanScore(raw);
    setNoneMeta((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        scores: { ...(prev.scores || {}), [rowKey]: { ...((prev.scores || {})[rowKey] || {}), [colKey]: v } },
      };
    });
  };

  const clearNone = () => {
    setNoneMeta(null);
    showToast("Cheatsheet cleared", "info");
  };

  const renameNoneName = (name) => setNoneMeta((prev) => (prev ? { ...prev, name } : prev));

  const saveNone = () => {
    const nm = (noneMeta?.name || "").trim() || "Cheatsheet";
    const final = noneMeta ? { ...noneMeta, name: nm } : noneMeta;
    if (final) {
      try {
        localStorage.setItem(NONE_META_KEY, JSON.stringify(final));
      } catch {
        /* ignore */
      }
    }
    const subjectCount = final?.layout?.columns?.length || final?.subjects?.length || 0;
    const rowCount = final?.rows?.length || 0;
    logAudit("save_scores_none", `Saved score list "${nm}" (${subjectCount} subjects · ${rowCount} students)`);
    showToast(`Score list "${nm}" saved`);
  };

  /* ensure every column belongs to a group (even if the file had none) so the header stays gapless —
     the group row gets an EMPTY name so it doesn't repeat the subject below; the user merges + names them */
  const normalizeLayout = (cols, groups) => {
    const gs = [...(groups || [])];
    const next = cols.map((c) => {
      if (c.group) return c;
      const id = nextGroupId(gs);
      gs.push({ id, name: "" });
      return { ...c, group: id };
    });
    return { columns: next, groups: gs.filter((g) => next.some((c) => c.group === g.id)) };
  };

  /* ── import: merge file columns (+groups) into the sheet ── */
  const applyImport = (payload) => {
    const { rows, matched, cells, perCol, groups: fileGroups, fileRows, addRows = [] } = payload;

    if (!cls) {
      /* "(No class)" cheatsheet: the sheet mirrors the file */
      const base = noneLayout ? noneLayout.columns : bootstrapColumns(noneMeta?.subjects || []);
      const used = new Set(base.map((c) => c.key));
      const resolved = perCol.map((p) => {
        if (p.key) {
          used.add(p.key);
          return p;
        }
        const key = uniqueColumnKey(p.label, used);
        used.add(key);
        return { ...p, key };
      });
      const isNew = perCol.map((p) => !p.key);
      const keyByIdx = new Map(resolved.map((r, i) => [perCol[i].idx, r.key]));

      const keep = (fileRows || []).filter((fr) => rows[fr.key] && Object.keys(rows[fr.key]).length);
      let cols = [...base];
      let localGroups = noneLayout ? [...noneLayout.groups] : [];
      const fileToLocal = new Map();
      (fileGroups || []).forEach((g) => {
        const id = nextGroupId(localGroups);
        fileToLocal.set(g.id, id);
        localGroups.push({ id, name: g.name });
      });
      resolved.forEach((r, i) => {
        const gid = r.gid ? fileToLocal.get(r.gid) || null : null;
        if (isNew[i]) cols.push({ key: r.key, label: r.label, group: gid });
        else {
          const ci = cols.findIndex((c) => c.key === r.key);
          if (ci >= 0) cols[ci] = gid ? { ...cols[ci], group: gid } : cols[ci];
        }
      });
      const finalLayout = normalizeLayout(cols, localGroups);
      const scoresMap = Object.fromEntries(
        keep.map((fr) => [
          fr.key,
          Object.fromEntries(
            Object.entries(rows[fr.key])
              .map(([idx, v]) => [keyByIdx.get(Number(idx)), v])
              .filter(([k]) => k)
          ),
        ])
      );
      const meta = {
        name: payload.source ? payload.source.replace(/\.[^.]+$/, "") : (noneMeta?.name || "Cheatsheet"),
        layout: finalLayout,
        subjects: finalLayout.columns.map((c) => c.label),
        rows: keep.map((fr) => ({ key: fr.key, name: fr.name, sidRaw: fr.sidRaw })),
        scores: scoresMap,
      };
      setNoneMeta(meta);
      try {
        localStorage.setItem(NONE_META_KEY, JSON.stringify(meta));
      } catch {
        /* ignore */
      }
      showToast(
        `Cheatsheet imported & saved — ${finalLayout.columns.length} subject${finalLayout.columns.length === 1 ? "" : "s"} · ${keep.length} student${keep.length === 1 ? "" : "s"} (columns + group headers match the file)`
      );
      logAudit("import_scores_none", `Imported cheatsheet: ${finalLayout.columns.length} subjects, ${keep.length} rows`);
      setImportOpen(false);
      return;
    }

    /* class mode: resolve every file column to a sheet column key (new columns get unique keys) */
    const base = clsLayout ? clsLayout.columns : bootstrapColumns(schedSubjects);
    const used = new Set(base.map((c) => c.key));
    const resolved = perCol.map((p) => {
      if (p.key) {
        used.add(p.key);
        return p;
      }
      const key = uniqueColumnKey(p.label, used);
      used.add(key);
      return { ...p, key };
    });
    const isNew = perCol.map((p) => !p.key);
    const keyByIdx = new Map(resolved.map((r, i) => [perCol[i].idx, r.key]));
    const newLabels = resolved.filter((_, i) => isNew[i]).map((r) => r.label);

    /* Unmatched file rows become new class members: link an existing registry
       student, or create one — either way their scores come along. */
    const normId = (x) => norm(String(x ?? ""));
    const matchRegistry = (sidRaw, nameRaw) => {
      const sid = norm(sidRaw);
      if (sid) {
        const byId = students.find(
          (s) =>
            normId(s.studentId) === sid ||
            normId(s.studentId).endsWith("-" + sid) ||
            (sid.length >= 3 && normId(s.studentId).includes(sid))
        );
        if (byId) return byId;
      }
      const nm = norm(nameRaw);
      if (!nm) return null;
      return (
        students.find(
          (s) =>
            norm(s.khmerName) === nm ||
            norm(`${s.firstName} ${s.lastName}`) === nm ||
            (nm.length >= 3 && (norm(s.khmerName).includes(nm) || norm(`${s.firstName} ${s.lastName}`).includes(nm)))
        ) || null
      );
    };
    const toLinkIds = [];
    const toCreate = [];
    const scoredAdds = [];
    addRows.forEach((a) => {
      const ex = matchRegistry(a.sidRaw, a.nameRaw);
      if (ex) {
        if (ex.className !== cls.id) {
          toLinkIds.push(ex.id);
          scoredAdds.push({ id: ex.id, st: a.st || {} });
        }
        return;
      }
      const nm = cleanName(a.nameRaw);
      if (nm) toCreate.push(a);
    });
    let maxId = Math.max(0, ...students.map((s) => s.id));
    const usedSids = new Set(students.map((s) => normId(s.studentId)));
    const seq = { v: maxId + 1 };
    const createdStudents = toCreate.map((a) => {
      const nm = cleanName(a.nameRaw);
      const sp = splitLatin(nm);
      const base = buildStudent(
        { sid: a.sidRaw, kh: nm, latin: "", firstName: sp.firstName, lastName: sp.lastName },
        classes,
        cls.id,
        new Date().getFullYear(),
        usedSids,
        seq,
        cls.id
      );
      base.id = ++maxId;
      return base;
    });
    createdStudents.forEach((c, i) => scoredAdds.push({ id: c.id, st: toCreate[i].st || {} }));

    setScores((prev) => {
      const next = { ...prev, [classId]: { ...(prev[classId] || {}) } };
      Object.entries(rows).forEach(([sid, idxMap]) => {
        next[classId][sid] = { ...(next[classId][sid] || {}) };
        Object.entries(idxMap).forEach(([idx, val]) => {
          const key = keyByIdx.get(Number(idx));
          if (key) next[classId][sid][key] = val;
        });
      });
      scoredAdds.forEach(({ id: sid, st }) => {
        if (!Object.keys(st).length) return;
        next[classId][sid] = { ...(next[classId][sid] || {}) };
        Object.entries(st).forEach(([idx, val]) => {
          const key = keyByIdx.get(Number(idx));
          if (key) next[classId][sid][key] = val;
        });
      });
      try {
        localStorage.setItem(SCORES_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    const added = extendSubjects([...new Set(newLabels)]);
    if (toLinkIds.length) importStudents(cls.id, toLinkIds);
    if (createdStudents.length) addStudentsBatch(createdStudents);

    /* only build a layout when there is something to preserve (groups, renames or new columns) */
    if (fileGroups.length || isNew.some(Boolean) || clsLayout) {
      let cols = [...base];
      let localGroups = clsLayout ? [...clsLayout.groups] : [];
      const fileToLocal = new Map();
      (fileGroups || []).forEach((g) => {
        const id = nextGroupId(localGroups);
        fileToLocal.set(g.id, id);
        localGroups.push({ id, name: g.name });
      });
      resolved.forEach((r, i) => {
        const gid = r.gid ? fileToLocal.get(r.gid) || null : null;
        if (isNew[i]) {
          cols.push({ key: r.key, label: r.label, group: gid });
        } else {
          const ci = cols.findIndex((c) => c.key === r.key);
          if (ci >= 0) cols[ci] = gid ? { ...cols[ci], group: gid } : cols[ci];
        }
      });
      const finalLayout = normalizeLayout(cols, localGroups);
      upsertLayout(finalLayout.columns, finalLayout.groups);
    }

    const nAdded = createdStudents.length + toLinkIds.length;
    logAudit(
      "import_scores",
      `Imported ${cells} score cells for ${matched} students into ${cls?.name || "class"}` +
        (nAdded ? ` + ${nAdded} added (${createdStudents.length} new, ${toLinkIds.length} linked)` : "") +
        (added ? ` (+${added} new subject column${added === 1 ? "" : "s"})` : "") +
        (fileGroups.length ? ` (${fileGroups.length} group header${fileGroups.length === 1 ? "" : "s"})` : "")
    );
    showToast(
      `Imported & saved ${cells} scores for ${matched} students` +
        (nAdded ? ` · ${createdStudents.length} new + ${toLinkIds.length} linked added to ${cls?.name}` : "") +
        (added ? ` · added ${added} new subject column${added === 1 ? "" : "s"}` : "") +
        (fileGroups.length ? ` · group headers kept (${fileGroups.map((g) => g.name).join(", ")})` : "")
    );
    setImportOpen(false);
  };

  return (
    <div className="max-w-[1500px] mx-auto space-y-5 animate-fade-up">
      <PageHeader
        title="Scores"
        subtitle="Pick a class for a live score sheet, or keep None and import a cheatsheet — its columns and group headers become the subjects exactly as written in the file."
        actions={
          <>
            <button
              onClick={() => setImportOpen(true)}
              className="btn btn-outline h-10 shrink-0 px-3.5 text-sm gap-1.5"
              title={
                classId
                  ? "Import scores for this class from an Excel or CSV file (one subject per column, one row per student)"
                  : "Import an Excel cheatsheet — its columns and group headers become the score subjects exactly as written in the file"
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
            <NoneSheet
              meta={noneMeta}
              onScore={setNoneMetaScore}
              onClear={clearNone}
              frozen={frozen}
              setFrozen={setFrozen}
              onRenameColumn={onNoneRenameColumn}
              onRenameGroup={onNoneRenameGroup}
              onMerge={onNoneMerge}
              onSplit={onNoneSplit}
              onClearGroups={onNoneClearGroups}
              onRenameName={renameNoneName}
              onSave={saveNone}
            />
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
            subtitle="Add subject columns on the Schedule page — or use Import Excel above: the file's columns automatically become this class's score subjects (and its students are added with their scores)."
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
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <div>
              <p className="text-base font-bold" style={{ color: "var(--text)" }}>
                {cls.name} — score sheet
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-2)" }}>
                {[cls.field, cls.shift].filter(Boolean).join(" · ")} · {cls.year || "Year 1"} · {cls.semester || "Semester 1"} · {columns.length} subject{columns.length === 1 ? "" : "s"} · {roster.length} student{roster.length === 1 ? "" : "s"}
              </p>
            </div>
            {filledCount > 0 && (
              <span className="rounded-lg border px-2.5 py-1 text-xs font-semibold" style={{ borderColor: "var(--border)", background: "var(--primary-soft)", color: "var(--primary-strong)" }}>
                {filledCount}/{roster.length} scored
              </span>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-2">
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

          {columns.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm" style={{ color: "var(--text-3)" }}>
              This class has a schedule but no subjects yet — click <b style={{ color: "var(--text-2)" }}>+ Add subject</b> above, or add subject columns on the Schedule page.
            </p>
          ) : (
            <ScoreSheet
              key={`cls:${classId}`}
              rows={roster.map((s) => ({
                key: String(s.id),
                node: (
                  <div className="flex items-center gap-2.5 min-w-0">
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
                ),
              }))}
              columns={columns}
              groups={groups}
              frozen={frozen}
              setFrozen={setFrozen}
              getValue={valueOf}
              setValue={setScore}
              onBlur={onScoreBlur}
              onRenameColumn={onRenameColumn}
              onRenameGroup={(id, name) => {
                if (!clsLayout) return;
                upsertLayout(renameGroup(clsLayout, id, name).columns, renameGroup(clsLayout, id, name).groups);
              }}
              onMerge={onMerge}
              onSplit={onSplit}
              onClearGroups={onClearGroups}
              emptyNote={`No active students in ${cls.name} yet — add them from the Classes page.`}
            />
          )}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-5 py-3 border-t text-[11px]" style={{ borderColor: "var(--border)", color: "var(--text-3)" }}>
            <span>Scores 0–100 · auto-saved as you type · arrow keys / Enter move between cells</span>
            <span className="ml-auto">Merge headers to label semesters (S1Y1, S2Y2, …) · click a header to rename</span>
          </div>
        </div>
      )}

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
                  This clears every score entered for <b>{cls?.name}</b> and removes its column layout (merged headers). The class schedule and students are untouched.
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
        subjects={schedSubjects}
        columns={columns}
        roster={roster}
        noneMode={!cls}
        onImport={applyImport}
      />
    </div>
  );
}