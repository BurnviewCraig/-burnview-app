"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import type { Farm, WaterMeter } from "@/lib/types";

export default function WaterMetersSettingsPage() {
  const { data: farmsData, loading: farmsLoading } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];
  const { data, loading, refetch } = useApi<{ meters: WaterMeter[] }>("/api/water-meters");
  const meters = data?.meters ?? [];
  const [editing, setEditing] = useState<Record<string, { name: string; groupName: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const startEdit = (m: WaterMeter) => {
    setEditing((prev) => ({ ...prev, [m.id]: { name: m.name, groupName: m.groupName } }));
  };

  const handleSave = async (m: WaterMeter) => {
    const vals = editing[m.id];
    if (!vals || !vals.name.trim() || !vals.groupName.trim()) return;
    setSavingId(m.id);
    await fetch(`/api/water-meters/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: vals.name.trim(), groupName: vals.groupName.trim() }),
    });
    setSavingId(null);
    setEditing((prev) => { const next = { ...prev }; delete next[m.id]; return next; });
    refetch();
  };

  const byFarm = useMemo(() => {
    const map = new Map<string, { farmName: string; meters: WaterMeter[] }>();
    meters.forEach((m) => {
      const farm = farms.find((f) => f.id === m.farmId);
      const g = map.get(m.farmId) ?? { farmName: farm?.name ?? "", meters: [] };
      g.meters.push(m);
      map.set(m.farmId, g);
    });
    return [...map.values()];
  }, [meters, farms]);

  if (farmsLoading || loading) return <div className="screen"><Header title="Water meters" backHref="/settings" /><Spinner /></div>;

  return (
    <div className="screen">
      <Header title="Water meters" backHref="/settings" />
      <p className="ds-note" style={{ padding: "12px 18px 0" }}>
        Name and billing group for each water meter. Meters sharing a group name are added together for that
        group&apos;s year-to-date total on the Water meters page.
      </p>

      <div className="no-print" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {byFarm.map((f) => (
          <div key={f.farmName}>
            <p className="field-label" style={{ padding: "10px 18px 0" }}>{f.farmName}</p>
            <div className="menu-list">
              {f.meters.map((m) => {
                const edit = editing[m.id];
                return (
                  <div key={m.id} className="settings-row">
                    {edit ? (
                      <>
                        <label className="field">
                          <span className="field-label">Name</span>
                          <input className="field-input small" type="text" value={edit.name} onChange={(e) => setEditing((prev) => ({ ...prev, [m.id]: { ...prev[m.id], name: e.target.value } }))} />
                        </label>
                        <label className="field">
                          <span className="field-label">Billing group</span>
                          <input className="field-input small" type="text" value={edit.groupName} onChange={(e) => setEditing((prev) => ({ ...prev, [m.id]: { ...prev[m.id], groupName: e.target.value } }))} />
                        </label>
                        <button className="save-btn small" onClick={() => handleSave(m)} disabled={savingId === m.id || !edit.name.trim() || !edit.groupName.trim()}>
                          {savingId === m.id ? "Saving…" : "Save"}
                        </button>
                      </>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div className="settings-row-title">{m.name}</div>
                          <span className="mr-sub">{m.groupName}</span>
                        </div>
                        <button className="link-btn" onClick={() => startEdit(m)}>Edit</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
