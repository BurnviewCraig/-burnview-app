"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { todayStr } from "@/lib/utils";
import { addDays } from "@/lib/calendarFormat";
import { computeDieselByDate } from "@/lib/dieselCalc";
import type { DieselAsset, DieselLogEntry } from "@/lib/types";

type AssetWithFarm = DieselAsset & { farm: { id: string; name: string } };

type DisplayRow = {
  date: string;
  worked: boolean;
  driverName: string | null;
  opening: number | null;
  closing: number | null;
  hours: number | null;
  litresFilled: number | null;
  litresUsed: number | null;
  rate: number | null;
  activities: string[];
  paddockCodes: string[];
  comment: string | null;
};

function DieselHistoryContent() {
  const params = useSearchParams();
  const assetId = params.get("assetId");

  const { data: assetData, loading } = useApi<{ asset: AssetWithFarm }>(assetId ? `/api/diesel-assets/${assetId}` : null);
  const asset = assetData?.asset ?? null;
  const { data: entriesData } = useApi<{ entries: DieselLogEntry[] }>(assetId ? `/api/diesel-entries?assetId=${assetId}` : null);
  const entries = entriesData?.entries ?? [];

  const [from, setFrom] = useState(addDays(todayStr(), -90));
  const [to, setTo] = useState(todayStr());

  // Computed over ALL history (not just the print window) so a fill just
  // outside the range still prorates correctly into days inside it.
  const byDate = useMemo(() => {
    const computed = computeDieselByDate(entries, asset?.unit ?? "HOURS");
    const map = new Map<string, DisplayRow>();
    entries.forEach((e) => {
      const c = computed.get(e.date);
      map.set(e.date, {
        date: e.date,
        worked: e.worked,
        driverName: e.driver?.name ?? null,
        opening: e.openingReading,
        closing: c?.closing ?? null,
        hours: c?.hours ?? null,
        litresFilled: e.litresFilled,
        litresUsed: c?.litresUsed ?? null,
        rate: c?.rate ?? null,
        activities: e.activities,
        paddockCodes: e.paddockCodes,
        comment: e.comment,
      });
    });
    return map;
  }, [entries, asset]);

  // One row per calendar day in the print window, worked or not — a day
  // with no logged entry at all prints identically to an explicit "parked" day.
  const rows = useMemo(() => {
    const list: DisplayRow[] = [];
    let d = from;
    let guard = 0;
    while (d <= to && guard < 2000) {
      const existing = byDate.get(d);
      list.push(
        existing ?? {
          date: d,
          worked: false,
          driverName: null,
          opening: null,
          closing: null,
          hours: null,
          litresFilled: null,
          litresUsed: null,
          rate: null,
          activities: [],
          paddockCodes: [],
          comment: null,
        }
      );
      d = addDays(d, 1);
      guard++;
    }
    return list.reverse();
  }, [byDate, from, to]);

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
        <table className="grazing-table diesel-history-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Driver</th>
              <th>Opening</th>
              <th>Closing</th>
              <th>Usage</th>
              <th>Litres filled</th>
              <th>Litres used</th>
              <th>Rate</th>
              <th>Activity</th>
              <th>Location</th>
              <th>Comment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) =>
              r.worked ? (
                <tr key={r.date}>
                  <td>{r.date}</td>
                  <td>{r.driverName ?? "—"}</td>
                  <td>{r.opening ?? "—"}{r.opening != null ? unitLabel : ""}</td>
                  <td>{r.closing ?? "—"}{r.closing != null ? unitLabel : ""}</td>
                  <td>{r.hours ?? "—"}{r.hours != null ? unitLabel : ""}</td>
                  <td>{r.litresFilled ?? "—"}{r.litresFilled != null ? "L" : ""}</td>
                  <td>{r.litresUsed ?? "—"}{r.litresUsed != null ? "L" : ""}</td>
                  <td>{r.rate ?? "—"}{r.rate != null ? ` ${rateLabel}` : ""}</td>
                  <td>{r.activities.join(", ") || "—"}</td>
                  <td>{r.paddockCodes.join(", ") || "—"}</td>
                  <td>{r.comment ?? ""}</td>
                </tr>
              ) : (
                <tr key={r.date} className="diesel-not-worked">
                  <td>{r.date}</td>
                  <td colSpan={9}>Asset not worked</td>
                  <td>{r.comment ?? ""}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
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
