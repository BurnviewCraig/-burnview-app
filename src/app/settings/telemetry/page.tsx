"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import type { Farm, TelemetryDevice, TelemetryDeviceKind } from "@/lib/types";

const KIND_OPTIONS: { value: TelemetryDeviceKind; label: string }[] = [
  { value: "TANK_SENSOR", label: "Tank/dam sensor (level or pressure only)" },
  { value: "PUMP_CONTROLLER", label: "Pump controller (start/stop + run confirmation)" },
  { value: "PIVOT_CONTROLLER", label: "Pivot pump house controller (pressure + VSD)" },
];
const KIND_LABEL: Record<TelemetryDeviceKind, string> = Object.fromEntries(KIND_OPTIONS.map((k) => [k.value, k.label])) as Record<TelemetryDeviceKind, string>;
const PUMP_KINDS = new Set<TelemetryDeviceKind>(["PUMP_CONTROLLER", "PIVOT_CONTROLLER"]);

export default function TelemetrySettingsPage() {
  const { data: farmsData, loading: farmsLoading } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];
  const { data, loading, refetch } = useApi<{ devices: TelemetryDevice[] }>("/api/telemetry-devices");
  const devices = data?.devices ?? [];

  const [farmId, setFarmId] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<TelemetryDeviceKind>("TANK_SENSOR");
  const [pumpName, setPumpName] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!farmId || !name.trim() || (PUMP_KINDS.has(kind) && !pumpName.trim())) return;
    setSaving(true);
    setErrorMsg(null);
    const res = await fetch("/api/telemetry-devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ farmId, name: name.trim(), kind, pumpName: PUMP_KINDS.has(kind) ? pumpName.trim() : undefined }),
    });
    setSaving(false);
    if (!res.ok) { setErrorMsg("Couldn't add that device."); return; }
    setName(""); setPumpName("");
    refetch();
  };

  const handleToggleActive = async (d: TelemetryDevice) => {
    await fetch(`/api/telemetry-devices/${d.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !d.active }),
    });
    refetch();
  };

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); return; }
    await fetch(`/api/telemetry-devices/${id}`, { method: "DELETE" });
    setConfirmDeleteId(null);
    refetch();
  };

  const byFarm = useMemo(() => {
    const map = new Map<string, { farmName: string; devices: TelemetryDevice[] }>();
    devices.forEach((d) => {
      const g = map.get(d.farmId) ?? { farmName: d.farm?.name ?? "", devices: [] };
      g.devices.push(d);
      map.set(d.farmId, g);
    });
    return [...map.values()];
  }, [devices]);

  if (farmsLoading || loading) return <div className="screen"><Header title="Telemetry devices" backHref="/settings" /><Spinner /></div>;

  return (
    <div className="screen">
      <Header title="Telemetry devices" backHref="/settings" />
      <p className="ds-note" style={{ padding: "12px 18px 0" }}>
        Register each TRB141 (or similar) unit here as it goes in — this gives it a stable topic key to configure
        into the device itself. A pump/pivot controller also gets its own Pump record for start/stop control.
      </p>

      <div className="form" style={{ padding: "12px 18px", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label className="field" style={{ flex: 1, minWidth: 140 }}>
            <span className="field-label">Farm</span>
            <select className="field-input small" value={farmId} onChange={(e) => setFarmId(e.target.value)}>
              <option value="">Select…</option>
              {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
          <label className="field" style={{ flex: 1, minWidth: 140 }}>
            <span className="field-label">Kind</span>
            <select className="field-input small" value={kind} onChange={(e) => setKind(e.target.value as TelemetryDeviceKind)}>
              {KIND_OPTIONS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </label>
        </div>
        <label className="field">
          <span className="field-label">Device name</span>
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tank 3 level" />
        </label>
        {PUMP_KINDS.has(kind) && (
          <label className="field">
            <span className="field-label">Pump name</span>
            <input className="field-input" value={pumpName} onChange={(e) => setPumpName(e.target.value)} placeholder="e.g. Stockton Gravity Pump" />
          </label>
        )}
        <button className="save-btn small" onClick={handleAdd} disabled={saving || !farmId || !name.trim() || (PUMP_KINDS.has(kind) && !pumpName.trim())}>
          {saving ? "Adding…" : "Add device"}
        </button>
        {errorMsg && <p className="error-note">{errorMsg}</p>}
      </div>

      <div className="no-print" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {byFarm.length === 0 && <p className="ds-note" style={{ padding: "0 18px" }}>No devices registered yet — add your first one above.</p>}
        {byFarm.map((f) => (
          <div key={f.farmName}>
            <p className="field-label" style={{ padding: "10px 18px 0" }}>{f.farmName}</p>
            <div className="menu-list">
              {f.devices.map((d) => (
                <div key={d.id} className="settings-row">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div className="settings-row-title">{d.name}{!d.active && <span className="placeholder-badge" style={{ marginLeft: 6 }}>INACTIVE</span>}</div>
                      <span className="mr-sub">{KIND_LABEL[d.kind]}{d.pump ? ` · pump: ${d.pump.name}` : ""}</span>
                      <div className="ds-note" style={{ marginTop: 2 }}>topic: {d.topicKey}</div>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <button className="link-btn" onClick={() => handleToggleActive(d)}>{d.active ? "Disable" : "Enable"}</button>
                      <button className="link-btn" onClick={() => handleDelete(d.id)} aria-label={`Remove ${d.name}`}>
                        {confirmDeleteId === d.id ? "Confirm?" : <Trash2 size={15} strokeWidth={1.75} />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
