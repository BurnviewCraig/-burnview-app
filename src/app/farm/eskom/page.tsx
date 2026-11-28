"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { AccessGate } from "@/components/AccessGate";
import { TrendChart, type TrendPoint } from "@/components/TrendChart";
import { MultiTrendChart } from "@/components/MultiTrendChart";
import { useApi } from "@/lib/useApi";
import { NUTRIENT_RANGES } from "@/lib/constants";
import type { Farm, ElectricityMeter, ElectricityBill } from "@/lib/types";

type Range = (typeof NUTRIENT_RANGES)[number]["id"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
function monthLabel(month: string) {
  const [y, m] = month.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

// Eskom's printed "ACCOUNT MONTH" is the month the bill is issued in, not
// the month the electricity was actually used — Craig reads meters on the
// 6th–8th, and that reading closes out the PREVIOUS month's billing period
// (periodStart usually falls on the 6th–9th of the usage month, periodEnd a
// few days into the following one). So for any month-based grouping —
// "latest month", YTD, chart x-axis — use the period's own start month,
// falling back to accountMonth minus one month for the handful of older
// bills with no parsed period dates.
function usageMonth(b: ElectricityBill): string {
  if (b.periodStart) return b.periodStart.slice(0, 7);
  const [y, m] = b.accountMonth.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function EskomPage() {
  return (
    <AccessGate section="farm" title="Eskom">
      <EskomPageInner />
    </AccessGate>
  );
}

function EskomPageInner() {
  const { data: farmsData } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];
  const { data: metersData, loading: metersLoading, refetch: refetchMeters } = useApi<{ meters: ElectricityMeter[] }>("/api/electricity-meters");
  const meters = metersData?.meters ?? [];
  const { data: billsData, loading: billsLoading } = useApi<{ bills: ElectricityBill[] }>("/api/electricity-bills");
  const bills = billsData?.bills ?? [];

  const billsByMeter = useMemo(() => {
    const map = new Map<string, ElectricityBill[]>();
    bills.forEach((b) => map.set(b.meterId, [...(map.get(b.meterId) ?? []), b]));
    return map;
  }, [bills]);

  const latestMonth = useMemo(
    () => bills.reduce((max, b) => { const um = usageMonth(b); return um > max ? um : max; }, ""),
    [bills]
  );
  const currentYear = new Date().getFullYear();

  // Burnview / Everfair / Stockton in farm order, then an "Unassigned"
  // bucket for meters Craig hasn't assigned a farm to yet.
  const farmGroups = useMemo(() => {
    const groups = farms.map((f) => ({ id: f.id, name: f.name, meters: meters.filter((m) => m.farmId === f.id) }));
    const unassigned = meters.filter((m) => !m.farmId);
    if (unassigned.length) groups.push({ id: "__none__", name: "Unassigned", meters: unassigned });
    return groups.filter((g) => g.meters.length > 0);
  }, [farms, meters]);

  const groupTotals = (groupMeters: ElectricityMeter[]) => {
    let latestKwh = 0, latestRand = 0, ytdRand = 0;
    let hasLatest = false;
    groupMeters.forEach((m) => {
      (billsByMeter.get(m.id) ?? []).forEach((b) => {
        const um = usageMonth(b);
        if (um === latestMonth) {
          hasLatest = true;
          latestKwh += b.kwhTotal ?? 0;
          latestRand += b.totalAmountDue ?? 0;
        }
        if (um.startsWith(String(currentYear))) ytdRand += b.totalAmountDue ?? 0;
      });
    });
    return { latestKwh, latestRand, ytdRand, hasLatest };
  };

  const totalSpendPoints = useMemo<TrendPoint[]>(() => {
    const byMonth = new Map<string, number>();
    bills.forEach((b) => {
      if (b.totalAmountDue == null) return;
      const um = usageMonth(b);
      byMonth.set(um, (byMonth.get(um) ?? 0) + b.totalAmountDue);
    });
    return [...byMonth.entries()].map(([month, value]) => ({ date: `${month}-01`, value: Math.round(value) }));
  }, [bills]);
  const [spendRange, setSpendRange] = useState<Range>("ytd");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const [compareRange, setCompareRange] = useState<Range>("1y");
  const [compareMetric, setCompareMetric] = useState<"kwh" | "rand">("rand");
  const compareSeries = useMemo(() => {
    return meters
      .filter((m) => selectedIds.has(m.id))
      .map((m) => ({
        key: m.id,
        label: m.name,
        points: (billsByMeter.get(m.id) ?? [])
          .filter((b) => (compareMetric === "kwh" ? b.kwhTotal != null : b.totalAmountDue != null))
          .map((b) => ({
            date: `${usageMonth(b)}-01`,
            value: Math.round(compareMetric === "kwh" ? b.kwhTotal! : b.totalAmountDue!),
          })),
      }));
  }, [meters, selectedIds, billsByMeter, compareMetric]);

  const [editing, setEditing] = useState<Record<string, { name: string; farmId: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const startEdit = (m: ElectricityMeter) => setEditing((prev) => ({ ...prev, [m.id]: { name: m.name, farmId: m.farmId ?? "" } }));
  const cancelEdit = (id: string) => setEditing((prev) => { const next = { ...prev }; delete next[id]; return next; });
  const saveEdit = async (m: ElectricityMeter) => {
    const vals = editing[m.id];
    if (!vals || !vals.name.trim()) return;
    setSavingId(m.id);
    await fetch(`/api/electricity-meters/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: vals.name.trim(), farmId: vals.farmId || null }),
    });
    setSavingId(null);
    cancelEdit(m.id);
    refetchMeters();
  };

  if (metersLoading || billsLoading) return <div className="screen"><Header title="Eskom" backHref="/farm" /><Spinner /></div>;

  return (
    <div className="screen">
      <Header title="Eskom" backHref="/farm" />
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={{ padding: "12px 18px 0" }}>
          <TrendChart
            points={totalSpendPoints}
            range={spendRange}
            onRangeChange={setSpendRange}
            ranges={NUTRIENT_RANGES}
            unit=" ZAR"
            yLabel="Total Eskom spend"
            title={`Total Eskom spend${latestMonth ? ` — latest: ${monthLabel(latestMonth)}` : ""}`}
          />
        </div>

        <p className="field-label" style={{ padding: "14px 18px 0" }}>Usage per farm{latestMonth ? ` — ${monthLabel(latestMonth)}` : ""}</p>
        <div style={{ padding: "6px 18px 0", display: "flex", flexDirection: "column", gap: 8 }}>
          {farmGroups.map((g) => {
            const t = groupTotals(g.meters);
            return (
              <div key={g.id} className="wedge-info-box" style={{ display: "grid", width: "100%" }}>
                <div style={{ gridColumn: "1 / -1", fontWeight: 700 }}>{g.name}</div>
                <div><span className="wib-k">kWh this month</span><span className="wib-v">{t.hasLatest ? Math.round(t.latestKwh).toLocaleString() : "—"}</span></div>
                <div><span className="wib-k">Spend this month</span><span className="wib-v">{t.hasLatest ? `R${Math.round(t.latestRand).toLocaleString()}` : "—"}</span></div>
                <div><span className="wib-k">Spend YTD {currentYear}</span><span className="wib-v">R{Math.round(t.ytdRand).toLocaleString()}</span></div>
              </div>
            );
          })}
          {farmGroups.length === 0 && <p className="ds-note">No Eskom bills imported yet.</p>}
        </div>

        <p className="field-label" style={{ padding: "16px 18px 0" }}>Compare meters</p>
        <p className="ds-note" style={{ padding: "2px 18px 6px" }}>Tick meters below to plot them against each other.</p>
        <div className="chip-wrap" style={{ padding: "0 18px 6px" }}>
          <button className={`range-chip${compareMetric === "rand" ? " on" : ""}`} onClick={() => setCompareMetric("rand")}>Rand (R)</button>
          <button className={`range-chip${compareMetric === "kwh" ? " on" : ""}`} onClick={() => setCompareMetric("kwh")}>kWh</button>
        </div>
        <div style={{ padding: "0 18px" }}>
          <MultiTrendChart
            series={compareSeries}
            range={compareRange}
            onRangeChange={setCompareRange}
            ranges={NUTRIENT_RANGES}
            unit={compareMetric === "rand" ? " ZAR" : " kWh"}
            yLabel={compareMetric === "rand" ? "Rand" : "kWh"}
            title={compareMetric === "rand" ? "Total charge comparison (incl. service costs)" : "kWh comparison"}
          />
        </div>

        <p className="field-label" style={{ padding: "16px 18px 0" }}>Meters</p>
        {farmGroups.map((g) => (
          <div key={g.id}>
            <p className="ds-note" style={{ padding: "8px 18px 0", fontWeight: 600 }}>{g.name}</p>
            <div className="menu-list">
              {g.meters.map((m) => {
                const edit = editing[m.id];
                const latest = (billsByMeter.get(m.id) ?? []).find((b) => usageMonth(b) === latestMonth);
                return (
                  <div key={m.id} className="settings-row">
                    {edit ? (
                      <>
                        <label className="field">
                          <span className="field-label">Name</span>
                          <input className="field-input small" value={edit.name} onChange={(e) => setEditing((prev) => ({ ...prev, [m.id]: { ...prev[m.id], name: e.target.value } }))} />
                        </label>
                        <label className="field">
                          <span className="field-label">Farm</span>
                          <select className="field-input small" value={edit.farmId} onChange={(e) => setEditing((prev) => ({ ...prev, [m.id]: { ...prev[m.id], farmId: e.target.value } }))}>
                            <option value="">(unassigned)</option>
                            {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                          </select>
                        </label>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="save-btn small" onClick={() => saveEdit(m)} disabled={savingId === m.id || !edit.name.trim()}>
                            {savingId === m.id ? "Saving…" : "Save"}
                          </button>
                          <button className="link-btn" onClick={() => cancelEdit(m.id)}>Cancel</button>
                        </div>
                      </>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggleSelected(m.id)} />
                        <div style={{ flex: 1, minWidth: 0 }} onClick={() => startEdit(m)}>
                          <div className="settings-row-title">{m.name}</div>
                          <span className="mr-sub">
                            {m.accountNo}
                            {latest ? ` · ${Math.round(latest.kwhTotal ?? 0).toLocaleString()} kWh · R${Math.round(latest.totalAmountDue ?? 0).toLocaleString()}` : " · no bill this month"}
                          </span>
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
        {farmGroups.length === 0 && <p className="ds-note" style={{ padding: "12px 18px" }}>No electricity meters yet.</p>}
      </div>
    </div>
  );
}
