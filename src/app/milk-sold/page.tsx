"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { TrendChart, type ChartRange } from "@/components/TrendChart";
import { useApi } from "@/lib/useApi";
import { todayStr } from "@/lib/utils";
import type { Farm, MilkSaleEntry } from "@/lib/types";

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function MilkSoldForm() {
  const params = useSearchParams();
  const { data: farmsData, loading } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];

  const [farmId, setFarmId] = useState<string | null>(params.get("farmId"));
  const farm = farms.find((f) => f.id === (farmId ?? farms[0]?.id)) ?? farms[0];

  const [date, setDate] = useState(params.get("date") || todayStr());
  const [litres, setLitres] = useState("");
  const [takenBy, setTakenBy] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [range, setRange] = useState<ChartRange>("1m");

  const { data, refetch } = useApi<{ entries: MilkSaleEntry[] }>(farm ? `/api/milk-sales?farmId=${farm.id}` : null);
  const entries = data?.entries ?? [];

  // Multiple buyers can collect on the same day, so the chart/comparison
  // work off each day's total across every collection, not a single value.
  const dailyTotals = useMemo(() => {
    const byDate = new Map<string, number>();
    entries.forEach((e) => {
      const d = e.date.slice(0, 10);
      byDate.set(d, (byDate.get(d) ?? 0) + e.litres);
    });
    return [...byDate.entries()].map(([d, value]) => ({ date: d, value: Math.round(value * 10) / 10 }));
  }, [entries]);

  const monthComparison = useMemo(() => {
    const now = new Date();
    const thisMonth = monthKey(now);
    const lastMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    let thisTotal = 0;
    let lastTotal = 0;
    dailyTotals.forEach((p) => {
      const m = p.date.slice(0, 7);
      if (m === thisMonth) thisTotal += p.value;
      else if (m === lastMonth) lastTotal += p.value;
    });
    thisTotal = Math.round(thisTotal * 10) / 10;
    lastTotal = Math.round(lastTotal * 10) / 10;
    const pct = lastTotal > 0 ? Math.round(((thisTotal - lastTotal) / lastTotal) * 100) : null;
    return { thisTotal, lastTotal, pct };
  }, [dailyTotals]);

  const resetForm = () => {
    setEditingId(null);
    setLitres("");
    setTakenBy("");
    setDate(todayStr());
  };

  const switchFarm = (id: string) => {
    setFarmId(id);
    resetForm();
  };

  const startEdit = (e: MilkSaleEntry) => {
    setEditingId(e.id);
    setDate(e.date.slice(0, 10));
    setLitres(String(e.litres));
    setTakenBy(e.takenBy ?? "");
  };

  const handleSave = async () => {
    if (!farm || litres === "" || Number(litres) < 0) return;
    setSaving(true);
    if (editingId) {
      await fetch(`/api/milk-sales/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, litres: Number(litres), takenBy: takenBy.trim() || null }),
      });
    } else {
      await fetch("/api/milk-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmId: farm.id, date, litres: Number(litres), takenBy: takenBy.trim() || null }),
      });
    }
    setSaving(false);
    resetForm();
    refetch();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/milk-sales/${id}`, { method: "DELETE" });
    if (editingId === id) resetForm();
    refetch();
  };

  if (loading) return <div className="screen"><Header title="Milk sold" backHref="/cattle" /><Spinner /></div>;
  if (!farm) return <div className="screen"><Header title="Milk sold" backHref="/cattle" /><div className="empty">No farms found.</div></div>;

  return (
    <div className="screen">
      <Header title="Milk sold" backHref="/cattle" />

      <div className="tabs">
        {farms.map((f) => (
          <button key={f.id} className={`tab${farm.id === f.id ? " active" : ""}`} onClick={() => switchFarm(f.id)}>{f.name}</button>
        ))}
      </div>

      <div className="wedge-info-box" style={{ margin: "12px 18px 0" }}>
        <div><span className="wib-k">This month</span><span className="wib-v">{monthComparison.thisTotal}L</span></div>
        <div><span className="wib-k">Last month</span><span className="wib-v">{monthComparison.lastTotal}L</span></div>
        {monthComparison.pct != null && (
          <div><span className="wib-k">Change</span><span className="wib-v">{monthComparison.pct > 0 ? "+" : ""}{monthComparison.pct}%</span></div>
        )}
      </div>

      <div style={{ padding: "12px 18px 0" }}>
        <TrendChart points={dailyTotals} range={range} onRangeChange={setRange} unit="L" yLabel="Litres sold" />
      </div>

      <div className="form" style={{ padding: "12px 18px", gap: 12 }}>
        <p className="ds-note">
          A farm can have several buyers collecting on the same day — each save here adds a new collection rather than replacing the day&apos;s total.
        </p>

        <label className="field">
          <span className="field-label">Litres sold</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="field-input" type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} style={{ flex: 1 }} />
            <input className="field-input" type="number" inputMode="decimal" value={litres} onChange={(e) => setLitres(e.target.value)} placeholder="Litres" style={{ width: 90 }} />
          </div>
        </label>

        <label className="field">
          <span className="field-label">Taken by</span>
          <input className="field-input" value={takenBy} onChange={(e) => setTakenBy(e.target.value)} placeholder="e.g. driver, company or buyer name" />
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="save-btn" onClick={handleSave} disabled={saving || litres === ""}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Save milk sold"}
          </button>
          {editingId && <button className="link-btn" onClick={resetForm}>Cancel edit</button>}
        </div>
      </div>

      <div className="field" style={{ padding: "0 18px 18px" }}>
        <span className="field-label">History</span>
        {entries.length === 0 && <p className="ds-note">No milk sold logged yet for {farm.name}.</p>}
        {entries.map((e) => (
          <div key={e.id} className={`settings-row${editingId === e.id ? " active" : ""}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button className="link-btn" style={{ textAlign: "left" }} onClick={() => startEdit(e)}>
                {e.date.slice(0, 10)} — {e.litres}L{e.takenBy ? ` — ${e.takenBy}` : ""}
              </button>
              <button className="link-btn" onClick={() => handleDelete(e.id)} aria-label="Delete milk sale">
                <Trash2 size={14} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MilkSoldPage() {
  return (
    <Suspense fallback={<div className="screen"><Header title="Milk sold" backHref="/cattle" /><Spinner /></div>}>
      <MilkSoldForm />
    </Suspense>
  );
}
