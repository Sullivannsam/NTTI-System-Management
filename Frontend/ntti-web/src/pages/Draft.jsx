import React, { useEffect, useMemo, useState } from "react";
import { Archive, Users, UsersRound, RotateCcw, Trash2, Check, CheckSquare } from "lucide-react";
import PageHeader, { EmptyState } from "../components/Page";
import Modal from "../components/Modal";
import { useApp } from "../context/AppContext";
import { prettyDate, majorName } from "../data/seed";
import { Badge, StudentAvatar, statusTone } from "../components/Badge";

const ACCENT = {
  it: "linear-gradient(135deg,#6366f1,#8b5cf6)",
  el: "linear-gradient(135deg,#f59e0b,#f97316)",
  arc: "linear-gradient(135deg,#10b981,#14b8a6)",
};

const SOURCE = {
  class: { label: "From Classes", icon: UsersRound, bg: "var(--primary-soft)", fg: "var(--primary-strong)" },
  student: { label: "From Students", icon: Users, bg: "var(--success-soft)", fg: "var(--success)" },
};

/** Draft — every deleted class or student parks here (tagged with where it
    came from) so it can be restored whole, or purged forever. Linked from
    the left menu panel, under Admin. */
export default function Draft() {
  const { drafts, students, classes, restoreFromDraft, purgeFromDraft, showToast } = useApp();
  const [purgeTarget, setPurgeTarget] = useState(null);
  const [purgeSel, setPurgeSel] = useState(() => new Set());
  const [confirmed, setConfirmed] = useState(false);

  const draftCount = drafts.length;
  const isStudentTarget = purgeTarget?.source === "student";

  // the class's students shown in the "Delete forever" picker
  const targetStudents = useMemo(
    () => (purgeTarget && purgeTarget.source !== "student" ? students.filter((s) => s.className === purgeTarget.id) : []),
    [purgeTarget, students]
  );

  // reset the picker + confirm state every time a new purge target opens
  useEffect(() => {
    setPurgeSel(new Set());
    setConfirmed(false);
  }, [purgeTarget]);

  const pickerAll = targetStudents.length > 0 && purgeSel.size === targetStudents.length;

  const togglePurgeSel = (sid) =>
    setPurgeSel((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });

  const sourceMeta = (item) => SOURCE[item.source === "student" ? "student" : "class"];

  const doPurge = () => {
    if (!purgeTarget) return;
    const who = isStudentTarget
      ? purgeTarget.khmerName || `${purgeTarget.firstName} ${purgeTarget.lastName}`.trim()
      : `Class "${purgeTarget.name}"`;
    purgeFromDraft(purgeTarget.id, { removeStudents: isStudentTarget ? [] : Array.from(purgeSel) });
    showToast(
      isStudentTarget
        ? `${who} deleted forever`
        : `${who} deleted forever${
            purgeSel.size
              ? ` · ${purgeSel.size} student${purgeSel.size === 1 ? "" : "s"} erased`
              : " · students kept in Students panel"
          }`
    );
    setPurgeTarget(null);
  };

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Draft"
        subtitle="Classes and students you deleted are parked here — each card shows where it came from, so you can restore it anytime or delete it forever."
      />

      {draftCount === 0 ? (
        <div className="card">
          <EmptyState
            icon={Archive}
            title="Draft is empty"
            subtitle="When you delete a class or a student it lands here — nothing is lost until you delete it forever."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {drafts.map((item) => {
            const meta = sourceMeta(item);
            const Icon = meta.icon;
            const isStudent = item.source === "student";

            if (isStudent) {
              const inClass = classes.find((c) => c.id === item.className);
              return (
                <div key={item.id} className="card p-5 flex flex-col animate-fade-up">
                  <span
                    className="mb-3 inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: meta.bg, color: meta.fg }}
                  >
                    <Icon size={11} /> {meta.label}
                  </span>
                  <div className="flex items-start gap-3">
                    <StudentAvatar student={item} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold truncate" style={{ color: "var(--text)" }}>
                        {item.khmerName || `${item.firstName} ${item.lastName}`.trim()}
                      </p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-2)" }}>
                        {`${item.firstName} ${item.lastName}`.trim() || item.username}
                      </p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-3)" }}>
                        {item.studentId || "—"} · {inClass ? `was in ${inClass.name}` : "no class"}
                      </p>
                      <p className="text-[10px] mt-1 font-semibold" style={{ color: "var(--danger)" }}>
                        Moved to Draft · {prettyDate(item.deletedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Badge tone={statusTone(item.status)}>{item.status || "—"}</Badge>
                    {item.gender && <Badge tone="neutral">{item.gender}</Badge>}
                    {item.phone && <Badge tone="neutral">{item.phone}</Badge>}
                  </div>

                  <div className="mt-4 pt-3 border-t flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
                    <button
                      onClick={() => {
                        restoreFromDraft(item.id);
                        const who = item.khmerName || `${item.firstName} ${item.lastName}`.trim();
                        showToast(`${who} restored to Students`);
                      }}
                      className="btn h-9 px-3 text-sm flex-1"
                      style={{ background: "var(--primary-soft)", color: "var(--primary-strong)" }}
                    >
                      <RotateCcw size={14} /> Restore
                    </button>
                    <button
                      onClick={() => setPurgeTarget(item)}
                      className="btn h-9 px-3 text-sm"
                      style={{ color: "var(--danger)" }}
                      title="Delete forever — cannot be undone"
                    >
                      <Trash2 size={14} /> Delete forever
                    </button>
                  </div>
                </div>
              );
            }

            /* ── class draft ── */
            const dSem = String(item.semester || "").match(/\d+/)?.[0] || "1";
            const dYear = String(item.year || "").match(/\d+/)?.[0] || "1";
            const dCount = students.filter((s) => s.className === item.id).length;
            return (
              <div key={item.id} className="card p-5 flex flex-col animate-fade-up">
                <span
                  className="mb-3 inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{ background: meta.bg, color: meta.fg }}
                >
                  <Icon size={11} /> {meta.label}
                </span>
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white text-xs font-bold shadow-soft"
                    style={{ background: ACCENT[item.major] || ACCENT.it }}
                  >
                    {item.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold truncate" style={{ color: "var(--text)" }}>
                      {item.name}
                    </p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-3)" }}>
                      {item.field || item.name} · {item.shift} shift · {majorName(item.major)}
                    </p>
                    <p className="text-[10px] mt-1 font-semibold" style={{ color: "var(--danger)" }}>
                      Moved to Draft · {prettyDate(item.deletedAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {item.field && <Badge tone="neutral">{item.field}</Badge>}
                  <Badge tone="neutral">Semester {dSem} · Year {dYear}</Badge>
                </div>

                <div className="mt-4 flex flex-1 items-end justify-between text-xs">
                  <span style={{ color: "var(--text-2)" }}>
                    <b className="tabular-nums" style={{ color: "var(--text)" }}>{dCount}</b>{" "}
                    student{dCount === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
                  <button
                    onClick={() => {
                      restoreFromDraft(item.id);
                      showToast(`Class "${item.name}" restored to Classes`);
                    }}
                    className="btn h-9 px-3 text-sm flex-1"
                    style={{ background: "var(--primary-soft)", color: "var(--primary-strong)" }}
                  >
                    <RotateCcw size={14} /> Restore
                  </button>
                  <button
                    onClick={() => setPurgeTarget(item)}
                    className="btn h-9 px-3 text-sm"
                    style={{ color: "var(--danger)" }}
                    title="Delete forever — cannot be undone"
                  >
                    <Trash2 size={14} /> Delete forever
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* delete forever */}
      <Modal
        open={!!purgeTarget}
        onClose={() => setPurgeTarget(null)}
        fluidBody
        title={isStudentTarget ? "Delete student forever" : "Delete class forever"}
        subtitle={purgeTarget ? (isStudentTarget
          ? purgeTarget.khmerName || `${purgeTarget.firstName} ${purgeTarget.lastName}`.trim()
          : `${purgeTarget.name} · ${targetStudents.length} student${targetStudents.length === 1 ? "" : "s"}`) : ""}
        footer={
          <>
            <button onClick={() => setPurgeTarget(null)} className="btn btn-outline h-10 px-4 text-sm">
              Cancel
            </button>
            <button
              onClick={doPurge}
              disabled={!confirmed}
              className="btn h-10 px-4 text-sm text-white"
              style={{
                background: "var(--danger)",
                opacity: confirmed ? 1 : 0.45,
                cursor: confirmed ? "pointer" : "not-allowed",
                boxShadow: confirmed ? "0 8px 18px -6px rgba(239,68,68,.45)" : undefined,
              }}
              title={confirmed ? "Delete forever — cannot be undone" : "Tick the confirmation box first"}
            >
              <Trash2 size={15} /> Delete forever
            </button>
          </>
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3 text-sm" style={{ color: "var(--text-2)" }}>
          {isStudentTarget ? (
            <>
              <p>
                <b style={{ color: "var(--text)" }}>
                  {purgeTarget.khmerName || `${purgeTarget.firstName} ${purgeTarget.lastName}`.trim()}
                </b>{" "}
                will be permanently removed, together with their attendance and weekly records.
              </p>
              <p className="text-xs" style={{ color: "var(--text-3)" }}>
                This cannot be undone.
              </p>
            </>
          ) : (
            <>
              <p>
                <b style={{ color: "var(--text)" }}>{purgeTarget?.name}</b> will be permanently removed. Its
                students carry on living in the <b style={{ color: "var(--text)" }}>Students</b> panel — tick
                any of them below to also erase them forever (they lose all attendance and weekly records).
              </p>
              {targetStudents.length > 0 ? (
                <div className="flex min-h-0 flex-1 flex-col rounded-xl border pt-1.5" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between px-3 pb-1.5">
                    <p className="text-[11px] font-semibold" style={{ color: "var(--text-3)" }}>
                      {purgeSel.size === 0
                        ? "All students will be kept"
                        : `${purgeSel.size} student${purgeSel.size === 1 ? "" : "s"} will be erased forever`}
                    </p>
                    <button
                      onClick={() =>
                        setPurgeSel(pickerAll ? new Set() : new Set(targetStudents.map((s) => s.id)))
                      }
                      className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold hover:bg-[var(--surface-2)]"
                      style={{ color: "var(--primary-strong)" }}
                    >
                      <CheckSquare size={12} /> {pickerAll ? "Clear all" : "Select all"}
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto thin-scroll border-t" style={{ borderColor: "var(--border)" }}>
                    {targetStudents.map((s) => {
                      const on = purgeSel.has(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => togglePurgeSel(s.id)}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-2)]"
                        >
                          <span
                            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-md border"
                            style={{
                              borderColor: on ? "var(--danger)" : "var(--border)",
                              background: on ? "var(--danger)" : "transparent",
                            }}
                          >
                            {on && <Check size={11} strokeWidth={3.5} style={{ color: "#fff" }} />}
                          </span>
                          <StudentAvatar student={s} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-medium truncate" style={{ color: on ? "var(--text)" : "var(--text-2)" }}>
                              {s.khmerName || `${s.firstName} ${s.lastName}`.trim()}
                            </span>
                            <span className="block text-[11px] truncate" style={{ color: "var(--text-3)" }}>
                              {`${s.firstName} ${s.lastName}`.trim()} · {s.studentId}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs" style={{ color: "var(--text-3)" }}>
                  This class has no students assigned right now.
                </p>
              )}
              <p className="text-xs" style={{ color: "var(--text-3)" }}>
                The class, its term records, schedule link and score sheet are erased. This cannot be undone.
              </p>
            </>
          )}
          <button
            onClick={() => setConfirmed((c) => !c)}
            className="mt-1 flex items-start gap-2.5 rounded-xl border px-3 py-3 text-left transition-colors"
            style={{
              borderColor: confirmed ? "var(--danger)" : "var(--border)",
              background: confirmed ? "rgba(239,68,68,.08)" : "transparent",
            }}
          >
            <span
              className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-md border"
              style={{
                borderColor: confirmed ? "var(--danger)" : "var(--border)",
                background: confirmed ? "var(--danger)" : "transparent",
              }}
            >
              {confirmed && <Check size={11} strokeWidth={3.5} style={{ color: "#fff" }} />}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold leading-snug" style={{ color: "var(--text)" }}>
                I understand — this cannot be undone
              </span>
              <span className="block text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
                {isStudentTarget
                  ? "Deleting forever erases this student and all of their records."
                  : "Students you did not tick are kept in the Students panel."}
              </span>
            </span>
          </button>
        </div>
      </Modal>
    </div>
  );
}