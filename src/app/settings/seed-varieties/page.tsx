"use client";

import { useState } from "react";
import { Trash2, Pencil } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { sanitizeDecimalInput } from "@/lib/utils";
import { CROP_TYPES } from "@/lib/constants";
import type { SeedVariety } from "@/lib/types";

export default function SeedVarietiesSettingsPage() {
  const { data, loading, refetch } = useApi<{ varieties: SeedVariety[] }>("/api/seed-varieties");
  const varieties = data?.varieties ?? [];

  const [crop, setCrop] = useState<string>(CROP_TYPES[0]);
  const [name, setName] = useState("");
  const [costPerBag, setCostPerBag] = useState("");
  const [seedsPerBag, setSeedsPerBag] = useState("");
  const [daysToMaturity, setDaysToMaturity] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isMaize = crop === "Maize";

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setCostPerBag("");
    setSeedsPerBag("");
    setDaysToMaturity("");
  };

  const startEdit = (v: SeedVariety) => {
    setEditingId(v.id);
    setCrop(v.cropType);
    setName(v.name);
    setCostPerBag(v.costPerBag != null ? String(v.costPerBag) : "");
    setSeedsPerBag(v.seedsPerBag != null ? String(v.seedsPerBag) : "");
    setDaysToMaturity(v.daysToMaturity != null ? String(v.daysToMaturity) : "");
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setAddError(null);
    if (editingId) {
      await fetch(`/api/seed-varieties/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          costPerBag: costPerBag !== "" ? Number(costPerBag) : null,
          seedsPerBag: seedsPerBag !== "" ? Number(seedsPerBag) : null,
          daysToMaturity: daysToMaturity !== "" ? Number(daysToMaturity) : null,
        }),
      });
      setSaving(false);
      resetForm();
      refetch();
      return;
    }
    const res = await fetch("/api/seed-varieties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cropType: crop,
        name: name.trim(),
        costPerBag: costPerBag !== "" ? Number(costPerBag) : null,
        seedsPerBag: seedsPerBag !== "" ? Number(seedsPerBag) : null,
        daysToMaturity: daysToMaturity !== "" ? Number(daysToMaturity) : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setAddError(json?.error || "Couldn't add that variety — try again.");
      return;
    }
    resetForm();
    refetch();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await fetch(`/api/seed-varieties/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (editingId === id) resetForm();
    refetch();
  };

  if (loading) return <div className="screen"><Header title="Seed varieties" backHref="/settings" /><Spinner /></div>;

  return (
    <div className="screen">
      <Header title="Seed varieties" backHref="/settings" />
      <p className="ds-note" style={{ padding: "12px 18px 0" }}>
        Named cultivars/hybrids for the Planting form&apos;s variety dropdown. For maize, cost/bag, seeds/bag and
        days to maturity let planting auto-fill a field&apos;s estimated maturity date and seed cost per hectare —
        changing these later only affects future plantings, not what&apos;s already been logged.
      </p>

      <div className="form" style={{ padding: "12px 18px" }}>
        <label className="field">
          <span className="field-label">Crop</span>
          <select className="field-input" value={crop} onChange={(e) => setCrop(e.target.value)} disabled={!!editingId}>
            {CROP_TYPES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Variety name</span>
          <input
            className="field-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. One50"
            disabled={!!editingId}
          />
        </label>
        {isMaize && (
          <>
            <div style={{ display: "flex", gap: 8 }}>
              <label className="field" style={{ flex: 1 }}>
                <span className="field-label">Cost/bag</span>
                <input className="field-input" type="text" inputMode="decimal" value={costPerBag} onChange={(e) => setCostPerBag(sanitizeDecimalInput(e.target.value))} placeholder="R" />
              </label>
              <label className="field" style={{ flex: 1 }}>
                <span className="field-label">Seeds/bag</span>
                <input className="field-input" type="text" inputMode="decimal" value={seedsPerBag} onChange={(e) => setSeedsPerBag(sanitizeDecimalInput(e.target.value))} placeholder="e.g. 60000" />
              </label>
            </div>
            <label className="field">
              <span className="field-label">Days to maturity</span>
              <input className="field-input" type="text" inputMode="decimal" value={daysToMaturity} onChange={(e) => setDaysToMaturity(sanitizeDecimalInput(e.target.value))} placeholder="e.g. 120" />
            </label>
          </>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="save-btn small" onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Add variety"}
          </button>
          {editingId && <button className="link-btn" onClick={resetForm}>Cancel</button>}
        </div>
        {addError && <p className="error-note">{addError}</p>}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {CROP_TYPES.map((c) => {
          const list = varieties.filter((v) => v.cropType === c);
          return (
            <div key={c}>
              <div className="paddock-picker-head">
                <span className="field-label">{c} ({list.length})</span>
              </div>
              <div className="menu-list" style={{ flex: "none", overflow: "visible" }}>
                {list.length === 0 && <p className="ds-note" style={{ padding: "0 18px" }}>No {c} varieties yet.</p>}
                {list.map((v) => (
                  <div key={v.id} className={`settings-row${editingId === v.id ? " active" : ""}`}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="settings-row-title">
                        {v.name}
                        {v.cropType === "Maize" && (v.costPerBag != null || v.seedsPerBag != null || v.daysToMaturity != null) && (
                          <span className="ds-note" style={{ display: "block", fontWeight: 400 }}>
                            {v.costPerBag != null ? `R${v.costPerBag}/bag` : ""}
                            {v.seedsPerBag != null ? ` — ${v.seedsPerBag.toLocaleString()} seeds/bag` : ""}
                            {v.daysToMaturity != null ? ` — ${v.daysToMaturity}d maturity` : ""}
                          </span>
                        )}
                      </span>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button className="link-btn" onClick={() => startEdit(v)} aria-label={`Edit ${v.name}`}>
                          <Pencil size={15} strokeWidth={1.75} />
                        </button>
                        <button
                          className="link-btn"
                          onClick={() => handleDelete(v.id)}
                          disabled={deletingId === v.id}
                          aria-label={`Remove ${v.name}`}
                        >
                          <Trash2 size={15} strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
