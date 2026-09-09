"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { todayStr } from "@/lib/utils";
import type { Farm, MilkSaleEntry } from "@/lib/types";

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

  const { data, refetch } = useApi<{ entries: MilkSaleEntry[] }>(farm ? `/api/milk-sales?farmId=${farm.id}` : null);
  const entries = data?.entries ?? [];

  const switchFarm = (id: string) => {
    setFarmId(id);
    setLitres("");
    setTakenBy("");
  };

  const handleSave = async () => {
    if (!farm || litres === "" || Number(litres) < 0) return;
    setSaving(true);
    await fetch("/api/milk-sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ farmId: farm.id, date, litres: Number(litres), takenBy: takenBy.trim() || null }),
    });
    setSaving(false);
    setLitres("");
    setTakenBy("");
    refetch();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/milk-sales/${id}`, { method: "DELETE" });
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

      <div className="form" style={{ padding: "12px 18px", gap: 12 }}>
        <p className="ds-note">
          The whole farm&apos;s tank for one day — this won&apos;t always match the groups&apos; combined production exactly.
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
          <input className="field-input" value={takenBy} onChange={(e) => setTakenBy(e.target.value)} placeholder="e.g. driver or company name" />
        </label>

        <button className="save-btn" onClick={handleSave} disabled={saving || litres === ""}>
          {saving ? "Saving…" : "Save milk sold"}
        </button>
      </div>

      <div className="field" style={{ padding: "0 18px 18px" }}>
        <span className="field-label">History</span>
        {entries.length === 0 && <p className="ds-note">No milk sold logged yet for {farm.name}.</p>}
        {entries.map((e) => (
          <div key={e.id} className="settings-row">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="mr-sub">
                {e.date.slice(0, 10)} — {e.litres}L{e.takenBy ? ` — ${e.takenBy}` : ""}
              </span>
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
