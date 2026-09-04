"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Trash2 } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { LAND_PREP_METHODS, BALE_TYPES, CROP_TYPES, CROP_UNITS } from "@/lib/constants";
import type { FertilizerType, ChemicalType, SeedVariety } from "@/lib/types";

type MixItem = { crop: string; variety: string | null; rate: number; unit: string };
type ChemItem = { name: string; rate: number; unit: string };

export type EditableEntry =
  | {
      kind: "activity";
      id: string;
      type: "FERTILIZER" | "MULCHING" | "PLANTING" | "LAND_PREP" | "SPRAYING" | "MOWING" | "BAILING";
      date: string;
      notes: string | null;
      product: string | null;
      rate: number | null;
      method: string | null;
      depth: number | null;
      mix: MixItem[] | null;
      chemicals: ChemItem[] | null;
      bales: number | null;
    }
  | { kind: "walk"; id: string; date: string; cover: number };

type MixRow = { rowId: string; crop: string; variety: string; rate: string };
type ChemRow = { rowId: string; name: string; rate: string };

const rid = () => Math.random().toString(36).slice(2);

export function EditEntryPanel({
  entry,
  paddockCode,
  paddockSizeHa,
  onClose,
  onSaved,
  onDeleted,
}: {
  entry: EditableEntry;
  paddockCode: string;
  paddockSizeHa: number | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const { data: fertData } = useApi<{ types: FertilizerType[] }>("/api/fertilizer-types");
  const fertTypes = fertData?.types ?? [];
  const { data: chemData } = useApi<{ types: ChemicalType[] }>("/api/chemical-types");
  const chemTypes = chemData?.types ?? [];
  const { data: varietyData } = useApi<{ varieties: SeedVariety[] }>("/api/seed-varieties");
  const varieties = varietyData?.varieties ?? [];

  const isWalk = entry.kind === "walk";
  const [date, setDate] = useState(entry.date.slice(0, 10));
  const [notes, setNotes] = useState(isWalk ? "" : entry.notes ?? "");
  const [product, setProduct] = useState(isWalk ? "" : entry.product ?? "");
  const [rate, setRate] = useState(isWalk ? "" : entry.rate != null ? String(entry.rate) : "");
  const [method, setMethod] = useState(isWalk ? "" : entry.method ?? "");
  const [depth, setDepth] = useState(isWalk ? "" : entry.depth != null ? String(entry.depth) : "");
  const [bales, setBales] = useState(isWalk ? "" : entry.bales != null ? String(entry.bales) : "");
  const [cover, setCover] = useState(isWalk ? String(entry.cover) : "");
  const [mixRows, setMixRows] = useState<MixRow[]>(
    !isWalk && entry.mix?.length
      ? entry.mix.map((m) => ({ rowId: rid(), crop: m.crop, variety: m.variety ?? "", rate: String(m.rate) }))
      : [{ rowId: rid(), crop: "", variety: "", rate: "" }]
  );
  const [chemRows, setChemRows] = useState<ChemRow[]>(
    !isWalk && entry.chemicals?.length
      ? entry.chemicals.map((c) => ({ rowId: rid(), name: c.name, rate: String(c.rate) }))
      : [{ rowId: rid(), name: "", rate: "" }]
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const type = !isWalk ? entry.type : null;

  const addMixRow = () => setMixRows((prev) => [...prev, { rowId: rid(), crop: "", variety: "", rate: "" }]);
  const removeMixRow = (rowId: string) =>
    setMixRows((prev) => (prev.length > 1 ? prev.filter((r) => r.rowId !== rowId) : prev));
  const updateMixRow = (rowId: string, patch: Partial<MixRow>) =>
    setMixRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch, ...(patch.crop ? { variety: "" } : {}) } : r)));

  const addChemRow = () => setChemRows((prev) => [...prev, { rowId: rid(), name: "", rate: "" }]);
  const removeChemRow = (rowId: string) =>
    setChemRows((prev) => (prev.length > 1 ? prev.filter((r) => r.rowId !== rowId) : prev));
  const updateChemRow = (rowId: string, patch: Partial<ChemRow>) =>
    setChemRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  const chosenChemNames = new Set(chemRows.map((r) => r.name).filter(Boolean));

  const bailingPerHa = paddockSizeHa && Number(bales) > 0 ? Number(bales) / paddockSizeHa : null;

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);

    if (isWalk) {
      const res = await fetch(`/api/pasture-walks/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, cover: Number(cover) }),
      });
      setSaving(false);
      if (!res.ok) { setErrorMsg("Couldn't save — try again."); return; }
      onSaved();
      return;
    }

    const mixPayload = type === "PLANTING"
      ? mixRows.filter((r) => r.crop && Number(r.rate) > 0).map((r) => ({ crop: r.crop, variety: r.variety || null, rate: Number(r.rate), unit: CROP_UNITS[r.crop] }))
      : undefined;
    const chemicalsPayload = type === "SPRAYING"
      ? chemRows.filter((r) => r.name && Number(r.rate) > 0).map((r) => {
          const t = chemTypes.find((c) => c.name === r.name);
          return { name: r.name, rate: Number(r.rate), unit: t?.unit ?? "" };
        })
      : undefined;

    const res = await fetch(`/api/field-activities/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        notes: notes || null,
        product: type === "FERTILIZER" || type === "BAILING" ? product : undefined,
        rate: type === "FERTILIZER" ? Number(rate) : undefined,
        method: type === "LAND_PREP" ? method : undefined,
        depth: type === "LAND_PREP" && depth ? Number(depth) : undefined,
        mix: mixPayload,
        chemicals: chemicalsPayload,
        bales: type === "BAILING" ? Number(bales) : undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setErrorMsg(json?.error || "Couldn't save — try again.");
      return;
    }
    onSaved();
  };

  const handleDelete = async () => {
    if (!confirmingDelete) { setConfirmingDelete(true); return; }
    setDeleting(true);
    setErrorMsg(null);
    const url = isWalk ? `/api/pasture-walks/${entry.id}` : `/api/field-activities/${entry.id}`;
    const res = await fetch(url, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) { setErrorMsg("Couldn't delete — try again."); return; }
    onDeleted();
  };

  const TYPE_NAME: Record<string, string> = {
    FERTILIZER: "Fertilizer", MULCHING: "Mulching", PLANTING: "Planting",
    LAND_PREP: "Land prep", SPRAYING: "Spraying", MOWING: "Mowing for bailing", BAILING: "Bailing",
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="edit-entry-overlay" onClick={onClose}>
      <div className="edit-entry-panel" onClick={(e) => e.stopPropagation()}>
        <div className="keypad-header">
          <div className="stock-panel-title">
            <span className="keypad-code">{isWalk ? "Pasture walk" : TYPE_NAME[type!]} — {paddockCode}</span>
          </div>
          <X size={18} className="close" onClick={onClose} />
        </div>

        <div className="edit-entry-body">
          {isWalk ? (
            <label className="field">
              <span className="field-label">Cover (kg DM/ha)</span>
              <input className="field-input" type="number" inputMode="numeric" value={cover} onChange={(e) => setCover(e.target.value)} />
            </label>
          ) : (
            <>
              {type === "FERTILIZER" && (
                <>
                  <label className="field">
                    <span className="field-label">Fertilizer type</span>
                    <select className="field-input" value={product} onChange={(e) => setProduct(e.target.value)}>
                      <option value="">Select…</option>
                      {fertTypes.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field-label">Rate (kg/ha)</span>
                    <input className="field-input" type="number" inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value)} />
                  </label>
                </>
              )}

              {type === "LAND_PREP" && (
                <>
                  <label className="field">
                    <span className="field-label">Method</span>
                    <select className="field-input" value={method} onChange={(e) => setMethod(e.target.value)}>
                      <option value="">Select…</option>
                      {LAND_PREP_METHODS.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field-label">Depth (cm)</span>
                    <input className="field-input" type="number" inputMode="numeric" value={depth} onChange={(e) => setDepth(e.target.value)} />
                  </label>
                </>
              )}

              {type === "PLANTING" && (
                <div className="field">
                  <span className="field-label">Seed mix</span>
                  <div className="chem-rows">
                    {mixRows.map((row) => {
                      const cropVarieties = row.crop ? varieties.filter((v) => v.cropType === row.crop) : [];
                      return (
                        <div key={row.rowId} className="chem-row mix-row-grid">
                          <select className="field-input" value={row.crop} onChange={(e) => updateMixRow(row.rowId, { crop: e.target.value })}>
                            <option value="">Select crop…</option>
                            {CROP_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                          {row.crop && (
                            <select className="field-input" value={row.variety} onChange={(e) => updateMixRow(row.rowId, { variety: e.target.value })}>
                              <option value="">{cropVarieties.length === 0 ? "No varieties" : "Variety…"}</option>
                              {cropVarieties.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
                            </select>
                          )}
                          <input
                            className="field-input small"
                            type="number"
                            inputMode="numeric"
                            value={row.rate}
                            onChange={(e) => updateMixRow(row.rowId, { rate: e.target.value })}
                            placeholder="Rate"
                          />
                          <span className="chem-row-unit">{row.crop ? CROP_UNITS[row.crop] : ""}</span>
                          <button type="button" className="link-btn chem-row-remove" onClick={() => removeMixRow(row.rowId)} disabled={mixRows.length === 1} aria-label="Remove crop">
                            <X size={16} strokeWidth={1.75} />
                          </button>
                        </div>
                      );
                    })}
                    <button type="button" className="link-btn" onClick={addMixRow}>+ Add crop</button>
                  </div>
                </div>
              )}

              {type === "SPRAYING" && (
                <div className="field">
                  <span className="field-label">Chemicals</span>
                  <div className="chem-rows">
                    {chemRows.map((row) => (
                      <div key={row.rowId} className="chem-row">
                        <select className="field-input" value={row.name} onChange={(e) => updateChemRow(row.rowId, { name: e.target.value })}>
                          <option value="">Select chemical…</option>
                          {chemTypes.filter((c) => c.name === row.name || !chosenChemNames.has(c.name)).map((c) => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                        <input
                          className="field-input small"
                          type="number"
                          inputMode="decimal"
                          value={row.rate}
                          onChange={(e) => updateChemRow(row.rowId, { rate: e.target.value })}
                          placeholder="Rate"
                        />
                        <span className="chem-row-unit">{chemTypes.find((c) => c.name === row.name)?.unit ?? ""}</span>
                        <button type="button" className="link-btn chem-row-remove" onClick={() => removeChemRow(row.rowId)} disabled={chemRows.length === 1} aria-label="Remove chemical">
                          <X size={16} strokeWidth={1.75} />
                        </button>
                      </div>
                    ))}
                    <button type="button" className="link-btn" onClick={addChemRow}>+ Add chemical</button>
                  </div>
                </div>
              )}

              {type === "BAILING" && (
                <>
                  <label className="field">
                    <span className="field-label">Bale type</span>
                    <select className="field-input" value={product} onChange={(e) => setProduct(e.target.value)}>
                      <option value="">Select…</option>
                      {BALE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field-label">Bales</span>
                    <input className="field-input" type="number" inputMode="numeric" value={bales} onChange={(e) => setBales(e.target.value)} />
                    {bailingPerHa != null && <p className="field-hint">≈ {bailingPerHa.toFixed(1)} bales/ha</p>}
                  </label>
                </>
              )}

              <label className="field">
                <span className="field-label">Notes</span>
                <textarea className="field-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
            </>
          )}

          <label className="field">
            <span className="field-label">Date</span>
            <input className="field-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          {errorMsg && <p className="error-note">{errorMsg}</p>}

          <div className="edit-entry-actions">
            <button className="save-btn" onClick={handleSave} disabled={saving || deleting}>
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              className={`delete-btn${confirmingDelete ? " confirm" : ""}`}
              onClick={handleDelete}
              disabled={saving || deleting}
            >
              <Trash2 size={14} strokeWidth={1.75} />
              {deleting ? "Deleting…" : confirmingDelete ? "Click again to confirm" : "Delete entry"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
