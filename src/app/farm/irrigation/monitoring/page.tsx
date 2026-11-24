"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Settings2, Trash2, X, Play, Square } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { AccessGate } from "@/components/AccessGate";
import { TankGauge } from "@/components/TankGauge";
import { useApi } from "@/lib/useApi";
import type { Pump, PumpSchedule, PumpTrigger, TelemetryDevice, TriggerComparison, PumpCommandAction } from "@/lib/types";

const METRIC_SUGGESTIONS = ["level_pct", "pressure_bar"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function metricLabel(metric: string): string {
  if (metric === "level_pct") return "Level";
  if (metric === "pressure_bar") return "Pressure";
  return metric;
}

function formatValue(metric: string, value: number): string {
  if (metric.endsWith("_pct")) return `${value.toFixed(1)}%`;
  if (metric.endsWith("_bar")) return `${value.toFixed(1)} bar`;
  return String(value);
}

export default function MonitoringPage() {
  const { data, loading, refetch } = useApi<{ devices: TelemetryDevice[] }>("/api/telemetry-devices");
  const devices = data?.devices ?? [];
  const [configuring, setConfiguring] = useState<TelemetryDevice | null>(null);

  const byFarm = useMemo(() => {
    const map = new Map<string, { farmName: string; devices: TelemetryDevice[] }>();
    devices.forEach((d) => {
      const g = map.get(d.farmId) ?? { farmName: d.farm?.name ?? "", devices: [] };
      g.devices.push(d);
      map.set(d.farmId, g);
    });
    return [...map.values()];
  }, [devices]);

  if (loading) return (
    <AccessGate section="farm" title="Live monitoring">
      <div className="screen"><Header title="Live monitoring" backHref="/farm/irrigation" /><Spinner /></div>
    </AccessGate>
  );

  return (
    <AccessGate section="farm" title="Live monitoring">
      <div className="screen">
        <Header title="Live monitoring" backHref="/farm/irrigation" />
        {devices.length === 0 ? (
          <p className="ds-note" style={{ padding: "12px 18px" }}>
            No telemetry devices registered yet — add one in Settings → Telemetry devices.
          </p>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {byFarm.map((f) => (
              <div key={f.farmName}>
                <p className="field-label" style={{ padding: "10px 18px 0" }}>{f.farmName}</p>
                <div className="irrigation-grid">
                  {f.devices.map((d) => (
                    <DeviceCard key={d.id} device={d} onChanged={refetch} onConfigure={() => setConfiguring(d)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {configuring && (
        <DeviceConfigSheet
          device={configuring}
          allDevices={devices}
          onClose={() => setConfiguring(null)}
          onChanged={refetch}
        />
      )}
    </AccessGate>
  );
}

function DeviceCard({ device, onChanged, onConfigure }: { device: TelemetryDevice; onChanged: () => void; onConfigure: () => void }) {
  const [sending, setSending] = useState(false);
  const latestEntries = Object.values(device.latest ?? {});
  const mostRecent = latestEntries.sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))[0] ?? null;
  const isLive = mostRecent ? Date.now() - new Date(mostRecent.recordedAt).getTime() < 5 * 60 * 1000 : false;

  const sendCommand = async (action: PumpCommandAction) => {
    if (!device.pump) return;
    setSending(true);
    await fetch("/api/pump-commands", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pumpId: device.pump.id, action }),
    });
    setSending(false);
    onChanged();
  };

  const pctEntry = latestEntries.find((e) => e.metric.endsWith("_pct"));

  return (
    <div className="tm-card">
      <div className="tm-card-head">
        <span className={`tm-status-dot${mostRecent ? (isLive ? " live" : " stale") : ""}`} />
        <span className="tm-card-name" title={device.name}>{device.name}</span>
        <button className="link-btn" onClick={onConfigure} aria-label={`Configure ${device.name}`}>
          <Settings2 size={15} strokeWidth={1.75} />
        </button>
      </div>

      <div className="tm-card-body">
        {pctEntry && <TankGauge pct={pctEntry.value} />}
        <div className="tm-card-info">
          {device.pump ? (
            <span className={`tm-pump-state ${device.pump.running ? "running" : "stopped"}`}>
              {device.pump.running ? "Running" : "Stopped"}
            </span>
          ) : !pctEntry && mostRecent ? (
            <span className="tm-pump-state">{formatValue(mostRecent.metric, mostRecent.value)}</span>
          ) : null}
          {pctEntry && <span className="tm-card-sub">Input {pctEntry.value.toFixed(2)}%</span>}
          {latestEntries.filter((e) => e !== pctEntry).map((e) => (
            <span key={e.metric} className="tm-card-sub">{metricLabel(e.metric)}: {formatValue(e.metric, e.value)}</span>
          ))}
          <span className="tm-card-sub">{mostRecent ? timeAgo(mostRecent.recordedAt) : "No data yet"}</span>
        </div>
      </div>

      {device.pump && (
        <div className="tm-card-actions">
          {device.pump.running ? (
            <button className="tm-pump-btn stop" onClick={() => sendCommand("STOP")} disabled={sending}>
              <Square size={13} /> Stop
            </button>
          ) : (
            <button className="tm-pump-btn" onClick={() => sendCommand("START")} disabled={sending}>
              <Play size={13} /> Start
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Opened via the gear icon on ANY device card, not just pumps — a tank
// sensor has no pump of its own, but you still need to (a) calibrate its
// reading and (b) set up triggers that watch IT and act on some pump
// elsewhere on the farm (e.g. "tank hits 99% -> stop the gravity pump
// feeding it"), which is why triggers/schedules here are scoped to the
// whole farm rather than to this one device.
function DeviceConfigSheet({
  device, allDevices, onClose, onChanged,
}: {
  device: TelemetryDevice; allDevices: TelemetryDevice[]; onClose: () => void; onChanged: () => void;
}) {
  const farmDevices = allDevices.filter((d) => d.farmId === device.farmId);
  const farmPumps = farmDevices.filter((d): d is TelemetryDevice & { pump: Pump } => !!d.pump).map((d) => d.pump);

  const { data: triggersData, refetch: refetchTriggers } = useApi<{ triggers: PumpTrigger[] }>(`/api/pump-triggers?farmId=${device.farmId}`);
  const triggers = triggersData?.triggers ?? [];
  const { data: schedulesData, refetch: refetchSchedules } = useApi<{ schedules: PumpSchedule[] }>(`/api/pump-schedules?farmId=${device.farmId}`);
  const schedules = schedulesData?.schedules ?? [];

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="detail-sheet-overlay" onClick={onClose}>
      <div className="detail-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ds-head">
          <h2>{device.name}</h2>
          <button className="close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <CalibrationSection device={device} onChanged={onChanged} />

        {farmPumps.length === 0 ? (
          <p className="ds-note" style={{ marginTop: 14 }}>
            No pump registered on this farm yet, so there&apos;s nothing to trigger or schedule — register one in
            Settings → Telemetry devices first.
          </p>
        ) : (
          <>
            <TriggerSection
              deviceOptions={farmDevices}
              pumpOptions={farmPumps}
              defaultDeviceId={device.id}
              triggers={triggers}
              refetch={refetchTriggers}
            />
            <ScheduleSection pumpOptions={farmPumps} schedules={schedules} refetch={refetchSchedules} />
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

function CalibrationSection({ device, onChanged }: { device: TelemetryDevice; onChanged: () => void }) {
  const [offset, setOffset] = useState(String(device.calibrationOffset));
  const [scale, setScale] = useState(String(device.calibrationScale));
  const [saving, setSaving] = useState(false);

  const rawEntry = Object.values(device.latest ?? {})[0] ?? null;
  // The device's `latest` value already has calibration applied, so back it
  // out here to show the raw sensor figure alongside the live preview below.
  const rawValue = rawEntry ? (rawEntry.value - device.calibrationOffset) / device.calibrationScale : null;
  const previewValue = rawValue != null && offset !== "" && scale !== "" ? rawValue * Number(scale) + Number(offset) : null;

  const save = async () => {
    setSaving(true);
    await fetch(`/api/telemetry-devices/${device.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calibrationOffset: Number(offset) || 0, calibrationScale: Number(scale) || 1 }),
    });
    setSaving(false);
    onChanged();
  };

  return (
    <div className="field" style={{ marginTop: 14 }}>
      <span className="field-label">Sensor calibration</span>
      <p className="ds-note">
        Corrects a reading that&apos;s consistently off — e.g. the sensor reads 95% when the tank is actually full.
        Shown value = raw × scale + offset. Doesn&apos;t touch past history, only how readings are read from here on.
      </p>
      {rawValue != null && (
        <p className="ds-note">Raw sensor reading right now: {rawValue.toFixed(2)}{previewValue != null ? ` → shown as ${previewValue.toFixed(2)}` : ""}</p>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <label className="field" style={{ flex: 1 }}>
          <span className="field-label">Offset</span>
          <input className="field-input small" type="number" value={offset} onChange={(e) => setOffset(e.target.value)} />
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span className="field-label">Scale</span>
          <input className="field-input small" type="number" value={scale} onChange={(e) => setScale(e.target.value)} />
        </label>
      </div>
      <button className="save-btn small" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save calibration"}</button>
    </div>
  );
}

function TriggerSection({
  deviceOptions, pumpOptions, defaultDeviceId, triggers, refetch,
}: {
  deviceOptions: TelemetryDevice[]; pumpOptions: Pump[]; defaultDeviceId: string; triggers: PumpTrigger[]; refetch: () => void;
}) {
  const [deviceId, setDeviceId] = useState(defaultDeviceId);
  const [pumpId, setPumpId] = useState(pumpOptions[0]?.id ?? "");
  const [metric, setMetric] = useState("level_pct");
  const [comparison, setComparison] = useState<TriggerComparison>("BELOW");
  const [threshold, setThreshold] = useState("");
  const [action, setAction] = useState<PumpCommandAction>("START");
  const [stableDelay, setStableDelay] = useState("0");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (threshold === "" || !pumpId) return;
    setSaving(true);
    await fetch("/api/pump-triggers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pumpId, deviceId, metric, comparison, threshold: Number(threshold), action, stableDelayMinutes: Number(stableDelay) || 0 }),
    });
    setSaving(false);
    setThreshold("");
    refetch();
  };

  const toggleEnabled = async (t: PumpTrigger) => {
    await fetch(`/api/pump-triggers/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !t.enabled }) });
    refetch();
  };

  const remove = async (id: string) => {
    await fetch(`/api/pump-triggers/${id}`, { method: "DELETE" });
    refetch();
  };

  return (
    <div className="field" style={{ marginTop: 14 }}>
      <span className="field-label">Triggers</span>
      {triggers.length === 0 && <p className="ds-note">No triggers set on this farm yet — pumps only run manually or on a schedule.</p>}
      {triggers.map((t) => {
        const d = deviceOptions.find((x) => x.id === t.deviceId);
        const p = pumpOptions.find((x) => x.id === t.pumpId);
        return (
          <div key={t.id} className="settings-row">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="mr-sub">
                {d?.name ?? "device"} {metricLabel(t.metric)} {t.comparison === "BELOW" ? "<" : ">"} {t.threshold}
                {" → "}{t.action === "START" ? "Start" : "Stop"} {p?.name ?? "pump"}
                {t.stableDelayMinutes > 0 ? ` (holds ${t.stableDelayMinutes}m)` : ""}
              </span>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button className="link-btn" onClick={() => toggleEnabled(t)}>{t.enabled ? "Enabled" : "Disabled"}</button>
                <button className="link-btn" onClick={() => remove(t.id)} aria-label="Remove trigger"><Trash2 size={14} strokeWidth={1.75} /></button>
              </div>
            </div>
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <label className="field" style={{ flex: 1, minWidth: 120 }}>
          <span className="field-label">Watch device</span>
          <select className="field-input small" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
            {deviceOptions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="field" style={{ flex: 1, minWidth: 100 }}>
          <span className="field-label">Metric</span>
          <input className="field-input small" list="metric-suggestions" value={metric} onChange={(e) => setMetric(e.target.value)} />
          <datalist id="metric-suggestions">{METRIC_SUGGESTIONS.map((m) => <option key={m} value={m} />)}</datalist>
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label className="field" style={{ flex: 1, minWidth: 90 }}>
          <span className="field-label">When</span>
          <select className="field-input small" value={comparison} onChange={(e) => setComparison(e.target.value as TriggerComparison)}>
            <option value="BELOW">Drops below</option>
            <option value="ABOVE">Rises above</option>
          </select>
        </label>
        <label className="field" style={{ flex: 1, minWidth: 80 }}>
          <span className="field-label">Threshold</span>
          <input className="field-input small" type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="e.g. 20" />
        </label>
        <label className="field" style={{ flex: 1, minWidth: 90 }}>
          <span className="field-label">Action</span>
          <select className="field-input small" value={action} onChange={(e) => setAction(e.target.value as PumpCommandAction)}>
            <option value="START">Start pump</option>
            <option value="STOP">Stop pump</option>
          </select>
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label className="field" style={{ flex: 1, minWidth: 120 }}>
          <span className="field-label">Pump to control</span>
          <select className="field-input small" value={pumpId} onChange={(e) => setPumpId(e.target.value)}>
            {pumpOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="field" style={{ flex: 1, minWidth: 90 }}>
          <span className="field-label">Stable delay (min)</span>
          <input className="field-input small" type="number" min={0} value={stableDelay} onChange={(e) => setStableDelay(e.target.value)} />
        </label>
      </div>
      <button className="save-btn small" onClick={add} disabled={saving || threshold === "" || !pumpId}>{saving ? "Adding…" : "Add trigger"}</button>
    </div>
  );
}

function ScheduleSection({ pumpOptions, schedules, refetch }: { pumpOptions: Pump[]; schedules: PumpSchedule[]; refetch: () => void }) {
  const [pumpId, setPumpId] = useState(pumpOptions[0]?.id ?? "");
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("18:00");
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [saving, setSaving] = useState(false);

  const toggleDay = (d: number) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const add = async () => {
    if (!name.trim() || !pumpId) return;
    setSaving(true);
    await fetch("/api/pump-schedules", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pumpId, name: name.trim(), startTime, endTime, daysOfWeek: days }),
    });
    setSaving(false);
    setName("");
    refetch();
  };

  const toggleEnabled = async (s: PumpSchedule) => {
    await fetch(`/api/pump-schedules/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !s.enabled }) });
    refetch();
  };

  const remove = async (id: string) => {
    await fetch(`/api/pump-schedules/${id}`, { method: "DELETE" });
    refetch();
  };

  return (
    <div className="field" style={{ marginTop: 16 }}>
      <span className="field-label">Schedules</span>
      {schedules.length === 0 && <p className="ds-note">No preset schedules yet.</p>}
      {schedules.map((s) => {
        const p = pumpOptions.find((x) => x.id === s.pumpId);
        return (
          <div key={s.id} className="settings-row">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="mr-sub">{p?.name ?? "pump"} · {s.name} · {s.startTime}–{s.endTime} · {s.daysOfWeek.map((d) => DAY_LABELS[d]).join("/")}</span>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button className="link-btn" onClick={() => toggleEnabled(s)}>{s.enabled ? "On" : "Off"}</button>
                <button className="link-btn" onClick={() => remove(s.id)} aria-label="Remove schedule"><Trash2 size={14} strokeWidth={1.75} /></button>
              </div>
            </div>
          </div>
        );
      })}

      <label className="field" style={{ marginTop: 8 }}>
        <span className="field-label">Pump</span>
        <select className="field-input small" value={pumpId} onChange={(e) => setPumpId(e.target.value)}>
          {pumpOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label className="field">
        <span className="field-label">Schedule name</span>
        <input className="field-input small" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rural Flex Green only" />
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <label className="field" style={{ flex: 1 }}>
          <span className="field-label">Start</span>
          <input className="field-input small" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </label>
        <label className="field" style={{ flex: 1 }}>
          <span className="field-label">End</span>
          <input className="field-input small" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </label>
      </div>
      <div className="chip-wrap">
        {DAY_LABELS.map((lbl, i) => (
          <button key={i} type="button" className={`paddock-chip fert-chip${days.includes(i) ? " on" : ""}`} onClick={() => toggleDay(i)}>{lbl}</button>
        ))}
      </div>
      <button className="save-btn small" onClick={add} disabled={saving || !name.trim() || !pumpId} style={{ marginTop: 8 }}>{saving ? "Adding…" : "Add schedule"}</button>
    </div>
  );
}
