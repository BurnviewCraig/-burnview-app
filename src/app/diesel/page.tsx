"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { X, Plus, Trash2, History } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { byPaddockNumber, todayStr } from "@/lib/utils";
import { DIESEL_ACTIVITIES } from "@/lib/constants";
import type { Farm, DieselAsset, DieselLogEntry, Worker } from "@/lib/types";

export default function DieselPage() {
  const { data: farmsData, loading } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];
  const [farmId, setFarmId] = useState<string | null>(null);
  const farm = farms.find((f) => f.id === (farmId ?? farms[0]?.id)) ?? farms[0];

  const [date, setDate] = useState(todayStr());
  const [managing, setManaging] = useState(false);
  const [activeAsset, setActiveAsset] = useState<DieselAsset | null>(null);

  const { data: assetsData, refetch: refetchAssets } = useApi<{ assets: DieselAsset[] }>(
    farm ? `/api/diesel-assets?farmId=${farm.id}${managing ? "&includeInactive=true" : ""}` : null
  );
  const assets = assetsData?.assets ?? [];
  const activeAssets = assets.filter((a) => a.active);

  const { data: entriesData, refetch: refetchEntries } = useApi<{ entries: DieselLogEntry[] }>(
    farm ? `/api/diesel-entries?farmId=${farm.id}&date=${date}` : null
  );
  const entries = entriesData?.entries ?? [];
  const entryByAsset = new Map(entries.map((e) => [e.assetId, e]));

  const { data: workersData } = useApi<{ workers: Worker[] }>(farm ? `/api/workers?farmId=${farm.id}` : null);
  const workers = workersData?.workers ?? [];

  const switchFarm = (id: string) => {
    setFarmId(id);
    setManaging(false);
    setActiveAsset(null);
  };

  if (loading) return <div className="screen"><Header title="Diesel" backHref="/" /><Spinner /></div>;
  if (!farm) return <div className="screen"><Header title="Diesel" backHref="/" /><div className="empty">No farms found.</div></div>;

  return (
    <div className="screen">
      <Header title="Diesel" backHref="/" />

      <div className="tabs">
        {farms.map((f) => (
          <button key={f.id} className={`tab${farm.id === f.id ? " active" : ""}`} onClick={() => switchFarm(f.id)}>{f.name}</button>
        ))}
      </div>

      <div className="add-item-bar" style={{ flexWrap: "wrap" }}>
        <span className="field-label" style={{ width: "100%" }}>Date</span>
        <input className="field-input small" type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} />
        <div style={{ flex: 1 }} />
        <button className="link-btn" onClick={() => { setManaging((v) => !v); setActiveAsset(null); }}>
          {managing ? "Done" : "Manage tractors"}
        </button>
      </div>

      {managing ? (
        <ManageAssets farmId={farm.id} assets={assets} onChanged={refetchAssets} />
      ) : (
        <div className="walk-list">
          {activeAssets.length === 0 && (
            <p className="ds-note" style={{ padding: "12px 18px" }}>
              No tractors/vehicles set up for {farm.name} yet — tap &quot;Manage tractors&quot; to add one.
            </p>
          )}
          {activeAssets.map((a) => {
            const e = entryByAsset.get(a.id);
            return (
              <button key={a.id} className="walk-row" onClick={() => setActiveAsset(a)}>
                <span className="wr-code">{a.name}</span>
                <span className="field-editor-sub">
                  {a.numberPlate ? `${a.numberPlate} · ` : ""}
                  {e
                    ? e.worked
                      ? `Opening ${e.openingReading ?? "—"}${a.unit === "HOURS" ? "h" : "km"}${e.litresFilled ? ` · ${e.litresFilled}L` : ""}${e.driver ? ` · ${e.driver.name}` : ""}`
                      : "Parked"
                    : "Not logged yet"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {activeAsset && (
        <AssetEntryPanel
          asset={activeAsset}
          date={date}
          farmName={farm.name}
          paddocks={farm.paddocks}
          workers={workers}
          existingEntry={entryByAsset.get(activeAsset.id) ?? null}
          onClose={() => setActiveAsset(null)}
          onSaved={() => { setActiveAsset(null); refetchEntries(); }}
        />
      )}
    </div>
  );
}

function ManageAssets({
  farmId,
  assets,
  onChanged,
}: {
  farmId: string;
  assets: DieselAsset[];
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [numberPlate, setNumberPlate] = useState("");
  const [unit, setUnit] = useState<"HOURS" | "KM">("HOURS");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setAdding(true);
    setError(null);
    const res = await fetch("/api/diesel-assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ farmId, name: name.trim(), numberPlate: numberPlate.trim() || undefined, unit }),
    });
    setAdding(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setError(json?.error || "Couldn't add that asset — try again.");
      return;
    }
    setName("");
    setNumberPlate("");
    setUnit("HOURS");
    onChanged();
  };

  const toggleActive = async (a: DieselAsset) => {
    await fetch(`/api/diesel-assets/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !a.active }),
    });
    onChanged();
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setDeleteError(null);
      return;
    }
    const res = await fetch(`/api/diesel-assets/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setDeleteError(json?.error || "Couldn't delete that asset.");
      setConfirmDeleteId(null);
      return;
    }
    setConfirmDeleteId(null);
    onChanged();
  };

  return (
    <div className="walk-list">
      <div className="add-item-bar" style={{ flexWrap: "wrap" }}>
        <input className="field-input small" placeholder="Name, e.g. Tractor 1" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="field-input small" placeholder="Number plate" value={numberPlate} onChange={(e) => setNumberPlate(e.target.value)} />
        <select className="field-input small" value={unit} onChange={(e) => setUnit(e.target.value as "HOURS" | "KM")}>
          <option value="HOURS">Hours</option>
          <option value="KM">Km</option>
        </select>
        <button className="save-btn small" onClick={handleAdd} disabled={adding || !name.trim()}>
          <Plus size={14} style={{ verticalAlign: "-2px" }} /> Add
        </button>
      </div>
      {error && <p className="error-note" style={{ padding: "0 18px" }}>{error}</p>}
      {deleteError && <p className="error-note" style={{ padding: "0 18px" }}>{deleteError}</p>}

      {assets.map((a) => (
        <div key={a.id} className="settings-row">
          <div className="settings-row-head">
            <span className="settings-row-title">{a.name}{!a.active ? " (inactive)" : ""}</span>
            <span className="mr-sub">{a.numberPlate || "No plate"} · {a.unit === "HOURS" ? "Hours" : "Km"}</span>
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            <Link className="link-btn" href={`/diesel/history?assetId=${a.id}`}>
              <History size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />History
            </Link>
            <button className="link-btn" onClick={() => toggleActive(a)}>{a.active ? "Mark inactive" : "Mark active"}</button>
            <button className="link-btn" onClick={() => handleDelete(a.id)}>
              <Trash2 size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
              {confirmDeleteId === a.id ? "Confirm delete" : "Delete"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AssetEntryPanel({
  asset,
  date,
  farmName,
  paddocks,
  workers,
  existingEntry,
  onClose,
  onSaved,
}: {
  asset: DieselAsset;
  date: string;
  farmName: string;
  paddocks: Farm["paddocks"];
  workers: Worker[];
  existingEntry: DieselLogEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [worked, setWorked] = useState(existingEntry?.worked ?? true);
  const [driverId, setDriverId] = useState(existingEntry?.driverId ?? "");
  const [opening, setOpening] = useState(existingEntry?.openingReading != null ? String(existingEntry.openingReading) : "");
  const [litres, setLitres] = useState(existingEntry?.litresFilled != null ? String(existingEntry.litresFilled) : "");
  const [activities, setActivities] = useState<string[]>(existingEntry?.activities ?? []);
  const [paddockCodes, setPaddockCodes] = useState<string[]>(existingEntry?.paddockCodes ?? []);
  const [comment, setComment] = useState(existingEntry?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Sticky driver default: if there's no entry yet for this exact date, use
  // whoever drove it most recently, so most days you don't touch the dropdown.
  const { data: historyData } = useApi<{ entries: DieselLogEntry[] }>(
    !existingEntry ? `/api/diesel-entries?assetId=${asset.id}` : null
  );
  useEffect(() => {
    if (existingEntry || driverId) return;
    const prior = (historyData?.entries ?? []).find((e) => e.date < date && e.driverId);
    if (prior?.driverId) setDriverId(prior.driverId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyData]);

  const orderedPaddocks = useMemo(() => [...paddocks].sort(byPaddockNumber), [paddocks]);

  const toggleActivity = (a: string) =>
    setActivities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  const togglePaddock = (code: string) =>
    setPaddockCodes((prev) => (prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]));

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/diesel-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId: asset.id,
        date,
        worked,
        openingReading: opening !== "" ? Number(opening) : null,
        litresFilled: litres !== "" ? Number(litres) : null,
        driverId: driverId || null,
        activities,
        paddockCodes,
        comment: comment.trim() || null,
      }),
    });
    setSaving(false);
    onSaved();
  };

  const handleDelete = async () => {
    if (!existingEntry) return;
    setDeleting(true);
    await fetch(`/api/diesel-entries/${existingEntry.id}`, { method: "DELETE" });
    setDeleting(false);
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
            <span className="keypad-code">{farmName} — {asset.name}</span>
            <span className="stock-panel-qty">{date}{asset.numberPlate ? ` · ${asset.numberPlate}` : ""}</span>
          </div>
          <X size={18} className="close" onClick={onClose} />
        </div>

        <div className="edit-entry-body">
          <div className="field">
            <span className="field-label">Today</span>
            <div className="chip-wrap">
              <button className={`range-chip${worked ? " on" : ""}`} onClick={() => setWorked(true)}>Worked</button>
              <button className={`range-chip${!worked ? " on" : ""}`} onClick={() => setWorked(false)}>Parked</button>
            </div>
          </div>

          {worked && (
            <>
              <label className="field">
                <span className="field-label">Driver</span>
                <select className="field-input" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
                  <option value="">(none)</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">Opening {asset.unit === "HOURS" ? "hours" : "km"}</span>
                <input
                  className="field-input"
                  type="number"
                  inputMode="decimal"
                  value={opening}
                  onChange={(e) => setOpening(e.target.value)}
                  placeholder={asset.unit === "HOURS" ? "e.g. 1204.5" : "e.g. 88210"}
                />
              </label>

              <label className="field">
                <span className="field-label">Litres filled (only on a fill day)</span>
                <input className="field-input" type="number" inputMode="decimal" value={litres} onChange={(e) => setLitres(e.target.value)} placeholder="Leave blank if you didn't fill today" />
                <span className="field-hint">Doesn&apos;t need to be every day — if it&apos;s a few days between fills, this fill gets spread back over the days worked since the last one, by hours/km worked each day.</span>
              </label>

              <div className="field">
                <span className="field-label">Activity ({activities.length} selected)</span>
                <div className="chip-wrap">
                  {DIESEL_ACTIVITIES.map((a) => (
                    <button key={a} className={`paddock-chip fert-chip${activities.includes(a) ? " on" : ""}`} onClick={() => toggleActivity(a)}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div className="paddock-picker-head">
                <span className="field-label">Location ({paddockCodes.length} selected)</span>
                <div className="paddock-picker-actions">
                  <button className="link-btn" onClick={() => setPaddockCodes(orderedPaddocks.map((p) => p.code))}>Select all</button>
                  <button className="link-btn" onClick={() => setPaddockCodes([])}>Clear</button>
                </div>
              </div>
              <div className="paddock-picker-list">
                {orderedPaddocks.map((p) => {
                  const on = paddockCodes.includes(p.code);
                  return (
                    <button key={p.id} className={`paddock-chip${on ? " on" : ""}`} onClick={() => togglePaddock(p.code)}>
                      <span className="paddock-chip-check">{on ? "✓" : ""}</span>
                      {p.code}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <label className="field" style={{ marginTop: 10 }}>
            <span className="field-label">Comment</span>
            <textarea
              className="field-input"
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={worked ? "e.g. Road trip, not field work" : "e.g. In for repairs"}
            />
          </label>

          <div className="edit-entry-actions" style={{ marginTop: 14 }}>
            <button className="save-btn" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            {existingEntry && (
              <button className="delete-btn" onClick={handleDelete} disabled={deleting}>
                <Trash2 size={14} strokeWidth={1.75} />
                {deleting ? "Deleting…" : "Delete this entry"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
