"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X, Trash2, Utensils, ChevronRight, Milk } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { TrendChart, type ChartRange } from "@/components/TrendChart";
import { useApi } from "@/lib/useApi";
import { todayStr } from "@/lib/utils";
import type { Farm, CattleGroup, CattleCountEntry, GrazingAllocation, MilkProductionEntry } from "@/lib/types";

export default function CattlePage() {
  const { data: farmsData, loading } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];
  const [farmId, setFarmId] = useState<string | null>(null);
  const farm = farms.find((f) => f.id === (farmId ?? farms[0]?.id)) ?? farms[0];

  const { data: groupsData, refetch: refetchGroups } = useApi<{ groups: CattleGroup[] }>(
    farm ? `/api/cattle-groups?farmId=${farm.id}` : null
  );
  const groups = groupsData?.groups ?? [];

  const [activeGroup, setActiveGroup] = useState<CattleGroup | null>(null);

  const switchFarm = (id: string) => {
    setFarmId(id);
    setActiveGroup(null);
  };

  if (loading) return <div className="screen"><Header title="Cattle" backHref="/" /><Spinner /></div>;
  if (!farm) return <div className="screen"><Header title="Cattle" backHref="/" /><div className="empty">No farms found.</div></div>;

  return (
    <div className="screen">
      <Header title="Cattle" backHref="/" />

      <div style={{ flexShrink: 0 }}>
        <Link className="menu-row" href="/feeding">
          <Utensils size={18} strokeWidth={1.75} />
          <div className="menu-row-text">
            <span className="mr-title">Feeding</span>
            <span className="mr-sub">Log what&apos;s fed — draws from Feed stock</span>
          </div>
          <ChevronRight size={16} />
        </Link>
        <Link className="menu-row" href="/milk-sold">
          <Milk size={18} strokeWidth={1.75} />
          <div className="menu-row-text">
            <span className="mr-title">Milk sold</span>
            <span className="mr-sub">Litres sold per day, and who took it</span>
          </div>
          <ChevronRight size={16} />
        </Link>
      </div>

      <div className="tabs">
        {farms.map((f) => (
          <button key={f.id} className={`tab${farm.id === f.id ? " active" : ""}`} onClick={() => switchFarm(f.id)}>{f.name}</button>
        ))}
      </div>

      <div className="menu-list">
        {groups.length === 0 && <p className="ds-note" style={{ padding: "0 18px" }}>No milking groups set up for {farm.name}.</p>}
        {groups.map((g) => (
          <button key={g.id} className="walk-row" onClick={() => setActiveGroup(g)}>
            <span className="wr-code">{g.name}</span>
            <span className="field-editor-sub">
              {g.currentCount != null ? `${g.currentCount} head` : "No count set"}
              {g.currentCountDate ? ` · as of ${g.currentCountDate}` : ""}
              {g.currentMilkPerCow != null ? ` · ${g.currentMilkPerCow} L/cow (${g.currentMilkDate})` : ""}
            </span>
          </button>
        ))}
      </div>

      {activeGroup && (
        <GroupDetail
          key={activeGroup.id}
          group={activeGroup}
          farmName={farm.name}
          onClose={() => setActiveGroup(null)}
          onChanged={refetchGroups}
        />
      )}
    </div>
  );
}

type GroupView = "overview" | "headcount" | "milk";

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

