"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { byPaddockNumber, todayStr } from "@/lib/utils";
import { CROP_TYPES, CROP_TO_LAND_TYPE, CROP_UNITS, LAND_PREP_METHODS, BALE_TYPES } from "@/lib/constants";
import type { Farm, ChemicalType, FertilizerType, SeedVariety } from "@/lib/types";

type ChemRow = { rowId: string; chemicalTypeId: string; rate: string };
const newChemRow = (): ChemRow => ({ rowId: Math.random().toString(36).slice(2), chemicalTypeId: "", rate: "" });

type BaleRow = { rowId: string; paddockId: string; bales: string };
const newBaleRow = (): BaleRow => ({ rowId: Math.random().toString(36).slice(2), paddockId: "", bales: "" });

type MixRow = { rowId: string; crop: string; variety: string; rate: string };
const newMixRow = (): MixRow => ({ rowId: Math.random().toString(36).slice(2), crop: "", variety: "", rate: "" });

type ActivityTypeId = "FERTILIZER" | "MULCHING" | "PLANTING" | "LAND_PREP" | "SPRAYING" | "MOWING" | "BAILING";

const SLUG_TO_TYPE: Record<string, { id: ActivityTypeId; name: string }> = {
  fertilizer: { id: "FERTILIZER", name: "Fertilizer" },
  mulching: { id: "MULCHING", name: "Mulching" },
  planting: { id: "PLANTING", name: "Planting" },
  "land-prep": { id: "LAND_PREP", name: "Land prep" },
  spraying: { id: "SPRAYING", name: "Spraying" },
  mowing: { id: "MOWING", name: "Mowing for bailing" },
  bailing: { id: "BAILING", name: "Bailing" },
};

