"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Plus, Printer, RotateCcw, Trash2, X } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { todayStr } from "@/lib/utils";
import { addDays } from "@/lib/calendarFormat";
import { TIMEBOOK_SECTIONS, ATTENDANCE_CODES, ATTENDANCE_LETTER } from "@/lib/constants";
import type { Farm, Worker, TimeBookEntry } from "@/lib/types";

type Section = "DAIRY" | "STAFF" | "TOGH";

function mondayOf(dateStr: string): string {
  const dow = new Date(dateStr + "T00:00:00Z").getUTCDay(); // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(dateStr, diff);
}

function daysBetween(fromStr: string, toStr: string): string[] {
  const list: string[] = [];
  let d = fromStr;
  let guard = 0;
  while (d <= toStr && guard < 400) {
    list.push(d);
    d = addDays(d, 1);
    guard++;
  }
  return list;
}

type CellTarget = { workerId: string; workerName: string; date: string; code: TimeBookEntry["code"]; overtime: string | null };

export default function TimeBookPage() {
  const { data: farmsData, loading } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];
  const [farmId, setFarmId] = useState<string | null>(null);
  const farm = farms.find((f) => f.id === (farmId ?? farms[0]?.id)) ?? farms[0];

  const [section, setSection] = useState<Section>("DAIRY");

  const today = todayStr();
  const [anchor, setAnchor] = useState(mondayOf(today));
  const days = useMemo(() => {
    const list: string[] = [];
    for (let i = 0; i < 7; i++) list.push(addDays(anchor, i));
    return list;
  }, [anchor]);

  const { data: workersData, refetch: refetchWorkers } = useApi<{ workers: Worker[] }>(
    farm ? `/api/workers?farmId=${farm.id}&section=${section}` : null
  );
  const workers = workersData?.workers ?? [];

  const { data: entriesData, refetch: refetchEntries } = useApi<{ entries: TimeBookEntry[] }>(
    farm ? `/api/timebook-entries?farmId=${farm.id}&section=${section}&start=${anchor}&end=${days[6]}` : null
  );
  const entries = entriesData?.entries ?? [];
  const entryMap = useMemo(() => {
    const map = new Map<string, TimeBookEntry>();
    entries.forEach((e) => map.set(`${e.workerId}|${e.date.slice(0, 10)}`, e));
    return map;
  }, [entries]);

  const [cellTarget, setCellTarget] = useState<CellTarget | null>(null);
  const [managingWorker, setManagingWorker] = useState<Worker | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [showRemoved, setShowRemoved] = useState(false);

  const [printFrom, setPrintFrom] = useState(anchor);
  const [printTo, setPrintTo] = useState(days[6]);
  const [printData, setPrintData] = useState<{ from: string; to: string; entries: TimeBookEntry[] } | null>(null);
  const [printLoading, setPrintLoading] = useState(false);

  useEffect(() => {
    setPrintFrom(anchor);
    setPrintTo(days[6]);
  }, [anchor, days]);

  const printDays = useMemo(() => (printData ? daysBetween(printData.from, printData.to) : []), [printData]);
  const printEntryMap = useMemo(() => {
    const map = new Map<string, TimeBookEntry>();
    (printData?.entries ?? []).forEach((e) => map.set(`${e.workerId}|${e.date.slice(0, 10)}`, e));
    return map;
  }, [printData]);

  const handlePrint = async () => {
    if (!farm || !printFrom || !printTo || printFrom > printTo) return;
    setPrintLoading(true);
    const res = await fetch(`/api/timebook-entries?farmId=${farm.id}&section=${section}&start=${printFrom}&end=${printTo}`);
    const json = await res.json();
    setPrintLoading(false);
    setPrintData({ from: printFrom, to: printTo, entries: json.entries ?? [] });
  };

  useEffect(() => {
    if (!printData) return;
    const t = setTimeout(() => window.print(), 50);
    const after = () => setPrintData(null);
    window.addEventListener("afterprint", after, { once: true });
    return () => clearTimeout(t);
  }, [printData]);

  const { data: removedData, refetch: refetchRemoved } = useApi<{ workers: Worker[] }>(
    showRemoved && farm ? `/api/workers?farmId=${farm.id}&section=${section}&includeInactive=true` : null
  );
  const removedWorkers = (removedData?.workers ?? []).filter((w) => !w.active);

  const switchFarm = (id: string) => {
    setFarmId(id);
    setAdding(false);
    setShowRemoved(false);
  };
  const switchSection = (s: Section) => {
    setSection(s);
    setAdding(false);
    setShowRemoved(false);
  };

  const openCell = (w: Worker, date: string) => {
    const existing = entryMap.get(`${w.id}|${date}`);
    setCellTarget({ workerId: w.id, workerName: w.name, date, code: existing?.code ?? null, overtime: existing?.overtime ?? null });
  };

  const handleAddWorker = async () => {
    if (!farm || !newName.trim()) return;
    await fetch("/api/workers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ farmId: farm.id, section, name: newName.trim(), role: newRole.trim() || undefined }),
    });
    setNewName("");
    setNewRole("");
    setAdding(false);
    refetchWorkers();
  };

  const handleRestore = async (id: string) => {
    await fetch(`/api/workers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    refetchWorkers();
    refetchRemoved();
  };

  if (loading) return <div className="screen"><Header title="Time book" backHref="/" /><Spinner /></div>;
  if (!farm) return <div className="screen"><Header title="Time book" backHref="/" /><div className="empty">No farms found.</div></div>;

  const sectionName = TIMEBOOK_SECTIONS.find((s) => s.id === section)?.name ?? section;

  return (
    <div className="screen">
      <Header title="Time book" backHref="/" />

      <div className="tabs no-print">
        {farms.map((f) => (
          <button key={f.id} className={`tab${farm.id === f.id ? " active" : ""}`} onClick={() => switchFarm(f.id)}>{f.name}</button>
        ))}
      </div>

      <div className="tabs no-print">
        {TIMEBOOK_SECTIONS.map((s) => (
          <button key={s.id} className={`tab${section === s.id ? " active" : ""}`} onClick={() => switchSection(s.id)}>{s.name}</button>
        ))}
      </div>

      <div className="grazing-week-nav no-print">
        <button className="map-zoom-btn" onClick={() => setAnchor(addDays(anchor, -7))} aria-label="Previous week"><ChevronLeft size={16} /></button>
        <button className="link-btn" onClick={() => setAnchor(mondayOf(today))}>This week</button>
        <button className="map-zoom-btn" onClick={() => setAnchor(addDays(anchor, 7))} aria-label="Next week"><ChevronRight size={16} /></button>
        <div style={{ flex: 1 }} />
        <button className="link-btn" onClick={() => { setAdding((v) => !v); setShowRemoved(false); }}>
          <Plus size={14} style={{ verticalAlign: "-2px" }} /> Add worker
        </button>
        <button className="link-btn" onClick={() => { setShowRemoved((v) => !v); setAdding(false); }}>
          <RotateCcw size={14} style={{ verticalAlign: "-2px" }} /> Removed
        </button>
      </div>

      <div className="add-item-bar no-print" style={{ flexWrap: "wrap" }}>
        <span className="field-label" style={{ width: "100%" }}>Print range</span>
        <input className="field-input small" type="date" value={printFrom} onChange={(e) => setPrintFrom(e.target.value)} />
        <span>to</span>
        <input className="field-input small" type="date" value={printTo} onChange={(e) => setPrintTo(e.target.value)} />
        <button className="save-btn small" onClick={handlePrint} disabled={printLoading || !printFrom || !printTo || printFrom > printTo}>
          <Printer size={14} style={{ verticalAlign: "-2px" }} /> {printLoading ? "Loading…" : "Print"}
        </button>
      </div>

      {adding && (
        <div className="add-item-bar no-print">
          <input className="field-input small" placeholder="Worker name" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          <input className="field-input small" placeholder="Role (what they do)" value={newRole} onChange={(e) => setNewRole(e.target.value)} />
          <button className="save-btn small" onClick={handleAddWorker} disabled={!newName.trim()}>Add</button>
        </div>
      )}

      {showRemoved && (
        <div className="walk-list no-print" style={{ flex: "none", maxHeight: 220, overflowY: "auto" }}>
          {removedWorkers.length === 0 && <p className="ds-note" style={{ padding: "8px 18px" }}>No removed workers in {sectionName}.</p>}
          {removedWorkers.map((w) => (
            <div key={w.id} className="walk-row" style={{ cursor: "default" }}>
              <span className="wr-code">{w.name}</span>
              <button className="link-btn" onClick={() => handleRestore(w.id)}>Restore</button>
            </div>
          ))}
        </div>
      )}

      {workers.length === 0 ? (
        <p className="ds-note no-print" style={{ padding: "12px 18px" }}>No workers added for this section yet — add one above.</p>
      ) : (
        <div className="grazing-table-scroll no-print">
          <table className="grazing-table timebook-table">
            <thead>
              <tr>
                <th className="grazing-table-label">Name</th>
                {days.map((d) => {
                  const dt = new Date(d + "T00:00:00");
                  const isToday = d === today;
                  return (
                    <th key={d} className={isToday ? "today" : ""}>
                      <div>{dt.toLocaleDateString(undefined, { weekday: "short" })}</div>
                      <div className="grazing-table-daynum">{dt.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id}>
                  <td className="grazing-table-label timebook-name" onClick={() => setManagingWorker(w)}>
                    {w.name}
                    {w.role && <span className="timebook-role">{w.role}</span>}
                  </td>
                  {days.map((d) => {
                    const e = entryMap.get(`${w.id}|${d}`);
                    const letter = e?.code ? ATTENDANCE_LETTER[e.code] : "";
                    return (
                      <td key={d} className="grazing-table-cell timebook-cell" onClick={() => openCell(w, d)}>
                        <span className="timebook-code">{letter}</span>
                        {e?.overtime && <span className="timebook-overtime">{e.overtime}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {printData && (
        <div className="print-only">
          <p className="timebook-title-print">{farm.name} — {sectionName} — {printData.from} to {printData.to}</p>
          <table className="grazing-table timebook-table">
            <thead>
              <tr>
                <th className="grazing-table-label">Name</th>
                {printDays.map((d) => {
                  const dt = new Date(d + "T00:00:00");
                  return (
                    <th key={d}>
                      <div>{dt.toLocaleDateString(undefined, { weekday: "short" })}</div>
                      <div className="grazing-table-daynum">{dt.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id}>
                  <td className="grazing-table-label timebook-name">{w.name}</td>
                  {printDays.map((d) => {
                    const e = printEntryMap.get(`${w.id}|${d}`);
                    const letter = e?.code ? ATTENDANCE_LETTER[e.code] : "";
                    return (
                      <td key={d} className="grazing-table-cell timebook-cell">
                        <span className="timebook-code">{letter}</span>
                        {e?.overtime && <span className="timebook-overtime">{e.overtime}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cellTarget && (
        <CellEditor
          target={cellTarget}
          onClose={() => setCellTarget(null)}
          onSaved={() => { setCellTarget(null); refetchEntries(); }}
        />
      )}

      {managingWorker && (
        <WorkerManager
          worker={managingWorker}
          onClose={() => setManagingWorker(null)}
          onChanged={() => { setManagingWorker(null); refetchWorkers(); }}
        />
      )}
    </div>
  );
}

function CellEditor({ target, onClose, onSaved }: { target: CellTarget; onClose: () => void; onSaved: () => void }) {
  const [code, setCode] = useState<TimeBookEntry["code"]>(target.code);
  const [overtime, setOvertime] = useState(target.overtime ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/timebook-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workerId: target.workerId, date: target.date, code, overtime: overtime.trim() || null }),
    });
    setSaving(false);
    onSaved();
  };

  const handleClear = async () => {
    setSaving(true);
    await fetch("/api/timebook-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workerId: target.workerId, date: target.date, code: null, overtime: null }),
    });
    setSaving(false);
    onSaved();
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="detail-sheet-overlay" onClick={onClose}>
      <div className="detail-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ds-head">
          <div><h2>{target.workerName} — {target.date}</h2></div>
          <button className="close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="chip-wrap" style={{ marginBottom: 14 }}>
          {ATTENDANCE_CODES.map((c) => (
            <button
              key={c.id}
              className={`range-chip${code === c.id ? " on" : ""}`}
              onClick={() => setCode(code === c.id ? null : (c.id as TimeBookEntry["code"]))}
            >
              {c.letter} — {c.label}
            </button>
          ))}
        </div>

        <label className="field">
          <span className="field-label">Overtime note (e.g. +2 or -1.5)</span>
          <input className="field-input" value={overtime} onChange={(e) => setOvertime(e.target.value)} placeholder="+2" />
        </label>

        <div className="edit-entry-actions" style={{ marginTop: 14 }}>
          <button className="save-btn" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          <button className="delete-btn" onClick={handleClear} disabled={saving}>Clear this entry</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function WorkerManager({ worker, onClose, onChanged }: { worker: Worker; onClose: () => void; onChanged: () => void }) {
  const [name, setName] = useState(worker.name);
  const [role, setRole] = useState(worker.role ?? "");
  const [notes, setNotes] = useState(worker.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await fetch(`/api/workers/${worker.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), role: role.trim() || null, notes: notes.trim() || null }),
    });
    setSaving(false);
    onChanged();
  };

  const handleRemove = async () => {
    if (!confirmingRemove) { setConfirmingRemove(true); return; }
    setSaving(true);
    await fetch(`/api/workers/${worker.id}`, { method: "DELETE" });
    setSaving(false);
    onChanged();
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="detail-sheet-overlay" onClick={onClose}>
      <div className="detail-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ds-head">
          <div><h2>Edit worker</h2></div>
          <button className="close" onClick={onClose}><X size={18} /></button>
        </div>

        <label className="field">
          <span className="field-label">Name</span>
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="field">
          <span className="field-label">Role (what they do)</span>
          <input className="field-input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Milker, Tractor driver" />
        </label>

        <label className="field">
          <span className="field-label">Notes</span>
          <textarea className="field-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <div className="edit-entry-actions" style={{ marginTop: 14 }}>
          <button className="save-btn" onClick={handleSave} disabled={saving || !name.trim()}>{saving ? "Saving…" : "Save"}</button>
          <button className={`delete-btn${confirmingRemove ? " confirm" : ""}`} onClick={handleRemove} disabled={saving}>
            <Trash2 size={14} strokeWidth={1.75} />
            {confirmingRemove ? "Click again to confirm" : "Remove worker"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
