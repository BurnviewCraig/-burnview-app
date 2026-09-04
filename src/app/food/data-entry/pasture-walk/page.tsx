"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { KeypadGrid } from "@/components/KeypadGrid";
import { useApi } from "@/lib/useApi";
import { byPaddockNumber, todayStr } from "@/lib/utils";
import type { Farm } from "@/lib/types";

export default function PastureWalkPage() {
  const { data, loading } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = data?.farms ?? [];

  const [farmId, setFarmId] = useState<string | null>(null);
  const [date, setDate] = useState(todayStr());
  const [readings, setReadings] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const farm = farms.find((f) => f.id === (farmId ?? farms[0]?.id)) ?? farms[0];
  const orderedPaddocks = useMemo(() => (farm ? [...farm.paddocks].sort(byPaddockNumber) : []), [farm]);
  const filledCount = Object.values(readings).filter((v) => v !== "").length;

  const resetEntry = () => { setReadings({}); setActiveId(null); setSavedCount(null); };
  const switchFarm = (id: string) => { setFarmId(id); resetEntry(); };

  const handleKey = (k: string) => {
    if (!activeId) return;
    setReadings((prev) => {
      const cur = prev[activeId] ?? "";
      let next = cur;
      if (k === "C") next = "";
      else if (k === "⌫") next = cur.slice(0, -1);
      else next = (cur + k).slice(0, 5);
      return { ...prev, [activeId]: next };
    });
  };

  const handleNext = () => {
    const idx = orderedPaddocks.findIndex((p) => p.id === activeId);
    const next = orderedPaddocks[idx + 1];
    setActiveId(next ? next.id : null);
  };

  const handleSave = async () => {
    if (!farm) return;
    const entries = Object.entries(readings)
      .filter(([, v]) => v !== "" && Number(v) > 0)
      .map(([paddockId, v]) => ({ paddockId, cover: Number(v) }));
    if (!entries.length) return;
    setSaving(true);
    await fetch("/api/pasture-walks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ farmId: farm.id, date, readings: entries }),
    });
    setSaving(false);
    setSavedCount(entries.length);
    setReadings({});
    setActiveId(null);
  };

  const handleCancel = () => {
    resetEntry();
    setDate(todayStr());
  };

  if (loading) return <div className="screen"><Header title="Pasture walk" backHref="/food/data-entry" /><Spinner /></div>;
  if (!farm) return <div className="screen"><Header title="Pasture walk" backHref="/food/data-entry" /><div className="empty">No farms found.</div></div>;

  return (
    <div className="screen">
      <Header title="Pasture walk" backHref="/food/data-entry" />

      <div className="tabs">
        {farms.map((f) => (
          <button key={f.id} className={`tab${farm.id === f.id ? " active" : ""}`} onClick={() => switchFarm(f.id)}>{f.name}</button>
        ))}
      </div>

      <div className="walk-datebar">
        <label className="field" style={{ flex: 1 }}>
          <span className="field-label">Walk date</span>
          <input className="field-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="walk-progress">{filledCount} / {farm.paddocks.length} entered</div>
      </div>

      <div className="walk-list" style={{ paddingBottom: activeId ? 232 : 0 }}>
        {orderedPaddocks.map((p) => {
          const val = readings[p.id] ?? "";
          return (
            <button key={p.id} className={`walk-row${activeId === p.id ? " active" : ""}`} onClick={() => setActiveId(p.id)}>
              <span className="wr-code">{p.code}</span>
              <span className={`wr-value${val === "" ? " placeholder" : ""}`}>{val !== "" ? val : "0"}</span>
              <span className="wr-unit">kg DM/ha</span>
            </button>
          );
        })}
      </div>

      {activeId ? (
        <div className="keypad-panel">
          <div className="keypad-header">
            <span className="keypad-code">{orderedPaddocks.find((p) => p.id === activeId)?.code}</span>
            <span className="keypad-value">{readings[activeId] || "0"} <span className="keypad-unit">kg DM/ha</span></span>
            <button className="close" onClick={() => setActiveId(null)}><X size={18} /></button>
          </div>
          <KeypadGrid onKey={handleKey} />
          <button className="save-btn keypad-next" onClick={handleNext}>Next field ▸</button>
        </div>
      ) : (
        <div className="walk-save-bar">
          <div className="walk-save-row">
            <button className="cancel-btn" onClick={handleCancel} disabled={filledCount === 0}>Cancel walk</button>
            <button className="save-btn" onClick={handleSave} disabled={filledCount === 0 || !date || saving}>
              {saving ? "Saving…" : `Save walk (${filledCount})`}
            </button>
          </div>
          {savedCount != null && (
            <p className="save-note">Saved {savedCount} readings for {farm.name} — {date}. These now feed the wedge and that field&apos;s history.</p>
          )}
        </div>
      )}
    </div>
  );
}
