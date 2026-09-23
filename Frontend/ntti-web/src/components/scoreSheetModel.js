/* Pure helpers for the score sheet's column layout.
   A layout = { columns: [{ key, label, group }], groups: [{ id, name }] }
   - `key`  = storage identity of a score column (stays stable when you rename)
   - `label`= the text shown in the column header
   - `group`= which group header the column sits under
   Groups are contiguous: column order defines which columns belong to which group.
*/

/** "Math" -> "Math" unless already used, then "Math #2", "Math #3", … */
export const uniqueColumnKey = (label, usedKeys) => {
  const base = String(label ?? "").trim();
  const used = new Set(usedKeys || []);
  let candidate = base;
  let n = 2;
  while (candidate === "" || used.has(candidate)) {
    candidate = `${base || "Column"} #${n++}`;
  }
  return candidate;
};

/** Flat layout from plain subject names (class from schedule / cheatsheet from file). No groups yet. */
export const bootstrapColumns = (labels) =>
  (labels || [])
    .filter((l) => String(l ?? "").trim() !== "")
    .map((label) => ({ key: String(label).trim(), label: String(label).trim(), group: null }));

/** Give every column its own group named after the column (used when a layout is first created). */
export const freshGroupsFor = (columns) =>
  columns.map((c, i) => ({ id: `g${i}`, name: c.label }));

/** Ensure a full layout (columns carry group ids, groups array present). */
export const layoutFromColumns = (columns, groups) => {
  const gs = groups && groups.length ? groups : freshGroupsFor(columns);
  const byIndex = (i) => (gs[i] ? gs[i].id : null);
  return {
    columns: columns.map((c, i) => ({ ...c, group: groups && groups.length ? c.group ?? gs.find((g) => g.id === c.group)?.id ?? byIndex(i) : byIndex(i) })),
    groups: gs,
  };
};

/** Groups in column-display order (first appearance wins). */
export const orderedGroups = ({ columns, groups }) => {
  const seen = [];
  columns.forEach((c) => {
    if (!c.group || seen.some((g) => g.id === c.group)) return;
    const g = (groups || []).find((x) => x.id === c.group);
    if (g) seen.push(g);
  });
  return seen;
};

export const groupSpan = (columns, groupId) => columns.filter((c) => c.group === groupId).length;

export const nextGroupId = (groups) => {
  let n = 0;
  (groups || []).forEach((g) => {
    const m = /^g(\d+)$/.exec(g.id || "");
    if (m) n = Math.max(n, Number(m[1]) + 1);
  });
  return `g${n}`;
};

/** Drop groups that no longer cover any column (keeps the layout tidy). */
export const pruneGroups = ({ columns, groups }) => ({
  columns,
  groups: (groups || []).filter((g) => columns.some((c) => c.group === g.id)),
});

/** Rename a column (display label only — the storage key does not change). */
export const renameColumn = (layout, key, label) => ({
  ...layout,
  columns: layout.columns.map((c) => (c.key === key ? { ...c, label: String(label).trim() || c.label } : c)),
  groups: layout.groups,
});

/** Rename a group header. */
export const renameGroup = (layout, id, name) => ({
  ...layout,
  columns: layout.columns,
  groups: layout.groups.map((g) => (g.id === id ? { ...g, name: String(name).trim() || g.name } : g)),
});

/** Merge the columns whose keys are given (the whole range between first and last) into one group. */
export const mergeColumns = (layout, keys, name) => {
  const cols = layout.columns;
  const idxs = keys.map((k) => cols.findIndex((c) => c.key === k)).filter((i) => i >= 0);
  if (!idxs.length) return layout;
  const lo = Math.min(...idxs);
  const hi = Math.max(...idxs);
  const gids = new Set(cols.slice(lo, hi + 1).map((c) => c.group).filter(Boolean));
  if (gids.size === 0) return layout;
  if (gids.size === 1) {
    const g = layout.groups.find((x) => x.id === cols[lo].group);
    if (g && (name === undefined || g.name === name || name === "")) return layout;
  }
  const gid = nextGroupId(layout.groups);
  return pruneGroups({
    columns: cols.map((c, i) => (i >= lo && i <= hi ? { ...c, group: gid } : c)),
    groups: [...layout.groups, { id: gid, name: (name && name.trim()) || cols[lo].label }],
  });
};

