"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, Droplet, Gauge, Printer, Trash2, X } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { AccessGate } from "@/components/AccessGate";
import { useApi } from "@/lib/useApi";
import { todayStr, byPaddockNumber, sanitizeDecimalInput } from "@/lib/utils";
import { addDays } from "@/lib/calendarFormat";
import type { Farm, Pivot, IrrigationRun, IrrigationConflict } from "@/lib/types";

const WEEK_LENGTH = 7;

// Speed is inverse to depth and to duration — running slower (a lower %)
// passes more water and takes longer to complete.
function mmForRun(pivot: Pivot, percentage: number) {
  if (pivot.mmAt100Pct == null || percentage <= 0) return null;
  return Math.round(((pivot.mmAt100Pct * 100) / percentage) * 10) / 10;
}

function hoursForRun(pivot: Pivot, percentage: number) {
  if (pivot.hoursAt100Pct == null || percentage <= 0) return null;
  return (pivot.hoursAt100Pct * 100) / percentage;
}

function formatDuration(hours: number) {
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  if (days === 0) return `${rem}h`;
  if (rem === 0) return `${days}d`;
  return `${days}d ${rem}h`;
}

function clampPct(pct: number) {
  return Math.min(100, Math.max(1, pct));
}

// mm is how the farm actually thinks about a run, so it's the field someone
// fills in — speed % is derived from it and shown as a readout, not typed
// in directly, when the pivot has a rating to invert.
const MM_PRESETS = [5, 8, 10, 12, 15, 20, 25, 30];

