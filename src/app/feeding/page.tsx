"use client";

import { useState } from "react";
import { Trash2, Pencil, Scale, ChevronUp } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { sanitizeDecimalInput } from "@/lib/utils";
import type { Farm, CattleGroup, AdditionalConcentrate, GroupFeedEntry, FeedingTotals } from "@/lib/types";

function GroupConcentrates({ group }: { group: CattleGroup }) {
  const { data, refetch } = useApi<{ concentrates: AdditionalConcentrate[] }>(
    `/api/additional-concentrates?groupId=${group.id}`
  );
  const concentrates = data?.concentrates ?? [];

  const { data: feedData } = useApi<{ entries: GroupFeedEntry[] }>(`/api/group-feed?groupId=${group.id}`);
  const latestFeed = feedData?.entries.find((e) => e.dairyMealKg != null) ?? null;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [kg, setKg] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = (c: AdditionalConcentrate) => {
    setEditingId(c.id);
    setAdding(false);
    setName(c.name);
    setKg(String(c.kgPerCow));
  };
  const startAdd = () => {
    setAdding(true);
    setEditingId(null);
    setName("");
    setKg("");
  };
  const cancel = () => {
    setAdding(false);
    setEditingId(null);
  };

  const save = async () => {
    if (!name.trim() || kg === "" || Number.isNaN(Number(kg))) return;
    setSaving(true);
    if (editingId) {
      await fetch(`/api/additional-concentrates/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), kgPerCow: Number(kg) }),
      });
    } else {
      await fetch("/api/additional-concentrates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: group.id, name: name.trim(), kgPerCow: Number(kg) }),
      });
    }
    setSaving(false);
    cancel();
    refetch();
  };

  const remove = async (id: string) => {
    await fetch(`/api/additional-concentrates/${id}`, { method: "DELETE" });
    refetch();
  };

  const showForm = adding || editingId;

  return (
    <div className="settings-row">
      <div className="settings-row-title">Group {group.name}</div>
      <p className="ds-note" style={{ margin: "2px 0 6px" }}>
        Dairy meal (AFI): {latestFeed?.dairyMealKg != null ? `${latestFeed.dairyMealKg}kg/cow` : "not logged yet"}
        {latestFeed && ` — ${latestFeed.date.slice(0, 10)}`}
      </p>
      {concentrates.length === 0 && !showForm && (
        <p className="ds-note" style={{ margin: "4px 0" }}>Nothing added yet.</p>
      )}
      {concentrates.map((c) => (
        <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
          <span>{c.name} — {c.kgPerCow}kg/cow</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="link-btn" onClick={() => startEdit(c)} aria-label={`Edit ${c.name}`}>
              <Pencil size={15} strokeWidth={1.75} />
            </button>
            <button className="link-btn" onClick={() => remove(c.id)} aria-label={`Remove ${c.name}`}>
              <Trash2 size={15} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      ))}

      {showForm ? (
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Molasses" style={{ flex: 1, minWidth: 120 }} />
          <input className="field-input" type="text" inputMode="decimal" value={kg} onChange={(e) => setKg(sanitizeDecimalInput(e.target.value))} placeholder="kg/cow" style={{ width: 90 }} />
          <button className="save-btn small" onClick={save} disabled={saving || !name.trim() || kg === ""}>{saving ? "Saving…" : "Save"}</button>
          <button className="link-btn" onClick={cancel}>Cancel</button>
        </div>
      ) : (
        <button className="link-btn" onClick={startAdd} style={{ marginTop: 6 }}>+ Add concentrate</button>
      )}
    </div>
  );
}

export default function FeedingPage() {
  const { data: farmsData, loading } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];
  const [showTotals, setShowTotals] = useState(false);

  if (loading) return <div className="screen"><Header title="Feeding" backHref="/" /><Spinner /></div>;

  return (
    <div className="screen">
      <Header title="Feeding" backHref="/" />
      <p className="ds-note" style={{ padding: "12px 18px 0" }}>
        Dairy meal comes in automatically from AFI every night. Additional concentrates below are set once per
        group and only need updating when the mix actually changes — not a daily entry.
      </p>
      <div style={{ padding: "10px 18px 0" }}>
        <button className="link-btn" onClick={() => setShowTotals((v) => !v)}>
          {showTotals ? <ChevronUp size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} /> : <Scale size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />}
          {showTotals ? "Hide order totals" : "Show order totals per farm"}
        </button>
      </div>
      {showTotals && <FeedingTotalsPanel />}
      <div className="menu-list" style={{ padding: "8px 0 18px" }}>
        {farms.map((f) => <FarmConcentrates key={f.id} farm={f} />)}
      </div>
    </div>
  );
}

function FeedingTotalsPanel() {
  const { data, loading } = useApi<FeedingTotals>("/api/feeding-totals");
  const farms = data?.farms ?? [];
  const grandTotal = farms.reduce((s, f) => s + f.totalKgPerDay, 0);

  return (
    <div style={{ padding: "8px 18px 0" }}>
      {loading ? (
        <Spinner />
      ) : farms.length === 0 ? (
        <p className="ds-note">No meal logged yet for any group.</p>
      ) : (
        <div className="settings-row">
          {farms.map((f) => (
            <div key={f.farmId} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span className="field-label" style={{ margin: 0 }}>{f.farmName}</span>
                <span style={{ fontWeight: 700 }}>{f.totalKgPerDay.toLocaleString()} kg/day</span>
              </div>
              {f.groups.map((g) => (
                <p key={g.groupId} className="ds-note" style={{ margin: "2px 0 0" }}>
                  {g.groupName}: {g.currentCount ?? "—"} cows × {g.kgPerCow?.toFixed(1) ?? "—"}kg/cow = {g.kgPerDay?.toLocaleString() ?? "—"}kg
                </p>
              ))}
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 6, borderTop: "1px solid var(--paper-deep)" }}>
            <span className="field-label" style={{ margin: 0 }}>All farms</span>
            <span style={{ fontWeight: 700 }}>{grandTotal.toLocaleString()} kg/day</span>
          </div>
        </div>
      )}
    </div>
  );
}

function FarmConcentrates({ farm }: { farm: Farm }) {
  const { data } = useApi<{ groups: CattleGroup[] }>(`/api/cattle-groups?farmId=${farm.id}`);
  const groups = data?.groups ?? [];
  if (!groups.length) return null;
  return (
    <>
      <p className="field-label" style={{ padding: "10px 18px 0" }}>{farm.name}</p>
      {groups.map((g) => <GroupConcentrates key={g.id} group={g} />)}
    </>
  );
}
