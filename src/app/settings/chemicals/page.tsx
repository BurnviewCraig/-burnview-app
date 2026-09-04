"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { CHEMICAL_UNITS } from "@/lib/constants";
import type { ChemicalType } from "@/lib/types";

export default function ChemicalsSettingsPage() {
  const { data, loading, refetch } = useApi<{ types: ChemicalType[] }>("/api/chemical-types");
  const types = data?.types ?? [];

  const [name, setName] = useState("");
  const [unit, setUnit] = useState(CHEMICAL_UNITS[0]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    const res = await fetch("/api/chemical-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), unit }),
    });
    setSaving(false);
    if (!res.ok) {
      setErrorMsg("Couldn't add that chemical — it may already be in the list.");
      return;
    }
    setName("");
    refetch();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await fetch(`/api/chemical-types/${id}`, { method: "DELETE" });
    setDeletingId(null);
    refetch();
  };

  if (loading) return <div className="screen"><Header title="Chemicals" backHref="/settings" /><Spinner /></div>;

  return (
    <div className="screen">
      <Header title="Chemicals" backHref="/settings" />
      <p className="ds-note" style={{ padding: "12px 18px 0" }}>
        The spray chemical list used on the Spraying form. Add every product you use — each one gets its
        own rate per hectare when logging a spray.
      </p>

      <div className="form" style={{ padding: "12px 18px" }}>
        <label className="field">
          <span className="field-label">Add a chemical</span>
          <input
            className="field-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Roundup"
          />
        </label>
        <label className="field">
          <span className="field-label">Rate unit</span>
          <select className="field-input" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {CHEMICAL_UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </label>
        <button className="save-btn small" onClick={handleAdd} disabled={!name.trim() || saving}>
          {saving ? "Adding…" : "Add chemical"}
        </button>
        {errorMsg && <p className="error-note">{errorMsg}</p>}
      </div>

      <div className="menu-list">
        {types.length === 0 && (
          <p className="ds-note" style={{ padding: "0 18px" }}>No chemicals yet — add your first one above.</p>
        )}
        {types.map((t) => (
          <div key={t.id} className="settings-row">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="settings-row-head">
                <span className="settings-row-title">{t.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="mr-sub">{t.unit}</span>
                <button
                  className="link-btn"
                  onClick={() => handleDelete(t.id)}
                  disabled={deletingId === t.id}
                  aria-label={`Remove ${t.name}`}
                >
                  <Trash2 size={16} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
