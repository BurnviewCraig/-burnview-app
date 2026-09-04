"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { X, Footprints, ChevronRight } from "lucide-react";
import {
  BarChart, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Cell, ReferenceLine,
} from "recharts";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { COLORS } from "@/lib/constants";
import type { WedgeFarm, WedgePaddock } from "@/lib/types";

type Row = WedgePaddock & { trend: number };

export default function FarmWedgePage() {
  const { data, loading, error } = useApi<{ farms: WedgeFarm[] }>("/api/wedge");
  const farms = data?.farms ?? [];
  const [activeFarmId, setActiveFarmId] = useState<string | "all">("all");
  const [selected, setSelected] = useState<Row | null>(null);

  const current = activeFarmId === "all" ? null : farms.find((f) => f.id === activeFarmId) ?? null;

  const totalPaddocks = farms.reduce((s, f) => s + f.paddockCount, 0);
  const totalNoData = farms.reduce((s, f) => s + f.noDataCount, 0);
  const withCoverFarms = farms.filter((f) => f.avgCover != null);
  const combinedCover = withCoverFarms.length
    ? Math.round(withCoverFarms.reduce((s, f) => s + (f.avgCover ?? 0) * f.paddockCount, 0) / withCoverFarms.reduce((s, f) => s + f.paddockCount, 0))
    : null;
  const withGrowthFarms = farms.filter((f) => f.avgGrowth != null);
  const combinedGrowth = withGrowthFarms.length
    ? (withGrowthFarms.reduce((s, f) => s + (f.avgGrowth ?? 0) * f.paddockCount, 0) / withGrowthFarms.reduce((s, f) => s + f.paddockCount, 0)).toFixed(1)
    : null;

  // Sorted ascending by cover — tallest grass on the right, like the real
  // wedge exports. No-data paddocks can't be height-sorted, so they sit at
  // the left edge.
  const sorted: Row[] = useMemo(() => {
    if (!current) return [];
    const withData = current.paddocks.filter((p) => p.hasData).sort((a, b) => (a.cover ?? 0) - (b.cover ?? 0));
    const noData = current.paddocks.filter((p) => !p.hasData);
    const combined = [...noData, ...withData];

    const covPoints = combined.map((p, i) => ({ x: i, y: p.cover })).filter((pt) => pt.y != null) as { x: number; y: number }[];
    const n = covPoints.length;
    const sumX = covPoints.reduce((s, p) => s + p.x, 0);
    const sumY = covPoints.reduce((s, p) => s + p.y, 0);
    const sumXY = covPoints.reduce((s, p) => s + p.x * p.y, 0);
    const sumXX = covPoints.reduce((s, p) => s + p.x * p.x, 0);
    const denom = n * sumXX - sumX * sumX || 1;
    const slope = n ? (n * sumXY - sumX * sumY) / denom : 0;
    const intercept = n ? (sumY - slope * sumX) / n : 0;

    return combined.map((p, i) => ({ ...p, trend: Math.max(0, Math.round(intercept + slope * i)) }));
  }, [current]);

  const avgMulch = useMemo(() => {
    const withMulch = sorted.filter((p) => p.mulchDays != null);
    if (!withMulch.length) return null;
    return Math.round(withMulch.reduce((s, p) => s + (p.mulchDays ?? 0), 0) / withMulch.length);
  }, [sorted]);

  const chartWidth = current ? Math.max(420, sorted.length * 13) : 420;

  if (loading) return <div className="screen"><Header title="Farm wedge" backHref="/food" /><Spinner /></div>;
  if (error) return <div className="screen"><Header title="Farm wedge" backHref="/food" /><div className="empty">{error}</div></div>;

  return (
    <div className="screen">
      <Header
        title="Farm wedge"
        backHref="/food"
        action={
          <Link className="hdr-action" href="/food/data-entry">
            <Footprints size={14} strokeWidth={2} />Data entry
          </Link>
        }
      />

      <div className="tabs">
        <button className={`tab${activeFarmId === "all" ? " active" : ""}`} onClick={() => { setActiveFarmId("all"); setSelected(null); }}>All farms</button>
        {farms.map((f) => (
          <button key={f.id} className={`tab${activeFarmId === f.id ? " active" : ""}`} onClick={() => { setActiveFarmId(f.id); setSelected(null); }}>{f.name}</button>
        ))}
      </div>

      {activeFarmId === "all" && (
        <div className="all-farms">
          <div className="holistic-summary">
            <div><span className="num">{combinedCover ?? "—"}</span><span className="lbl">avg cover (kg DM/ha)</span></div>
            <div><span className="num">{combinedGrowth ?? "—"}</span><span className="lbl">avg growth (kg DM/ha/day)</span></div>
            <div><span className="num">{totalPaddocks}</span><span className="lbl">paddocks total</span></div>
            <div><span className="num">{totalNoData}</span><span className="lbl">no data yet</span></div>
          </div>
          <div className="farm-cards">
            {farms.map((f) => (
              <button key={f.id} className="farm-card" onClick={() => setActiveFarmId(f.id)}>
                <div className="fc-top"><span className="fc-name">{f.name}</span><ChevronRight size={16} /></div>
                <div className="fc-stats">
                  <div><span className="num">{f.avgCover ?? "—"}</span><span className="lbl">avg cover</span></div>
                  <div><span className="num">{f.avgGrowth ?? "—"}</span><span className="lbl">avg growth</span></div>
                  <div><span className="num">{f.paddockCount}</span><span className="lbl">paddocks</span></div>
                  <div><span className="num" style={{ color: f.noDataCount ? COLORS.flagged : "var(--ink)" }}>{f.noDataCount}</span><span className="lbl">no data</span></div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {current && (
        <div className="farm-detail">
          <div className="wedge-info-box">
            <div><span className="wib-k">Avg cover</span><span className="wib-v">{current.avgCover ?? "—"}</span></div>
            <div><span className="wib-k">Avg growth</span><span className="wib-v">{current.avgGrowth ?? "—"}</span></div>
            <div><span className="wib-k">Paddocks</span><span className="wib-v">{current.paddockCount}</span></div>
            <div><span className="wib-k">No data</span><span className="wib-v">{current.noDataCount}</span></div>
          </div>

          <div className="wedge-legend">
            <div><span className="wedge-swatch" style={{ background: COLORS.normal }} />Cover</div>
            <div><span className="wedge-swatch" style={{ background: COLORS.flagged }} />No data</div>
            <div><span className="wedge-swatch line" />Trend</div>
          </div>

          {sorted.every((p) => !p.hasData) ? (
            <p className="ds-note">No pasture walks recorded yet for {current.name} — enter one from Data entry to see the wedge.</p>
          ) : (
            <div className="wedge-chart-scroll">
              <div style={{ width: chartWidth }}>
                <ComposedChart width={chartWidth} height={190} data={sorted} margin={{ top: 14, right: 4, left: 0, bottom: 0 }}>
                  <YAxis width={38} tick={{ fontSize: 9, fill: COLORS.inkSoft }} label={{ value: "Cover kg DM/ha", angle: -90, position: "insideLeft", fontSize: 9, fill: COLORS.inkSoft }} />
                  <Tooltip
                    formatter={(v: number) => [v, "Cover"]}
                    labelFormatter={(code) => code}
                    contentStyle={{ fontSize: 11, background: COLORS.card, border: `1px solid ${COLORS.paperDeep}` }}
                  />
                  <Bar dataKey="cover" onClick={(d) => setSelected(d as unknown as Row)} cursor="pointer">
                    {sorted.map((p) => (
                      <Cell key={p.id} fill={!p.hasData ? COLORS.flagged : COLORS.normal} opacity={selected?.id === p.id ? 1 : 0.92} />
                    ))}
                  </Bar>
                  <Line type="linear" dataKey="trend" stroke={COLORS.trend} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </ComposedChart>

                <div className="wedge-axis-labels" style={{ width: chartWidth }}>
                  {sorted.map((p) => (
                    <div
                      key={p.id}
                      className={`wedge-axis-label${!p.hasData ? " flagged" : ""}${selected?.id === p.id ? " selected" : ""}`}
                      style={{ width: chartWidth / sorted.length }}
                      onClick={() => setSelected(p)}
                    >
                      {p.code}
                    </div>
                  ))}
                </div>

                <BarChart width={chartWidth} height={120} data={sorted} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
                  <YAxis width={38} reversed tick={{ fontSize: 9, fill: COLORS.inkSoft }} label={{ value: "Days since mulched", angle: -90, position: "insideLeft", fontSize: 9, fill: COLORS.inkSoft }} />
                  <Tooltip
                    formatter={(v) => [v == null ? "Never logged" : `${v} days`, "Since mulched"]}
                    labelFormatter={(code) => code}
                    contentStyle={{ fontSize: 11, background: COLORS.card, border: `1px solid ${COLORS.paperDeep}` }}
                  />
                  {avgMulch != null && (
                    <ReferenceLine y={avgMulch} stroke="#B5533C" strokeDasharray="4 3" label={{ value: `Avg ${avgMulch}d`, position: "insideBottomRight", fontSize: 9, fill: "#B5533C" }} />
                  )}
                  <Bar dataKey="mulchDays" onClick={(d) => setSelected(d as unknown as Row)} cursor="pointer" fill={COLORS.mulch} radius={[0, 0, 2, 2]} />
                </BarChart>
              </div>
            </div>
          )}
        </div>
      )}

      {selected && (
        <div className="detail-sheet">
          <div className="ds-head">
            <div>
              <h2>{current?.name} — {selected.code}</h2>
              {!selected.hasData ? (
                <span className="pill flagged">No data</span>
              ) : (
                <span className="pill">In rotation</span>
              )}
            </div>
            <button className="close" onClick={() => setSelected(null)}><X size={18} /></button>
          </div>
          {selected.hasData ? (
            <div className="ds-grid">
              <div><div className="k">Cover</div><div className="v">{selected.cover} kg DM/ha</div></div>
              <div><div className="k">Growth</div><div className="v">{selected.growthPerDay != null ? `${selected.growthPerDay.toFixed(1)} kg DM/ha/day` : "Not enough data yet"}</div></div>
              <div><div className="k">Last walked</div><div className="v">{selected.walkDate}</div></div>
              <div><div className="k">Mulched</div><div className="v">{selected.mulchDays != null ? `${selected.mulchDays} days ago` : "Never logged"}</div></div>
            </div>
          ) : (
            <p className="ds-note">No pasture walk recorded for this paddock yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
