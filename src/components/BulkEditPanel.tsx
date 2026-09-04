"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { LAND_PREP_METHODS, BALE_TYPES } from "@/lib/constants";
import type { FertilizerType } from "@/lib/types";

export type BulkTarget = { id: string; isWalk: boolean };

export function BulkEditPanel({
  targets,
  type,
  onClose,
  onDone,
}: {
  targets: BulkTarget[];
  type: string; // activity type, or "WALK"
  onClose: () => void;
  onDone: () => void;
}) {
  const { data: fertData } = useApi<{ types: FertilizerType[] }>("/api/fertilizer-types");
  const fertTypes = fertData?.types ?? [];

  const isWalk = type === "WALK";

  const [dateOn, setDateOn] = useState(false);
  const [date, setDate] = useState("");
  const [notesOn, setNotesOn] = useState(false);
  const [notes, setNotes] = useState("");
  const [productOn, setProductOn] = useState(false);
  const [product, setProduct] = useState("");
  const [rateOn, setRateOn] = useState(false);
  const [rate, setRate] = useState("");
  const [methodOn, setMethodOn] = useState(false);
  const [method, setMethod] = useState("");
  const [depthOn, setDepthOn] = useState(false);
  const [depth, setDepth] = useState("");
  const [balesOn, setBalesOn] = useState(false);
  const [bales, setBales] = useState("");
  const [coverOn, setCoverOn] = useState(false);
  const [cover, setCover] = useState("");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const anyFieldOn = dateOn || notesOn || productOn || rateOn || methodOn || depthOn || balesOn || coverOn;

  const handleApply = async () => {
    if (!anyFieldOn) return;
    setSaving(true);
    setErrorMsg(null);

    if (isWalk) {
      const body: Record<string, unknown> = {};
      if (dateOn) body.date = date;
      if (coverOn) body.cover = Number(cover);
      const results = await Promise.all(
        targets.map((t) => fetch(`/api/pasture-walks/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }))
      );
      setSaving(false);
      if (results.some((r) => !r.ok)) { setErrorMsg("Some entries couldn't be updated."); return; }
      onDone();
      return;
    }

    const body: Record<string, unknown> = {};
    if (dateOn) body.date = date;
    if (notesOn) body.notes = notes;
    if (productOn) body.product = product;
    if (rateOn) body.rate = Number(rate);
    if (methodOn) body.method = method;
    if (depthOn) body.depth = Number(depth);
    if (balesOn) body.bales = Number(bales);

    const results = await Promise.all(
      targets.map((t) => fetch(`/api/field-activities/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }))
    );
    setSaving(false);
    if (results.some((r) => !r.ok)) { setErrorMsg("Some entries couldn't be updated — check they all have valid values."); return; }
    onDone();
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const TYPE_NAME: Record<string, string> = {
    FERTILIZER: "Fertilizer", MULCHING: "Mulching", PLANTING: "Planting",
    LAND_PREP: "Land prep", SPRAYING: "Spraying", MOWING: "Mowing for bailing", BAILING: "Bailing", WALK: "Pasture walk",
  };

  return createPortal(
    <div className="edit-entry-overlay" onClick={onClose}>
      <div className="edit-entry-panel" onClick={(e) => e.stopPropagation()}>
        <div className="keypad-header">
          <div className="stock-panel-title">
            <span className="keypad-code">Edit {targets.length} {TYPE_NAME[type]} entries</span>
          </div>
          <X size={18} className="close" onClick={onClose} />
        </div>

        <div className="edit-entry-body">
          <p className="field-hint">Tick a field to overwrite it on all {targets.length} selected entries. Leave the rest unticked to keep them as they are.</p>

          <label className="bulk-field-row">
            <input type="checkbox" checked={dateOn} onChange={(e) => setDateOn(e.target.checked)} />
            <span className="field-label">Date</span>
            <input className="field-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!dateOn} />
          </label>

          {!isWalk && (
            <label className="bulk-field-row">
              <input type="checkbox" checked={notesOn} onChange={(e) => setNotesOn(e.target.checked)} />
              <span className="field-label">Notes</span>
              <input className="field-input" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!notesOn} />
            </label>
          )}

          {type === "FERTILIZER" && (
            <>
              <label className="bulk-field-row">
                <input type="checkbox" checked={productOn} onChange={(e) => setProductOn(e.target.checked)} />
                <span className="field-label">Fertilizer type</span>
                <select className="field-input" value={product} onChange={(e) => setProduct(e.target.value)} disabled={!productOn}>
                  <option value="">Select…</option>
                  {fertTypes.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </label>
              <label className="bulk-field-row">
                <input type="checkbox" checked={rateOn} onChange={(e) => setRateOn(e.target.checked)} />
                <span className="field-label">Rate (kg/ha)</span>
                <input className="field-input" type="number" value={rate} onChange={(e) => setRate(e.target.value)} disabled={!rateOn} />
              </label>
            </>
          )}

          {type === "LAND_PREP" && (
            <>
              <label className="bulk-field-row">
                <input type="checkbox" checked={methodOn} onChange={(e) => setMethodOn(e.target.checked)} />
                <span className="field-label">Method</span>
                <select className="field-input" value={method} onChange={(e) => setMethod(e.target.value)} disabled={!methodOn}>
                  <option value="">Select…</option>
                  {LAND_PREP_METHODS.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
                </select>
              </label>
              <label className="bulk-field-row">
                <input type="checkbox" checked={depthOn} onChange={(e) => setDepthOn(e.target.checked)} />
                <span className="field-label">Depth (cm)</span>
                <input className="field-input" type="number" value={depth} onChange={(e) => setDepth(e.target.value)} disabled={!depthOn} />
              </label>
            </>
          )}

          {type === "BAILING" && (
            <>
              <label className="bulk-field-row">
                <input type="checkbox" checked={productOn} onChange={(e) => setProductOn(e.target.checked)} />
                <span className="field-label">Bale type</span>
                <select className="field-input" value={product} onChange={(e) => setProduct(e.target.value)} disabled={!productOn}>
                  <option value="">Select…</option>
                  {BALE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="bulk-field-row">
                <input type="checkbox" checked={balesOn} onChange={(e) => setBalesOn(e.target.checked)} />
                <span className="field-label">Bales</span>
                <input className="field-input" type="number" value={bales} onChange={(e) => setBales(e.target.value)} disabled={!balesOn} />
              </label>
            </>
          )}

          {isWalk && (
            <label className="bulk-field-row">
              <input type="checkbox" checked={coverOn} onChange={(e) => setCoverOn(e.target.checked)} />
              <span className="field-label">Cover (kg DM/ha)</span>
              <input className="field-input" type="number" value={cover} onChange={(e) => setCover(e.target.value)} disabled={!coverOn} />
            </label>
          )}

          {(type === "MULCHING" || type === "MOWING" || type === "PLANTING" || type === "SPRAYING") && (
            <p className="field-hint">Seed mix / chemical lists can&apos;t be bulk-edited — open an entry individually for those.</p>
          )}

          {errorMsg && <p className="error-note">{errorMsg}</p>}

          <div className="edit-entry-actions">
            <button className="save-btn" onClick={handleApply} disabled={!anyFieldOn || saving}>
              {saving ? "Applying…" : `Apply to ${targets.length} entries`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
