"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { UploadCloud } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { byPaddockNumber } from "@/lib/utils";
import { boundaryAreaHectares, type BoundaryGeometry } from "@/lib/geo";
import type { Farm } from "@/lib/types";

const NEW_VALUE = "__new__";
const FEATURE_NUMBER = "__feature_number__";

type RawFeature = {
  key: string;
  properties: Record<string, unknown>;
  geometry: BoundaryGeometry;
  areaHa: number;
};

type ParsedFeature = {
  key: string;
  name: string;
  geometry: BoundaryGeometry;
  areaHa: number;
  select: string; // NEW_VALUE | "" (skip) | an existing paddock id
  newCode: string; // used when select === NEW_VALUE
};

const NAME_KEYS = [
  "FIELD_NAME", "FieldName", "fieldName", "field_name",
  "name", "Name", "NAME", "field", "Field", "label", "Label", "Paddock", "paddock", "code", "Code",
];

function propValueToName(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number") return String(v);
  return null;
}

// A column where every row has the same value (grower name, farm name, a
// constant polygon-type flag…) can never be a per-field name, no matter how
// promising its key looks — John Deere's shapefile export puts the grower's
// name (CLIENT_NAM) before the actual field name (FIELD_NAME) in column
// order, which is what caused every field to import as "Hayden Stokes".
function isConstantColumn(features: RawFeature[], key: string): boolean {
  if (features.length < 2) return false;
  const values = new Set(features.map((f) => propValueToName(f.properties[key]) ?? ""));
  return values.size <= 1;
}

// GUID/UUID-style columns (JD's FIELD_ID, CLIENT_ID, etc.) are unique per
// row but not human names — don't let them win the fallback.
function looksLikeId(key: string, features: RawFeature[]): boolean {
  if (/(^|_)(id|guid|uuid)$/i.test(key) || /^org/i.test(key)) return true;
  const sample = features.slice(0, 5).map((f) => propValueToName(f.properties[key]) ?? "");
  return sample.length > 0 && sample.every((v) => /^[0-9a-f-]{20,}$/i.test(v));
}

function pickDefaultNameKey(features: RawFeature[], keysSeen: string[]): string {
  const usable = keysSeen.filter((k) => !isConstantColumn(features, k) && !looksLikeId(k, features));
  const namedMatch = NAME_KEYS.find((k) => usable.includes(k));
  if (namedMatch) return namedMatch;
  if (usable.length) return usable[0];
  return keysSeen[0] ?? FEATURE_NUMBER;
}

