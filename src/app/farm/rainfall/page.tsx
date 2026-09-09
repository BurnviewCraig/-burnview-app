"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { todayStr } from "@/lib/utils";
import type { Farm, RainfallEntry } from "@/lib/types";

const MONTH_FORMAT = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });

export default function RainfallPage() {
  const { data: farmsData, loading } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];
  const [farmId, setFarmId] = useState<string | null>(null);
  const farm = farms.find((f) => f.id === (farmId ?? farms[0]?.id)) ?? farms[0];

  const [date, setDate] = useState(todayStr());
  const [mm, setMm] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, refetch } = useApi<{ entries: RainfallEntry[] }>(farm ? `/api/rainfall?farmId=${farm.id}` : null);
  const entries = data?.entries ?? [];

  const monthlyTotals = useMemo(() => {
    const byMonth = new Map<string, number>();
    entries.forEach((e) => {
      const month = e.date.slice(0, 7); // YYYY-MM
      byMonth.set(month, (byMonth.get(month) ?? 0) + e.mm);
    });
    return [...byMonth.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([month, total]) => ({
        month,
        label: MONTH_FORMAT.format(new Date(`${month}-01T00:00:00`)),
        total: Math.round(total * 10) / 10,
      }));
  }, [entries]);

  const switchFarm = (id: string) => {
    setFarmId(id);
    setMm("");
  };

  const handleSave = async () => {
    if (!farm || mm === "" || Number(mm) < 0) return;
    setSaving(true);
    await fetch("/api/rainfall", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ farmId: farm.id, date, mm: Number(mm) }),
    });
    setSaving(false);
    setMm("");
    refetch();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/rainfall/${id}`, { method: "DELETE" });
    refetch();
  };

  if (loading) return <div className="screen"><Header title="Rainfall" backHref="/farm" /><Spinner /></div>;
  if (!farm) return <div className="screen"><Header title="Rainfall" backHref="/farm" /><div className="empty">No farms found.</div></div>;

  return (
    <div className="screen">
      <Header title="Rainfall" backHref="/farm" />

      <div className="tabs">
        {farms.map((f) => (
          <button key={f.id} className={`tab${farm.id === f.id ? " active" : ""}`} onClick={() => switchFarm(f.id)}>{f.name}</button>
        ))}
      </div>

      <div className="form" style={{ padding: "12px 18px", gap: 12 }}>
        <label className="field">
          <span className="field-label">Rainfall (mm)</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="field-input" type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} style={{ flex: 1 }} />
            <input className="field-input" type="number" inputMode="decimal" value={mm} onChange={(e) => setMm(e.target.value)} placeholder="mm" style={{ width: 90 }} />
          </div>
        </label>
        <button className="save-btn" onClick={handleSave} disabled={saving || mm === ""}>
          {saving ? "Saving…" : "Save rainfall"}
        </button>
      </div>

      {monthlyTotals.length > 0 && (
        <div className="wedge-info-box" style={{ margin: "0 18px 14px" }}>
          {monthlyTotals.slice(0, 6).map((m) => (
            <div key={m.month}><span className="wib-k">{m.label}</span><span className="wib-v">{m.total}mm</span></div>
          ))}
        </div>
      )}

      <div className="field" style={{ padding: "0 18px 18px" }}>
        <span className="field-label">History</span>
        {entries.length === 0 && <p className="ds-note">No rainfall logged yet for {farm.name}.</p>}
        {entries.map((e) => (
          <div key={e.id} className="settings-row">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="mr-sub">{e.date.slice(0, 10)} — {e.mm}mm</span>
              <button className="link-btn" onClick={() => handleDelete(e.id)} aria-label="Delete rainfall entry">
                <Trash2 size={14} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
