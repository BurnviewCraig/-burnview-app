"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, X } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { todayStr, sanitizeDecimalInput } from "@/lib/utils";
import { maizeSeasonFor } from "@/lib/maizeSeason";
import { FARM_SECTIONS } from "@/lib/constants";
import type { Farm, MaizeFieldSeason } from "@/lib/types";

const COLUMN_STORAGE_KEY = "maize-history-column-order";
const ALL_FARMS_ID = "__all__";

type ColumnKey =
  | "season" | "variety" | "varietyLength" | "plantDate" | "estMaturityDate" | "cutDate"
  | "population" | "yieldTonPerHa" | "burndownDate" | "preGerminationSprayDate" | "firstPostSprayDate" | "lastTractorEntryDate"
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
  { key: "burndownDate", label: "Burndown" },
  { key: "preGerminationSprayDate", label: "Pre-germination spray" },
  { key: "firstPostSprayDate", label: "1st post-spray" },
  { key: "lastTractorEntryDate", label: "Last tractor entry" },
  { key: "firstTopDressingDate", label: "1st top dress" },
  { key: "secondTopDressingDate", label: "2nd top dress" },
  { key: "silagePit", label: "Silage pit" },
  { key: "seedCostPerHa", label: "Seed cost R/ha" },
  { key: "notes", label: "Notes" },
];
const DATE_KEYS = new Set<ColumnKey>([
  "plantDate", "estMaturityDate", "cutDate", "burndownDate", "preGerminationSprayDate",
  "firstPostSprayDate", "lastTractorEntryDate", "firstTopDressingDate", "secondTopDressingDate",
]);

function cellValue(s: MaizeFieldSeason, key: ColumnKey): string {
  const v = s[key];
  if (v == null) return "—";
  if (DATE_KEYS.has(key)) return String(v).slice(0, 10);
  return String(v);
}

// Column order is just a personal display preference, so it stays a
// per-browser thing via localStorage.
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
  population: "", yieldTonPerHa: "", burndownDate: "", preGerminationSprayDate: "", firstPostSprayDate: "", lastTractorEntryDate: "",
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

function seasonToForm(s: MaizeFieldSeason): FormState {
  return {
    season: s.season, variety: s.variety ?? "", varietyLength: s.varietyLength ?? "",
    plantDate: s.plantDate?.slice(0, 10) ?? "", estMaturityDate: s.estMaturityDate?.slice(0, 10) ?? "", cutDate: s.cutDate?.slice(0, 10) ?? "",
    population: s.population != null ? String(s.population) : "", yieldTonPerHa: s.yieldTonPerHa != null ? String(s.yieldTonPerHa) : "",
    burndownDate: s.burndownDate?.slice(0, 10) ?? "", preGerminationSprayDate: s.preGerminationSprayDate?.slice(0, 10) ?? "",
    firstPostSprayDate: s.firstPostSprayDate?.slice(0, 10) ?? "", lastTractorEntryDate: s.lastTractorEntryDate?.slice(0, 10) ?? "",
    firstTopDressingDate: s.firstTopDressingDate?.slice(0, 10) ?? "", secondTopDressingDate: s.secondTopDressingDate?.slice(0, 10) ?? "",
    silagePit: s.silagePit ?? "", seedCostPerHa: s.seedCostPerHa != null ? String(s.seedCostPerHa) : "", notes: s.notes ?? "",
  };
}