function normalize(s: string) {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Exact match only. A "contains" fallback used to live here (e.g. matching
// "K33" to paddock "33" because the digits overlap) — on a farm that mixes
// plain-numeric codes with crop-prefixed ones (R33/K33/M33...), that silently
// merged unrelated fields onto the same numeric paddock, each import
// clobbering whatever the last one had attached. Exact-only means an
// unmatched name correctly falls back to "create new" instead of guessing.
function guessMatch(featureName: string, paddocks: { id: string; code: string }[]): string {
  const norm = normalize(featureName);
  if (!norm) return "";
  const exact = paddocks.find((p) => normalize(p.code) === norm);
  return exact?.id ?? "";
}

function extractFeatures(raw: unknown): { geometry: unknown; properties: Record<string, unknown> }[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  if (obj.type === "FeatureCollection" && Array.isArray(obj.features)) {
    return (obj.features as Record<string, unknown>[]).map((f) => ({ geometry: f.geometry, properties: (f.properties as Record<string, unknown>) ?? {} }));
  }
  if (obj.type === "Feature") {
    return [{ geometry: obj.geometry, properties: (obj.properties as Record<string, unknown>) ?? {} }];
  }
  if (Array.isArray(raw)) {
    return (raw as Record<string, unknown>[]).flatMap((item) => extractFeatures(item));
  }
  return [];
}

export default function ImportBoundariesPage() {
  const { data, loading } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = data?.farms ?? [];
  const [farmId, setFarmId] = useState<string | null>(null);
  const [rawFeatures, setRawFeatures] = useState<RawFeature[]>([]);
  const [propertyKeys, setPropertyKeys] = useState<string[]>([]);
  const [nameKey, setNameKey] = useState<string>(FEATURE_NUMBER);
  const [rows, setRows] = useState<ParsedFeature[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [skippedGeomCount, setSkippedGeomCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const farm = farms.find((f) => f.id === (farmId ?? farms[0]?.id)) ?? farms[0];
  const orderedPaddocks = useMemo(() => (farm ? [...farm.paddocks].sort(byPaddockNumber) : []), [farm]);

  const buildRows = (features: RawFeature[], key: string): ParsedFeature[] =>
    features.map((f, i) => {
      const name = (key !== FEATURE_NUMBER && propValueToName(f.properties[key])) || `Feature ${i + 1}`;
      const existingMatch = guessMatch(name, orderedPaddocks);
      return {
        key: f.key,
        name,
        geometry: f.geometry,
        areaHa: f.areaHa,
        select: existingMatch || NEW_VALUE,
        newCode: name,
      };
    });

  const handleFile = async (file: File) => {
    setParseError(null);
    setResult(null);
    setRows([]);
    setRawFeatures([]);
    setPropertyKeys([]);
    setSkippedGeomCount(0);
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      setParseError("That file isn't valid JSON/GeoJSON.");
      return;
    }
    const features = extractFeatures(raw);
    if (!features.length) {
      setParseError("No GeoJSON features found in that file.");
      return;
    }
    let skipped = 0;
    const parsed: RawFeature[] = [];
    const keysSeen: string[] = [];
    features.forEach((f, i) => {
      const geom = f.geometry as { type?: string } | null;
      if (!geom || (geom.type !== "Polygon" && geom.type !== "MultiPolygon")) {
        skipped += 1;
        return;
      }
      Object.keys(f.properties).forEach((k) => { if (!keysSeen.includes(k)) keysSeen.push(k); });
      const geometry = geom as unknown as BoundaryGeometry;
      let areaHa = 0;
      try {
        areaHa = boundaryAreaHectares(geometry);
      } catch {
        skipped += 1;
        return;
      }
      parsed.push({ key: `${i}`, properties: f.properties, geometry, areaHa });
    });
    setSkippedGeomCount(skipped);
    setRawFeatures(parsed);
    setPropertyKeys(keysSeen);
    const defaultKey = pickDefaultNameKey(parsed, keysSeen);
    setNameKey(defaultKey);
    setRows(buildRows(parsed, defaultKey));
  };

  const handleNameKeyChange = (key: string) => {
    setNameKey(key);
    setRows(buildRows(rawFeatures, key));
  };

  const updateSelect = (key: string, value: string) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, select: value } : r)));
  const updateNewCode = (key: string, value: string) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, newCode: value } : r)));

  const chosenExistingIds = new Set(rows.filter((r) => r.select !== NEW_VALUE && r.select !== "").map((r) => r.select));
  const includedCount = rows.filter((r) => r.select !== "").length;

  const handleImport = async () => {
    if (!farm) return;
    const payload = rows
      .filter((r) => r.select !== "")
      .map((r) =>
        r.select === NEW_VALUE
          ? { code: r.newCode.trim(), boundary: r.geometry }
          : { paddockId: r.select, boundary: r.geometry }
      )
      .filter((r) => !("code" in r) || r.code);
    if (!payload.length) return;
    setSaving(true);
    const res = await fetch("/api/paddocks/import-boundaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ farmId: farm.id, rows: payload }),
    });
    setSaving(false);
    if (res.ok) {
      const json = await res.json();
      setResult(json.count);
      setRows([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      setParseError("Import failed — try again.");
    }
  };

  if (loading) return <div className="screen"><Header title="Import boundaries" backHref="/farm/field-editor" /><Spinner /></div>;

  return (
    <div className="screen">
      <Header title="Import boundaries" backHref="/farm/field-editor" />

      <div className="form" style={{ padding: "12px 18px" }}>
        <p className="ds-note">
          From John Deere Operations Center: Setup → Fields → select your fields → Export. If GeoJSON
          isn&apos;t offered directly, export as Shapefile and convert it for free at{" "}
          <a href="https://mapshaper.org" target="_blank" rel="noreferrer">mapshaper.org</a> (drag in the
          .zip, then Export → GeoJSON). Upload that file below.
        </p>
        <p className="ds-note">
          Each field defaults to creating a new paddock using its name straight from the shapefile —
          classify land type/size afterward in Field Editor. If a field should instead attach to a
          paddock you already have, pick it from the dropdown.
        </p>

        <label className="field">
          <span className="field-label">Farm</span>
          <select className="field-input" value={farm?.id} onChange={(e) => { setFarmId(e.target.value); setRows([]); setResult(null); }}>
            {farms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">GeoJSON file</span>
          <input
            ref={fileInputRef}
            className="field-input"
            type="file"
            accept=".json,.geojson,application/json,application/geo+json"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </label>

        {propertyKeys.length > 0 && (
          <label className="field">
            <span className="field-label">Name field (from your file)</span>
            <select className="field-input" value={nameKey} onChange={(e) => handleNameKeyChange(e.target.value)}>
              <option value={FEATURE_NUMBER}>(no name found — number them)</option>
              {propertyKeys.map((k) => (
                <option key={k} value={k}>
                  {k} — e.g. &quot;{propValueToName(rawFeatures[0]?.properties[k]) ?? "(blank)"}&quot;
                </option>
              ))}
            </select>
            <p className="field-hint">
              If the list below shows &quot;Feature 1&quot;, &quot;Feature 2&quot;… your file stores names
              under a different property than the common ones — pick the right one here and every row
              updates at once.
            </p>
          </label>
        )}

        {parseError && <p className="error-note">{parseError}</p>}
        {skippedGeomCount > 0 && (
          <p className="field-hint">Skipped {skippedGeomCount} feature{skippedGeomCount === 1 ? "" : "s"} without a usable polygon shape.</p>
        )}
        {result != null && (
          <p className="save-note">
            <UploadCloud size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
            Imported {result} field boundary{result === 1 ? "" : "ies"} — check the <Link href="/farm/map">farm map</Link>.
          </p>
        )}
      </div>

      {rows.length > 0 && (
        <>
          <div className="paddock-picker-head">
            <span className="field-label">Fields to import ({includedCount}/{rows.length})</span>
          </div>
          <div className="import-match-list">
            {rows.map((row) => (
              <div key={row.key} className="import-match-row">
                <div className="import-match-info">
                  <span className="settings-row-title">{row.name}</span>
                  <span className="mr-sub">{row.areaHa.toFixed(2)} ha</span>
                  {row.select === NEW_VALUE && (
                    <input
                      className="field-input small"
                      value={row.newCode}
                      onChange={(e) => updateNewCode(row.key, e.target.value)}
                      placeholder="Paddock code"
                    />
                  )}
                </div>
                <select
                  className="field-input"
                  value={row.select}
                  onChange={(e) => updateSelect(row.key, e.target.value)}
                >
                  <option value={NEW_VALUE}>Create new paddock</option>
                  <option value="">Skip</option>
                  {orderedPaddocks
                    .filter((p) => p.id === row.select || !chosenExistingIds.has(p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        Attach to {p.code}{p.boundary ? " (already mapped)" : ""}
                      </option>
                    ))}
                </select>
              </div>
            ))}
          </div>
          <div className="walk-save-bar">
            <button className="save-btn" onClick={handleImport} disabled={includedCount === 0 || saving}>
              {saving ? "Importing…" : `Import ${includedCount} field${includedCount === 1 ? "" : "s"}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
