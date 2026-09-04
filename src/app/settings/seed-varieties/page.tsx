"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { CROP_TYPES } from "@/lib/constants";
import type { SeedVariety } from "@/lib/types";

export default function SeedVarietiesSettingsPage() {
  const { data, loading, refetch } = useApi<{ varieties: SeedVariety[] }>("/api/seed-varieties");
  const varieties = data?.varieties ?? [];

  const [crop, setCrop] = useState<string>(CROP_TYPES[0]);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setAdding(true);
    setAddError(null);
    const res = await fetch("/api/seed-varieties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cropType: crop, name: name.trim() }),
    });
    setAdding(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setAddError(json?.error || "Couldn't add that variety — try again.");
      return;
    }
    setName("");
    refetch();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await fetch(`/api/seed-varieties/${id}`, { method: "DELETE" });
    setDeletingId(null);
    refetch();
  };

  if (loading) return <div className="screen"><Header title="Seed varieties" backHref="/settings" /><Spinner /></div>;

  return (
    <div className="screen">
      <Header title="Seed varieties" backHref="/settings" />
      <p className="ds-note" style={{ padding: "12px 18px 0" }}>
        Named cultivars/hybrids for the Planting form&apos;s variety dropdown.
      </p>

      <div className="form" style={{ padding: "12px 18px" }}>
        <label className="field">
          <span className="field-label">Crop</span>
          <select className="field-input" value={crop} onChange={(e) => setCrop(e.target.value)}>
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
          />
        </label>
        <button className="save-btn small" onClick={handleAdd} disabled={!name.trim() || adding}>
          {adding ? "Adding…" : "Add variety"}
        </button>
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
                  <div key={v.id} className="settings-row">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="settings-row-title">{v.name}</span>
                      <button
                        className="link-btn"
                        onClick={() => handleDelete(v.id)}
                        disabled={deletingId === v.id}
                        aria-label={`Remove ${v.name}`}
                      >
                        <Trash2 size={16} strokeWidth={1.75} />
                      </button>
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
