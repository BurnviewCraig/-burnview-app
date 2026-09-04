"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import type { FertilizerType } from "@/lib/types";

export default function FertilizerSettingsPage() {
  const { data, loading, refetch } = useApi<{ types: FertilizerType[] }>("/api/fertilizer-types");
  const types = data?.types ?? [];
  const [editing, setEditing] = useState<Record<string, { N: string; P: string; K: string; S: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    setAddError(null);
    const res = await fetch("/api/fertilizer-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setAdding(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setAddError(json?.error || "Couldn't add that fertilizer — try again.");
      return;
    }
    setNewName("");
    refetch();
  };

  const startEdit = (t: FertilizerType) => {
    setEditing((prev) => ({
      ...prev,
      [t.id]: { N: String(t.nitrogenPct), P: String(t.phosphorusPct), K: String(t.potassiumPct), S: String(t.sulfurPct) },
    }));
  };

  const handleSave = async (t: FertilizerType) => {
    const vals = editing[t.id];
    if (!vals) return;
    setSavingId(t.id);
    await fetch(`/api/fertilizer-types/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nitrogenPct: Number(vals.N),
        phosphorusPct: Number(vals.P),
        potassiumPct: Number(vals.K),
        sulfurPct: Number(vals.S),
      }),
    });
    setSavingId(null);
    setEditing((prev) => {
      const next = { ...prev };
      delete next[t.id];
      return next;
    });
    refetch();
  };

  if (loading) return <div className="screen"><Header title="Fertilizer nutrients" backHref="/settings" /><Spinner /></div>;

  return (
    <div className="screen">
      <Header title="Fertilizer nutrients" backHref="/settings" />
      <p className="ds-note" style={{ padding: "12px 18px 0" }}>
        N/P/K/S % by weight for each product — used to total nutrients applied per field. Products marked
        &quot;placeholder&quot; are generic industry-typical guesses; replace them with your real bag/spec-sheet numbers.
      </p>

      <div className="form" style={{ padding: "12px 18px" }}>
        <label className="field">
          <span className="field-label">Add a fertilizer</span>
          <input
            className="field-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Superphosphate"
          />
        </label>
        <button className="save-btn small" onClick={handleAdd} disabled={!newName.trim() || adding}>
          {adding ? "Adding…" : "Add fertilizer"}
        </button>
        {addError && <p className="error-note">{addError}</p>}
        <p className="field-hint">New products start as a placeholder — set the real N/P/K/S % below once added.</p>
      </div>

      <div className="menu-list">
        {types.map((t) => {
          const edit = editing[t.id];
          return (
            <div key={t.id} className="settings-row">
              <div className="settings-row-head">
                <span className="settings-row-title">{t.name}</span>
                {t.isPlaceholder && <span className="placeholder-badge">Placeholder</span>}
              </div>
              {edit ? (
                <>
                  <div className="nutrient-edit-grid">
                    <label>N %<input className="field-input small" type="number" value={edit.N} onChange={(e) => setEditing((p) => ({ ...p, [t.id]: { ...p[t.id], N: e.target.value } }))} /></label>
                    <label>P %<input className="field-input small" type="number" value={edit.P} onChange={(e) => setEditing((p) => ({ ...p, [t.id]: { ...p[t.id], P: e.target.value } }))} /></label>
                    <label>K %<input className="field-input small" type="number" value={edit.K} onChange={(e) => setEditing((p) => ({ ...p, [t.id]: { ...p[t.id], K: e.target.value } }))} /></label>
                    <label>S %<input className="field-input small" type="number" value={edit.S} onChange={(e) => setEditing((p) => ({ ...p, [t.id]: { ...p[t.id], S: e.target.value } }))} /></label>
                  </div>
                  <button className="save-btn small" onClick={() => handleSave(t)} disabled={savingId === t.id}>
                    {savingId === t.id ? "Saving…" : "Save"}
                  </button>
                </>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="mr-sub">N {t.nitrogenPct}% · P {t.phosphorusPct}% · K {t.potassiumPct}% · S {t.sulfurPct}%</span>
                  <button className="link-btn" onClick={() => startEdit(t)}>Edit</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
