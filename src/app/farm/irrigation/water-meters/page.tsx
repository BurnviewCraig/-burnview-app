"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Droplet, Trash2, X } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { todayStr, sanitizeDecimalInput } from "@/lib/utils";
import type { Farm, WaterMeter, WaterMeterReading } from "@/lib/types";

// One meter's readings, sorted oldest first, with each entry's usage worked
// out as this reading minus the one before it — "that month's cubes", per
// the farmer's own description. The first-ever reading has no previous one
// to compare to, so its delta is null (just the starting dial figure).
type SeriesEntry = WaterMeterReading & { delta: number | null };

function buildSeries(readings: WaterMeterReading[]): SeriesEntry[] {
  const sorted = [...readings].sort((a, b) => (a.date < b.date ? -1 : 1));
  return sorted.map((r, i) => ({ ...r, delta: i === 0 ? null : Math.round((r.reading - sorted[i - 1].reading) * 10) / 10 }));
}

function shortDate(date: string) {
  return new Date(date.slice(0, 10) + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "2-digit" });
}

export default function WaterMetersPage() {
  const { data: farmsData, loading: farmsLoading } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];
  const { data: metersData, loading: metersLoading } = useApi<{ meters: WaterMeter[] }>("/api/water-meters");
  const meters = metersData?.meters ?? [];
  const { data: readingsData, refetch: refetchReadings } = useApi<{ readings: WaterMeterReading[] }>("/api/water-meter-readings");
  const readings = readingsData?.readings ?? [];

  const [farmFilter, setFarmFilter] = useState<string>("all");
  const farmTabs = farms.filter((f) => meters.some((m) => m.farmId === f.id));

  const readingsByMeter = useMemo(() => {
    const map = new Map<string, WaterMeterReading[]>();
    readings.forEach((r) => map.set(r.meterId, [...(map.get(r.meterId) ?? []), r]));
    return map;
  }, [readings]);

  const seriesByMeter = useMemo(() => {
    const map = new Map<string, SeriesEntry[]>();
    meters.forEach((m) => map.set(m.id, buildSeries(readingsByMeter.get(m.id) ?? [])));
    return map;
  }, [meters, readingsByMeter]);

  const currentYear = new Date(todayStr()).getFullYear();
  const ytdByGroup = useMemo(() => {
    const map = new Map<string, number>();
    meters.forEach((m) => {
      const series = seriesByMeter.get(m.id) ?? [];
      const sum = series.filter((e) => e.delta != null && new Date(e.date).getFullYear() === currentYear).reduce((s, e) => s + (e.delta ?? 0), 0);
      const key = `${m.farmId}|${m.groupName}`;
      map.set(key, (map.get(key) ?? 0) + sum);
    });
    return map;
  }, [meters, seriesByMeter, currentYear]);

  type Group = { groupName: string; meters: WaterMeter[] };
  const farmGroups = useMemo(() => {
    const visibleFarms = farmFilter === "all" ? farms : farms.filter((f) => f.id === farmFilter);
    return visibleFarms
      .map((f) => {
        const farmMeters = meters.filter((m) => m.farmId === f.id).sort((a, b) => a.sortOrder - b.sortOrder);
        const groups: Group[] = [];
        farmMeters.forEach((m) => {
          let g = groups.find((g) => g.groupName === m.groupName);
          if (!g) { g = { groupName: m.groupName, meters: [] }; groups.push(g); }
          g.meters.push(m);
        });
        return { farmId: f.id, farmName: f.name, groups };
      })
      .filter((f) => f.groups.length > 0);
  }, [farms, meters, farmFilter]);

  const [active, setActive] = useState<{ meter: WaterMeter; reading: WaterMeterReading | "new" } | null>(null);

  if (farmsLoading || metersLoading) return <div className="screen"><Header title="Water meters" backHref="/farm/irrigation" /><Spinner /></div>;

  return (
    <div className="screen">
      <Header title="Water meters" backHref="/farm/irrigation" />

      <div className="tabs">
        <button className={`tab${farmFilter === "all" ? " active" : ""}`} onClick={() => setFarmFilter("all")}>All</button>
        {farmTabs.map((f) => (
          <button key={f.id} className={`tab${farmFilter === f.id ? " active" : ""}`} onClick={() => setFarmFilter(f.id)}>{f.name}</button>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {farmGroups.length === 0 && <p className="ds-note" style={{ padding: "12px 18px" }}>No water meters set up.</p>}
        {farmGroups.map((f) => (
          <div key={f.farmId}>
            <p className="field-label" style={{ padding: "10px 18px 0" }}>{f.farmName}</p>
            {f.groups.map((g) => (
              <div key={g.groupName} style={{ padding: "6px 18px 10px" }}>
                <div className="irrigation-total-row" style={{ padding: "2px 0" }}>
                  <span>{g.groupName}</span>
                  <span className="pivot-card-mm">
                    <Droplet size={11} />
                    {Math.round((ytdByGroup.get(`${f.farmId}|${g.groupName}`) ?? 0) * 10) / 10} m³ YTD {currentYear}
                  </span>
                </div>
                <div className="irrigation-grid">
                  {g.meters.map((m) => (
                    <MeterCard
                      key={m.id}
                      meter={m}
                      series={seriesByMeter.get(m.id) ?? []}
                      onAddReading={() => setActive({ meter: m, reading: "new" })}
                      onEditReading={(r) => setActive({ meter: m, reading: r })}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {active && (
        <ReadingEditor
          meter={active.meter}
          reading={active.reading === "new" ? null : active.reading}
          onClose={() => setActive(null)}
          onSaved={() => { setActive(null); refetchReadings(); }}
        />
      )}

    </div>
  );
}

function MeterCard({
  meter,
  series,
  onAddReading,
  onEditReading,
}: {
  meter: WaterMeter;
  series: SeriesEntry[];
  onAddReading: () => void;
  onEditReading: (r: WaterMeterReading) => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const latest = series[series.length - 1] ?? null;
  const history = [...series].reverse();

  return (
    <div className="pivot-card">
      <div className="pivot-card-head">
        <span className="pivot-card-name">{meter.name}</span>
      </div>
      {latest ? (
        <button className="pivot-run-row" onClick={() => onEditReading(latest)}>
          <span className="pivot-run-day" style={{ width: 62 }}>{shortDate(latest.date)}</span>
          <span className="pivot-run-detail">reading {latest.reading}</span>
          {latest.delta != null && <span className="pivot-run-mm">+{latest.delta} m³</span>}
        </button>
      ) : (
        <div className="pivot-run-row empty"><span>No readings yet</span></div>
      )}
      <button className="pivot-add-btn link-btn" onClick={onAddReading}>+ Add reading</button>
      {series.length > 1 && (
        <button className="pivot-add-btn link-btn" onClick={() => setShowHistory((v) => !v)} style={{ marginTop: 2 }}>
          {showHistory ? "Hide history" : `History (${series.length})`}
        </button>
      )}
      {showHistory && history.slice(1).map((r) => (
        <button key={r.id} className="pivot-run-row" onClick={() => onEditReading(r)}>
          <span className="pivot-run-day" style={{ width: 62 }}>{shortDate(r.date)}</span>
          <span className="pivot-run-detail">reading {r.reading}</span>
          {r.delta != null && <span className="pivot-run-mm">+{r.delta} m³</span>}
        </button>
      ))}
    </div>
  );
}

function ReadingEditor({
  meter,
  reading,
  onClose,
  onSaved,
}: {
  meter: WaterMeter;
  reading: WaterMeterReading | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(reading?.date.slice(0, 10) ?? todayStr());
  const [value, setValue] = useState(reading ? String(reading.reading) : "");
  const [notes, setNotes] = useState(reading?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const valid = date !== "" && value !== "" && Number(value) >= 0;

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    await fetch("/api/water-meter-readings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meterId: meter.id, date, reading: Number(value), notes: notes.trim() }),
    });
    setSaving(false);
    onSaved();
  };

  const handleDelete = async () => {
    if (!reading) return;
    if (!confirmingDelete) { setConfirmingDelete(true); return; }
    setDeleting(true);
    await fetch(`/api/water-meter-readings/${reading.id}`, { method: "DELETE" });
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
            <span className="keypad-code">{reading ? `Edit reading — ${meter.name}` : `New reading — ${meter.name}`}</span>
          </div>
          <X size={18} className="close" onClick={onClose} />
        </div>
        <div className="edit-entry-body">
          <label className="field">
            <span className="field-label">Date</span>
            <input className="field-input small" type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Meter reading (m³)</span>
            <input
              className="field-input small"
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(sanitizeDecimalInput(e.target.value))}
              placeholder="e.g. 48213"
            />
            <span className="field-hint">The actual dial figure on the meter, not the amount used — usage since the last reading is worked out automatically.</span>
          </label>
          <label className="field">
            <span className="field-label">Notes</span>
            <textarea className="field-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </label>
          <div className="edit-entry-actions">
            <button className="save-btn" onClick={handleSave} disabled={saving || !valid}>{saving ? "Saving…" : "Save"}</button>
            {reading && (
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
