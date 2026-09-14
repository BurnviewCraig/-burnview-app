"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import type { DieselActivityType } from "@/lib/types";

export default function DieselActivitiesSettingsPage() {
  const { data, loading, refetch } = useApi<{ types: DieselActivityType[] }>("/api/diesel-activity-types");
  const types = data?.types ?? [];

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    const res = await fetch("/api/diesel-activity-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      setErrorMsg("Couldn't add that activity — it may already be in the list.");
      return;
    }
    setName("");
    refetch();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await fetch(`/api/diesel-activity-types/${id}`, { method: "DELETE" });
    setDeletingId(null);
    refetch();
  };

  if (loading) return <div className="screen"><Header title="Diesel activities" backHref="/settings" /><Spinner /></div>;

  return (
    <div className="screen">
      <Header title="Diesel activities" backHref="/settings" />
      <p className="ds-note" style={{ padding: "12px 18px 0" }}>
        The activity options offered when logging a tractor/vehicle's diesel use for the day.
      </p>

      <div className="form" style={{ padding: "12px 18px" }}>
        <label className="field">
          <span className="field-label">Add an activity</span>
          <input
            className="field-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Bush clearing"
          />
        </label>
        <button className="save-btn small" onClick={handleAdd} disabled={!name.trim() || saving}>
          {saving ? "Adding…" : "Add activity"}
        </button>
        {errorMsg && <p className="error-note">{errorMsg}</p>}
      </div>

      <div className="menu-list">
        {types.length === 0 && (
          <p className="ds-note" style={{ padding: "0 18px" }}>No activities yet — add your first one above.</p>
        )}
        {types.map((t) => (
          <div key={t.id} className="settings-row">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="settings-row-title">{t.name}</span>
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
        ))}
      </div>
    </div>
  );
}
