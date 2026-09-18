"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, X } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { todayStr, sanitizeDecimalInput } from "@/lib/utils";
import { maizeSeasonFor } from "@/lib/maizeSeason";
import type { Farm, MaizeFieldSeason } from "@/lib/types";

const COLUMN_STORAGE_KEY = "maize-history-column-order";

type ColumnKey =
  | "season" | "variety" | "varietyLength" | "plantDate" | "estMaturityDate" | "cutDate"
  | "population" | "yieldTonPerHa" | "firstPostSprayDate" | "lastTractorEntryDate"
  | "firstTopDressingDate" | "secondTopDressingDate" | "silagePit" | "seedCostPerHa" | "notes";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "season", label: "Season" },
  { key: "variety", label: "Variety" },
  { key: "varietyLength", label: "Variety length" },
  { key: "plantDate", label: "Plant date" },
  { key: "estMaturityDate", label: "Est. maturity" },
  { key: "cutDate", label: "Cut date" },
  { key: "population", label: "Population/ha" },
  { key: "yieldTonPerHa", label: "Yield t/ha" },
  { key: "firstPostSprayDate", label: "1st post-spray" },
  { key: "lastTractorEntryDate", label: "Last tractor entry" },
  { key: "firstTopDressingDate", label: "1st top dress" },
  { key: "secondTopDressingDate", label: "2nd top dress" },
  { key: "silagePit", label: "Silage pit" },
  { key: "seedCostPerHa", label: "Seed cost R/ha" },
  { key: "notes", label: "Notes" },
];
const DATE_KEYS = new Set<ColumnKey>(["plantDate", "estMaturityDate", "cutDate", "firstPostSprayDate", "lastTractorEntryDate", "firstTopDressingDate", "secondTopDressingDate"]);

function cellValue(s: MaizeFieldSeason, key: ColumnKey): string {
  const v = s[key];
  if (v == null) return "—";
  if (DATE_KEYS.has(key)) return String(v).slice(0, 10);
  return String(v);
}