export default function ActivityFormPage({ params }: { params: Promise<{ type: string }> }) {
  const { type: slug } = use(params);
  const activityType = SLUG_TO_TYPE[slug];

  const { data, loading } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = data?.farms ?? [];
  const { data: chemData } = useApi<{ types: ChemicalType[] }>("/api/chemical-types");
  const chemTypes = chemData?.types ?? [];
  const { data: fertData } = useApi<{ types: FertilizerType[] }>("/api/fertilizer-types");
  const fertTypes = fertData?.types ?? [];
  const { data: varietyData } = useApi<{ varieties: SeedVariety[] }>("/api/seed-varieties");
  const varieties = varietyData?.varieties ?? [];

  const [farmId, setFarmId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [fertType, setFertType] = useState("");
  const [rate, setRate] = useState("");
  const [prepMethod, setPrepMethod] = useState("");
  const [depth, setDepth] = useState("");
  const [mixRows, setMixRows] = useState<MixRow[]>([newMixRow()]);
  const [chemRows, setChemRows] = useState<ChemRow[]>([newChemRow()]);
  const [baleType, setBaleType] = useState("");
  const [baleRows, setBaleRows] = useState<BaleRow[]>([newBaleRow()]);
  const [plantFertType, setPlantFertType] = useState("");
  const [plantFertRate, setPlantFertRate] = useState("");
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const farm = farms.find((f) => f.id === (farmId ?? farms[0]?.id)) ?? farms[0];
  const orderedPaddocks = useMemo(() => (farm ? [...farm.paddocks].sort(byPaddockNumber) : []), [farm]);

  const isFertilizer = activityType?.id === "FERTILIZER";
  const isLandPrep = activityType?.id === "LAND_PREP";
  const isPlanting = activityType?.id === "PLANTING";
  const isSpraying = activityType?.id === "SPRAYING";
  const isMulching = activityType?.id === "MULCHING";
  const isBailing = activityType?.id === "BAILING";

  // Only rye grass and kikuyu can be mulched — everything else shouldn't be pickable here.
  const eligiblePaddocks = useMemo(
    () => (isMulching ? orderedPaddocks.filter((p) => p.landType === "Rye grass" || p.landType === "Kikuyu") : orderedPaddocks),
    [orderedPaddocks, isMulching]
  );

  const selectedMethod = LAND_PREP_METHODS.find((m) => m.name === prepMethod) || null;
  const isTillage = selectedMethod ? selectedMethod.tillage : false;

  const validMixRows = useMemo(() => mixRows.filter((r) => r.crop && Number(r.rate) > 0), [mixRows]);
  const majorityLandType = useMemo(() => {
    if (!validMixRows.length) return null;
    const top = validMixRows.reduce((a, b) => (Number(b.rate) > Number(a.rate) ? b : a));
    return CROP_TO_LAND_TYPE[top.crop] ?? null;
  }, [validMixRows]);
  const addMixRow = () => setMixRows((prev) => [...prev, newMixRow()]);
  const removeMixRow = (rowId: string) =>
    setMixRows((prev) => (prev.length > 1 ? prev.filter((r) => r.rowId !== rowId) : prev));
  const updateMixRow = (rowId: string, patch: Partial<MixRow>) =>
    setMixRows((prev) =>
      prev.map((r) => (r.rowId === rowId ? { ...r, ...patch, ...(patch.crop ? { variety: "" } : {}) } : r))
    );

  const validChemRows = useMemo(
    () =>
      chemRows.filter((r) => {
        const t = chemTypes.find((c) => c.id === r.chemicalTypeId);
        return t && Number(r.rate) > 0;
      }),
    [chemRows, chemTypes]
  );
  const addChemRow = () => setChemRows((prev) => [...prev, newChemRow()]);
  const removeChemRow = (rowId: string) =>
    setChemRows((prev) => (prev.length > 1 ? prev.filter((r) => r.rowId !== rowId) : prev));
  const updateChemRow = (rowId: string, patch: Partial<ChemRow>) =>
    setChemRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  const chosenChemIds = new Set(chemRows.map((r) => r.chemicalTypeId).filter(Boolean));

  const validBaleRows = useMemo(
    () => baleRows.filter((r) => r.paddockId && Number(r.bales) > 0),
    [baleRows]
  );
  const addBaleRow = () => setBaleRows((prev) => [...prev, newBaleRow()]);
  const removeBaleRow = (rowId: string) =>
    setBaleRows((prev) => (prev.length > 1 ? prev.filter((r) => r.rowId !== rowId) : prev));
  const updateBaleRow = (rowId: string, patch: Partial<BaleRow>) =>
    setBaleRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  const chosenBalePaddockIds = new Set(baleRows.map((r) => r.paddockId).filter(Boolean));

  const switchFarm = (id: string) => {
    setFarmId(id);
    setSelected([]);
    setBaleRows([newBaleRow()]);
    setMixRows([newMixRow()]);
    setPlantFertType("");
    setPlantFertRate("");
    setSaved(null);
  };
  const togglePaddock = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  const selectAll = () => setSelected(eligiblePaddocks.map((p) => p.id));
  const clearAll = () => setSelected([]);

  const canSave = isBailing
    ? !!date && !!baleType && validBaleRows.length > 0
    : selected.length > 0 &&
      !!date &&
      !(isFertilizer && (!fertType || !rate || Number(rate) <= 0)) &&
      !(isLandPrep && !prepMethod) &&
      !(isPlanting && validMixRows.length === 0) &&
      !(isPlanting && !!plantFertType !== !!plantFertRate) &&
      !(isPlanting && plantFertType && Number(plantFertRate) <= 0) &&
      !(isSpraying && validChemRows.length === 0);

  const handleSave = async () => {
    if (!farm || !activityType) return;
    setSaving(true);
    setErrorMsg(null);

    if (isBailing) {
      const results = await Promise.all(
        validBaleRows.map((r) =>
          fetch("/api/field-activities", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              farmId: farm.id,
              paddockIds: [r.paddockId],
              type: "BAILING",
              date,
              notes,
              product: baleType,
              bales: Number(r.bales),
            }),
          })
        )
      );
      setSaving(false);
      if (results.some((res) => !res.ok)) {
        setErrorMsg("Some camps couldn't be saved — try again.");
        return;
      }
      setSaved(validBaleRows.length);
      setBaleRows([newBaleRow()]);
      setBaleType("");
      return;
    }

    const mixPayload = isPlanting
      ? validMixRows.map((r) => ({ crop: r.crop, variety: r.variety || null, rate: Number(r.rate), unit: CROP_UNITS[r.crop] }))
      : undefined;
    const chemicalsPayload = isSpraying
      ? validChemRows.map((r) => {
          const t = chemTypes.find((c) => c.id === r.chemicalTypeId)!;
          return { name: t.name, rate: Number(r.rate), unit: t.unit };
        })
      : undefined;
    const res = await fetch("/api/field-activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farmId: farm.id,
        paddockIds: selected,
        type: activityType.id,
        date,
        notes,
        product: isFertilizer ? fertType : undefined,
        rate: isFertilizer ? Number(rate) : undefined,
        method: isLandPrep ? prepMethod : undefined,
        depth: isLandPrep && depth ? Number(depth) : undefined,
        mix: mixPayload,
        chemicals: chemicalsPayload,
      }),
    });
    if (!res.ok) {
      setSaving(false);
      const json = await res.json().catch(() => null);
      setErrorMsg(json?.error || "Couldn't save that entry — try again.");
      return;
    }

    if (isPlanting && plantFertType && plantFertRate) {
      const fertRes = await fetch("/api/field-activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmId: farm.id,
          paddockIds: selected,
          type: "FERTILIZER",
          date,
          notes: "Applied with planting",
          product: plantFertType,
          rate: Number(plantFertRate),
        }),
      });
      if (!fertRes.ok) {
        setSaving(false);
        setErrorMsg("Planting saved, but the fertilizer applied with it couldn't be logged — add it separately.");
        return;
      }
    }

    setSaving(false);
    setSaved(selected.length);
    setSelected([]);
    if (isSpraying) setChemRows([newChemRow()]);
    if (isPlanting) { setPlantFertType(""); setPlantFertRate(""); setMixRows([newMixRow()]); }
  };

  if (!activityType) {
    return (
      <div className="screen">
        <Header title="Log activity" backHref="/farm/activities" />
        <div className="empty">Unknown activity type.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="screen">
        <Header title={`Log ${activityType.name.toLowerCase()}`} backHref="/farm/activities" />
        <Spinner />
      </div>
    );
  }

  return (
    <div className="screen">
      <Header title={`Log ${activityType.name.toLowerCase()}`} backHref="/farm/activities" />

      <div className="activity-scroll">
        <div className="form" style={{ paddingBottom: 8 }}>
          <label className="field">
            <span className="field-label">Farm</span>
            <select className="field-input" value={farm?.id} onChange={(e) => switchFarm(e.target.value)}>
              {farms.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </label>

          {isFertilizer && (
            <div className="field">
              <span className="field-label">Fertilizer type{fertType ? ` — ${fertType}` : ""}</span>
              {fertTypes.length === 0 ? (
                <p className="field-hint">
                  No fertilizers set up yet — <Link href="/settings/fertilizer">add one in Settings</Link> first.
                </p>
              ) : (
                <div className="chip-wrap">
                  {fertTypes.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`paddock-chip fert-chip${fertType === t.name ? " on" : ""}`}
                      onClick={() => setFertType(fertType === t.name ? "" : t.name)}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
              <p className="field-hint">Don&apos;t see it? <Link href="/settings/fertilizer">Add a new fertilizer in Settings</Link>.</p>
            </div>
          )}

          {isFertilizer && (
            <label className="field">
              <span className="field-label">Rate (kg/ha)</span>
              <input className="field-input" type="number" inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 150" />
            </label>
          )}

          {isLandPrep && (
            <div className="field">
              <span className="field-label">Method{prepMethod ? ` — ${prepMethod}` : ""}</span>
              <div className="chip-wrap">
                {LAND_PREP_METHODS.map((m) => (
                  <button
                    key={m.name}
                    type="button"
                    className={`paddock-chip fert-chip${prepMethod === m.name ? " on" : ""}`}
                    onClick={() => setPrepMethod(prepMethod === m.name ? "" : m.name)}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
              <p className="field-hint">
                {selectedMethod
                  ? isTillage
                    ? `${selectedMethod.name} is tillage — the selected paddocks will move to "Unplanted".`
                    : `${selectedMethod.name} isn't tillage — classification won't change.`
                  : 'Ripping, Disc, Speed Disc and Bomford are tillage and move fields to "Unplanted". Rolling doesn\'t.'}
              </p>
            </div>
          )}

          {isLandPrep && (
            <label className="field">
              <span className="field-label">Depth (cm)</span>
              <input className="field-input" type="number" inputMode="numeric" value={depth} onChange={(e) => setDepth(e.target.value)} placeholder="e.g. 15" />
            </label>
          )}

          {isPlanting && (
            <div className="field">
              <span className="field-label">Seed mix{majorityLandType ? ` — classifies as ${majorityLandType}` : ""}</span>
              <div className="chem-rows">
                {mixRows.map((row) => {
                  const cropVarieties = row.crop ? varieties.filter((v) => v.cropType === row.crop) : [];
                  return (
                    <div key={row.rowId} className="chem-row mix-row-grid">
                      <select
                        className="field-input"
                        value={row.crop}
                        onChange={(e) => updateMixRow(row.rowId, { crop: e.target.value })}
                      >
                        <option value="">Select crop…</option>
                        {CROP_TYPES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      {row.crop && (
                        <select
                          className="field-input"
                          value={row.variety}
                          onChange={(e) => updateMixRow(row.rowId, { variety: e.target.value })}
                        >
                          <option value="">
                            {cropVarieties.length === 0 ? "No varieties set up" : "Variety (optional)…"}
                          </option>
                          {cropVarieties.map((v) => (
                            <option key={v.id} value={v.name}>{v.name}</option>
                          ))}
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
                      <button
                        type="button"
                        className="link-btn chem-row-remove"
                        onClick={() => removeMixRow(row.rowId)}
                        disabled={mixRows.length === 1}
                        aria-label="Remove crop"
                      >
                        <X size={16} strokeWidth={1.75} />
                      </button>
                    </div>
                  );
                })}
                <button type="button" className="link-btn" onClick={addMixRow}>+ Add crop</button>
              </div>
              <p className="field-hint">
                Whichever component is the majority by rate sets the paddock&apos;s new classification.{" "}
                <Link href="/settings/seed-varieties">Manage rye grass/maize varieties in Settings</Link>.
              </p>
            </div>
          )}

          {isPlanting && (
            <div className="field">
              <span className="field-label">Fertilizer applied with planting (optional){plantFertType ? ` — ${plantFertType}` : ""}</span>
              {fertTypes.length === 0 ? (
                <p className="field-hint">
                  No fertilizers set up yet — <Link href="/settings/fertilizer">add one in Settings</Link> if you planted with fertilizer.
                </p>
              ) : (
                <>
                  <div className="chip-wrap">
                    {fertTypes.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`paddock-chip fert-chip${plantFertType === t.name ? " on" : ""}`}
                        onClick={() => setPlantFertType(plantFertType === t.name ? "" : t.name)}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                  {plantFertType && (
                    <input
                      className="field-input"
                      type="number"
                      inputMode="numeric"
                      value={plantFertRate}
                      onChange={(e) => setPlantFertRate(e.target.value)}
                      placeholder="Rate (kg/ha)"
                      style={{ marginTop: 8 }}
                    />
                  )}
                </>
              )}
              <p className="field-hint">Leave blank if this was planted without fertilizer — it&apos;ll be logged as a separate Fertilizer entry.</p>
            </div>
          )}

          {isSpraying && (
            <div className="field">
              <span className="field-label">Chemicals</span>
              {chemTypes.length === 0 ? (
                <p className="field-hint">
                  No chemicals set up yet — <Link href="/settings/chemicals">add your spray chemicals in Settings</Link> first.
                </p>
              ) : (
                <div className="chem-rows">
                  {chemRows.map((row) => {
                    const selectedType = chemTypes.find((c) => c.id === row.chemicalTypeId);
                    return (
                      <div key={row.rowId} className="chem-row">
                        <select
                          className="field-input"
                          value={row.chemicalTypeId}
                          onChange={(e) => updateChemRow(row.rowId, { chemicalTypeId: e.target.value })}
                        >
                          <option value="">Select chemical…</option>
                          {chemTypes
                            .filter((c) => c.id === row.chemicalTypeId || !chosenChemIds.has(c.id))
                            .map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
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
                        <span className="chem-row-unit">{selectedType?.unit ?? ""}</span>
                        <button
                          type="button"
                          className="link-btn chem-row-remove"
                          onClick={() => removeChemRow(row.rowId)}
                          disabled={chemRows.length === 1}
                          aria-label="Remove chemical"
                        >
                          <X size={16} strokeWidth={1.75} />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={addChemRow}
                    disabled={chosenChemIds.size >= chemTypes.length}
                  >
                    + Add chemical
                  </button>
                </div>
              )}
              <p className="field-hint">Add every chemical in the tank mix with its own rate per hectare.</p>
            </div>
          )}

          {isBailing && (
            <>
              <div className="field">
                <span className="field-label">Bale type{baleType ? ` — ${baleType}` : ""}</span>
                <div className="chip-wrap">
                  {BALE_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`paddock-chip fert-chip${baleType === t ? " on" : ""}`}
                      onClick={() => setBaleType(baleType === t ? "" : t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <span className="field-label">Camps baled</span>
                <div className="chem-rows">
                  {baleRows.map((row) => {
                    const paddock = orderedPaddocks.find((p) => p.id === row.paddockId);
                    const perHa = paddock?.sizeHa && Number(row.bales) > 0 ? Number(row.bales) / paddock.sizeHa : null;
                    return (
                      <div key={row.rowId} className="chem-row">
                        <select
                          className="field-input"
                          value={row.paddockId}
                          onChange={(e) => updateBaleRow(row.rowId, { paddockId: e.target.value })}
                        >
                          <option value="">Select camp…</option>
                          {orderedPaddocks
                            .filter((p) => p.id === row.paddockId || !chosenBalePaddockIds.has(p.id))
                            .map((p) => (
                              <option key={p.id} value={p.id}>{p.code}</option>
                            ))}
                        </select>
                        <input
                          className="field-input small"
                          type="number"
                          inputMode="numeric"
                          value={row.bales}
                          onChange={(e) => updateBaleRow(row.rowId, { bales: e.target.value })}
                          placeholder="Bales"
                        />
                        <span className="chem-row-unit">{perHa != null ? `${perHa.toFixed(1)}/ha` : ""}</span>
                        <button
                          type="button"
                          className="link-btn chem-row-remove"
                          onClick={() => removeBaleRow(row.rowId)}
                          disabled={baleRows.length === 1}
                          aria-label="Remove camp"
                        >
                          <X size={16} strokeWidth={1.75} />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={addBaleRow}
                    disabled={chosenBalePaddockIds.size >= orderedPaddocks.length}
                  >
                    + Add camp
                  </button>
                </div>
                <p className="field-hint">Each camp gets its own bale count — bales/ha is worked out automatically from its size.</p>
              </div>
            </>
          )}

          <label className="field">
            <span className="field-label">Date</span>
            <input className="field-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Notes</span>
            <textarea className="field-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Rate, contractor, anything worth noting" />
          </label>
        </div>

        {!isBailing && (isMulching && eligiblePaddocks.length === 0 ? (
          <p className="field-hint" style={{ padding: "0 18px" }}>
            No Rye grass or Kikuyu fields classified on {farm?.name} yet — classify fields in{" "}
            <Link href="/farm/field-editor">Field Editor</Link> before logging mulching.
          </p>
        ) : (
          <>
            <div className="paddock-picker-head">
              <span className="field-label">
                {isMulching ? "Fields" : "Paddocks"} ({selected.length} selected)
              </span>
              <div className="paddock-picker-actions">
                <button className="link-btn" onClick={selectAll}>Select all</button>
                <button className="link-btn" onClick={clearAll}>Clear</button>
              </div>
            </div>
            {isMulching && (
              <p className="field-hint" style={{ padding: "0 18px 8px" }}>Only rye grass and kikuyu fields can be mulched.</p>
            )}
            <div className="paddock-picker-list">
              {eligiblePaddocks.map((p) => {
                const on = selected.includes(p.id);
                return (
                  <button key={p.id} className={`paddock-chip${on ? " on" : ""}`} onClick={() => togglePaddock(p.id)}>
                    <span className="paddock-chip-check">{on ? "✓" : ""}</span>
                    {p.code}
                  </button>
                );
              })}
            </div>
          </>
        ))}
      </div>

      <div className="walk-save-bar">
        <button className="save-btn" onClick={handleSave} disabled={!canSave || saving}>
          {saving ? "Saving…" : isBailing ? `Save entry (${validBaleRows.length} camp${validBaleRows.length === 1 ? "" : "s"})` : `Save entry (${selected.length})`}
        </button>
        {errorMsg && <p className="error-note">{errorMsg}</p>}
        {saved != null && (
          <p className="save-note">
            Logged {saved} {isBailing ? "camp" : "paddock"}{saved === 1 ? "" : "s"} — you&apos;ll see this in each field&apos;s history on the farm map.
          </p>
        )}
      </div>
    </div>
  );
}
