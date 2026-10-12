"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { TrendChart, type ChartRange } from "@/components/TrendChart";
import { useApi } from "@/lib/useApi";
import { todayStr, sanitizeDecimalInput } from "@/lib/utils";
import { addDays } from "@/lib/calendarFormat";
import type { Farm, MilkSaleEntry } from "@/lib/types";

const round1 = (n: number) => Math.round(n * 10) / 10;

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const ALL_FARMS_ID = "__all__";

function MilkSoldForm() {
  const params = useSearchParams();
  const { data: farmsData, loading } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];

  const [farmId, setFarmId] = useState<string | null>(params.get("farmId"));
  const showingAll = farmId === ALL_FARMS_ID;
  const farm = farms.find((f) => f.id === (farmId ?? farms[0]?.id)) ?? farms[0];

  const [date, setDate] = useState(params.get("date") || todayStr());
  const [litres, setLitres] = useState("");
  const [takenBy, setTakenBy] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [range, setRange] = useState<ChartRange>("14d");

  const { data, refetch } = useApi<{ entries: MilkSaleEntry[] }>(
    showingAll ? "/api/milk-sales" : farm ? `/api/milk-sales?farmId=${farm.id}` : null
  );
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

  // The old "Change %" here compared this month's running total against
  // LAST month's full total — early in a month that's a handful of days
  // against a complete 30, so it always read as a huge, meaningless drop
  // (e.g. -97% a few days into a new month) rather than any real trend.
  //
  // Averages below are now also gated on a day being "complete" — on the
  // All Farms view that means every farm has at least one collection
  // logged for that date, not just some of them. One farm's entry landing
  // late (or the AFI import missing a night) used to show as a low day
  // and drag the whole average down; a day nothing's been logged for yet
  // (including today, most of the time) is skipped rather than counted as
  // zero, so dailyAvg stays correct no matter how far into the month it
  // is, and the 7-day average is genuinely 7 complete days — not whichever
  // 7 calendar days happen to be most recent, gaps and all.
  const stats = useMemo(() => {
    const totalByDate = new Map<string, number>();
    const farmsByDate = new Map<string, Set<string>>();
    entries.forEach((e) => {
      const d = e.date.slice(0, 10);
      totalByDate.set(d, (totalByDate.get(d) ?? 0) + e.litres);
      if (!farmsByDate.has(d)) farmsByDate.set(d, new Set());
      farmsByDate.get(d)!.add(e.farmId);
    });
    const farmsNeeded = showingAll ? Math.max(farms.length, 1) : 1;
    const isComplete = (d: string) => (farmsByDate.get(d)?.size ?? 0) >= farmsNeeded;

    const today = todayStr();
    const now = new Date();
    const thisMonth = monthKey(now);
    const lastMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    let thisTotal = 0;
    let lastTotal = 0;
    let thisCompleteSum = 0;
    let thisCompleteDays = 0;
    totalByDate.forEach((value, d) => {
      const m = d.slice(0, 7);
      if (m === thisMonth) {
        thisTotal += value;
        if (isComplete(d)) { thisCompleteSum += value; thisCompleteDays++; }
      } else if (m === lastMonth) {
        lastTotal += value;
      }
    });
    thisTotal = round1(thisTotal);
    lastTotal = round1(lastTotal);
    const dailyAvg = thisCompleteDays > 0 ? round1(thisCompleteSum / thisCompleteDays) : null;

    // Scan backward from today for the most recent complete days — up to
    // ~4 months back, far more than ever needed, just as a sane bound.
    const completeDaysDesc: number[] = [];
    for (let i = 0; i < 120 && completeDaysDesc.length < 14; i++) {
      const d = addDays(today, -i);
      if (isComplete(d)) completeDaysDesc.push(totalByDate.get(d) ?? 0);
    }
    const last7 = completeDaysDesc.slice(0, 7);
    const prev7 = completeDaysDesc.slice(7, 14);
    const avgOf = (vals: number[]) => (vals.length ? round1(vals.reduce((s, v) => s + v, 0) / vals.length) : null);
    const last7Avg = avgOf(last7);
    const prev7Avg = avgOf(prev7);
    const trend: "up" | "down" | null =
      last7Avg != null && prev7Avg != null ? (last7Avg > prev7Avg ? "up" : last7Avg < prev7Avg ? "down" : null) : null;

    return { thisTotal, lastTotal, dailyAvg, last7Avg, trend };
  }, [entries, farms.length, showingAll]);

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
    if (showingAll) setFarmId(e.farmId); // jump into that entry's own farm tab to edit it
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
          <button key={f.id} className={`tab${!showingAll && farm.id === f.id ? " active" : ""}`} onClick={() => switchFarm(f.id)}>{f.name}</button>
        ))}
        <button className={`tab${showingAll ? " active" : ""}`} onClick={() => switchFarm(ALL_FARMS_ID)}>All Farms</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <p className="field-hint" style={{ padding: "12px 18px 0", margin: 0 }}>{showingAll ? "Business" : farm.name} total</p>
        <div className="wedge-info-box" style={{ margin: "6px 18px 0" }}>
          <div><span className="wib-k">This month</span><span className="wib-v">{stats.thisTotal}L</span></div>
          <div><span className="wib-k">Last month</span><span className="wib-v">{stats.lastTotal}L</span></div>
          <div><span className="wib-k">Daily avg (this month)</span><span className="wib-v">{stats.dailyAvg ?? "—"}L</span></div>
          <div>
            <span className="wib-k">Avg last 7 days</span>
            <span className={`wib-v cgb-variation${stats.trend ? ` ${stats.trend}` : ""}`}>
              {stats.trend === "up" ? "▲ " : stats.trend === "down" ? "▼ " : ""}{stats.last7Avg ?? "—"}L
            </span>
          </div>
        </div>

        <div style={{ padding: "12px 18px 0" }}>
          <TrendChart points={dailyTotals} range={range} onRangeChange={setRange} unit="L" yLabel="Litres sold" />
        </div>

        {showingAll ? (
          <p className="ds-note" style={{ padding: "12px 18px" }}>Pick a farm tab to log a new collection — this view is a read-only combined total.</p>
        ) : (
          <div className="form" style={{ padding: "12px 18px", gap: 12 }}>
            <p className="ds-note">
              A farm can have several buyers collecting on the same day — each save here adds a new collection rather than replacing the day&apos;s total.
            </p>

            <label className="field">
              <span className="field-label">Litres sold</span>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="field-input" type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} style={{ flex: 1 }} />
                <input className="field-input" type="text" inputMode="decimal" value={litres} onChange={(e) => setLitres(sanitizeDecimalInput(e.target.value))} placeholder="Litres" style={{ width: 90 }} />
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
        )}

        <div className="field" style={{ padding: "0 18px 18px" }}>
          <span className="field-label">History</span>
          {entries.length === 0 && <p className="ds-note">No milk sold logged yet for {showingAll ? "the business" : farm.name}.</p>}
          {entries.map((e) => (
            <div key={e.id} className={`settings-row${editingId === e.id ? " active" : ""}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button className="link-btn" style={{ textAlign: "left" }} onClick={() => startEdit(e)}>
                  {e.date.slice(0, 10)} — {e.litres}L{e.takenBy ? ` — ${e.takenBy}` : ""}{showingAll && e.farmName ? ` — ${e.farmName}` : ""}
                </button>
                <button className="link-btn" onClick={() => handleDelete(e.id)} aria-label="Delete milk sale">
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          ))}
        </div>
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
