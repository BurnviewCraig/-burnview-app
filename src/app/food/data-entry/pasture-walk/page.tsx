"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { KeypadGrid } from "@/components/KeypadGrid";
import { useApi } from "@/lib/useApi";
import { byPaddockNumber, todayStr } from "@/lib/utils";
import type { Farm, PastureWalk } from "@/lib/types";

function PastureWalkForm() {
  const params = useSearchParams();
  const { data, loading } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = data?.farms ?? [];

  // A calendar "{Farm} Pasture walk" entry links here with these set, so
  // clicking it opens straight to that day's sheet instead of today's.
  const [farmId, setFarmId] = useState<string | null>(params.get("farmId"));
  const [date, setDate] = useState(params.get("date") || todayStr());
  const [readings, setReadings] = useState<Record<string, string>>({});
  const [originalReadings, setOriginalReadings] = useState<Record<string, string>>({});
  const [existingIds, setExistingIds] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const farm = farms.find((f) => f.id === (farmId ?? farms[0]?.id)) ?? farms[0];
  // Only Rye grass camps get walked for the wedge — other land types aren't read.
  const orderedPaddocks = useMemo(
    () => (farm ? farm.paddocks.filter((p) => p.landType === "Rye grass").sort(byPaddockNumber) : []),
    [farm]
  );

  // Loads whatever's already saved for this farm + date, so a previous
  // walk sheet can be reopened and corrected rather than only ever adding
  // new readings on top of it.
  const { data: existingData, refetch: refetchExisting } = useApi<{ walks: PastureWalk[] }>(
    farm && date ? `/api/pasture-walks?farmId=${farm.id}&date=${date}` : null
  );

  useEffect(() => {
    const walks = existingData?.walks ?? [];
    const nextReadings: Record<string, string> = {};
    const nextIds: Record<string, string> = {};
    walks.forEach((w) => {
      nextReadings[w.paddockId] = String(w.cover);
      nextIds[w.paddockId] = w.id;
    });
    setReadings(nextReadings);
    setOriginalReadings(nextReadings);
    setExistingIds(nextIds);
    setActiveId(null);
    setSavedCount(null);
  }, [existingData]);

  const filledCount = Object.values(readings).filter((v) => v !== "").length;
  const hasChanges = orderedPaddocks.some((p) => (readings[p.id] ?? "") !== (originalReadings[p.id] ?? ""));

  const switchFarm = (id: string) => {
    setFarmId(id);
    setActiveId(null);
    setSavedCount(null);
  };

  const handleKey = (k: string) => {
    if (!activeId) return;
    setReadings((prev) => {
      const cur = prev[activeId] ?? "";
      let next = cur;
      if (k === "C") next = "";
      else if (k === "⌫") next = cur.slice(0, -1);
      else next = (cur + k).slice(0, 5);
      return { ...prev, [activeId]: next };
    });
  };

  const handleNext = () => {
    const idx = orderedPaddocks.findIndex((p) => p.id === activeId);
    const next = orderedPaddocks[idx + 1];
    setActiveId(next ? next.id : null);
  };

  // Reconciles the on-screen readings against what's actually saved:
  // changed existing readings are PATCHed, cleared ones are deleted, and
  // brand-new readings are created — nothing gets duplicated.
  const handleSave = async () => {
    if (!farm) return;
    setSaving(true);

    const toCreate: { paddockId: string; cover: number }[] = [];
    const requests: Promise<Response>[] = [];
    let touched = 0;

    orderedPaddocks.forEach((p) => {
      const val = readings[p.id] ?? "";
      const orig = originalReadings[p.id] ?? "";
      if (val === orig) return;
      const existingWalkId = existingIds[p.id];
      const numeric = val !== "" ? Number(val) : null;

      if (existingWalkId) {
        if (numeric == null || numeric <= 0) {
          requests.push(fetch(`/api/pasture-walks/${existingWalkId}`, { method: "DELETE" }));
        } else {
          requests.push(
            fetch(`/api/pasture-walks/${existingWalkId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cover: numeric }),
            })
          );
        }
        touched++;
      } else if (numeric != null && numeric > 0) {
        toCreate.push({ paddockId: p.id, cover: numeric });
        touched++;
      }
    });

    if (toCreate.length) {
      requests.push(
        fetch("/api/pasture-walks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ farmId: farm.id, date, readings: toCreate }),
        })
      );
    }

    await Promise.all(requests);
    setSaving(false);
    setSavedCount(touched);
    refetchExisting();
  };

  const handleCancel = () => {
    refetchExisting();
  };

  if (loading) return <div className="screen"><Header title="Pasture walk" backHref="/food/data-entry" /><Spinner /></div>;
  if (!farm) return <div className="screen"><Header title="Pasture walk" backHref="/food/data-entry" /><div className="empty">No farms found.</div></div>;

  return (
    <div className="screen">
      <Header title="Pasture walk" backHref="/food/data-entry" />

      <div className="tabs">
        {farms.map((f) => (
          <button key={f.id} className={`tab${farm.id === f.id ? " active" : ""}`} onClick={() => switchFarm(f.id)}>{f.name}</button>
        ))}
      </div>

      <div className="walk-datebar">
        <label className="field" style={{ flex: 1 }}>
          <span className="field-label">Walk date</span>
          <input className="field-input" type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="walk-progress">{filledCount} / {orderedPaddocks.length} entered</div>
      </div>

      {Object.keys(existingIds).length > 0 && (
        <p className="ds-note" style={{ padding: "0 18px 8px" }}>
          Editing the walk already saved for {date} — change a value and save to correct it.
        </p>
      )}

      <div className="walk-list" style={{ paddingBottom: activeId ? 232 : 0 }}>
        {orderedPaddocks.map((p) => {
          const val = readings[p.id] ?? "";
          return (
            <button key={p.id} className={`walk-row${activeId === p.id ? " active" : ""}`} onClick={() => setActiveId(p.id)}>
              <span className="wr-code">{p.code}</span>
              <span className={`wr-value${val === "" ? " placeholder" : ""}`}>{val !== "" ? val : "0"}</span>
              <span className="wr-unit">kg DM/ha</span>
            </button>
          );
        })}
      </div>

      {activeId ? (
        <div className="keypad-panel">
          <div className="keypad-header">
            <span className="keypad-code">{orderedPaddocks.find((p) => p.id === activeId)?.code}</span>
            <span className="keypad-value">{readings[activeId] || "0"} <span className="keypad-unit">kg DM/ha</span></span>
            <button className="close" onClick={() => setActiveId(null)}><X size={18} /></button>
          </div>
          <KeypadGrid onKey={handleKey} />
          <button className="save-btn keypad-next" onClick={handleNext}>Next field ▸</button>
        </div>
      ) : (
        <div className="walk-save-bar">
          <div className="walk-save-row">
            <button className="cancel-btn" onClick={handleCancel} disabled={!hasChanges}>Discard changes</button>
            <button className="save-btn" onClick={handleSave} disabled={!hasChanges || !date || saving}>
              {saving ? "Saving…" : "Save walk"}
            </button>
          </div>
          {savedCount != null && (
            <p className="save-note">
              Saved changes for {savedCount} camp{savedCount === 1 ? "" : "s"} — {farm.name} — {date}. These now feed the wedge and that field&apos;s history.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function PastureWalkPage() {
  return (
    <Suspense fallback={<div className="screen"><Header title="Pasture walk" backHref="/food/data-entry" /><Spinner /></div>}>
      <PastureWalkForm />
    </Suspense>
  );
}
