"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { X, Footprints, ChevronRight, Printer } from "lucide-react";
import {
  BarChart, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Cell, ReferenceLine,
} from "recharts";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { todayStr } from "@/lib/utils";
import { COLORS } from "@/lib/constants";
import type { WedgeFarm, WedgePaddock } from "@/lib/types";

type Row = WedgePaddock & { trend: number };

// A4 landscape usable width at 96dpi, minus default browser print margins —
// keeps the wedge to one page wide regardless of how many paddocks there are.
const PRINT_CHART_WIDTH = 950;

function WedgeCharts({
  width,
  sorted,
  avgMulch,
  onBarClick,
  selectedId,
}: {
  width: number;
  sorted: Row[];
  avgMulch: number | null;
  onBarClick?: (row: Row) => void;
  selectedId?: string;
}) {
  return (
    <>
      <ComposedChart width={width} height={190} data={sorted} margin={{ top: 14, right: 4, left: 0, bottom: 0 }}>
        <YAxis width={38} tick={{ fontSize: 9, fill: COLORS.inkSoft }} label={{ value: "Cover kg DM/ha", angle: -90, position: "insideLeft", fontSize: 9, fill: COLORS.inkSoft }} />
        <Tooltip
          formatter={(v: number) => [v, "Cover"]}
          labelFormatter={(code) => code}
          contentStyle={{ fontSize: 11, background: COLORS.card, border: `1px solid ${COLORS.paperDeep}` }}
        />
        <Bar dataKey="cover" onClick={onBarClick ? (d) => onBarClick(d as unknown as Row) : undefined} cursor={onBarClick ? "pointer" : undefined}>
          {sorted.map((p) => (
            <Cell key={p.id} fill={!p.hasData ? COLORS.flagged : COLORS.normal} opacity={selectedId === p.id ? 1 : 0.92} />
          ))}
        </Bar>
        <Line type="linear" dataKey="trend" stroke={COLORS.trend} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </ComposedChart>

      <div className="wedge-axis-labels" style={{ width }}>
        {sorted.map((p) => (
          <div
            key={p.id}
            className={`wedge-axis-label${!p.hasData ? " flagged" : ""}${selectedId === p.id ? " selected" : ""}`}
            style={{ width: width / sorted.length }}
            onClick={onBarClick ? () => onBarClick(p) : undefined}
          >
            {p.code}
          </div>
        ))}
      </div>

      <BarChart width={width} height={120} data={sorted} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
        <YAxis width={38} reversed tick={{ fontSize: 9, fill: COLORS.inkSoft }} label={{ value: "Days since mulched", angle: -90, position: "insideLeft", fontSize: 9, fill: COLORS.inkSoft }} />
        <Tooltip
          formatter={(v) => [v == null ? "Never logged" : `${v} days`, "Since mulched"]}
          labelFormatter={(code) => code}
          contentStyle={{ fontSize: 11, background: COLORS.card, border: `1px solid ${COLORS.paperDeep}` }}
        />
        {avgMulch != null && (
          <ReferenceLine y={avgMulch} stroke="#B5533C" strokeDasharray="4 3" label={{ value: `Avg ${avgMulch}d`, position: "insideBottomRight", fontSize: 9, fill: "#B5533C" }} />
        )}
        <Bar dataKey="mulchDays" onClick={onBarClick ? (d) => onBarClick(d as unknown as Row) : undefined} cursor={onBarClick ? "pointer" : undefined} fill={COLORS.mulch} radius={[0, 0, 2, 2]} />
      </BarChart>
    </>
  );
}

