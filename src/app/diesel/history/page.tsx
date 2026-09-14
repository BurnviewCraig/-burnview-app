"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { todayStr } from "@/lib/utils";
import { addDays } from "@/lib/calendarFormat";
import type { DieselAsset, DieselLogEntry } from "@/lib/types";

type AssetWithFarm = DieselAsset & { farm: { id: string; name: string } };

function DieselHistoryContent() {
  const params = useSearchParams();
  const assetId = params.get("assetId");

  const { data: assetData, loading } = useApi<{ asset: AssetWithFarm }>(assetId ? `/api/diesel-assets/${assetId}` : null);
  const asset = assetData?.asset ?? null;
  const { data: entriesData } = useApi<{ entries: DieselLogEntry[] }>(assetId ? `/api/diesel-entries?assetId=${assetId}` : null);
  const entries = entriesData?.entries ?? [];

  const [from, setFrom] = useState(addDays(todayStr(), -90));
  const [to, setTo] = useState(todayStr());

  // Ascending so each day can look at the NEXT day's opening/fill to derive
  // its own closing reading and rate — see DieselLogEntry in schema.prisma
  // for why nothing here is stored directly.
  const rows = useMemo(() => {
    const asc = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    return asc.map((e, i) => {
      const next = asc[i + 1];
      const closing = next?.openingReading ?? null;
      const usage = closing != null && e.openingReading != null ? Math.round((closing - e.openingReading) * 10) / 10 : null;
      const nextFill = next?.litresFilled ?? null;
      let rate: number | null = null;
      if (usage != null && usage > 0 && nextFill != null) {
        rate = asset?.unit === "KM" ? Math.round((usage / nextFill) * 100) / 100 : Math.round((nextFill / usage) * 100) / 100;
      }
      return { ...e, closing, usage, rate };
    }).reverse();
  }, [entries, asset]);

  const filteredRows = rows.filter((r) => r.date >= from && r.date <= to);

  if (loading) return <div className="screen"><Header title="Asset history" backHref="/diesel" /><Spinner /></div>;
  if (!asset) return <div className="screen"><Header title="Asset history" backHref="/diesel" /><div className="empty">Asset not found.</div></div>;

  const unitLabel = asset.unit === "HOURS" ? "h" : "km";
  const rateLabel = asset.unit === "HOURS" ? "L/h" : "km/L";

  return (
    <div className="screen">
      <Header title={asset.name} backHref="/diesel" />

      <div className="no-print" style={{ padding: "0 18px" }}>
        <p className="ds-note">{asset.farm.name}{asset.numberPlate ? ` · ${asset.numberPlate}` : ""} · {asset.unit === "HOURS" ? "Hours-based" : "Km-based"}</p>
      </div>

      <div className="add-item-bar no-print" style={{ flexWrap: "wrap" }}>
        <span className="field-label" style={{ width: "100%" }}>Print range</span>
        <input className="field-input small" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span>to</span>
        <input className="field-input small" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <button className="save-btn small" onClick={() => window.print()}>
          <Printer size={14} style={{ verticalAlign: "-2px" }} /> Print
        </button>
      </div>

      <p className="timebook-title-print">{asset.farm.name} — {asset.name}{asset.numberPlate ? ` (${asset.numberPlate})` : ""} — {from} to {to}</p>

      <div className="grazing-table-scroll">
        {filteredRows.length === 0 ? (
          <p className="ds-note" style={{ padding: "12px 18px" }}>No log entries in this range.</p>
        ) : (
          <table className="grazing-table diesel-history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Driver</th>
                <th>Opening</th>
                <th>Closing</th>
                <th>Usage</th>
                <th>Litres filled</th>
                <th>Rate</th>
                <th>Activity</th>
                <th>Location</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{r.driver?.name ?? "—"}</td>
                  <td>{r.openingReading ?? "—"}{r.openingReading != null ? unitLabel : ""}</td>
                  <td>{r.closing ?? "—"}{r.closing != null ? unitLabel : ""}</td>
                  <td>{r.usage ?? "—"}{r.usage != null ? unitLabel : ""}</td>
                  <td>{r.litresFilled ?? "—"}{r.litresFilled != null ? "L" : ""}</td>
                  <td>{r.rate ?? "—"}{r.rate != null ? ` ${rateLabel}` : ""}</td>
                  <td>{r.activities.join(", ") || "—"}</td>
                  <td>{r.paddockCodes.join(", ") || "—"}</td>
                  <td>{r.comment ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function DieselHistoryPage() {
  return (
    <Suspense fallback={<div className="screen"><Header title="Asset history" backHref="/diesel" /><Spinner /></div>}>
      <DieselHistoryContent />
    </Suspense>
  );
}
