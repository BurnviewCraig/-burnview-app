"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from "recharts";
import { COLORS } from "@/lib/constants";
import { withinRange } from "@/lib/utils";
import type { TrendPoint } from "@/components/TrendChart";

// A handful of visually distinct lines for comparing several meters at
// once — cycles if more series are selected than colors.
const SERIES_COLORS = ["#2E6F95", "#C0392B", "#5B3A73", "#3F6B3F", "#D9A916", "#8C2F39", "#5C7C87", "#B85A0A"];

export type TrendSeries = { key: string; label: string; points: TrendPoint[] };

// Same shape as TrendChart but draws one line per series, merged onto a
// shared set of x-axis dates (the union of every series' dates) so lines
// starting at different times still line up correctly on the same axis.
export function MultiTrendChart<R extends string>({
  series,
  range,
  onRangeChange,
  ranges,
  unit,
  yLabel,
  height = 220,
  title,
}: {
  series: TrendSeries[];
  range: R;
  onRangeChange: (r: R) => void;
  ranges: readonly { id: R; label: string }[];
  unit: string;
  yLabel: string;
  height?: number;
  title?: string;
}) {
  const filteredSeries = series.map((s) => ({
    ...s,
    points: s.points.filter((p) => withinRange(p.date, range)),
  }));
  const dates = [...new Set(filteredSeries.flatMap((s) => s.points.map((p) => p.date)))].sort();
  const data = dates.map((date) => {
    const row: Record<string, string | number | null> = { date };
    filteredSeries.forEach((s) => {
      row[s.key] = s.points.find((p) => p.date === date)?.value ?? null;
    });
    return row;
  });
  const tickInterval = Math.max(0, Math.ceil(data.length / 8) - 1);

  return (
    <div className="chart-card">
      <h3 className="chart-card-title">{title ?? yLabel}</h3>
      <div className="chip-wrap" style={{ marginBottom: 8 }}>
        {ranges.map((r) => (
          <button key={r.id} className={`range-chip${range === r.id ? " on" : ""}`} onClick={() => onRangeChange(r.id)}>
            {r.label}
          </button>
        ))}
      </div>
      {series.length === 0 ? (
        <p className="ds-note">Select one or more meters above to compare.</p>
      ) : data.length === 0 ? (
        <p className="ds-note">No data in this range yet.</p>
      ) : (
        <div style={{ width: "100%", height }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.paperDeep} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: COLORS.inkSoft }} tickFormatter={(d: string) => d.slice(0, 7)} interval={tickInterval} />
              <YAxis width={40} tick={{ fontSize: 9, fill: COLORS.inkSoft }} />
              <Tooltip
                formatter={(v: number, name: string) => [`${v}${unit}`, name]}
                contentStyle={{ fontSize: 11, background: COLORS.card, border: `1px solid ${COLORS.paperDeep}` }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {filteredSeries.map((s, i) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeWidth={1.75}
                  dot={{ r: 2 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
