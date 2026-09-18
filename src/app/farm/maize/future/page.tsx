"use client";

import { useState } from "react";
import { Trash2, Pencil } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { todayStr, sanitizeDecimalInput } from "@/lib/utils";
import type { Farm, MaizePlantingPlan } from "@/lib/types";

function PlantingPlansSection({ farmId }: { farmId: string }) {
  const { data, refetch } = useApi<{ entries: MaizePlantingPlan[] }>(`/api/maize-planting-plans?farmId=${farmId}`);
  const entries = data?.entries ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [season, setSeason] = useState("");
  const [plannedAreaHa, setPlannedAreaHa] = useState("");
  const [variety, setVariety] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setSeason("");
    setPlannedAreaHa("");
    setVariety("");
    setNotes("");
  };

  const startEdit = (e: MaizePlantingPlan) => {
    setEditingId(e.id);
    setSeason(e.season);
    setPlannedAreaHa(e.plannedAreaHa != null ? String(e.plannedAreaHa) : "");
    setVariety(e.variety ?? "");
    setNotes(e.notes ?? "");
  };

  const save = async () => {
    if (!season.trim()) return;
    setSaving(true);
    const body = { season: season.trim(), plannedAreaHa: plannedAreaHa !== "" ? Number(plannedAreaHa) : null, variety: variety.trim() || null, notes: notes.trim() || null };
    if (editingId) {
      await fetch(`/api/maize-planting-plans/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } else {
      await fetch("/api/maize-planting-plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ farmId, ...body }) });
    }
    setSaving(false);
    resetForm();
    refetch();
  };

  const remove = async (id: string) => {
    await fetch(`/api/maize-planting-plans/${id}`, { method: "DELETE" });
    if (editingId === id) resetForm();
    refetch();
  };

  return (
    <div style={{ padding: "12px 18px" }}>
      <div className="form" style={{ gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <label className="field" style={{ flex: 1 }}>
            <span className="field-label">Season</span>
            <input className="field-input" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="e.g. 2026/27" />
          </label>
          <label className="field" style={{ flex: 1 }}>
            <span className="field-label">Planned area (ha)</span>
            <input className="field-input" type="text" inputMode="decimal" value={plannedAreaHa} onChange={(e) => setPlannedAreaHa(sanitizeDecimalInput(e.target.value))} placeholder="ha" />
          </label>
        </div>
        <label className="field">
          <span className="field-label">Variety</span>
          <input className="field-input" value={variety} onChange={(e) => setVariety(e.target.value)} placeholder="optional" />
        </label>
        <label className="field">
          <span className="field-label">Notes</span>
          <input className="field-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="which camps, etc." />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="save-btn small" onClick={save} disabled={saving || !season.trim()}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Add plan"}
          </button>
          {editingId && <button className="link-btn" onClick={resetForm}>Cancel</button>}
        </div>
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <span className="field-label">Planned seasons</span>
        {entries.length === 0 && <p className="ds-note">No planting plans yet.</p>}
        {entries.map((e) => (
          <div key={e.id} className="settings-row">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{e.season}{e.plannedAreaHa ? ` — ${e.plannedAreaHa}ha` : ""}{e.variety ? ` — ${e.variety}` : ""}</span>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="link-btn" onClick={() => startEdit(e)} aria-label="Edit plan"><Pencil size={15} strokeWidth={1.75} /></button>
                <button className="link-btn" onClick={() => remove(e.id)} aria-label="Delete plan"><Trash2 size={15} strokeWidth={1.75} /></button>
              </div>
            </div>
            {e.notes && <p className="ds-note" style={{ margin: "4px 0 0" }}>{e.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MaizeFuturePage() {
  const { data: farmsData, loading } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];
  const [farmId, setFarmId] = useState<string | null>(null);
  const farm = farms.find((f) => f.id === (farmId ?? farms[0]?.id)) ?? farms[0];

  if (loading) return <div className="screen"><Header title="Future Maize Options" backHref="/farm/maize" /><Spinner /></div>;
  if (!farm) return <div className="screen"><Header title="Future Maize Options" backHref="/farm/maize" /><div className="empty">No farms found.</div></div>;

  return (
    <div className="screen">
      <Header title="Future Maize Options" backHref="/farm/maize" />
      <div className="tabs">
        {farms.map((f) => (
          <button key={f.id} className={`tab${farm.id === f.id ? " active" : ""}`} onClick={() => setFarmId(f.id)}>{f.name}</button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <PlantingPlansSection farmId={farm.id} />
      </div>
    </div>
  );
}
