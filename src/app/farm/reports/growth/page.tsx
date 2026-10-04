"use client";

import { useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { todayStr } from "@/lib/utils";
import { addDays } from "@/lib/calendarFormat";
import { COLORS } from "@/lib/constants";
import type { Farm } from "@/lib/types";

type GrowthRow = {
  paddockId: string;
  code: string;
  farmName: string;
  sizeHa: number | null;
  walkCount: number;
  avgGrowth: number | null;
  startCover: number | null;
  endCover: number | null;
  firstWalkDate: string | null;
  lastWalkDate: string | null;
};
type GrowthData = { rows: GrowthRow[]; avgGrowth: number | null; from: string; to: string };

export default function GrowthReportPage() {
  const { data: farmsData } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];

  const [farmId, setFarmId] = useState<string>("all");
  const [from, setFrom] = useState(addDays(todayStr(), -90));
  const [to, setTo] = useState(todayStr());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, loading } = useApi<GrowthData>(`/api/reports/growth?farmId=${farmId}&from=${from}&to=${to}`);
  const rows = data?.rows ?? [];

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(r.paddockId)).sort((a, b) => (b.avgGrowth ?? -Infinity) - (a.avgGrowth ?? -Infinity)),
    [rows, selected]
  );
  const maxSelectedGrowth = Math.max(1, ...selectedRows.map((r) => r.avgGrowth ?? 0));

  // Relative to the farm(s)-wide area-weighted average — the same
  // benchmark the summary number itself uses, so "performing" literally
  // means "pulling the average up" and vice versa.
  const perfColor = (g: number | null) => {
    if (g == null || data?.avgGrowth == null) return COLORS.inkSoft;
    return g >= data.avgGrowth ? COLORS.normal : COLORS.flagged;
  };

  return (
    <div className="screen">
      <Header title="Camp growth comparison" backHref="/farm/reports" />

      <div className="tabs">
        <button className={`tab${farmId === "all" ? " active" : ""}`} onClick={() => setFarmId("all")}>All farms</button>
        {farms.map((f) => (
          <button key={f.id} className={`tab${farmId === f.id ? " active" : ""}`} onClick={() => setFarmId(f.id)}>{f.name}</button>
        ))}
      </div>

      <div className="add-item-bar" style={{ flexWrap: "wrap" }}>
        <span className="field-label" style={{ width: "100%" }}>Period</span>
        <input className="field-input small" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        <span>to</span>
        <input className="field-input small" type="date" value={to} max={todayStr()} onChange={(e) => setTo(e.target.value)} />
      </div>

      {loading || !data ? (
        <Spinner />
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          <p className="field-hint" style={{ padding: "12px 18px 0" }}>
            Average growth is corrected for grazing in between walks (same as the wedge), from each camp&apos;s first walk on/after {from} to its last on/before {to}.
            Tick camps below to compare them directly.
          </p>

          <div className="holistic-summary" style={{ padding: "10px 18px" }}>
            <div><span className="num">{data.avgGrowth ?? "—"}</span><span className="lbl">area-weighted avg kg DM/ha/day</span></div>
            <div><span className="num">{rows.length}</span><span className="lbl">camps</span></div>
          </div>

          {selectedRows.length > 0 && (
            <div className="wedge-info-box" style={{ margin: "0 18px 14px", display: "block" }}>
              <p className="field-label" style={{ marginBottom: 8 }}>Comparing {selectedRows.length} camp{selectedRows.length === 1 ? "" : "s"}</p>
              {selectedRows.map((r) => (
                <div key={r.paddockId} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 48, fontSize: 11, fontWeight: 600 }}>{r.code}</span>
                  <div style={{ flex: 1, background: COLORS.paperDeep, borderRadius: 3, height: 14, position: "relative" }}>
                    <div
                      style={{
                        width: `${Math.max(0, Math.min(100, ((r.avgGrowth ?? 0) / maxSelectedGrowth) * 100))}%`,
                        background: perfColor(r.avgGrowth),
                        height: "100%",
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <span style={{ width: 60, fontSize: 11, textAlign: "right", fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>
                    {r.avgGrowth ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="maize-sheet-scroll" style={{ padding: "0 18px 18px" }}>
            <table className="maize-sheet-table">
              <thead>
                <tr>
                  <th className="maize-sheet-sticky">Compare</th>
                  <th>Camp</th>
                  <th>Farm</th>
                  <th>Walks</th>
                  <th>Start cover</th>
                  <th>End cover</th>
                  <th>Avg growth kg DM/ha/day</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.paddockId} onClick={() => toggleSelected(r.paddockId)} style={{ cursor: "pointer" }}>
                    <td className="maize-sheet-sticky">
                      <input type="checkbox" checked={selected.has(r.paddockId)} onChange={() => toggleSelected(r.paddockId)} onClick={(e) => e.stopPropagation()} />
                    </td>
                    <td><strong>{r.code}</strong></td>
                    <td>{r.farmName}</td>
                    <td>{r.walkCount}</td>
                    <td>{r.startCover ?? "—"}</td>
                    <td>{r.endCover ?? "—"}</td>
                    <td style={{ color: perfColor(r.avgGrowth), fontWeight: 600 }}>
                      {r.avgGrowth ?? (r.walkCount < 2 ? "Not enough walks" : "—")}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: "center" }}>No camps match this filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
