"use client";

import { useState } from "react";
import Link from "next/link";
import { Utensils, ChevronRight, Milk } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import type { Farm, CattleGroup } from "@/lib/types";

export default function CattlePage() {
  const { data: farmsData, loading } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];
  const [farmId, setFarmId] = useState<string | null>(null);
  const farm = farms.find((f) => f.id === (farmId ?? farms[0]?.id)) ?? farms[0];

  const { data: groupsData } = useApi<{ groups: CattleGroup[] }>(
    farm ? `/api/cattle-groups?farmId=${farm.id}` : null
  );
  const groups = groupsData?.groups ?? [];

  const switchFarm = (id: string) => setFarmId(id);

  if (loading) return <div className="screen"><Header title="Cattle" backHref="/" /><Spinner /></div>;
  if (!farm) return <div className="screen"><Header title="Cattle" backHref="/" /><div className="empty">No farms found.</div></div>;

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
          <button key={f.id} className={`tab${farm.id === f.id ? " active" : ""}`} onClick={() => switchFarm(f.id)}>{f.name}</button>
        ))}
      </div>

      {groups.length === 0 ? (
        <p className="ds-note" style={{ padding: "12px 18px" }}>No milking groups set up for {farm.name}.</p>
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
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
