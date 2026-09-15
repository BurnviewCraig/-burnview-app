"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Trash2, ChevronRight } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { TrendChart, type ChartRange } from "@/components/TrendChart";
import { useApi } from "@/lib/useApi";
import { todayStr } from "@/lib/utils";
import type { CattleGroup, CattleCountEntry, GrazingAllocation, MilkProductionEntry } from "@/lib/types";

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

function GroupPageContent() {
  const params = useSearchParams();
  const groupId = params.get("id");

  const { data: groupData, loading, refetch: refetchGroup } = useApi<{ group: CattleGroup }>(
    groupId ? `/api/cattle-groups/${groupId}` : null
  );
  const group = groupData?.group ?? null;

  const [view, setView] = useState<GroupView>("overview");

  const [count, setCount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);

  const [litresPerCow, setLitresPerCow] = useState("");
  const [milkDate, setMilkDate] = useState(todayStr());
  const [savingMilk, setSavingMilk] = useState(false);
  const [milkRange, setMilkRange] = useState<ChartRange>("1m");
  const [headcountRange, setHeadcountRange] = useState<ChartRange>("1m");

  const { data: countsData, refetch: refetchCounts } = useApi<{ counts: CattleCountEntry[] }>(
    groupId ? `/api/cattle-counts?groupId=${groupId}` : null
  );
  const counts = countsData?.counts ?? [];
  const { data: allocData, refetch: refetchAlloc } = useApi<{ allocations: GrazingAllocation[] }>(
    groupId ? `/api/grazing-allocations?groupId=${groupId}` : null
  );
  const allocations = allocData?.allocations ?? [];
  const { data: milkData, refetch: refetchMilk } = useApi<{ entries: MilkProductionEntry[] }>(
    groupId ? `/api/milk-production?groupId=${groupId}` : null
  );
  const milkEntries = milkData?.entries ?? [];

  const countPoints = useMemo(() => counts.map((c) => ({ date: c.date.slice(0, 10), value: c.count })), [counts]);
  const milkPoints = useMemo(() => milkEntries.map((m) => ({ date: m.date.slice(0, 10), value: m.litresPerCow })), [milkEntries]);
  const monthlyAvg = useMemo(() => {
    const thisMonth = todayStr().slice(0, 7);
    const inMonth = milkEntries.filter((m) => m.date.slice(0, 7) === thisMonth);
    if (!inMonth.length) return null;
    return round1(inMonth.reduce((s, m) => s + m.litresPerCow, 0) / inMonth.length);
  }, [milkEntries]);

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

  // Prefill the entry fields with the group's latest known values once
  // they load, so most days you're just confirming/tweaking a number
  // rather than typing from scratch.
  useEffect(() => {
    if (!group) return;
    setCount((prev) => (prev !== "" ? prev : group.currentCount != null ? String(group.currentCount) : ""));
    setLitresPerCow((prev) => (prev !== "" ? prev : group.currentMilkPerCow != null ? String(group.currentMilkPerCow) : ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id]);

  const refreshAll = () => { refetchGroup(); refetchCounts(); refetchMilk(); };

  const handleSaveCount = async () => {
    if (!groupId || count === "" || Number(count) < 0) return;
    setSaving(true);
    await fetch("/api/cattle-counts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, date, count: Number(count) }),
    });
    setSaving(false);
    setCount("");
    refreshAll();
  };

  const handleSaveMilk = async () => {
    if (!groupId || litresPerCow === "" || Number(litresPerCow) < 0) return;
    setSavingMilk(true);
    await fetch("/api/milk-production", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, date: milkDate, litresPerCow: Number(litresPerCow) }),
    });
    setSavingMilk(false);
    setLitresPerCow("");
    refreshAll();
  };

  const handleDeleteMilk = async (id: string) => {
    await fetch(`/api/milk-production/${id}`, { method: "DELETE" });
    refreshAll();
  };
  const handleDeleteCount = async (id: string) => {
    await fetch(`/api/cattle-counts/${id}`, { method: "DELETE" });
    refreshAll();
  };
  const handleDeleteAllocation = async (id: string) => {
    await fetch(`/api/grazing-allocations/${id}`, { method: "DELETE" });
    refetchAlloc();
  };

  const allocByDate = new Map<string, GrazingAllocation[]>();
  allocations.forEach((a) => {
    const d = a.date.slice(0, 10);
    allocByDate.set(d, [...(allocByDate.get(d) ?? []), a]);
  });
  const allocDates = [...allocByDate.keys()].sort((a, b) => (a < b ? 1 : -1)).slice(0, 7);
  const milkLast7 = milkEntries.slice(0, 7);

  if (loading) return <div className="screen"><Header title="Group" backHref="/cattle" /><Spinner /></div>;
  if (!group) return <div className="screen"><Header title="Group" backHref="/cattle" /><div className="empty">Group not found.</div></div>;

  return (
    <div className="screen">
      <Header
        title={view === "overview" ? `${group.farmName} — Group ${group.name}` : `${group.name} — ${view === "headcount" ? "Headcount" : "Milk production"}`}
        backHref="/cattle"
      />

      {view !== "overview" && (
        <div style={{ padding: "8px 18px 0" }}>
          <button className="link-btn" onClick={() => setView("overview")}>‹ Back to overview</button>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {view === "overview" && (
          <>
            <div className="menu-list" style={{ flexShrink: 0, marginBottom: 4 }}>
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

            <label className="field" style={{ padding: "0 18px" }}>
              <span className="field-label">Set headcount</span>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="field-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ flex: 1 }} />
                <input className="field-input" type="number" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} placeholder="Head" style={{ width: 90 }} />
              </div>
              <button className="save-btn small" onClick={handleSaveCount} disabled={saving || count === ""} style={{ marginTop: 8 }}>
                {saving ? "Saving…" : "Save headcount"}
              </button>
            </label>

            <label className="field" style={{ padding: "0 18px" }}>
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
              <div className="wedge-info-box" style={{ margin: "0 18px" }}>
                <div><span className="wib-k">Daily avg this month</span><span className="wib-v">{monthlyAvg} L/cow</span></div>
              </div>
            )}

            <div className="field" style={{ padding: "0 18px" }}>
              <span className="field-label">Milk — last 7 days</span>
              {milkLast7.length === 0 && <p className="ds-note">No milk production logged yet.</p>}
              {milkLast7.map((m) => (
                <div key={m.id} className="mr-sub" style={{ padding: "4px 0" }}>{m.date.slice(0, 10)} — {m.litresPerCow} L/cow</div>
              ))}
            </div>

            <div className="field" style={{ padding: "0 18px 18px" }}>
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
          </>
        )}

        {view === "headcount" && (
          <>
            <div style={{ padding: "12px 18px 0" }}>
              <TrendChart points={countPoints} range={headcountRange} onRangeChange={setHeadcountRange} unit=" head" yLabel="Headcount" height={300} />
            </div>
            <div className="field" style={{ padding: "0 18px 18px" }}>
              <span className="field-label">Headcount history</span>
              {counts.length === 0 && <p className="ds-note">No headcounts logged yet.</p>}
              {counts.map((c) => (
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
            <div className="wedge-info-box" style={{ margin: "12px 18px 0" }}>
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

            <div style={{ padding: "12px 18px 0" }}>
              <TrendChart points={milkPoints} range={milkRange} onRangeChange={setMilkRange} unit=" L/cow" yLabel="Litres per cow" height={300} />
            </div>

            <div className="field" style={{ padding: "0 18px 18px" }}>
              <span className="field-label">Milk production history</span>
              {milkEntries.length === 0 && <p className="ds-note">No milk production logged yet.</p>}
              {milkEntries.map((m) => (
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
  );
}

export default function GroupPage() {
  return (
    <Suspense fallback={<div className="screen"><Header title="Group" backHref="/cattle" /><Spinner /></div>}>
      <GroupPageContent />
    </Suspense>
  );
}
