"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { sanitizeDecimalInput } from "@/lib/utils";
import type { Farm, MaizePlantingPlan } from "@/lib/types";

// Same drag-to-reorder pattern as Maize History — lets planting be laid
// out in whatever sequence it'll actually happen in, not alphabetical.
function useRowOrder(storageKey: string, allIds: string[]) {
  const [order, setOrder] = useState<string[]>(allIds);
  const idsSignature = allIds.join(",");
  useEffect(() => {
    let next = allIds;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: string[] = JSON.parse(saved);
        const validSet = new Set(allIds);
        const valid = parsed.filter((k) => validSet.has(k));
        const missing = allIds.filter((k) => !valid.includes(k));
        if (valid.length) next = [...valid, ...missing];
      }
    } catch {
      // ignore — falls back to default order
    }
    setOrder(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, idsSignature]);
  const reorder = (dragId: string, dropId: string) => {
    if (dragId === dropId) return;
    setOrder((prev) => {
      const next = prev.filter((k) => k !== dragId);
      const dropIndex = next.indexOf(dropId);
      next.splice(dropIndex, 0, dragId);
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  return { order, reorder };
}

function PlantingPlansTable({ farmId }: { farmId: string }) {
  const { data, refetch } = useApi<{ entries: MaizePlantingPlan[] }>(`/api/maize-planting-plans?farmId=${farmId}`);
  const entries = useMemo(() => data?.entries ?? [], [data]);
  const entryById = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const { order, reorder } = useRowOrder(`maize-future-row-order-${farmId}`, entries.map((e) => e.id));
  const orderedEntries = order.map((id) => entryById.get(id)).filter((e): e is MaizePlantingPlan => !!e);
  const [dragId, setDragId] = useState<string | null>(null);

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
    <div>
      <div className="form" style={{ gap: 10, padding: "12px 18px" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label className="field" style={{ flex: 1, minWidth: 120 }}>
            <span className="field-label">Season</span>
            <input className="field-input" value={season} onChange={(e) => setSeason(e.target.value)} placeholder="e.g. 2026/27" />
          </label>
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
          <input className="field-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="which camps, etc." />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="save-btn small" onClick={save} disabled={saving || !season.trim()}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Add plan"}
          </button>
          {editingId && <button className="link-btn" onClick={resetForm}>Cancel</button>}
        </div>
      </div>

      {orderedEntries.length === 0 ? (
        <p className="ds-note" style={{ padding: "0 18px 18px" }}>No planting plans yet — add one above.</p>
      ) : (
        <>
          <p className="field-hint" style={{ padding: "0 18px 8px" }}>Drag a row to put it in planting order. Tap a row to edit it in the form above.</p>
          <div className="maize-sheet-scroll">
            <table className="maize-sheet-table">
              <thead>
                <tr>
                  <th className="maize-sheet-sticky">#</th>
                  <th>Season</th>
                  <th>Area (ha)</th>
                  <th>Variety</th>
                  <th>Notes</th>
                  <th>Remove</th>
                </tr>
              </thead>
              <tbody>
                {orderedEntries.map((e, i) => (
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
        <PlantingPlansTable farmId={farm.id} />
      </div>
    </div>
  );
}
