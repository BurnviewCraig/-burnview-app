"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { X, UploadCloud, Plus, Trash2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { byPaddockNumber } from "@/lib/utils";
import { LAND_TYPES } from "@/lib/constants";
import type { Farm, Paddock } from "@/lib/types";

export default function FieldEditorPage() {
  const { data, loading, error, refetch } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = data?.farms ?? [];
  const [farmId, setFarmId] = useState<string | null>(null);
  const [active, setActive] = useState<Paddock | null>(null);
  const [code, setCode] = useState("");
  const [area, setArea] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ activities: number; walks: number; grazing: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const farm = farms.find((f) => f.id === (farmId ?? farms[0]?.id)) ?? farms[0];
  const orderedPaddocks = useMemo(
    () => (farm ? [...farm.paddocks].sort(byPaddockNumber) : []),
    [farm]
  );

  const switchFarm = (id: string) => {
    setFarmId(id);
    setActive(null);
    setAdding(false);
  };

  const openField = (p: Paddock) => {
    setActive(p);
    setCode(p.code);
    setArea(p.sizeHa != null ? String(p.sizeHa) : "");
    setErrorMsg(null);
    setConfirmDelete(null);
    setAdding(false);
  };

  const handleAdd = async () => {
    if (!farm || !newCode.trim()) return;
    setAddSaving(true);
    setAddError(null);
    const res = await fetch("/api/paddocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ farmId: farm.id, code: newCode.trim() }),
    });
    setAddSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setAddError(json?.error || "Couldn't add that field — try again.");
      return;
    }
    setNewCode("");
    setAdding(false);
    refetch();
  };

  const handleDelete = async () => {
    if (!active) return;
    setDeleting(true);
    setErrorMsg(null);
    const force = confirmDelete != null;
    const res = await fetch(`/api/paddocks/${active.id}${force ? "?force=true" : ""}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      if (res.status === 409 && json?.counts) {
        setConfirmDelete(json.counts);
        return;
      }
      setErrorMsg(json?.error || "Couldn't delete that field — try again.");
      return;
    }
    setActive(null);
    setConfirmDelete(null);
    refetch();
  };

  const handleDone = async () => {
    if (!active) return;
    setSaving(true);
    setErrorMsg(null);
    const res = await fetch(`/api/paddocks/${active.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim(), sizeHa: area !== "" ? Number(area) : null }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setErrorMsg(json?.error || "Couldn't save that field — try again.");
      return;
    }
    setActive(null);
    refetch();
  };

  const setClassification = async (type: string | null) => {
    if (!active) return;
    await fetch(`/api/paddocks/${active.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ landType: type }),
    });
    setActive((prev) => (prev ? { ...prev, landType: type } : prev));
    refetch();
  };

  if (loading) return <div className="screen"><Header title="Edit fields" backHref="/farm" /><Spinner /></div>;
  if (error || !farm) return <div className="screen"><Header title="Edit fields" backHref="/farm" /><div className="empty">{error || "No farms found."}</div></div>;

  return (
    <div className="screen">
      <Header title="Edit fields" backHref="/farm" />

      <div style={{ padding: "10px 18px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link className="link-btn" href="/farm/field-editor/import">
          <UploadCloud size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
          Import boundaries from John Deere
        </Link>
        <button
          className="link-btn"
          onClick={() => {
            setActive(null);
            setAdding((v) => !v);
            setAddError(null);
            setNewCode("");
          }}
        >
          <Plus size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
          Add field
        </button>
      </div>

      {adding && (
        <div className="keypad-panel">
          <div className="keypad-header">
            <div className="stock-panel-title">
              <span className="keypad-code">New field — {farm.name}</span>
            </div>
            <X size={18} className="close" onClick={() => setAdding(false)} />
          </div>
          <label className="field">
            <span className="field-label">Name / code</span>
            <input
              className="field-input small"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="e.g. R78"
              autoFocus
            />
          </label>
          <button className="save-btn keypad-next" onClick={handleAdd} disabled={addSaving || !newCode.trim()} style={{ marginTop: 14 }}>
            {addSaving ? "Adding…" : "Add field"}
          </button>
          {addError && <p className="error-note">{addError}</p>}
        </div>
      )}

      <div className="tabs">
        {farms.map((f) => (
          <button key={f.id} className={`tab${farm.id === f.id ? " active" : ""}`} onClick={() => switchFarm(f.id)}>
            {f.name}
          </button>
        ))}
      </div>

      <div className="walk-list" style={{ paddingBottom: active ? 260 : 0 }}>
        {orderedPaddocks.map((p) => (
          <button key={p.id} className={`walk-row${active?.id === p.id ? " active" : ""}`} onClick={() => openField(p)}>
            <span className="wr-code">{p.code}</span>
            <span className="field-editor-sub">{p.sizeHa ? `${p.sizeHa} ha` : "No size set"} · {p.landType || "Unclassified"}</span>
          </button>
        ))}
      </div>

      {active && (
        <div className="keypad-panel">
          <div className="keypad-header">
            <div className="stock-panel-title">
              <span className="keypad-code">{farm.name} — {active.code}</span>
              <span className="stock-panel-qty">Currently: {active.landType || "Unclassified"}</span>
            </div>
            <X size={18} className="close" onClick={() => setActive(null)} />
          </div>

          <label className="field">
            <span className="field-label">Name / code</span>
            <input
              className="field-input small"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. 09"
            />
          </label>

          <label className="field">
            <span className="field-label">Size (ha)</span>
            <input
              className="field-input small"
              type="number"
              inputMode="decimal"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="e.g. 8.2"
            />
          </label>

          <div className="field" style={{ marginTop: 10 }}>
            <span className="field-label">Classification</span>
            <div className="chip-wrap">
              {LAND_TYPES.map((t) => (
                <button
                  key={t}
                  className={`range-chip${active.landType === t ? " on" : ""}`}
                  onClick={() => setClassification(active.landType === t ? null : t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <button className="save-btn keypad-next" onClick={handleDone} disabled={saving || !code.trim()} style={{ marginTop: 14 }}>
            {saving ? "Saving…" : "Done"}
          </button>
          {errorMsg && <p className="error-note">{errorMsg}</p>}

          {confirmDelete ? (
            <div style={{ marginTop: 14 }}>
              <p className="error-note">
                This field has {confirmDelete.activities} logged {confirmDelete.activities === 1 ? "activity" : "activities"},{" "}
                {confirmDelete.walks} pasture {confirmDelete.walks === 1 ? "walk" : "walks"} and {confirmDelete.grazing} grazing{" "}
                {confirmDelete.grazing === 1 ? "entry" : "entries"} — deleting it deletes that history too. Delete anyway?
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="delete-btn" onClick={handleDelete} disabled={deleting}>
                  {deleting ? "Deleting…" : "Yes, delete field & history"}
                </button>
                <button className="link-btn" onClick={() => setConfirmDelete(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="delete-btn" onClick={handleDelete} disabled={deleting} style={{ marginTop: 10 }}>
              <Trash2 size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
              {deleting ? "Deleting…" : "Delete field"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
