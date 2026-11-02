"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { AccessGate } from "@/components/AccessGate";
import { TrendChart, type ChartRange } from "@/components/TrendChart";
import { useApi } from "@/lib/useApi";
import type { Farm, MilkQualityEntry } from "@/lib/types";

const ALL_FARMS_ID = "__all__";

const METRICS = [
  { id: "butterfatPct", label: "Butterfat", unit: "%" },
  { id: "proteinPct", label: "Protein", unit: "%" },
  { id: "munMgPer100ml", label: "MUN", unit: " mg/100ml" },
  { id: "bactoscanCountPerMl", label: "Bactoscan", unit: " /ml" },
  { id: "lactosePct", label: "Lactose", unit: "%" },
  { id: "somaticCellCountPerMl", label: "Somatic cell", unit: " /ml" },
] as const;
type MetricId = (typeof METRICS)[number]["id"];

// Clover's own tank numbers, global across the business — not per-farm.
const TANK_FARM_SLUG: Record<number, string> = { 1: "burnview", 2: "burnview", 3: "everfair", 4: "stockton" };

function latestFor(entries: MilkQualityEntry[], field: MetricId) {
  for (let i = entries.length - 1; i >= 0; i--) {
    const v = entries[i][field];
    if (v != null) return { value: v, date: entries[i].date };
  }
  return null;
}

function fmtDate(date: string) {
  return new Date(date.slice(0, 10) + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function MilkQualityPage() {
  return (
    <AccessGate section="cattle" title="Milk quality">
      <MilkQualityPageInner />
    </AccessGate>
  );
}

function MilkQualityPageInner() {
  const { data: farmsData, loading: farmsLoading } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];
  const { data, loading } = useApi<{ entries: MilkQualityEntry[] }>("/api/milk-quality");
  const entries = data?.entries ?? [];

  const [farmFilter, setFarmFilter] = useState<string>(ALL_FARMS_ID);
  const [metric, setMetric] = useState<MetricId>("butterfatPct");
  const [range, setRange] = useState<ChartRange>("1m");

  const byTank = useMemo(() => {
    const map = new Map<number, MilkQualityEntry[]>();
    entries.forEach((e) => map.set(e.tankNumber, [...(map.get(e.tankNumber) ?? []), e]));
    return map;
  }, [entries]);

  const tanks = useMemo(() => {
    return Object.keys(TANK_FARM_SLUG)
      .map(Number)
      .filter((n) => farmFilter === ALL_FARMS_ID || farms.find((f) => f.id === farmFilter)?.slug === TANK_FARM_SLUG[n])
      .sort((a, b) => a - b);
  }, [farms, farmFilter]);

  const farmTabs = farms.filter((f) => Object.values(TANK_FARM_SLUG).includes(f.slug));
  const activeMetric = METRICS.find((m) => m.id === metric)!;

  if (farmsLoading || loading) return <div className="screen"><Header title="Milk quality" backHref="/cattle" /><Spinner /></div>;

  return (
    <div className="screen">
      <Header title="Milk quality" backHref="/cattle" />
      <p className="ds-note" style={{ padding: "12px 18px 0" }}>
        From Clover&apos;s weekly quality card — butterfat, protein, MUN, bactoscan and more, per bulk tank.
      </p>

      <div className="tabs">
        <button className={`tab${farmFilter === ALL_FARMS_ID ? " active" : ""}`} onClick={() => setFarmFilter(ALL_FARMS_ID)}>All</button>
        {farmTabs.map((f) => (
          <button key={f.id} className={`tab${farmFilter === f.id ? " active" : ""}`} onClick={() => setFarmFilter(f.id)}>{f.name}</button>
        ))}
      </div>

      <div className="chip-wrap" style={{ padding: "0 18px", marginBottom: 4 }}>
        {METRICS.map((m) => (
          <button key={m.id} className={`range-chip${metric === m.id ? " on" : ""}`} onClick={() => setMetric(m.id)}>{m.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {tanks.length === 0 && <p className="ds-note" style={{ padding: "12px 18px" }}>No quality card data yet.</p>}
        {tanks.map((tankNumber) => {
          const tankEntries = byTank.get(tankNumber) ?? [];
          const farm = farms.find((f) => f.slug === TANK_FARM_SLUG[tankNumber]);
          const points = tankEntries
            .filter((e) => e[metric] != null)
            .map((e) => ({ date: e.date.slice(0, 10), value: e[metric] as number }));

          return (
            <div key={tankNumber} style={{ padding: "6px 18px 14px" }}>
              <div className="pivot-card">
                <div className="pivot-card-head">
                  <span className="pivot-card-name">Tank {tankNumber} — {farm?.name ?? ""}</span>
                </div>
                {tankEntries.length === 0 ? (
                  <div className="pivot-run-row empty"><span>No readings yet</span></div>
                ) : (
                  <div className="wedge-info-box" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", width: "100%", marginBottom: 8 }}>
                    {METRICS.slice(0, 4).map((m) => {
                      const latest = latestFor(tankEntries, m.id);
                      return (
                        <div key={m.id}>
                          <span className="wib-k">{m.label}</span>
                          <span className="wib-v">
                            {latest ? `${latest.value}${m.unit}` : "—"}
                            {latest && <span style={{ opacity: 0.6, fontWeight: 400 }}> ({fmtDate(latest.date)})</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {points.length > 0 && (
                  <TrendChart
                    points={points}
                    range={range}
                    onRangeChange={setRange}
                    unit={activeMetric.unit}
                    yLabel={activeMetric.label}
                    height={180}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