function GroupDetail({
  group,
  farmName,
  onClose,
  onChanged,
}: {
  group: CattleGroup;
  farmName: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [view, setView] = useState<GroupView>("overview");

  const [count, setCount] = useState(group.currentCount != null ? String(group.currentCount) : "");
  const [date, setDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);

  const [litresPerCow, setLitresPerCow] = useState(group.currentMilkPerCow != null ? String(group.currentMilkPerCow) : "");
  const [milkDate, setMilkDate] = useState(todayStr());
  const [savingMilk, setSavingMilk] = useState(false);
  const [milkRange, setMilkRange] = useState<ChartRange>("1m");
  const [headcountRange, setHeadcountRange] = useState<ChartRange>("1m");

  const { data: countsData, refetch: refetchCounts } = useApi<{ counts: CattleCountEntry[] }>(`/api/cattle-counts?groupId=${group.id}`);
  const counts = countsData?.counts ?? [];
  const { data: allocData, refetch: refetchAlloc } = useApi<{ allocations: GrazingAllocation[] }>(`/api/grazing-allocations?groupId=${group.id}`);
  const allocations = allocData?.allocations ?? [];
  const { data: milkData, refetch: refetchMilk } = useApi<{ entries: MilkProductionEntry[] }>(`/api/milk-production?groupId=${group.id}`);
  const milkEntries = milkData?.entries ?? [];

  const countPoints = useMemo(
    () => counts.map((c) => ({ date: c.date.slice(0, 10), value: c.count })),
    [counts]
  );
  const milkPoints = useMemo(
    () => milkEntries.map((m) => ({ date: m.date.slice(0, 10), value: m.litresPerCow })),
    [milkEntries]
  );
  const monthlyAvg = useMemo(() => {
    const thisMonth = todayStr().slice(0, 7);
    const inMonth = milkEntries.filter((m) => m.date.slice(0, 7) === thisMonth);
    if (!inMonth.length) return null;
    return round1(inMonth.reduce((s, m) => s + m.litresPerCow, 0) / inMonth.length);
  }, [milkEntries]);

  // Month-on-month and year-on-year averages for the detailed milk view —
  // dairy yield is seasonal, so "same month last year" matters more than a
  // straight 12-months-ago comparison.
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

  const handleSaveCount = async () => {
    if (count === "" || Number(count) < 0) return;
    setSaving(true);
    await fetch("/api/cattle-counts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId: group.id, date, count: Number(count) }),
    });
    setSaving(false);
    refetchCounts();
    onChanged();
  };

  const handleSaveMilk = async () => {
    if (litresPerCow === "" || Number(litresPerCow) < 0) return;
    setSavingMilk(true);
    await fetch("/api/milk-production", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId: group.id, date: milkDate, litresPerCow: Number(litresPerCow) }),
    });
    setSavingMilk(false);
    refetchMilk();
    onChanged();
  };

  const handleDeleteMilk = async (id: string) => {
    await fetch(`/api/milk-production/${id}`, { method: "DELETE" });
    refetchMilk();
    onChanged();
  };

  const handleDeleteCount = async (id: string) => {
    await fetch(`/api/cattle-counts/${id}`, { method: "DELETE" });
    refetchCounts();
    onChanged();
  };

  const handleDeleteAllocation = async (id: string) => {
    await fetch(`/api/grazing-allocations/${id}`, { method: "DELETE" });
    refetchAlloc();
  };

  // Group allocations by date so day+night show on one line. Overview only
  // ever shows the most recent 7 dates that have grazing logged.
  const allocByDate = new Map<string, GrazingAllocation[]>();
  allocations.forEach((a) => {
    const d = a.date.slice(0, 10);
    allocByDate.set(d, [...(allocByDate.get(d) ?? []), a]);
  });
  const allocDates = [...allocByDate.keys()].sort((a, b) => (a < b ? 1 : -1)).slice(0, 7);
  const milkLast7 = milkEntries.slice(0, 7);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="edit-entry-overlay" onClick={onClose}>
      <div className="edit-entry-panel" onClick={(e) => e.stopPropagation()}>
        <div className="keypad-header">
          <div className="stock-panel-title">
            {view !== "overview" && (
              <button className="link-btn" onClick={() => setView("overview")} style={{ marginBottom: 4 }}>‹ Back</button>
            )}
            <span className="keypad-code">
              {view === "overview" && `${farmName} — Group ${group.name}`}
              {view === "headcount" && `${group.name} — Headcount`}
              {view === "milk" && `${group.name} — Milk production`}
            </span>
          </div>
          <X size={18} className="close" onClick={onClose} />
        </div>

        <div className="edit-entry-body">
          {view === "overview" && (
            <>
              <label className="field">
                <span className="field-label">Set headcount</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="field-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ flex: 1 }} />
                  <input className="field-input" type="number" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} placeholder="Head" style={{ width: 90 }} />
                </div>
                <button className="save-btn small" onClick={handleSaveCount} disabled={saving || count === ""} style={{ marginTop: 8 }}>
                  {saving ? "Saving…" : "Save headcount"}
                </button>
              </label>

              <label className="field">
                <span className="field-label">Milk production (litres per cow)</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="field-input" type="date" value={milkDate} onChange={(e) => setMilkDate(e.target.value)} style={{ flex: 1 }} />
                  <input className="field-input" type="number" inputMode="decimal" value={litresPerCow} onChange={(e) => setLitresPerCow(e.target.value)} placeholder="L/cow" style={{ width: 90 }} />
                </div>
                <button className="save-btn small" onClick={handleSaveMilk} disabled={savingMilk || litresPerCow === ""} style={{ marginTop: 8 }}>
                  {savingMilk ? "Saving…" : "Save milk production"}
                </button>
              </label>

              {monthlyAvg != null && (
                <div className="wedge-info-box">
                  <div><span className="wib-k">Daily avg this month</span><span className="wib-v">{monthlyAvg} L/cow</span></div>
                </div>
              )}

              <div className="field">
                <span className="field-label">Milk — last 7 days</span>
                {milkLast7.length === 0 && <p className="ds-note">No milk production logged yet.</p>}
                {milkLast7.map((m) => (
                  <div key={m.id} className="mr-sub" style={{ padding: "4px 0" }}>{m.date.slice(0, 10)} — {m.litresPerCow} L/cow</div>
                ))}
              </div>

              <div className="field">
                <span className="field-label">Grazing — last 7 days</span>
                {allocDates.length === 0 && <p className="ds-note">No grazing logged yet — use Feed &gt; Grazing allocation.</p>}
                {allocDates.map((d) => {
                  const rows = allocByDate.get(d)!;
                  const day = rows.find((r) => r.session === "DAY");
                  const night = rows.find((r) => r.session === "NIGHT");
                  return (
                    <div key={d} className="mr-sub" style={{ padding: "4px 0" }}>
                      {d} — {day ? `${day.paddock.code} Day` : ""}{day && night ? ", " : ""}{night ? `${night.paddock.code} Night` : ""}
                    </div>
                  );
                })}
              </div>

              <div className="menu-list" style={{ marginTop: 10, flexShrink: 0 }}>
                <button className="menu-row" onClick={() => setView("headcount")}>
                  <div className="menu-row-text">
                    <span className="mr-title">Headcount details</span>
                    <span className="mr-sub">Full history &amp; graph</span>
                  </div>
                  <ChevronRight size={16} />
                </button>
                <button className="menu-row" onClick={() => setView("milk")}>
                  <div className="menu-row-text">
                    <span className="mr-title">Milk production details</span>
                    <span className="mr-sub">Full history, graph &amp; comparisons</span>
                  </div>
                  <ChevronRight size={16} />
                </button>
              </div>
            </>
          )}

          {view === "headcount" && (
            <>
              <TrendChart points={countPoints} range={headcountRange} onRangeChange={setHeadcountRange} unit=" head" yLabel="Headcount" />
              <div className="field">
                <span className="field-label">Headcount history</span>
                {counts.length === 0 && <p className="ds-note">No headcounts logged yet.</p>}
                {counts.slice(0, 60).map((c) => (
                  <div key={c.id} className="settings-row">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="mr-sub">{c.date.slice(0, 10)} — {c.count} head</span>
                      <button className="link-btn" onClick={() => handleDeleteCount(c.id)} aria-label="Delete count">
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {view === "milk" && (
            <>
              <div className="wedge-info-box">
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

              <TrendChart points={milkPoints} range={milkRange} onRangeChange={setMilkRange} unit=" L/cow" yLabel="Litres per cow" />

              <div className="field">
                <span className="field-label">Milk production history</span>
                {milkEntries.length === 0 && <p className="ds-note">No milk production logged yet.</p>}
                {milkEntries.slice(0, 60).map((m) => (
                  <div key={m.id} className="settings-row">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="mr-sub">{m.date.slice(0, 10)} — {m.litresPerCow} L/cow</span>
                      <button className="link-btn" onClick={() => handleDeleteMilk(m.id)} aria-label="Delete milk entry">
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
