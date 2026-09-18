"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { sanitizeDecimalInput } from "@/lib/utils";
import type { Farm, MaizePlantingPlan } from "@/lib/types";

export default function MaizeFuturePage() {
  const { data: farmsData, loading } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];
  // Planting jumps around between farms, so this is one shared, unsplit
  // list — the camp dropdown is where "which farm" comes from, not a tab.
  const { data, refetch } = useApi<{ entries: MaizePlantingPlan[] }>("/api/maize-planting-plans");
  const entries = useMemo(() => data?.entries ?? [], [data]);
  const [dragId, setDragId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [paddockId, setPaddockId] = useState("");
  const [season, setSeason] = useState("");
  const [plannedAreaHa, setPlannedAreaHa] = useState("");
  const [variety, setVariety] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setPaddockId("");
    setSeason("");
    setPlannedAreaHa("");
    setVariety("");
    setNotes("");
  };

  const startEdit = (e: MaizePlantingPlan) => {
    setEditingId(e.id);
    setPaddockId(e.paddockId);
    setSeason(e.season);
    setPlannedAreaHa(e.plannedAreaHa != null ? String(e.plannedAreaHa) : "");
    setVariety(e.variety ?? "");
    setNotes(e.notes ?? "");
  };

  const save = async () => {
    if (!paddockId || !season.trim()) return;
    setSaving(true);
    const body = {
      paddockId, season: season.trim(),
      plannedAreaHa: plannedAreaHa !== "" ? Number(plannedAreaHa) : null,
      variety: variety.trim() || null, notes: notes.trim() || null,
    };
    if (editingId) {
      await fetch(`/api/maize-planting-plans/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } else {
      await fetch("/api/maize-planting-plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
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

  const reorder = async (dragEntryId: string, dropEntryId: string) => {
    if (dragEntryId === dropEntryId) return;
    const ids = entries.map((e) => e.id);
    const next = ids.filter((k) => k !== dragEntryId);
    const dropIndex = next.indexOf(dropEntryId);
    next.splice(dropIndex, 0, dragEntryId);
    await Promise.all(next.map((id, i) => fetch(`/api/maize-planting-plans/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: i }),
    })));
    refetch();
  };

  if (loading) return <div className="screen"><Header title="Future Maize Options" backHref="/farm/maize" /><Spinner /></div>;

  return (
    <div className="screen">
      <Header title="Future Maize Options" backHref="/farm/maize" />
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div className="form" style={{ gap: 10, padding: "12px 18px" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label className="field" style={{ flex: 1, minWidth: 160 }}>
              <span className="field-label">Camp</span>
              <select className="field-input" value={paddockId} onChange={(e) => setPaddockId(e.target.value)}>
                <option value="">Select a camp…</option>
                {farms.map((f) => (
                  <optgroup key={f.id} label={f.name}>
                    {f.paddocks.map((p) => (
                      <option key={p.id} value={p.id}>{p.code}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="field" style={{ flex: 1, minWidth: 120 }}>
              <span className="field-label">Season</span>
              <input className="field-input" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="e.g. 2026/27" />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label className="field" style={{ flex: 1, minWidth: 120 }}>
              <span className="field-label">Planned area (ha)</span>
              <input className="field-input" type="text" inputMode="decimal" value={plannedAreaHa} onChange={(e) => setPlannedAreaHa(sanitizeDecimalInput(e.target.value))} placeholder="ha" />
            </label>
            <label className="field" style={{ flex: 1, minWidth: 120 }}>
              <span className="field-label">Variety</span>
              <input className="field-input" value={variety} onChange={(e) => setVariety(e.target.value)} placeholder="optional" />
            </label>
          </div>
          <label className="field">
            <span className="field-label">Notes</span>
            <input className="field-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="save-btn small" onClick={save} disabled={saving || !paddockId || !season.trim()}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Add plan"}
            </button>
            {editingId && <button className="link-btn" onClick={resetForm}>Cancel</button>}
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="ds-note" style={{ padding: "0 18px 18px" }}>No planting plans yet — add one above.</p>
        ) : (
          <>
            <p className="field-hint" style={{ padding: "0 18px 8px" }}>Drag a row to put it in planting order — this order is shared with everyone. Tap a row to edit it in the form above.</p>
            <div className="maize-sheet-scroll">
              <table className="maize-sheet-table">
                <thead>
                  <tr>
                    <th className="maize-sheet-sticky">#</th>
                    <th>Farm</th>
                    <th>Field</th>
                    <th>Season</th>
                    <th>Area (ha)</th>
                    <th>Variety</th>
                    <th>Notes</th>
                    <th>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr
                      key={e.id}
                      className={`${dragId === e.id ? "dragging" : ""}${editingId === e.id ? " active" : ""}`}
                      draggable
                      onDragStart={() => setDragId(e.id)}
                      onDragOver={(ev) => ev.preventDefault()}
                      onDrop={() => { if (dragId) reorder(dragId, e.id); setDragId(null); }}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => startEdit(e)}
                    >
                      <td className="maize-sheet-sticky"><strong>{i + 1}</strong></td>
                      <td>{e.farmName ?? "—"}</td>
                      <td>{e.paddockCode ?? "—"}</td>
                      <td>{e.season}</td>
                      <td>{e.plannedAreaHa ?? "—"}</td>
                      <td>{e.variety ?? "—"}</td>
                      <td>{e.notes ?? "—"}</td>
                      <td>
                        <button className="link-btn" onClick={(ev) => { ev.stopPropagation(); remove(e.id); }} aria-label="Delete plan">
                          <Trash2 size={15} strokeWidth={1.75} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