/** Fully un-group the groups that contain any of the given column keys (each column gets its own header). */
export const splitGroups = (layout, keys) => {
  const cols = layout.columns;
  const targetIds = new Set(keys.map((k) => cols.find((c) => c.key === k)?.group).filter(Boolean));
  if (!targetIds.size) return layout;
  let groups = layout.groups.filter((g) => !targetIds.has(g.id));
  const next = cols.map((c) => {
    if (!targetIds.has(c.group)) return c;
    const gid = nextGroupId(groups);
    groups = [...groups, { id: gid, name: c.label }];
    return { ...c, group: gid };
  });
  return pruneGroups({ columns: next, groups });
};

/** Remove every group — each column becomes its own header. */
export const clearGroups = (layout) => splitGroups(layout, layout.columns.map((c) => c.key));

/** Append new columns (labels) to a layout, keeping groups. Keys dedupe to stay unique. */
export const appendColumns = (layout, labels) => {
  const used = layout.columns.map((c) => c.key);
  const adds = (labels || [])
    .filter((l) => String(l ?? "").trim() !== "")
    .map((label) => {
      const key = uniqueColumnKey(label, used);
      used.push(key);
      return { key, label: String(label).trim(), group: null };
    });
  if (!adds.length) return layout;
  return { columns: [...layout.columns, ...adds], groups: layout.groups };
};

/**
 * Reconstruct merged groups from a (possibly sparse) header row.
 * Merged cells in xlsx read as the value in the first cell and "" in the rest;
 * adjacent identical labels are treated as the same group too.
 * Returns { groups: [{id,name}], perColumn: [groupId per column] }.
 */
export const groupsFromRow = (cells, columnCount) => {
  const names = [];
  const perColumn = [];
  let gi = -1;
  for (let i = 0; i < columnCount; i++) {
    const v = String(cells[i] ?? "").trim();
    if (gi < 0) {
      gi = 0;
      names[0] = v || "—";
    } else if (v && v !== names[gi]) {
      gi++;
      names[gi] = v;
    }
    perColumn[i] = gi;
  }
  const groups = names.map((name, i) => ({ id: `g${i}`, name }));
  return { groups, perColumn: perColumn.map((id) => (groups[id] ? groups[id].id : null)) };
};

/**
 * Look for a group-header row directly above `subjectRowIdx`: a row that has at
 * least `min` non-empty cells in the subject-column area, none of which are IDs,
 * names or numeric score values.
 */
export const detectGroupRow = (rows, subjectRowIdx, { subjectLike, min = 1 } = {}) => {
  const g = subjectRowIdx - 1;
  if (g < 0) return -1;
  const subject = rows[subjectRowIdx] || [];
  const group = rows[g] || [];
  let hits = 0;
  for (let i = 0; i < Math.max(subject.length, group.length); i++) {
    const s = String(subject[i] ?? "").trim();
    if (!s || (subjectLike && !subjectLike(s))) continue;
    const v = String(group[i] ?? "").trim();
    if (!v) continue;
    if (/^\d+([.,]\d+)?$/.test(v)) continue; // a data row, not a header
    hits++;
  }
  return hits >= min ? g : -1;
};

/** Pick the file label that best matches an existing sheet column (label or key, case-insensitive). */
export const matchSheetColumn = (columns, fileLabel) => {
  const want = String(fileLabel ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!want) return null;
  return (
    columns.find((c) => String(c.label).trim().toLowerCase().replace(/\s+/g, " ") === want) ||
    columns.find((c) => String(c.key).trim().toLowerCase().replace(/\s+/g, " ") === want) ||
    null
  );
};