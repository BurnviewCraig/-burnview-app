"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { sanitizeDecimalInput } from "@/lib/utils";
import type { Pivot } from "@/lib/types";

export default function PivotsSettingsPage() {
  const { data, loading, refetch } = useApi<{ pivots: Pivot[] }>("/api/pivots");
  const pivots = data?.pivots ?? [];
  const [editing, setEditing] = useState<Record<string, { mm: string; hours: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const startEdit = (p: Pivot) => {
    setEditing((prev) => ({
      ...prev,
      [p.id]: { mm: p.mmAt100Pct != null ? String(p.mmAt100Pct) : "", hours: p.hoursAt100Pct != null ? String(p.hoursAt100Pct) : "" },
    }));
  };

  const handleSave = async (p: Pivot) => {
    const vals = editing[p.id];
    if (!vals) return;
    setSavingId(p.id);
    await fetch(`/api/pivots/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mmAt100Pct: vals.mm === "" ? null : Number(vals.mm),
        hoursAt100Pct: vals.hours === "" ? null : Number(vals.hours),
      }),
    });
    setSavingId(null);
    setEditing((prev) => { const next = { ...prev }; delete next[p.id]; return next; });
    refetch();
  };

  const byFarm = useMemo(() => {
    const map = new Map<string, { farmName: string; pivots: Pivot[] }>();
    pivots.forEach((p) => {
      const g = map.get(p.farmId) ?? { farmName: p.farm.name, pivots: [] };
      g.pivots.push(p);
      map.set(p.farmId, g);
    });
    return [...map.values()];
  }, [pivots]);

  if (loading) return <div className="screen"><Header title="Pivots" backHref="/settings" /><Spinner /></div>;

  return (
    <div className="screen">
      <Header title="Pivots" backHref="/settings" />
      <p className="ds-note" style={{ padding: "12px 18px 0" }}>
        The mm and hours per full pass at 100% speed, for each pivot — used by the Irrigation schedule to work out
        depth, duration and grazing conflicts for a run. Names and the camps each pivot covers are fixed.
      </p>

      <div className="no-print" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {byFarm.map((f) => (
          <div key={f.farmName}>
            <p className="field-label" style={{ padding: "10px 18px 0" }}>{f.farmName}</p>
            <div className="menu-list">
              {f.pivots.map((p) => {
                const edit = editing[p.id];
                return (
                  <div key={p.id} className="settings-row">
                    <div className="settings-row-head">
                      <span className="settings-row-title">{p.name}</span>
                    </div>
                    {edit ? (
                      <>
                        <div className="nutrient-edit-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                          <label>mm @ 100%<input className="field-input small" type="text" inputMode="decimal" value={edit.mm} onChange={(e) => setEditing((prev) => ({ ...prev, [p.id]: { ...prev[p.id], mm: sanitizeDecimalInput(e.target.value) } }))} placeholder="e.g. 6" /></label>
                          <label>Hours @ 100%<input className="field-input small" type="text" inputMode="decimal" value={edit.hours} onChange={(e) => setEditing((prev) => ({ ...prev, [p.id]: { ...prev[p.id], hours: sanitizeDecimalInput(e.target.value) } }))} placeholder="e.g. 48" /></label>
                        </div>
                        <button className="save-btn small" onClick={() => handleSave(p)} disabled={savingId === p.id}>
                          {savingId === p.id ? "Saving…" : "Save"}
                        </button>
                      </>
                    ) : (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span className="mr-sub">
                          {p.mmAt100Pct != null || p.hoursAt100Pct != null
                            ? `${p.mmAt100Pct ?? "—"}mm · ${p.hoursAt100Pct ?? "—"}h @ 100%`
                            : "No rating set"}
                        </span>
                        <button className="link-btn" onClick={() => startEdit(p)}>Edit</button>
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
