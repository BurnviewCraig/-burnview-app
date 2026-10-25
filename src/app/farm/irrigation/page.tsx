"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Pencil, Printer, Trash2, X } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { todayStr, byPaddockNumber, sanitizeDecimalInput } from "@/lib/utils";
import { addDays } from "@/lib/calendarFormat";
import type { Farm, Pivot, IrrigationRun, IrrigationConflict } from "@/lib/types";

const WEEK_LENGTH = 7;

// Speed is inverse to depth — running slower (a lower %) passes more water.
function mmForRun(pivot: Pivot, percentage: number) {
  if (pivot.mmAt100Pct == null || percentage <= 0) return null;
  return Math.round(((pivot.mmAt100Pct * 100) / percentage) * 10) / 10;
}

function dayLabel(date: string) {
  return new Date(date.slice(0, 10) + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export default function IrrigationPage() {
  const today = todayStr();
  const [anchor, setAnchor] = useState(today);
  const start = anchor;
  const end = addDays(anchor, WEEK_LENGTH - 1);

  const { data: farmsData, loading: farmsLoading } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];
  const { data: pivotsData, loading: pivotsLoading, refetch: refetchPivots } = useApi<{ pivots: Pivot[] }>("/api/pivots");
  const pivots = pivotsData?.pivots ?? [];
  const { data: runsData, refetch: refetchRuns } = useApi<{ runs: IrrigationRun[]; conflicts: Record<string, IrrigationConflict[]> }>(
    `/api/irrigation-runs?start=${start}&end=${end}`
  );
  const runs = runsData?.runs ?? [];
  const conflicts = runsData?.conflicts ?? {};

  const [farmFilter, setFarmFilter] = useState<string | "all">("all");
  const farmTabs = useMemo(() => {
    const seen = new Map<string, string>();
    pivots.forEach((p) => { if (!seen.has(p.farmId)) seen.set(p.farmId, p.farm.name); });
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [pivots]);

  const runsByPivot = useMemo(() => {
    const map = new Map<string, IrrigationRun[]>();
    runs.forEach((r) => map.set(r.pivotId, [...(map.get(r.pivotId) ?? []), r]));
    return map;
  }, [runs]);

  const mmWeekFor = (pivot: Pivot) => {
    if (pivot.mmAt100Pct == null) return null;
    const list = runsByPivot.get(pivot.id) ?? [];
    return Math.round(list.reduce((s, r) => s + (mmForRun(pivot, r.percentage) ?? 0), 0) * 10) / 10;
  };

  const farmGroups = useMemo(() => {
    const byFarm = new Map<string, { farmId: string; farmName: string; pivots: Pivot[] }>();
    pivots
      .filter((p) => farmFilter === "all" || p.farmId === farmFilter)
      .forEach((p) => {
        const g = byFarm.get(p.farmId) ?? { farmId: p.farmId, farmName: p.farm.name, pivots: [] };
        g.pivots.push(p);
        byFarm.set(p.farmId, g);
      });
    return [...byFarm.values()];
  }, [pivots, farmFilter]);

  const grandTotal = useMemo(() => {
    let total = 0;
    let missing = 0;
    farmGroups.forEach((g) => g.pivots.forEach((p) => {
      const mm = mmWeekFor(p);
      if (mm == null) missing++;
      else total += mm;
    }));
    return { total: Math.round(total * 10) / 10, missing };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmGroups, runsByPivot]);

  const [active, setActive] = useState<{ pivot: Pivot; run: IrrigationRun | "new" } | null>(null);
  const [ratingPivot, setRatingPivot] = useState<Pivot | null>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!printing) return;
    const t = setTimeout(() => window.print(), 50);
    const after = () => setPrinting(false);
    window.addEventListener("afterprint", after, { once: true });
    return () => { clearTimeout(t); window.removeEventListener("afterprint", after); };
  }, [printing]);

  if (farmsLoading || pivotsLoading) return <div className="screen"><Header title="Irrigation" backHref="/farm" /><Spinner /></div>;

  return (
    <div className="screen">
      <Header title="Irrigation" backHref="/farm" />

      <div className="tabs no-print">
        <button className={`tab${farmFilter === "all" ? " active" : ""}`} onClick={() => setFarmFilter("all")}>All</button>
        {farmTabs.map((f) => (
          <button key={f.id} className={`tab${farmFilter === f.id ? " active" : ""}`} onClick={() => setFarmFilter(f.id)}>{f.name}</button>
        ))}
      </div>

      <div className="grazing-week-nav no-print">
        <button className="map-zoom-btn" onClick={() => setAnchor(addDays(anchor, -WEEK_LENGTH))} aria-label="Previous week"><ChevronLeft size={16} /></button>
        <button className="link-btn" onClick={() => setAnchor(today)}>This week</button>
        <button className="map-zoom-btn" onClick={() => setAnchor(addDays(anchor, WEEK_LENGTH))} aria-label="Next week"><ChevronRight size={16} /></button>
        <button className="link-btn" style={{ marginLeft: "auto" }} onClick={() => setPrinting(true)}>
          <Printer size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} /> Print
        </button>
      </div>

      <div className="no-print" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {farmGroups.length === 0 && <p className="ds-note" style={{ padding: "12px 18px" }}>No pivots set up.</p>}
        {farmGroups.map((g) => (
          <div key={g.farmId}>
            <p className="field-label" style={{ padding: "14px 18px 0" }}>{g.farmName}</p>
            {g.pivots.map((p) => (
              <PivotCard
                key={p.id}
                pivot={p}
                farm={farms.find((f) => f.id === p.farmId)}
                runs={runsByPivot.get(p.id) ?? []}
                mmWeek={mmWeekFor(p)}
                conflicts={conflicts[p.id] ?? []}
                onAddRun={() => setActive({ pivot: p, run: "new" })}
                onEditRun={(run) => setActive({ pivot: p, run })}
                onEditRating={() => setRatingPivot(p)}
              />
            ))}
            <div className="settings-row" style={{ flexDirection: "row", justifyContent: "space-between", fontWeight: 700 }}>
              <span>{g.farmName} total</span>
              <span>{Math.round(g.pivots.reduce((s, p) => s + (mmWeekFor(p) ?? 0), 0) * 10) / 10} mm/week</span>
            </div>
          </div>
        ))}
        {farmGroups.length > 0 && (
          <div className="settings-row" style={{ flexDirection: "row", justifyContent: "space-between", fontWeight: 700, borderTop: "1px solid var(--paper-deep)" }}>
            <span>All farms</span>
            <span>
              {grandTotal.total} mm/week
              {grandTotal.missing > 0 ? ` (${grandTotal.missing} pivot${grandTotal.missing > 1 ? "s" : ""} without a rating set)` : ""}
            </span>
          </div>
        )}
      </div>

      {active && (
        <RunEditor
          pivot={active.pivot}
          run={active.run === "new" ? null : active.run}
          paddocks={(farms.find((f) => f.id === active.pivot.farmId)?.paddocks ?? [])
            .filter((pd) => active.pivot.paddockCodes.includes(pd.code))
            .sort(byPaddockNumber)}
          weekStart={start}
          weekEnd={end}
          onClose={() => setActive(null)}
          onSaved={() => { setActive(null); refetchRuns(); }}
        />
      )}

      {ratingPivot && (
        <RatingEditor
          pivot={ratingPivot}
          onClose={() => setRatingPivot(null)}
          onSaved={() => { setRatingPivot(null); refetchPivots(); }}
        />
      )}

      {printing && (
        <div className="print-only">
          <p className="irrigation-title-print">Irrigation schedule — {start} to {end}</p>
          {farmGroups.map((g) => (
            <div key={g.farmId}>
              <p className="irrigation-title-print" style={{ fontSize: 12 }}>{g.farmName}</p>
              <table className="timebook-table">
                <thead>
                  <tr><th>Pivot</th><th>Start day</th><th>Start camp</th><th>%</th><th>mm</th></tr>
                </thead>
                <tbody>
                  {g.pivots.flatMap((p) => {
                    const list = runsByPivot.get(p.id) ?? [];
                    if (!list.length) {
                      return [<tr key={p.id}><td>{p.name}</td><td colSpan={4}>No run scheduled</td></tr>];
                    }
                    return list.map((r) => (
                      <tr key={r.id}>
                        <td>{p.name}</td>
                        <td>{dayLabel(r.date)}</td>
                        <td>{r.startPaddock?.code ?? "—"}</td>
                        <td>{r.percentage}%</td>
                        <td>{mmForRun(p, r.percentage) ?? "—"}</td>
                      </tr>
                    ));
                  })}
                  <tr>
                    <td colSpan={4} style={{ fontWeight: 700 }}>{g.farmName} total</td>
                    <td style={{ fontWeight: 700 }}>{Math.round(g.pivots.reduce((s, p) => s + (mmWeekFor(p) ?? 0), 0) * 10) / 10}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PivotCard({
  pivot,
  runs,
  mmWeek,
  conflicts,
  onAddRun,
  onEditRun,
  onEditRating,
}: {
  pivot: Pivot;
  farm: Farm | undefined;
  runs: IrrigationRun[];
  mmWeek: number | null;
  conflicts: IrrigationConflict[];
  onAddRun: () => void;
  onEditRun: (run: IrrigationRun) => void;
  onEditRating: () => void;
}) {
  const uniqueConflicts = useMemo(() => {
    const seen = new Set<string>();
    return conflicts.filter((c) => {
      const key = `${c.paddockCode}|${c.groupName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [conflicts]);

  return (
    <div className="settings-row">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="settings-row-title">{pivot.name}</span>
        <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontWeight: 700 }}>{mmWeek != null ? `${mmWeek} mm/week` : "no rating set"}</span>
          <button className="link-btn" onClick={onEditRating} aria-label={`Edit ${pivot.name} rating`}>
            <Pencil size={13} strokeWidth={1.75} />
          </button>
        </span>
      </div>
      <p className="ds-note" style={{ margin: "0 0 4px" }}>
        Camps {pivot.paddockCodes[0]}–{pivot.paddockCodes[pivot.paddockCodes.length - 1]}
      </p>

      {uniqueConflicts.length > 0 && (
        <p className="ds-note" style={{ color: "var(--flagged)", fontWeight: 700, margin: "0 0 4px" }}>
          ⚠ Cows grazing {uniqueConflicts.map((c) => `${c.paddockCode} (${c.groupName})`).join(", ")} this week
        </p>
      )}

      {runs.length === 0 && <p className="ds-note" style={{ margin: "4px 0" }}>No run scheduled this week.</p>}
      {runs.map((r) => (
        <button key={r.id} className="walk-row" onClick={() => onEditRun(r)}>
          <span className="wr-code">{dayLabel(r.date)}</span>
          <span className="field-editor-sub">
            {r.startPaddock ? `Start at ${r.startPaddock.code}` : "No start camp set"} · {r.percentage}% · {mmForRun(pivot, r.percentage) ?? "—"}mm
          </span>
        </button>
      ))}
      <button className="link-btn" onClick={onAddRun} style={{ marginTop: 6 }}>+ Add run</button>
    </div>
  );
}

function RunEditor({
  pivot,
  run,
  paddocks,
  weekStart,
  weekEnd,
  onClose,
  onSaved,
}: {
  pivot: Pivot;
  run: IrrigationRun | null;
  paddocks: { id: string; code: string }[];
  weekStart: string;
  weekEnd: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(run?.date.slice(0, 10) ?? weekStart);
  const [percentage, setPercentage] = useState(run ? String(run.percentage) : "");
  const [startPaddockId, setStartPaddockId] = useState(run?.startPaddockId ?? "");
  const [notes, setNotes] = useState(run?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const pct = Number(percentage);
  const validPct = percentage !== "" && pct > 0 && pct <= 100;
  const mm = validPct ? mmForRun(pivot, pct) : null;

  const handleSave = async () => {
    if (!date || !validPct) return;
    setSaving(true);
    const body = { date, percentage: pct, startPaddockId: startPaddockId || null, notes: notes.trim() };
    if (run) {
      await fetch(`/api/irrigation-runs/${run.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } else {
      await fetch("/api/irrigation-runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pivotId: pivot.id, ...body }) });
    }
    setSaving(false);
    onSaved();
  };

  const handleDelete = async () => {
    if (!run) return;
    if (!confirmingDelete) { setConfirmingDelete(true); return; }
    setDeleting(true);
    await fetch(`/api/irrigation-runs/${run.id}`, { method: "DELETE" });
    setDeleting(false);
    onSaved();
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="edit-entry-overlay" onClick={onClose}>
      <div className="edit-entry-panel" onClick={(e) => e.stopPropagation()}>
        <div className="keypad-header">
          <div className="stock-panel-title">
            <span className="keypad-code">{run ? `Edit run — ${pivot.name}` : `New run — ${pivot.name}`}</span>
          </div>
          <X size={18} className="close" onClick={onClose} />
        </div>
        <div className="edit-entry-body">
          <label className="field">
            <span className="field-label">Start day</span>
            <input className="field-input small" type="date" value={date} min={weekStart} max={weekEnd} onChange={(e) => setDate(e.target.value)} />
          </label>

          <label className="field">
            <span className="field-label">Start camp</span>
            <select className="field-input small" value={startPaddockId} onChange={(e) => setStartPaddockId(e.target.value)}>
              <option value="">Select…</option>
              {paddocks.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Speed (%)</span>
            <input className="field-input small" type="number" min={1} max={100} value={percentage} onChange={(e) => setPercentage(e.target.value)} placeholder="e.g. 60" />
            {mm != null && <span className="field-hint">≈ {mm}mm this pass</span>}
          </label>

          <label className="field">
            <span className="field-label">Notes</span>
            <textarea className="field-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </label>

          <div className="edit-entry-actions">
            <button className="save-btn" onClick={handleSave} disabled={saving || !date || !validPct}>
              {saving ? "Saving…" : "Save"}
            </button>
            {run && (
              <button className={`delete-btn${confirmingDelete ? " confirm" : ""}`} onClick={handleDelete} disabled={deleting}>
                <Trash2 size={14} strokeWidth={1.75} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                {deleting ? "Deleting…" : confirmingDelete ? "Click again to confirm" : "Delete"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function RatingEditor({ pivot, onClose, onSaved }: { pivot: Pivot; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState(pivot.mmAt100Pct != null ? String(pivot.mmAt100Pct) : "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/pivots/${pivot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mmAt100Pct: value === "" ? null : Number(value) }),
    });
    setSaving(false);
    onSaved();
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="edit-entry-overlay" onClick={onClose}>
      <div className="edit-entry-panel" onClick={(e) => e.stopPropagation()}>
        <div className="keypad-header">
          <div className="stock-panel-title">
            <span className="keypad-code">{pivot.name} — rating</span>
          </div>
          <X size={18} className="close" onClick={onClose} />
        </div>
        <div className="edit-entry-body">
          <label className="field">
            <span className="field-label">mm per pass at 100% speed</span>
            <input
              className="field-input small"
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(sanitizeDecimalInput(e.target.value))}
              placeholder="e.g. 6"
            />
            <span className="field-hint">Running slower than 100% puts down more water — mm for a run is this × 100 ÷ speed%.</span>
          </label>
          <div className="edit-entry-actions">
            <button className="save-btn" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
