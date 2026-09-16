"use client";

import { useState } from "react";
import Link from "next/link";
import { Utensils, ChevronRight, Milk } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { TrendChart, type ChartRange } from "@/components/TrendChart";
import { useApi } from "@/lib/useApi";
import type { Farm, CattleGroup, CattleSummary } from "@/lib/types";

const ALL_FARMS_ID = "__all__";

const METRICS = [
  { id: "litres", label: "Litres/cow", unit: " L/cow" },
  { id: "weight", label: "Weight", unit: "kg" },
  { id: "dairyMeal", label: "Dairy meal", unit: "kg" },
  { id: "gramsPerLitre", label: "g/L", unit: "g/L" },
  { id: "daysInMilk", label: "Days in milk", unit: " days" },
] as const;
type MetricId = (typeof METRICS)[number]["id"];

function SummaryPanel({ farmId, label }: { farmId: string | null; label: string }) {
  const { data } = useApi<CattleSummary>(
    farmId === ALL_FARMS_ID ? "/api/cattle-summary" : `/api/cattle-summary?farmId=${farmId}`
  );
  const current = data?.current;
  const [metric, setMetric] = useState<MetricId>("litres");
  const [range, setRange] = useState<ChartRange>("1m");

  const trendKey =
    metric === "dairyMeal" ? "dairyMeal" :
    metric === "gramsPerLitre" ? "gramsPerLitre" :
    metric === "weight" ? "weight" :
    metric === "daysInMilk" ? "daysInMilk" : "litres";
  const points = data?.trend[trendKey] ?? [];
  const activeMetric = METRICS.find((m) => m.id === metric)!;

  return (
    <div style={{ padding: "0 18px 6px" }}>
      <p className="field-hint" style={{ marginBottom: 6 }}>{label} average</p>
      <div className="wedge-info-box" style={{ display: "grid", width: "100%" }}>
        <div><span className="wib-k">Head</span><span className="wib-v">{current?.count ?? "—"}</span></div>
        <div><span className="wib-k">Litres/cow</span><span className="wib-v">{current?.litresPerCow ?? "—"}</span></div>
        <div><span className="wib-k">Weight</span><span className="wib-v">{current?.avgWeightKg ?? "—"}{current?.avgWeightKg != null ? "kg" : ""}</span></div>
        <div><span className="wib-k">Dairy meal</span><span className="wib-v">{current?.dairyMealKg ?? "—"}{current?.dairyMealKg != null ? "kg" : ""}</span></div>
        <div><span className="wib-k">g / litre</span><span className="wib-v">{current?.gramsPerLitre ?? "—"}</span></div>
        <div><span className="wib-k">Days in milk</span><span className="wib-v">{current?.avgDaysInMilk ?? "—"}</span></div>
      </div>

      <div className="chip-wrap" style={{ marginBottom: 8 }}>
        {METRICS.map((m) => (
          <button key={m.id} className={`range-chip${metric === m.id ? " on" : ""}`} onClick={() => setMetric(m.id)}>{m.label}</button>
        ))}
      </div>
      <TrendChart points={points} range={range} onRangeChange={setRange} unit={activeMetric.unit} yLabel={activeMetric.label} title={`${label} — ${activeMetric.label}`} />
    </div>
  );
}

export default function CattlePage() {
  const { data: farmsData, loading } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];
  const [farmId, setFarmId] = useState<string | null>(null);
  const selected = farmId ?? farms[0]?.id ?? null;
  const farm = farms.find((f) => f.id === selected);
  const showingAll = selected === ALL_FARMS_ID;

  const { data: groupsData } = useApi<{ groups: CattleGroup[] }>(
    farm ? `/api/cattle-groups?farmId=${farm.id}` : null
  );
  const groups = groupsData?.groups ?? [];

  if (loading) return <div className="screen"><Header title="Cattle" backHref="/" /><Spinner /></div>;
  if (!farms.length) return <div className="screen"><Header title="Cattle" backHref="/" /><div className="empty">No farms found.</div></div>;

  return (
    <div className="screen">
      <Header title="Cattle" backHref="/" />

      <div style={{ flexShrink: 0 }}>
        <Link className="menu-row" href="/feeding">
          <Utensils size={18} strokeWidth={1.75} />
          <div className="menu-row-text">
            <span className="mr-title">Feeding</span>
            <span className="mr-sub">Log what&apos;s fed — draws from Feed stock</span>
          </div>
          <ChevronRight size={16} />
        </Link>
        <Link className="menu-row" href="/milk-sold">
          <Milk size={18} strokeWidth={1.75} />
          <div className="menu-row-text">
            <span className="mr-title">Milk sold</span>
            <span className="mr-sub">Litres sold per day, and who took it</span>
          </div>
          <ChevronRight size={16} />
        </Link>
      </div>

      <div className="tabs">
        {farms.map((f) => (
          <button key={f.id} className={`tab${selected === f.id ? " active" : ""}`} onClick={() => setFarmId(f.id)}>{f.name}</button>
        ))}
        <button className={`tab${showingAll ? " active" : ""}`} onClick={() => setFarmId(ALL_FARMS_ID)}>All Farms</button>
      </div>

      {showingAll ? (
        <SummaryPanel farmId={ALL_FARMS_ID} label="Business" />
      ) : (
        <>
          {farm && <SummaryPanel farmId={farm.id} label={farm.name} />}
          {groups.length === 0 ? (
            <p className="ds-note" style={{ padding: "12px 18px" }}>No milking groups set up for {farm?.name}.</p>
          ) : (
            <div className="cattle-group-grid">
              {groups.map((g) => {
                const variation =
                  g.currentMilkPerCow != null && g.previousMilkPerCow != null
                    ? Math.round((g.currentMilkPerCow - g.previousMilkPerCow) * 10) / 10
                    : null;
                return (
                  <Link key={g.id} className="cattle-group-box" href={`/cattle/group?id=${g.id}`}>
                    <span className="cgb-name">{g.name}</span>
                    <span className="cgb-milk">{g.currentMilkPerCow != null ? `${g.currentMilkPerCow} L/cow` : "No milk logged"}</span>
                    {variation != null && (
                      <span className={`cgb-variation${variation > 0 ? " up" : variation < 0 ? " down" : ""}`}>
                        {variation > 0 ? "▲" : variation < 0 ? "▼" : "–"} {Math.abs(variation)}
                      </span>
                    )}
                    <span className="cgb-count">{g.currentCount != null ? `${g.currentCount} head` : "No count set"}</span>
                    <span className="cgb-count">{g.currentDaysInMilk != null ? `${g.currentDaysInMilk} DIM` : "No DIM logged"}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