export default function FarmWedgePage() {
  const { data, loading, error } = useApi<{ farms: WedgeFarm[] }>("/api/wedge");
  const farms = data?.farms ?? [];
  const [activeFarmId, setActiveFarmId] = useState<string | "all">("all");
  const [selected, setSelected] = useState<Row | null>(null);

  const current = activeFarmId === "all" ? null : farms.find((f) => f.id === activeFarmId) ?? null;

  // The API's own paddockCount/noDataCount/avgCover/avgGrowth cover every
  // land type (the farm map reads those same fields, so they must stay
  // unfiltered) — the wedge only cares about Rye grass, so its summary
  // numbers are recomputed here from the Rye grass subset only.
  const farmsWithStats = useMemo(
    () =>
      farms.map((f) => {
        const rye = f.paddocks.filter((p) => p.landType === "Rye grass");
        const withData = rye.filter((p) => p.hasData);
        const avgCover = withData.length
          ? Math.round(withData.reduce((s, p) => s + (p.cover ?? 0), 0) / withData.length)
          : null;
        const withGrowth = rye.filter((p) => p.growthPerDay != null);
        const avgGrowth = withGrowth.length
          ? Math.round((withGrowth.reduce((s, p) => s + (p.growthPerDay ?? 0), 0) / withGrowth.length) * 10) / 10
          : null;
        return { farm: f, stats: { paddockCount: rye.length, noDataCount: rye.length - withData.length, avgCover, avgGrowth } };
      }),
    [farms]
  );
  const currentStats = farmsWithStats.find((x) => x.farm.id === current?.id)?.stats ?? null;

  const totalPaddocks = farmsWithStats.reduce((s, x) => s + x.stats.paddockCount, 0);
  const totalNoData = farmsWithStats.reduce((s, x) => s + x.stats.noDataCount, 0);
  const withCoverFarms = farmsWithStats.filter((x) => x.stats.avgCover != null);
  const combinedCover = withCoverFarms.length
    ? Math.round(withCoverFarms.reduce((s, x) => s + (x.stats.avgCover ?? 0) * x.stats.paddockCount, 0) / withCoverFarms.reduce((s, x) => s + x.stats.paddockCount, 0))
    : null;
  const withGrowthFarms = farmsWithStats.filter((x) => x.stats.avgGrowth != null);
  const combinedGrowth = withGrowthFarms.length
    ? (withGrowthFarms.reduce((s, x) => s + (x.stats.avgGrowth ?? 0) * x.stats.paddockCount, 0) / withGrowthFarms.reduce((s, x) => s + x.stats.paddockCount, 0)).toFixed(1)
    : null;

  // Sorted ascending by cover — tallest grass on the right, like the real
  // wedge exports. No-data paddocks can't be height-sorted, so they sit at
  // the left edge. Only Rye grass camps go on the wedge — the API returns
  // every paddock (the map needs the rest), so filter down to it here.
  const sorted: Row[] = useMemo(() => {
    if (!current) return [];
    const wedgePaddocks = current.paddocks.filter((p) => p.landType === "Rye grass");
    const withData = wedgePaddocks.filter((p) => p.hasData).sort((a, b) => (a.cover ?? 0) - (b.cover ?? 0));
    const noData = wedgePaddocks.filter((p) => !p.hasData);
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

      <div className="tabs no-print">
        <button className={`tab${activeFarmId === "all" ? " active" : ""}`} onClick={() => { setActiveFarmId("all"); setSelected(null); }}>All farms</button>
        {farms.map((f) => (
          <button key={f.id} className={`tab${activeFarmId === f.id ? " active" : ""}`} onClick={() => { setActiveFarmId(f.id); setSelected(null); }}>{f.name}</button>
        ))}
      </div>

      {activeFarmId === "all" && (
        <div className="all-farms no-print">
          <div className="holistic-summary">
            <div><span className="num">{combinedCover ?? "—"}</span><span className="lbl">avg cover (kg DM/ha)</span></div>
            <div><span className="num">{combinedGrowth ?? "—"}</span><span className="lbl">avg growth (kg DM/ha/day)</span></div>
            <div><span className="num">{totalPaddocks}</span><span className="lbl">paddocks total</span></div>
            <div><span className="num">{totalNoData}</span><span className="lbl">no data yet</span></div>
          </div>
          <div className="farm-cards">
            {farmsWithStats.map(({ farm: f, stats }) => (
              <button key={f.id} className="farm-card" onClick={() => setActiveFarmId(f.id)}>
                <div className="fc-top"><span className="fc-name">{f.name}</span><ChevronRight size={16} /></div>
                <div className="fc-stats">
                  <div><span className="num">{stats.avgCover ?? "—"}</span><span className="lbl">avg cover</span></div>
                  <div><span className="num">{stats.avgGrowth ?? "—"}</span><span className="lbl">avg growth</span></div>
                  <div><span className="num">{stats.paddockCount}</span><span className="lbl">paddocks</span></div>
                  <div><span className="num" style={{ color: stats.noDataCount ? COLORS.flagged : "var(--ink)" }}>{stats.noDataCount}</span><span className="lbl">no data</span></div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {current && (
        <div className="farm-detail">
          <div className="wedge-header-row no-print">
            <span />
            <button className="link-btn" onClick={() => window.print()}>
              <Printer size={14} style={{ verticalAlign: "-2px" }} /> Print
            </button>
          </div>

          <div className="wedge-info-box">
            <div><span className="wib-k">Avg cover</span><span className="wib-v">{currentStats?.avgCover ?? "—"}</span></div>
            <div><span className="wib-k">Avg growth</span><span className="wib-v">{currentStats?.avgGrowth ?? "—"}</span></div>
            <div><span className="wib-k">Paddocks</span><span className="wib-v">{currentStats?.paddockCount ?? 0}</span></div>
            <div><span className="wib-k">No data</span><span className="wib-v">{currentStats?.noDataCount ?? 0}</span></div>
          </div>

          <div className="wedge-legend">
            <div><span className="wedge-swatch" style={{ background: COLORS.normal }} />Cover</div>
            <div><span className="wedge-swatch" style={{ background: COLORS.flagged }} />No data</div>
            <div><span className="wedge-swatch line" />Trend</div>
          </div>

          {sorted.every((p) => !p.hasData) ? (
            <p className="ds-note">No pasture walks recorded yet for {current.name} — enter one from Data entry to see the wedge.</p>
          ) : (
            <>
              <div className="wedge-chart-scroll no-print">
                <div style={{ width: chartWidth }}>
                  <WedgeCharts width={chartWidth} sorted={sorted} avgMulch={avgMulch} onBarClick={setSelected} selectedId={selected?.id} />
                </div>
              </div>

              <div className="print-only wedge-print">
                <p className="timebook-title-print">{current.name} — Farm wedge — {todayStr()}</p>
                <div style={{ width: PRINT_CHART_WIDTH }}>
                  <WedgeCharts width={PRINT_CHART_WIDTH} sorted={sorted} avgMulch={avgMulch} />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {selected && (
        <div className="detail-sheet no-print">
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