function useColumnOrder() {
  const [order, setOrder] = useState<ColumnKey[]>(COLUMNS.map((c) => c.key));
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLUMN_STORAGE_KEY);
      if (saved) {
        const parsed: ColumnKey[] = JSON.parse(saved);
        const valid = parsed.filter((k) => COLUMNS.some((c) => c.key === k));
        if (valid.length === COLUMNS.length) setOrder(valid);
      }
    } catch {
      // ignore — falls back to default order
    }
  }, []);
  const reorder = (dragKey: ColumnKey, dropKey: ColumnKey) => {
    if (dragKey === dropKey) return;
    setOrder((prev) => {
      const next = prev.filter((k) => k !== dragKey);
      const dropIndex = next.indexOf(dropKey);
      next.splice(dropIndex, 0, dragKey);
      try { localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  return { order, reorder };
}

const emptyForm = {
  season: "", variety: "", varietyLength: "", plantDate: "", estMaturityDate: "", cutDate: "",
  population: "", yieldTonPerHa: "", firstPostSprayDate: "", lastTractorEntryDate: "",
  firstTopDressingDate: "", secondTopDressingDate: "", silagePit: "", seedCostPerHa: "", notes: "",
};
type FormState = typeof emptyForm;

function dateField(label: string, value: string, onChange: (v: string) => void) {
  return (
    <label className="field" style={{ flex: 1, minWidth: 140 }}>
      <span className="field-label">{label}</span>
      <input className="field-input" type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function textField(label: string, value: string, onChange: (v: string) => void, placeholder?: string) {
  return (
    <label className="field" style={{ flex: 1, minWidth: 140 }}>
      <span className="field-label">{label}</span>
      <input className="field-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}
function numField(label: string, value: string, onChange: (v: string) => void, placeholder?: string) {
  return (
    <label className="field" style={{ flex: 1, minWidth: 140 }}>
      <span className="field-label">{label}</span>
      <input className="field-input" type="text" inputMode="decimal" value={value} onChange={(e) => onChange(sanitizeDecimalInput(e.target.value))} placeholder={placeholder} />
    </label>
  );
}

function FieldDetailSheet({
  farmId, paddockId, paddockCode, onClose, onSaved,
}: {
  farmId: string; paddockId: string; paddockCode: string; onClose: () => void; onSaved: () => void;
}) {
  const { data, refetch } = useApi<{ entries: MaizeFieldSeason[] }>(`/api/maize-field-seasons?paddockId=${paddockId}`);
  const seasons = data?.entries ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ ...emptyForm, season: maizeSeasonFor(todayStr()) });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof FormState>(key: K) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  const resetForm = () => { setEditingId(null); setForm({ ...emptyForm, season: maizeSeasonFor(todayStr()) }); };
  const startEdit = (s: MaizeFieldSeason) => {
    setEditingId(s.id);
    setForm({
      season: s.season, variety: s.variety ?? "", varietyLength: s.varietyLength ?? "",
      plantDate: s.plantDate?.slice(0, 10) ?? "", estMaturityDate: s.estMaturityDate?.slice(0, 10) ?? "", cutDate: s.cutDate?.slice(0, 10) ?? "",
      population: s.population != null ? String(s.population) : "", yieldTonPerHa: s.yieldTonPerHa != null ? String(s.yieldTonPerHa) : "",
      firstPostSprayDate: s.firstPostSprayDate?.slice(0, 10) ?? "", lastTractorEntryDate: s.lastTractorEntryDate?.slice(0, 10) ?? "",
      firstTopDressingDate: s.firstTopDressingDate?.slice(0, 10) ?? "", secondTopDressingDate: s.secondTopDressingDate?.slice(0, 10) ?? "",
      silagePit: s.silagePit ?? "", seedCostPerHa: s.seedCostPerHa != null ? String(s.seedCostPerHa) : "", notes: s.notes ?? "",
    });
  };

  const save = async () => {
    if (!form.season.trim()) return;
    setSaving(true);
    const body = {
      farmId, paddockId, season: form.season.trim(),
      variety: form.variety || null, varietyLength: form.varietyLength || null,
      plantDate: form.plantDate || null, estMaturityDate: form.estMaturityDate || null, cutDate: form.cutDate || null,
      population: form.population !== "" ? Number(form.population) : null,
      yieldTonPerHa: form.yieldTonPerHa !== "" ? Number(form.yieldTonPerHa) : null,
      firstPostSprayDate: form.firstPostSprayDate || null, lastTractorEntryDate: form.lastTractorEntryDate || null,
      firstTopDressingDate: form.firstTopDressingDate || null, secondTopDressingDate: form.secondTopDressingDate || null,
      silagePit: form.silagePit || null, seedCostPerHa: form.seedCostPerHa !== "" ? Number(form.seedCostPerHa) : null,
      notes: form.notes || null,
    };
    await fetch("/api/maize-field-seasons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    resetForm();
    refetch();
    onSaved();
  };

  const remove = async (id: string) => {
    await fetch(`/api/maize-field-seasons/${id}`, { method: "DELETE" });
    if (editingId === id) resetForm();
    refetch();
    onSaved();
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="detail-sheet-overlay" onClick={onClose}>
      <div className="detail-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ds-head">
          <h2>{paddockCode}</h2>
          <button className="close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <p className="field-hint" style={{ marginBottom: 10 }}>
          Planting, spraying and top-dressing fill most of this in automatically as they&apos;re logged in Field activities — maturity, cut date, silage pit, seed cost and yield still need entering by hand.
        </p>
        <div className="form" style={{ gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {textField("Season", form.season, set("season"), "e.g. 2026/27")}
            {textField("Variety", form.variety, set("variety"))}
            {textField("Variety length", form.varietyLength, set("varietyLength"), "e.g. Medium")}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {dateField("Plant date", form.plantDate, set("plantDate"))}
            {dateField("Est. maturity date", form.estMaturityDate, set("estMaturityDate"))}
            {dateField("Cut date", form.cutDate, set("cutDate"))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {numField("Population (/ha)", form.population, set("population"))}
            {numField("Yield (t/ha)", form.yieldTonPerHa, set("yieldTonPerHa"))}
            {numField("Seed cost (R/ha)", form.seedCostPerHa, set("seedCostPerHa"))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {dateField("First post-spray date", form.firstPostSprayDate, set("firstPostSprayDate"))}
            {dateField("Last tractor entry date", form.lastTractorEntryDate, set("lastTractorEntryDate"))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {dateField("1st top dressing date", form.firstTopDressingDate, set("firstTopDressingDate"))}
            {dateField("2nd top dressing date", form.secondTopDressingDate, set("secondTopDressingDate"))}
          </div>
          {textField("Silage pit", form.silagePit, set("silagePit"))}
          <label className="field">
            <span className="field-label">Notes</span>
            <input className="field-input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="optional" />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="save-btn small" onClick={save} disabled={saving || !form.season.trim()}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Add season"}
            </button>
            {editingId && <button className="link-btn" onClick={resetForm}>Cancel</button>}
          </div>
        </div>

        <div className="field" style={{ marginTop: 16 }}>
          <span className="field-label">History</span>
          {seasons.length === 0 && <p className="ds-note">No seasons logged yet for this field.</p>}
          {seasons.map((s) => (
            <div key={s.id} className={`settings-row${editingId === s.id ? " active" : ""}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button className="link-btn" style={{ textAlign: "left" }} onClick={() => startEdit(s)}>
                  {s.season}{s.variety ? ` — ${s.variety}` : ""}{s.plantDate ? ` — planted ${s.plantDate.slice(0, 10)}` : ""}{s.yieldTonPerHa ? ` — ${s.yieldTonPerHa}t/ha` : ""}
                </button>
                <button className="link-btn" onClick={() => remove(s.id)} aria-label="Delete season"><Trash2 size={15} strokeWidth={1.75} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function MaizeHistoryPage() {
  const { data: farmsData, loading } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];
  const [farmId, setFarmId] = useState<string | null>(null);
  const farm = farms.find((f) => f.id === (farmId ?? farms[0]?.id)) ?? farms[0];
  const [selected, setSelected] = useState<{ id: string; code: string } | null>(null);
  const [dragKey, setDragKey] = useState<ColumnKey | null>(null);
  const { order, reorder } = useColumnOrder();

  const { data: seasonsData, refetch } = useApi<{ entries: MaizeFieldSeason[] }>(farm ? `/api/maize-field-seasons?farmId=${farm.id}` : null);

  // A field belongs here if it's currently classified Maize, or has any
  // season history at all (so a field rotated out of maize doesn't lose
  // its past records from view). One row per field, showing its latest season.
  const rows = useMemo(() => {
    if (!farm) return [];
    const byId = new Map<string, { id: string; code: string; latest: MaizeFieldSeason | null }>();
    farm.paddocks.filter((p) => p.landType === "Maize").forEach((p) => byId.set(p.id, { id: p.id, code: p.code, latest: null }));
    (seasonsData?.entries ?? []).forEach((s) => {
      const existing = byId.get(s.paddockId);
      if (existing) { if (!existing.latest) existing.latest = s; } // entries already sorted desc by season
      else byId.set(s.paddockId, { id: s.paddockId, code: s.paddockCode ?? s.paddockId, latest: s });
    });
    return [...byId.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [farm, seasonsData]);

  if (loading) return <div className="screen"><Header title="Maize History" backHref="/farm/maize" /><Spinner /></div>;
  if (!farm) return <div className="screen"><Header title="Maize History" backHref="/farm/maize" /><div className="empty">No farms found.</div></div>;

  return (
    <div className="screen">
      <Header title="Maize History" backHref="/farm/maize" />
      <div className="tabs">
        {farms.map((f) => (
          <button key={f.id} className={`tab${farm.id === f.id ? " active" : ""}`} onClick={() => { setFarmId(f.id); setSelected(null); }}>{f.name}</button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="ds-note" style={{ padding: "12px 18px" }}>No maize fields classified on {farm.name} yet — classify a field as Maize in Edit fields first.</p>
      ) : (
        <>
          <p className="field-hint" style={{ padding: "10px 18px 0" }}>Drag a column heading to reorder it. Tap a row to see or edit that field&apos;s full history.</p>
          <div className="maize-sheet-scroll">
            <table className="maize-sheet-table">
              <thead>
                <tr>
                  <th className="maize-sheet-sticky">Field</th>
                  {order.map((key) => {
                    const col = COLUMNS.find((c) => c.key === key)!;
                    return (
                      <th
                        key={key}
                        draggable
                        className={dragKey === key ? "dragging" : ""}
                        onDragStart={() => setDragKey(key)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => { if (dragKey) reorder(dragKey, key); setDragKey(null); }}
                        onDragEnd={() => setDragKey(null)}
                      >
                        {col.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => setSelected({ id: r.id, code: r.code })}>
                    <td className="maize-sheet-sticky"><strong>{r.code}</strong></td>
                    {order.map((key) => (
                      <td key={key}>{r.latest ? cellValue(r.latest, key) : "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selected && (
        <FieldDetailSheet
          farmId={farm.id}
          paddockId={selected.id}
          paddockCode={selected.code}
          onClose={() => setSelected(null)}
          onSaved={refetch}
        />
      )}
    </div>
  );
}