function FieldDetailSheet({
  farmId, paddockId, paddockCode, initialSeasonId, onClose, onSaved,
}: {
  farmId: string; paddockId: string; paddockCode: string; initialSeasonId: string | null; onClose: () => void; onSaved: () => void;
}) {
  const { data, refetch } = useApi<{ entries: MaizeFieldSeason[] }>(`/api/maize-field-seasons?paddockId=${paddockId}`);
  const seasons = data?.entries ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ ...emptyForm, season: maizeSeasonFor(todayStr()) });
  const [saving, setSaving] = useState(false);
  const [loadedInitial, setLoadedInitial] = useState(false);
  const set = <K extends keyof FormState>(key: K) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  // Jump straight to editing whichever row was clicked in the main table.
  useEffect(() => {
    if (loadedInitial || !data) return;
    setLoadedInitial(true);
    if (initialSeasonId) {
      const s = seasons.find((x) => x.id === initialSeasonId);
      if (s) { setEditingId(s.id); setForm(seasonToForm(s)); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const resetForm = () => { setEditingId(null); setForm({ ...emptyForm, season: maizeSeasonFor(todayStr()) }); };
  const startEdit = (s: MaizeFieldSeason) => { setEditingId(s.id); setForm(seasonToForm(s)); };

  const save = async () => {
    if (!form.season.trim()) return;
    setSaving(true);
    const body = {
      farmId, paddockId, season: form.season.trim(),
      variety: form.variety || null, varietyLength: form.varietyLength || null,
      plantDate: form.plantDate || null, estMaturityDate: form.estMaturityDate || null, cutDate: form.cutDate || null,
      population: form.population !== "" ? Number(form.population) : null,
      yieldTonPerHa: form.yieldTonPerHa !== "" ? Number(form.yieldTonPerHa) : null,
      burndownDate: form.burndownDate || null, preGerminationSprayDate: form.preGerminationSprayDate || null,
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
          Planting, spraying and top-dressing fill most of this in automatically as they&apos;re logged in Field activities (variety length comes from the variety&apos;s days-to-maturity in Settings) — cut date, silage pit, seed cost and yield still need entering by hand.
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
            {dateField("Burndown date", form.burndownDate, set("burndownDate"))}
            {dateField("Pre-germination spray date", form.preGerminationSprayDate, set("preGerminationSprayDate"))}
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
            {editingId && <button className="link-btn" onClick={resetForm}>Cancel / add another season</button>}
          </div>
        </div>

        <div className="field" style={{ marginTop: 16 }}>
          <span className="field-label">All seasons on this field</span>
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

type FieldRow = {
  id: string; code: string; maizeSortOrder: number | null; seasons: MaizeFieldSeason[]; memberIds?: string[];
  farmId?: string; farmName?: string; farmSlug?: string;
};

// A pivot/section (see FARM_SECTIONS) where every one of its camps has the
// exact same season record — same variety, dates, population etc. Detected
// fresh from the data every render, so it only ever groups what was
// actually planted identically; a camp planted on its own, or with
// different seed, just falls out of the match and shows on its own row.
type SectionMatch = { sectionName: string; season: string; fieldIds: string[]; seasonIds: string[]; representative: MaizeFieldSeason };

function seasonSignature(s: MaizeFieldSeason): string {
  return COLUMNS.map((c) => cellValue(s, c.key)).join("|");
}

function findSectionMatches(farmSlug: string, fields: FieldRow[]): SectionMatch[] {
  const sections = FARM_SECTIONS.filter((s) => s.farmSlug === farmSlug);
  const byCode = new Map(fields.map((f) => [f.code, f]));
  const matches: SectionMatch[] = [];
  for (const section of sections) {
    const members = section.codes.map((c) => byCode.get(c));
    if (members.some((m) => !m) || members.length === 0) continue;
    const memberFields = members as FieldRow[];
    const seasonCounts = new Map<string, number>();
    memberFields.forEach((f) => {
      new Set(f.seasons.map((s) => s.season)).forEach((season) => {
        seasonCounts.set(season, (seasonCounts.get(season) ?? 0) + 1);
      });
    });
    for (const [season, count] of seasonCounts) {
      if (count !== memberFields.length) continue; // not every camp in the section has this season
      const rows = memberFields.map((f) => f.seasons.find((s) => s.season === season)!);
      const base = seasonSignature(rows[0]);
      if (rows.every((r) => seasonSignature(r) === base)) {
        matches.push({
          sectionName: section.name,
          season,
          fieldIds: memberFields.map((f) => f.id),
          seasonIds: rows.map((r) => r.id),
          representative: rows[0],
        });
      }
    }
  }
  return matches;
}

function buildFieldRows(farm: Farm, seasons: MaizeFieldSeason[]): FieldRow[] {
  const byId = new Map<string, FieldRow>();
  farm.paddocks.filter((p) => p.landType === "Maize").forEach((p) =>
    byId.set(p.id, { id: p.id, code: p.code, maizeSortOrder: p.maizeSortOrder, seasons: [], farmId: farm.id, farmName: farm.name, farmSlug: farm.slug })
  );
  seasons.filter((s) => s.farmId === farm.id).forEach((s) => {
    const existing = byId.get(s.paddockId);
    if (existing) existing.seasons.push(s);
    else byId.set(s.paddockId, { id: s.paddockId, code: s.paddockCode ?? s.paddockId, maizeSortOrder: null, seasons: [s], farmId: farm.id, farmName: farm.name, farmSlug: farm.slug });
  });
  return [...byId.values()].filter((f) => f.seasons.length > 0);
}

// Fields are ordered by their most recent season's plant date (earliest
// first) so the sheet reads as a planting timeline — fields with no plant
// date yet sort to the end.
function latestPlantDate(f: FieldRow): string | null {
  let best: MaizeFieldSeason | null = null;
  for (const s of f.seasons) {
    if (!best || s.season > best.season) best = s;
    else if (s.season === best.season && (s.plantDate ?? "") > (best.plantDate ?? "")) best = s;
  }
  return best?.plantDate ?? null;
}

function sortByPlantDate(fields: FieldRow[]): FieldRow[] {
  return [...fields].sort((a, b) => {
    const da = latestPlantDate(a);
    const db = latestPlantDate(b);
    if (da && db) return da === db ? a.code.localeCompare(b.code, undefined, { numeric: true }) : da < db ? -1 : 1;
    if (da) return -1;
    if (db) return 1;
    return a.code.localeCompare(b.code, undefined, { numeric: true });
  });
}

// Groups a farm's fields into section rows wherever every camp in a section
// (see FARM_SECTIONS) shares an identical season record, same as the
// single-farm view always did — just callable per-farm so the All Farms
// view can run it once per farm and merge the results.
function buildDisplayRows(farm: Farm, seasons: MaizeFieldSeason[], expandedSections: Set<string>): { fields: FieldRow[]; sectionMatches: SectionMatch[]; displayFields: FieldRow[] } {
  const fields = sortByPlantDate(buildFieldRows(farm, seasons));
  const sectionMatches = findSectionMatches(farm.slug, fields);
  const activeMatches = sectionMatches.filter((m) => !expandedSections.has(`${farm.slug}:${m.sectionName}`));

  if (activeMatches.length === 0) return { fields, sectionMatches, displayFields: fields };

  const indexOf = new Map(fields.map((f, i) => [f.id, i]));
  const consumedSeasonIds = new Set(activeMatches.flatMap((m) => m.seasonIds));
  const consumedFieldIds = new Set(activeMatches.flatMap((m) => m.fieldIds));

  const bySection = new Map<string, SectionMatch[]>();
  activeMatches.forEach((m) => bySection.set(m.sectionName, [...(bySection.get(m.sectionName) ?? []), m]));
  const groupRows = [...bySection.entries()].map(([name, matches]) => ({
    row: {
      id: `group:${farm.slug}:${name}`,
      code: name,
      maizeSortOrder: null,
      seasons: [...matches].sort((a, b) => (a.season < b.season ? 1 : -1)).map((m) => m.representative),
      memberIds: [...new Set(matches.flatMap((m) => m.fieldIds))],
      farmId: farm.id, farmName: farm.name, farmSlug: farm.slug,
    } as FieldRow,
    index: Math.min(...matches.flatMap((m) => m.fieldIds.map((id) => indexOf.get(id) ?? Infinity))),
  }));

  const remaining = fields
    .map((f) => ({ row: { ...f, seasons: f.seasons.filter((s) => !consumedSeasonIds.has(s.id)) }, index: indexOf.get(f.id)! }))
    .filter(({ row }) => row.seasons.length > 0 || !consumedFieldIds.has(row.id));

  const displayFields = [...remaining, ...groupRows].sort((a, b) => a.index - b.index).map((r) => r.row);
  return { fields, sectionMatches, displayFields };
}

export default function MaizeHistoryPage() {
  const { data: farmsData, loading, refetch: refetchFarms } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];
  const [farmId, setFarmId] = useState<string | null>(null);
  const showingAll = farmId === ALL_FARMS_ID;
  const farm = !showingAll ? (farms.find((f) => f.id === (farmId ?? farms[0]?.id)) ?? farms[0]) : undefined;
  const [selected, setSelected] = useState<{ farmId: string; id: string; code: string; seasonId: string | null } | null>(null);
  const [dragKey, setDragKey] = useState<ColumnKey | null>(null);
  const { order, reorder } = useColumnOrder();

  const { data: seasonsData, refetch: refetchSeasons } = useApi<{ entries: MaizeFieldSeason[] }>(
    showingAll ? "/api/maize-field-seasons" : farm ? `/api/maize-field-seasons?farmId=${farm.id}` : null
  );
  const refetch = () => { refetchSeasons(); refetchFarms(); };
  const seasons = seasonsData?.entries ?? [];

  // Which sections currently have a full, identical match are found fresh
  // from the data every render; "expanded" ones are ones the user chose to
  // see broken out into individual camps anyway. Keys are namespaced by
  // farm slug so the All Farms view can't conflate two farms' sections.
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const toggleSectionExpanded = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // A field belongs here if it has any season history at all — classifying
  // a field Maize doesn't by itself put it in this list, only an actual
  // logged season does (so an unplanted field, e.g. V2, doesn't show up
  // with a row of dashes). A field rotated out of maize still keeps its
  // past records visible. Every season shows as its own row, not just the
  // latest. In the All Farms view, each farm's rows are built the same way
  // as the single-farm view and then merged, re-sorted by plant date across
  // every farm together.
  const perFarm = useMemo(() => {
    const list = showingAll ? farms : farm ? [farm] : [];
    return list.map((f) => ({ farm: f, ...buildDisplayRows(f, seasons, expandedSections) }));
  }, [showingAll, farms, farm, seasons, expandedSections]);

  const sectionMatches = useMemo(
    () => perFarm.flatMap((p) => p.sectionMatches.map((m) => ({ ...m, farmSlug: p.farm.slug, farmName: p.farm.name }))),
    [perFarm]
  );

  const fieldsEmpty = perFarm.every((p) => p.fields.length === 0);

  const displayFields = useMemo<FieldRow[]>(() => {
    const merged = perFarm.flatMap((p) => p.displayFields);
    return showingAll ? sortByPlantDate(merged) : merged;
  }, [perFarm, showingAll]);

  const sizeHaByPaddockId = useMemo(
    () => new Map((showingAll ? farms.flatMap((f) => f.paddocks) : farm?.paddocks ?? []).map((p) => [p.id, p.sizeHa])),
    [showingAll, farms, farm]
  );

  // Hectares planted = sum of each distinct field's size, counted once even
  // when a combined section row stands in for several camps.
  const totalHa = useMemo(() => {
    let sum = 0;
    for (const field of displayFields) {
      const ids = field.memberIds ?? [field.id];
      for (const id of ids) sum += sizeHaByPaddockId.get(id) ?? 0;
    }
    return sum;
  }, [displayFields, sizeHaByPaddockId]);

  if (loading) return <div className="screen"><Header title="Maize History" backHref="/farm/maize" /><Spinner /></div>;
  if (!farms.length) return <div className="screen"><Header title="Maize History" backHref="/farm/maize" /><div className="empty">No farms found.</div></div>;

  return (
    <div className="screen">
      <Header title="Maize History" backHref="/farm/maize" />
      <div className="tabs">
        {farms.map((f) => (
          <button key={f.id} className={`tab${!showingAll && farm?.id === f.id ? " active" : ""}`} onClick={() => { setFarmId(f.id); setSelected(null); setExpandedSections(new Set()); }}>{f.name}</button>
        ))}
        <button className={`tab${showingAll ? " active" : ""}`} onClick={() => { setFarmId(ALL_FARMS_ID); setSelected(null); setExpandedSections(new Set()); }}>All Farms</button>
      </div>

      {fieldsEmpty ? (
        <p className="ds-note" style={{ padding: "12px 18px" }}>No maize fields classified{showingAll ? "" : ` on ${farm?.name}`} yet — classify a field as Maize in Edit fields first.</p>
      ) : (
        <>
          <p className="field-hint" style={{ padding: "10px 18px 0" }}>
            {showingAll ? "Every farm's fields, " : "Fields are "}ordered by planting date, earliest first — drag a column heading to reorder columns. Tap a row to see or edit that season.
          </p>
          {sectionMatches.length > 0 && (
            <div className="chip-wrap" style={{ padding: "0 18px 8px" }}>
              {[...new Map(sectionMatches.map((m) => [`${m.farmSlug}:${m.sectionName}`, m])).entries()].map(([key, m]) => (
                <button
                  key={key}
                  className={`range-chip${expandedSections.has(key) ? "" : " on"}`}
                  onClick={() => toggleSectionExpanded(key)}
                >
                  {showingAll ? `${m.farmName} — ${m.sectionName}` : m.sectionName}{expandedSections.has(key) ? " (split out)" : " (combined)"}
                </button>
              ))}
            </div>
          )}
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
                {displayFields.map((field) => {
                  const isGroup = field.id.startsWith("group:");
                  const rowSpan = field.seasons.length || 1;
                  const label = showingAll && field.farmName ? `${field.farmName} — ${field.code}` : field.code;
                  const sectionKey = `${field.farmSlug}:${field.code}`;
                  return field.seasons.length ? (
                    field.seasons.map((s, i) => (
                      <tr
                        key={s.id}
                        onClick={() => (isGroup ? toggleSectionExpanded(sectionKey) : setSelected({ farmId: field.farmId!, id: field.id, code: field.code, seasonId: s.id }))}
                      >
                        {i === 0 && (
                          <td className="maize-sheet-sticky" rowSpan={rowSpan}>
                            <strong>{label}</strong>
                            {isGroup && <span className="ds-note" style={{ display: "block", fontWeight: 400 }}>all camps planted the same</span>}
                          </td>
                        )}
                        {order.map((key) => <td key={key}>{cellValue(s, key)}</td>)}
                      </tr>
                    ))
                  ) : (
                    <tr key={field.id} onClick={() => setSelected({ farmId: field.farmId!, id: field.id, code: field.code, seasonId: null })}>
                      <td className="maize-sheet-sticky"><strong>{label}</strong></td>
                      {order.map((key) => <td key={key}>—</td>)}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="maize-sheet-sticky"><strong>Total planted</strong></td>
                  <td colSpan={order.length}>{totalHa ? `${totalHa.toLocaleString()} ha` : "—"}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {selected && (
        <FieldDetailSheet
          farmId={selected.farmId}
          paddockId={selected.id}
          paddockCode={selected.code}
          initialSeasonId={selected.seasonId}
          onClose={() => setSelected(null)}
          onSaved={refetch}
        />
      )}
    </div>
  );
}
