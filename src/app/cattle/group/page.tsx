"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { TrendChart, type ChartRange } from "@/components/TrendChart";
import { useApi } from "@/lib/useApi";
import { todayStr } from "@/lib/utils";
import { addDays } from "@/lib/calendarFormat";
import type { CattleGroup, CattleCountEntry, GrazingAllocation, MilkProductionEntry, GroupFeedEntry, GroupWeightEntry } from "@/lib/types";

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function monthKeyOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function pctChange(curr: number | null, base: number | null) {
  if (curr == null || base == null || base === 0) return null;
  return Math.round(((curr - base) / base) * 100);
}

type GridRow = {
  date: string;
  count: number | null;
  milk: number | null;
  rollingAvg: number | null;
  weightKg: number | null;
  grazing: string;
  dairyMealKg: number | null;
  otherName: string | null;
  otherKg: number | null;
  silageKg: number | null;
};

function GroupPageContent() {
  const params = useSearchParams();
  const groupId = params.get("id");

  const { data: groupData, loading, refetch: refetchGroup } = useApi<{ group: CattleGroup }>(
    groupId ? `/api/cattle-groups/${groupId}` : null
  );
  const group = groupData?.group ?? null;

  const [milkRange, setMilkRange] = useState<ChartRange>("1m");
  const [weightRange, setWeightRange] = useState<ChartRange>("1m");
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [histFrom, setHistFrom] = useState(addDays(todayStr(), -30));
  const [histTo, setHistTo] = useState(todayStr());
  const [editDate, setEditDate] = useState<string | null>(null);

  const { data: countsData, refetch: refetchCounts } = useApi<{ counts: CattleCountEntry[] }>(
    groupId ? `/api/cattle-counts?groupId=${groupId}` : null
  );
  const counts = countsData?.counts ?? [];
  const { data: allocData } = useApi<{ allocations: GrazingAllocation[] }>(
    groupId ? `/api/grazing-allocations?groupId=${groupId}` : null
  );
  const allocations = allocData?.allocations ?? [];
  const { data: milkData, refetch: refetchMilk } = useApi<{ entries: MilkProductionEntry[] }>(
    groupId ? `/api/milk-production?groupId=${groupId}` : null
  );
  const milkEntries = milkData?.entries ?? [];
  const { data: feedData, refetch: refetchFeed } = useApi<{ entries: GroupFeedEntry[] }>(
    groupId ? `/api/group-feed?groupId=${groupId}` : null
  );
  const feedEntries = feedData?.entries ?? [];
  const { data: weightData, refetch: refetchWeight } = useApi<{ entries: GroupWeightEntry[] }>(
    groupId ? `/api/group-weights?groupId=${groupId}` : null
  );
  const weightEntries = weightData?.entries ?? [];

  const milkPoints = useMemo(() => milkEntries.map((m) => ({ date: m.date.slice(0, 10), value: m.litresPerCow })), [milkEntries]);
  const weightPoints = useMemo(() => weightEntries.map((w) => ({ date: w.date.slice(0, 10), value: w.avgWeightKg })), [weightEntries]);

  const milkComparison = useMemo(() => {
    const avgForMonth = (key: string) => {
      const rows = milkEntries.filter((m) => m.date.slice(0, 7) === key);
      return rows.length ? round1(rows.reduce((s, m) => s + m.litresPerCow, 0) / rows.length) : null;
    };
    const now = new Date();
    const thisMonth = avgForMonth(monthKeyOf(now));
    const lastMonth = avgForMonth(monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
    const sameMonthLastYear = avgForMonth(`${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    return { thisMonth, lastMonth, sameMonthLastYear };
  }, [milkEntries]);

  const countByDate = useMemo(() => new Map(counts.map((c) => [c.date.slice(0, 10), c])), [counts]);
  const milkByDate = useMemo(() => new Map(milkEntries.map((m) => [m.date.slice(0, 10), m])), [milkEntries]);
  const feedByDate = useMemo(() => new Map(feedEntries.map((f) => [f.date.slice(0, 10), f])), [feedEntries]);
  const weightByDate = useMemo(() => new Map(weightEntries.map((w) => [w.date.slice(0, 10), w])), [weightEntries]);
  const allocByDate = useMemo(() => {
    const map = new Map<string, GrazingAllocation[]>();
    allocations.forEach((a) => {
      const d = a.date.slice(0, 10);
      map.set(d, [...(map.get(d) ?? []), a]);
    });
    return map;
  }, [allocations]);

  const grazingLabel = (d: string) => {
    const rows = allocByDate.get(d);
    if (!rows || !rows.length) return "—";
    const day = rows.find((r) => r.session === "DAY");
    const night = rows.find((r) => r.session === "NIGHT");
    if (day && night && day.paddock.code === night.paddock.code) return `${day.paddock.code} Day, Night`;
    const parts: string[] = [];
    if (day) parts.push(`${day.paddock.code} Day`);
    if (night) parts.push(`${night.paddock.code} Night`);
    return parts.join(", ") || "—";
  };

  // Trailing 10-day average as of a given date, so the grid shows where
  // the group's yield trend sits on every single row, not just the latest.
  const rollingAvgFor = (date: string) => {
    let sum = 0;
    let n = 0;
    let d = date;
    for (let i = 0; i < 10; i++) {
      const m = milkByDate.get(d);
      if (m) { sum += m.litresPerCow; n++; }
      d = addDays(d, -1);
    }
    return n ? round1(sum / n) : null;
  };

  const buildRows = (from: string, to: string): GridRow[] => {
    const rows: GridRow[] = [];
    let d = to;
    let guard = 0;
    while (d >= from && guard < 1000) {
      const c = countByDate.get(d);
      const m = milkByDate.get(d);
      const f = feedByDate.get(d);
      const w = weightByDate.get(d);
      rows.push({
        date: d,
        count: c?.count ?? null,
        milk: m?.litresPerCow ?? null,
        rollingAvg: rollingAvgFor(d),
        weightKg: w?.avgWeightKg ?? null,
        grazing: grazingLabel(d),
        dairyMealKg: f?.dairyMealKg ?? null,
        otherName: f?.otherConcentrateName ?? null,
        otherKg: f?.otherConcentrateKg ?? null,
        silageKg: f?.silageKg ?? null,
      });
      d = addDays(d, -1);
      guard++;
    }
    return rows;
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const last10 = useMemo(() => buildRows(addDays(todayStr(), -9), todayStr()), [countByDate, milkByDate, feedByDate, weightByDate, allocByDate]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fullHistoryRows = useMemo(() => (showFullHistory ? buildRows(histFrom, histTo) : []), [showFullHistory, histFrom, histTo, countByDate, milkByDate, feedByDate, weightByDate, allocByDate]);

  const editRow = useMemo(() => {
    if (!editDate) return null;
    const c = countByDate.get(editDate);
    const m = milkByDate.get(editDate);
    const f = feedByDate.get(editDate);
    const w = weightByDate.get(editDate);
    return {
      count: c?.count ?? null,
      milk: m?.litresPerCow ?? null,
      weightKg: w?.avgWeightKg ?? null,
      dairyMealKg: f?.dairyMealKg ?? null,
      otherName: f?.otherConcentrateName ?? null,
      otherKg: f?.otherConcentrateKg ?? null,
      silageKg: f?.silageKg ?? null,
    };
  }, [editDate, countByDate, milkByDate, feedByDate, weightByDate]);

  if (loading) return <div className="screen"><Header title="Group" backHref="/cattle" /><Spinner /></div>;
  if (!group) return <div className="screen"><Header title="Group" backHref="/cattle" /><div className="empty">Group not found.</div></div>;

  const renderTable = (rows: GridRow[]) => (
    <div className="grazing-table-scroll">
      <table className="grazing-table cattle-history-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Numbers</th>
            <th>Yield</th>
            <th>10d avg</th>
            <th>Weight</th>
            <th>Grazing</th>
            <th>Dairy meal</th>
            <th>Other conc.</th>
            <th>Silage</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.date} className="diesel-row-clickable" onClick={() => setEditDate(r.date)}>
              <td>{r.date}</td>
              <td>{r.count ?? "—"}</td>
              <td>{r.milk ?? "—"}{r.milk != null ? " L/cow" : ""}</td>
              <td>{r.rollingAvg ?? "—"}{r.rollingAvg != null ? " L/cow" : ""}</td>
              <td>{r.weightKg ?? "—"}{r.weightKg != null ? "kg" : ""}</td>
              <td>{r.grazing}</td>
              <td>{r.dairyMealKg ?? "—"}{r.dairyMealKg != null ? "kg" : ""}</td>
              <td>{r.otherKg != null ? `${r.otherKg}kg${r.otherName ? ` (${r.otherName})` : ""}` : "—"}</td>
              <td>{r.silageKg ?? "—"}{r.silageKg != null ? "kg" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="screen">
      <Header title={`${group.farmName} — Group ${group.name}`} backHref="/cattle" />

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={{ padding: "12px 18px 0" }}>
          <TrendChart points={milkPoints} range={milkRange} onRangeChange={setMilkRange} unit=" L/cow" yLabel="Litres per cow" height={260} />
        </div>

        <div style={{ padding: "12px 18px 0" }}>
          <TrendChart points={weightPoints} range={weightRange} onRangeChange={setWeightRange} unit="kg" yLabel="Average weight" height={260} />
        </div>

        <p className="field-hint" style={{ padding: "8px 18px 0" }}>Tap a row to add or correct that day&apos;s numbers.</p>
        {renderTable(last10)}

        <div style={{ padding: "8px 18px" }}>
          <button className="link-btn" onClick={() => setShowFullHistory((v) => !v)}>
            {showFullHistory ? "Hide full history" : "View full history"}
          </button>
        </div>

        {showFullHistory && (
          <>
            <div className="add-item-bar" style={{ flexWrap: "wrap" }}>
              <span className="field-label" style={{ width: "100%" }}>Date range</span>
              <input className="field-input small" type="date" value={histFrom} onChange={(e) => setHistFrom(e.target.value)} />
              <span>to</span>
              <input className="field-input small" type="date" value={histTo} max={todayStr()} onChange={(e) => setHistTo(e.target.value)} />
            </div>
            {renderTable(fullHistoryRows)}
          </>
        )}

        <div className="wedge-info-box" style={{ margin: "14px 18px 18px" }}>
          <div><span className="wib-k">This month</span><span className="wib-v">{milkComparison.thisMonth ?? "—"} L/cow</span></div>
          <div>
            <span className="wib-k">Last month</span>
            <span className="wib-v">
              {milkComparison.lastMonth ?? "—"} L/cow
              {pctChange(milkComparison.thisMonth, milkComparison.lastMonth) != null && (
                <> ({pctChange(milkComparison.thisMonth, milkComparison.lastMonth)! > 0 ? "+" : ""}{pctChange(milkComparison.thisMonth, milkComparison.lastMonth)}%)</>
              )}
            </span>
          </div>
          <div>
            <span className="wib-k">Same month last yr</span>
            <span className="wib-v">
              {milkComparison.sameMonthLastYear ?? "—"} L/cow
              {pctChange(milkComparison.thisMonth, milkComparison.sameMonthLastYear) != null && (
                <> ({pctChange(milkComparison.thisMonth, milkComparison.sameMonthLastYear)! > 0 ? "+" : ""}{pctChange(milkComparison.thisMonth, milkComparison.sameMonthLastYear)}%)</>
              )}
            </span>
          </div>
        </div>
      </div>

      {editDate && groupId && (
        <DayEditSheet
          groupId={groupId}
          date={editDate}
          initial={editRow}
          onClose={() => setEditDate(null)}
          onSaved={() => {
            setEditDate(null);
            refetchGroup();
            refetchCounts();
            refetchMilk();
            refetchFeed();
            refetchWeight();
          }}
        />
      )}
    </div>
  );
}

function DayEditSheet({
  groupId,
  date,
  initial,
  onClose,
  onSaved,
}: {
  groupId: string;
  date: string;
  initial: {
    count: number | null;
    milk: number | null;
    weightKg: number | null;
    dairyMealKg: number | null;
    otherName: string | null;
    otherKg: number | null;
    silageKg: number | null;
  } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [count, setCount] = useState(initial?.count != null ? String(initial.count) : "");
  const [milk, setMilk] = useState(initial?.milk != null ? String(initial.milk) : "");
  const [weight, setWeight] = useState(initial?.weightKg != null ? String(initial.weightKg) : "");
  const [dairyMeal, setDairyMeal] = useState(initial?.dairyMealKg != null ? String(initial.dairyMealKg) : "");
  const [otherName, setOtherName] = useState(initial?.otherName ?? "");
  const [otherKg, setOtherKg] = useState(initial?.otherKg != null ? String(initial.otherKg) : "");
  const [silage, setSilage] = useState(initial?.silageKg != null ? String(initial.silageKg) : "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const requests: Promise<Response>[] = [];
    if (count !== "" && Number(count) >= 0) {
      requests.push(fetch("/api/cattle-counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, date, count: Number(count) }),
      }));
    }
    if (milk !== "" && Number(milk) >= 0) {
      requests.push(fetch("/api/milk-production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, date, litresPerCow: Number(milk) }),
      }));
    }
    if (weight !== "" && Number(weight) >= 0) {
      requests.push(fetch("/api/group-weights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, date, avgWeightKg: Number(weight) }),
      }));
    }
    if (dairyMeal !== "" || otherName !== "" || otherKg !== "" || silage !== "") {
      requests.push(fetch("/api/group-feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          date,
          dairyMealKg: dairyMeal !== "" ? Number(dairyMeal) : null,
          otherConcentrateName: otherName || null,
          otherConcentrateKg: otherKg !== "" ? Number(otherKg) : null,
          silageKg: silage !== "" ? Number(silage) : null,
        }),
      }));
    }
    await Promise.all(requests);
    setSaving(false);
    onSaved();
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="edit-entry-overlay" onClick={onClose}>
      <div className="edit-entry-panel" onClick={(e) => e.stopPropagation()}>
        <div className="keypad-header">
          <div className="stock-panel-title">
            <span className="keypad-code">{date}</span>
          </div>
          <X size={18} className="close" onClick={onClose} />
        </div>

        <div className="edit-entry-body">
          <label className="field">
            <span className="field-label">Numbers (headcount)</span>
            <input className="field-input" type="number" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} placeholder="Head" />
          </label>

          <label className="field">
            <span className="field-label">Group yield (litres per cow)</span>
            <input className="field-input" type="number" inputMode="decimal" value={milk} onChange={(e) => setMilk(e.target.value)} placeholder="L/cow" />
          </label>

          <label className="field">
            <span className="field-label">Average weight (kg)</span>
            <input className="field-input" type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="kg" />
          </label>

          <label className="field">
            <span className="field-label">Dairy meal fed (kg)</span>
            <input className="field-input" type="number" inputMode="decimal" value={dairyMeal} onChange={(e) => setDairyMeal(e.target.value)} placeholder="kg" />
          </label>

          <label className="field">
            <span className="field-label">Other concentrate</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="field-input" value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="What was fed" style={{ flex: 1 }} />
              <input className="field-input" type="number" inputMode="decimal" value={otherKg} onChange={(e) => setOtherKg(e.target.value)} placeholder="kg" style={{ width: 90 }} />
            </div>
          </label>

          <label className="field">
            <span className="field-label">Silage fed (kg)</span>
            <input className="field-input" type="number" inputMode="decimal" value={silage} onChange={(e) => setSilage(e.target.value)} placeholder="kg" />
          </label>

          <p className="field-hint">Grazing location is set from Grass &gt; Grazing allocation, not here.</p>

          <div className="edit-entry-actions" style={{ marginTop: 14 }}>
            <button className="save-btn" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function GroupPage() {
  return (
    <Suspense fallback={<div className="screen"><Header title="Group" backHref="/cattle" /><Spinner /></div>}>
      <GroupPageContent />
    </Suspense>
  );
}
