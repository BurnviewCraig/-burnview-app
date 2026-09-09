"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { COLORS, MILK_CHART_RANGES } from "@/lib/constants";
import { withinRange } from "@/lib/utils";

export type TrendPoint = { date: string; value: number };
export type ChartRange = (typeof MILK_CHART_RANGES)[number]["id"];

// Shared trend line for milk figures — sold litres per farm, litres/cow per
// group — with a 1 month / 3 months / year-to-date range selector.
export function TrendChart({
  points,
  range,
  onRangeChange,
  unit,
  yLabel,
}: {
  points: TrendPoint[];
  range: ChartRange;
  onRangeChange: (r: ChartRange) => void;
  unit: string;
  yLabel: string;
}) {
  const filtered = points.filter((p) => withinRange(p.date, range)).sort((a, b) => a.date.localeCompare(b.date));
  const tickInterval = Math.max(0, Math.ceil(filtered.length / 8) - 1);

  return (
    <div className="field">
      <div className="chip-wrap" style={{ marginBottom: 8 }}>
        {MILK_CHART_RANGES.map((r) => (
          <button key={r.id} className={`range-chip${range === r.id ? " on" : ""}`} onClick={() => onRangeChange(r.id)}>
            {r.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="ds-note">No data in this range yet.</p>
      ) : (
        <div style={{ width: "100%", height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filtered} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.paperDeep} />
              <XAxis dataKey="date" tick={{ fontSize: 9, fill: COLORS.inkSoft }} tickFormatter={(d: string) => d.slice(5)} interval={tickInterval} />
              <YAxis width={34} tick={{ fontSize: 9, fill: COLORS.inkSoft }} />
              <Tooltip
                formatter={(v: number) => [`${v}${unit}`, yLabel]}
                contentStyle={{ fontSize: 11, background: COLORS.card, border: `1px solid ${COLORS.paperDeep}` }}
              />
              <Line type="monotone" dataKey="value" stroke={COLORS.normal} strokeWidth={1.75} dot={{ r: 2 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