function dayLabel(date: string) {
  return new Date(date.slice(0, 10) + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// "Monday 27 July" — spelled out manually rather than via toLocaleDateString
// so the format is exact regardless of the browser's locale.
function mondayLabel(date: string) {
  const d = new Date(date.slice(0, 10) + "T00:00:00Z");
  return `${WEEKDAY_LONG[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_LONG[d.getUTCMonth()]}`;
}

// Schedules always run Monday-Sunday, not "today + 6 days" — so the anchor
// itself is always a Monday, and paging by a week always lands on one too.
function mondayOf(date: string): string {
  const dow = new Date(date.slice(0, 10) + "T00:00:00Z").getUTCDay(); // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(date, diff);
}

export default function IrrigationPage() {
  const today = todayStr();
  const thisMonday = mondayOf(today);
  const [anchor, setAnchor] = useState(thisMonday);
  const start = anchor;
  const end = addDays(anchor, WEEK_LENGTH - 1);
  const weeksFromNow = Math.round((new Date(anchor + "T00:00:00Z").getTime() - new Date(thisMonday + "T00:00:00Z").getTime()) / (7 * 86400000));
  const weekLabel = weeksFromNow === 0 ? "This week" : weeksFromNow === 1 ? "Next week" : mondayLabel(anchor);

  const { data: farmsData, loading: farmsLoading } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];
  const { data: pivotsData, loading: pivotsLoading } = useApi<{ pivots: Pivot[] }>("/api/pivots");
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

  // A pivot's wetted area — the combined size of the camps it covers —
  // read off the same paddock records the camps/maize fields already use.
  // mm is a depth, not a volume, so turning it into m³ needs this: 1mm over
  // 1ha is 10 m³ (1ha = 10,000 m², 1mm = 0.001m).
  const pivotAreaHa = (pivot: Pivot) => {
    const farm = farms.find((f) => f.id === pivot.farmId);
    if (!farm) return null;
    const codes = new Set(pivot.paddockCodes);
    const total = farm.paddocks.filter((p) => codes.has(p.code)).reduce((s, p) => s + (p.sizeHa ?? 0), 0);
    return total > 0 ? total : null;
  };
  const cubesWeekFor = (pivot: Pivot) => {
    const mm = mmWeekFor(pivot);
    const area = pivotAreaHa(pivot);
    if (mm == null || area == null) return null;
    return mm * area * 10;
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

  // mm/week is a depth, so combining several pivots' figures is an average
  // (mm applied per pivot), never a sum — a farm running one pivot at 10mm
  // and another at 20mm isn't putting down 30mm anywhere. Cubes (m³), being
  // a volume, DO add up across pivots — that's the real total water used.
  const farmTotal = (farmPivots: Pivot[]) => {
    let mmSum = 0;
    let cubesSum = 0;
    let missing = 0;
    farmPivots.forEach((p) => {
      const mm = mmWeekFor(p);
      if (mm == null) missing++;
      else mmSum += mm;
      const cubes = cubesWeekFor(p);
      if (cubes != null) cubesSum += cubes;
    });
    return {
      avgMm: farmPivots.length ? Math.round((mmSum / farmPivots.length) * 10) / 10 : 0,
      cubes: Math.round(cubesSum),
      missing,
    };
  };

  const grandTotal = useMemo(() => {
    const allPivots = farmGroups.flatMap((g) => g.pivots);
    return farmTotal(allPivots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmGroups, runsByPivot, farms]);

  const [active, setActive] = useState<{ pivot: Pivot; run: IrrigationRun | "new" } | null>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!printing) return;
    const t = setTimeout(() => window.print(), 50);
    const after = () => setPrinting(false);
    window.addEventListener("afterprint", after, { once: true });
    return () => { clearTimeout(t); window.removeEventListener("afterprint", after); };
  }, [printing]);

  if (farmsLoading || pivotsLoading) return (
    <AccessGate section="farm" title="Irrigation">
      <div className="screen"><Header title="Irrigation" backHref="/" /><Spinner /></div>
    </AccessGate>
  );

  return (
    <AccessGate section="farm" title="Irrigation">
    <div className="screen">
      <Header
        title="Irrigation"
        backHref="/"
        action={
          <Link href="/farm/irrigation/water-meters" className="hdr-action no-print">
            <Gauge size={14} strokeWidth={1.75} />
            Water meters
          </Link>
        }
      />

      <div className="tabs no-print">
        <button className={`tab${farmFilter === "all" ? " active" : ""}`} onClick={() => setFarmFilter("all")}>All</button>
        {farmTabs.map((f) => (
          <button key={f.id} className={`tab${farmFilter === f.id ? " active" : ""}`} onClick={() => setFarmFilter(f.id)}>{f.name}</button>
        ))}
      </div>

      <div className="grazing-week-nav no-print">
        <button className="map-zoom-btn" onClick={() => setAnchor(addDays(anchor, -WEEK_LENGTH))} aria-label="Previous week"><ChevronLeft size={16} /></button>
        <button className="link-btn" onClick={() => setAnchor(thisMonday)}>{weekLabel}</button>
        <button className="map-zoom-btn" onClick={() => setAnchor(addDays(anchor, WEEK_LENGTH))} aria-label="Next week"><ChevronRight size={16} /></button>
        <button className="link-btn" style={{ marginLeft: "auto" }} onClick={() => setPrinting(true)}>
          <Printer size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} /> Print
        </button>
      </div>

      <div className="no-print" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {farmGroups.length === 0 && <p className="ds-note" style={{ padding: "12px 18px" }}>No pivots set up.</p>}
        {farmGroups.map((g) => (
          <div key={g.farmId}>
            <p className="field-label" style={{ padding: "10px 18px 0" }}>{g.farmName}</p>
            <div className="irrigation-grid">
              {g.pivots.map((p) => (
                <PivotCard
                  key={p.id}
                  pivot={p}
                  runs={runsByPivot.get(p.id) ?? []}
                  mmWeek={mmWeekFor(p)}
                  conflicts={conflicts}
                  onAddRun={() => setActive({ pivot: p, run: "new" })}
                  onEditRun={(run) => setActive({ pivot: p, run })}
                />
              ))}
            </div>
            <div className="irrigation-total-row">
              <span>{g.farmName} total</span>
              <span style={{ display: "flex", gap: 6 }}>
                <span className="pivot-card-mm"><Droplet size={11} />{farmTotal(g.pivots).avgMm} mm/week avg</span>
                <span className="pivot-card-mm">{farmTotal(g.pivots).cubes.toLocaleString()} m³/week</span>
              </span>
            </div>
          </div>
        ))}
        {farmGroups.length > 0 && (
          <div className="irrigation-total-row grand">
            <span>All farms</span>
            <span style={{ display: "flex", gap: 6 }}>
              <span className="pivot-card-mm">
                <Droplet size={11} />
                {grandTotal.avgMm} mm/week avg
                {grandTotal.missing > 0 ? ` (${grandTotal.missing} without a rating)` : ""}
              </span>
              <span className="pivot-card-mm">{grandTotal.cubes.toLocaleString()} m³/week</span>
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

      {printing && (
        <div className="print-only">
          <p className="irrigation-title-print">Irrigation schedule — {start} to {end}</p>
          {farmGroups.map((g) => (
            <div key={g.farmId}>
              <p className="irrigation-title-print" style={{ fontSize: 12 }}>{g.farmName}</p>
              <table className="timebook-table">
                <thead>
                  <tr><th>Pivot</th><th>Start day</th><th>Start camp</th><th>%</th><th>mm</th><th>Takes</th><th>Note</th></tr>
                </thead>
                <tbody>
                  {g.pivots.flatMap((p) => {
                    const list = runsByPivot.get(p.id) ?? [];
                    if (!list.length) {
                      return [<tr key={p.id}><td>{p.name}</td><td colSpan={6}>No run scheduled</td></tr>];
                    }
                    return list.map((r) => {
                      const hours = hoursForRun(p, r.percentage);
                      const runConflicts = conflicts[r.id] ?? [];
                      return (
                        <tr key={r.id}>
                          <td>{p.name}</td>
                          <td>{dayLabel(r.date)}</td>
                          <td>{r.startPaddock?.code ?? "—"}</td>
                          <td>{r.percentage}%</td>
                          <td>{mmForRun(p, r.percentage) ?? "—"}</td>
                          <td>{hours != null ? formatDuration(hours) : "—"}</td>
                          <td>
                            {runConflicts.length > 0
                              ? `Reaches ${runConflicts.map((c) => `${c.paddockCode} (${c.groupName})`).join(", ")} while still grazing`
                              : ""}
                          </td>
                        </tr>
                      );
                    });
                  })}
                  <tr>
                    <td colSpan={4} style={{ fontWeight: 700 }}>{g.farmName} total</td>
                    <td style={{ fontWeight: 700 }}>{farmTotal(g.pivots).avgMm} avg</td>
                    <td colSpan={2} style={{ fontWeight: 700 }}>{farmTotal(g.pivots).cubes.toLocaleString()} m³/week</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
    </AccessGate>
  );
}

function PivotCard({
  pivot,
  runs,
  mmWeek,
  conflicts,
  onAddRun,
  onEditRun,
}: {
  pivot: Pivot;
  runs: IrrigationRun[];
  mmWeek: number | null;
  conflicts: Record<string, IrrigationConflict[]>;
  onAddRun: () => void;
  onEditRun: (run: IrrigationRun) => void;
}) {
  const campRange = pivot.paddockCodes.length > 1
    ? `Camps ${pivot.paddockCodes[0]}–${pivot.paddockCodes[pivot.paddockCodes.length - 1]}`
    : `Camp ${pivot.paddockCodes[0] ?? "—"}`;

  return (
    <div className="pivot-card">
      <div className="pivot-card-head">
        <span className="pivot-card-name" title={campRange}>{pivot.name}</span>
        {mmWeek != null ? (
          <span className="pivot-card-mm"><Droplet size={10} />{mmWeek}mm/wk</span>
        ) : (
          <span className="pivot-card-mm" style={{ color: "var(--ink-soft)", background: "var(--paper-deep)" }}>no rating</span>
        )}
      </div>

      {runs.length === 0 ? (
        <div className="pivot-run-row empty">
          <span>No run this week</span>
          <button className="link-btn" onClick={onAddRun}>+ Add</button>
        </div>
      ) : (
        <>
          {runs.map((r) => {
            const hours = hoursForRun(pivot, r.percentage);
            const runConflicts = conflicts[r.id] ?? [];
            const conflictTitle = runConflicts.length
              ? `Reaches ${runConflicts.map((c) => `${c.paddockCode} (${c.groupName}) on ${dayLabel(c.date)}`).join(", ")} while still grazing`
              : undefined;
            return (
              <button key={r.id} className="pivot-run-row" onClick={() => onEditRun(r)}>
                <span className="pivot-run-day">{dayLabel(r.date)}</span>
                <span className="pivot-run-detail">
                  {r.startPaddock?.code ?? "no camp"} · {r.percentage}% · <span className="pivot-run-mm">{mmForRun(pivot, r.percentage) ?? "—"}mm</span>
                  {hours != null ? ` · ${formatDuration(hours)}` : ""}
                </span>
                {runConflicts.length > 0 && (
                  <span className="pivot-run-warn" title={conflictTitle}>
                    <AlertTriangle size={13} />
                  </span>
                )}
              </button>
            );
          })}
          <button className="link-btn pivot-add-btn" onClick={onAddRun}>+ Add run</button>
        </>
      )}
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
  const hasRating = pivot.mmAt100Pct != null;
  const [date, setDate] = useState(run?.date.slice(0, 10) ?? weekStart);
  const [mm, setMm] = useState(hasRating && run ? String(mmForRun(pivot, run.percentage) ?? "") : "");
  const [percentage, setPercentage] = useState(!hasRating && run ? String(run.percentage) : "");
  const [startPaddockId, setStartPaddockId] = useState(run?.startPaddockId ?? "");
  const [notes, setNotes] = useState(run?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // When the pivot has a mm rating, mm is what's typed and % is derived
  // from it (inverted — see mmForRun); otherwise fall back to typing % directly.
  const mmNum = Number(mm);
  const computedPct = hasRating && mm !== "" && mmNum > 0 ? clampPct(Math.round((pivot.mmAt100Pct! * 100) / mmNum)) : null;
  const typedPct = !hasRating && percentage !== "" ? Number(percentage) : null;
  const effectivePct = hasRating ? computedPct : typedPct;
  const validPct = effectivePct != null && effectivePct > 0 && effectivePct <= 100;
  const actualMm = validPct ? mmForRun(pivot, effectivePct!) : null;
  const hours = validPct ? hoursForRun(pivot, effectivePct!) : null;

  const handleSave = async () => {
    if (!date || !validPct) return;
    setSaving(true);
    const body = { date, percentage: effectivePct, startPaddockId: startPaddockId || null, notes: notes.trim() };
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

          {hasRating ? (
            <label className="field">
              <span className="field-label">mm to put down</span>
              <div className="chip-wrap">
                {MM_PRESETS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`paddock-chip fert-chip${mm === String(v) ? " on" : ""}`}
                    onClick={() => setMm(String(v))}
                  >
                    {v}mm
                  </button>
                ))}
              </div>
              <input
                className="field-input small"
                type="text"
                inputMode="decimal"
                value={mm}
                onChange={(e) => setMm(sanitizeDecimalInput(e.target.value))}
                placeholder="or type a custom mm"
                style={{ marginTop: 6 }}
              />
              {computedPct != null && (
                <span className="field-hint">
                  ≈ {computedPct}% speed
                  {actualMm != null && Math.abs(actualMm - mmNum) > 0.05 ? ` (closest is ${actualMm}mm at that speed)` : ""}
                  {hours != null ? ` · takes ${formatDuration(hours)} to complete` : ""}
                </span>
              )}
            </label>
          ) : (
            <label className="field">
              <span className="field-label">Speed (%)</span>
              <input className="field-input small" type="number" min={1} max={100} value={percentage} onChange={(e) => setPercentage(e.target.value)} placeholder="e.g. 60" />
              <span className="field-hint">Set the pivot&apos;s mm rating (pencil icon on its card) to size runs by mm instead.</span>
            </label>
          )}

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
