"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { NUTRIENT_RANGES } from "@/lib/constants";
import type { Farm } from "@/lib/types";

type ReportRow = {
  paddockId: string;
  code: string;
  farmName: string;
  landType: string | null;
  sizeHa: number | null;
  applications: number;
  N: number;
  P: number;
  K: number;
  S: number;
};
type ReportData = {
  rows: ReportRow[];
  totals: { N: number; P: number; K: number; S: number };
  avgPerHa: { N: number; P: number; K: number; S: number };
  totalHa: number;
  excludedNoSize: number;
  unrecognizedProducts: string[];
  placeholderProducts: string[];
};

const NUTRIENTS = ["N", "P", "K", "S"] as const;
const NUTRIENT_NAME: Record<(typeof NUTRIENTS)[number], string> = {
  N: "Nitrogen", P: "Phosphorus", K: "Potassium", S: "Sulfur",
};

export default function FertilizerReportPage() {
  const { data: farmsData } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];

  const [farmId, setFarmId] = useState<string>("all");
  const [range, setRange] = useState<string>("ytd");
  const [scope, setScope] = useState<"pasture" | "all">("pasture");

  const { data, loading } = useApi<ReportData>(`/api/reports/fertilizer?farmId=${farmId}&range=${range}&scope=${scope}`);

  return (
    <div className="screen">
      <Header title="Fertilizer report" backHref="/farm/reports" />

      <div className="tabs">
        <button className={`tab${farmId === "all" ? " active" : ""}`} onClick={() => setFarmId("all")}>All farms</button>
        {farms.map((f) => (
          <button key={f.id} className={`tab${farmId === f.id ? " active" : ""}`} onClick={() => setFarmId(f.id)}>{f.name}</button>
        ))}
      </div>

      <div style={{ padding: "10px 18px 0" }}>
        <span className="field-label">Period</span>
        <div className="chip-wrap" style={{ marginTop: 4 }}>
          {NUTRIENT_RANGES.map((r) => (
            <button key={r.id} className={`range-chip${range === r.id ? " on" : ""}`} onClick={() => setRange(r.id)}>{r.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "10px 18px 0" }}>
        <span className="field-label">Fields</span>
        <div className="chip-wrap" style={{ marginTop: 4 }}>
          <button className={`range-chip${scope === "pasture" ? " on" : ""}`} onClick={() => setScope("pasture")}>Pastures (Rye grass &amp; Kikuyu)</button>
          <button className={`range-chip${scope === "all" ? " on" : ""}`} onClick={() => setScope("all")}>All fields</button>
        </div>
      </div>

      {loading || !data ? (
        <Spinner />
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          <p className="field-hint" style={{ padding: "12px 18px 0" }}>
            Average kg/ha is area-weighted across {data.rows.length - data.excludedNoSize} camp{data.rows.length - data.excludedNoSize === 1 ? "" : "s"}
            {data.excludedNoSize > 0 ? ` (${data.excludedNoSize} excluded — no size on file)` : ""}, {data.totalHa}ha total.
          </p>

          <div className="holistic-summary" style={{ padding: "10px 18px" }}>
            {NUTRIENTS.map((n) => (
              <div key={n}>
                <span className="num">{data.avgPerHa[n]}</span>
                <span className="lbl">kg {n}/ha — {NUTRIENT_NAME[n]}</span>
              </div>
            ))}
          </div>

          {(data.unrecognizedProducts.length > 0 || data.placeholderProducts.length > 0) && (
            <div className="wedge-info-box" style={{ margin: "0 18px 10px" }}>
              {data.unrecognizedProducts.length > 0 && (
                <div><span className="wib-k">Unrecognized product{data.unrecognizedProducts.length === 1 ? "" : "s"}</span><span className="wib-v">{data.unrecognizedProducts.join(", ")} — counted as 0 nutrient</span></div>
              )}
              {data.placeholderProducts.length > 0 && (
                <div><span className="wib-k">Placeholder analysis</span><span className="wib-v">{data.placeholderProducts.join(", ")} — real N/P/K/S %s not set in Settings &gt; Fertilizer yet</span></div>
              )}
            </div>
          )}

          <div className="maize-sheet-scroll" style={{ padding: "0 18px 18px" }}>
            <table className="maize-sheet-table">
              <thead>
                <tr>
                  <th className="maize-sheet-sticky">Camp</th>
                  <th>Farm</th>
                  <th>Size (ha)</th>
                  <th>Applications</th>
                  <th>N kg/ha</th>
                  <th>P kg/ha</th>
                  <th>K kg/ha</th>
                  <th>S kg/ha</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.paddockId}>
                    <td className="maize-sheet-sticky"><strong>{r.code}</strong></td>
                    <td>{r.farmName}</td>
                    <td>{r.sizeHa ?? "—"}</td>
                    <td>{r.applications}</td>
                    <td>{r.N || "—"}</td>
                    <td>{r.P || "—"}</td>
                    <td>{r.K || "—"}</td>
                    <td>{r.S || "—"}</td>
                  </tr>
                ))}
                {data.rows.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: "center" }}>No camps match this filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
