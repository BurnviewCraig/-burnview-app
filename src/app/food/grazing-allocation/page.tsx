"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { byPaddockNumber, todayStr } from "@/lib/utils";
import { addDays } from "@/lib/calendarFormat";
import type { Farm, CattleGroup, GrazingAllocation } from "@/lib/types";

type Session = "DAY" | "NIGHT";
type CellTarget = { groupId: string; groupName: string; date: string; session: Session; currentPaddockId: string; currentAllocationId: string | null };

export default function GrazingAllocationPage() {
  const { data: farmsData, loading } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];
  const [farmId, setFarmId] = useState<string | null>(null);
  const farm = farms.find((f) => f.id === (farmId ?? farms[0]?.id)) ?? farms[0];
  const orderedPaddocks = useMemo(() => (farm ? [...farm.paddocks].sort(byPaddockNumber) : []), [farm]);

  const { data: groupsData } = useApi<{ groups: CattleGroup[] }>(farm ? `/api/cattle-groups?farmId=${farm.id}` : null);
  const groups = groupsData?.groups ?? [];

  const today = todayStr();
  const [anchor, setAnchor] = useState(today);
  const start = addDays(anchor, -2);
  const end = addDays(anchor, 4);
  const days = useMemo(() => {
    const list: string[] = [];
    for (let i = -2; i <= 4; i++) list.push(addDays(anchor, i));
    return list;
  }, [anchor]);

  const { data: allocData, refetch } = useApi<{ allocations: GrazingAllocation[] }>(
    farm ? `/api/grazing-allocations?farmId=${farm.id}&start=${start}&end=${end}` : null
  );
  const allocations = allocData?.allocations ?? [];

  const cellMap = useMemo(() => {
    const map = new Map<string, GrazingAllocation>();
    allocations.forEach((a) => map.set(`${a.groupId}|${a.date.slice(0, 10)}|${a.session}`, a));
    return map;
  }, [allocations]);

  const [cellTarget, setCellTarget] = useState<CellTarget | null>(null);

  const switchFarm = (id: string) => {
    setFarmId(id);
    setAnchor(today);
  };

  const openCell = (g: CattleGroup, date: string, session: Session) => {
    const existing = cellMap.get(`${g.id}|${date}|${session}`);
    setCellTarget({
      groupId: g.id,
      groupName: g.name,
      date,
      session,
      currentPaddockId: existing?.paddockId ?? "",
      currentAllocationId: existing?.id ?? null,
    });
  };

  if (loading) return <div className="screen"><Header title="Grazing allocation" backHref="/food" /><Spinner /></div>;
  if (!farm) return <div className="screen"><Header title="Grazing allocation" backHref="/food" /><div className="empty">No farms found.</div></div>;

  return (
    <div className="screen">
      <Header title="Grazing allocation" backHref="/food" />

      <div className="tabs">
        {farms.map((f) => (
          <button key={f.id} className={`tab${farm.id === f.id ? " active" : ""}`} onClick={() => switchFarm(f.id)}>{f.name}</button>
        ))}
      </div>

      <div className="grazing-week-nav">
        <button className="map-zoom-btn" onClick={() => setAnchor(addDays(anchor, -7))} aria-label="Previous week"><ChevronLeft size={16} /></button>
        <button className="link-btn" onClick={() => setAnchor(today)}>Today</button>
        <button className="map-zoom-btn" onClick={() => setAnchor(addDays(anchor, 7))} aria-label="Next week"><ChevronRight size={16} /></button>
      </div>

      {groups.length === 0 ? (
        <p className="ds-note" style={{ padding: "12px 18px" }}>No milking groups set up for {farm.name} yet — add them under Cattle.</p>
      ) : (
        <div className="grazing-table-scroll">
          <table className="grazing-table">
            <thead>
              <tr>
                <th className="grazing-table-label" colSpan={2}></th>
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
              {groups.map((g) => (
                <Fragment key={g.id}>
                  <tr>
                    <td rowSpan={2} className="grazing-table-label">{g.name}</td>
                    <td className="grazing-table-session">Day</td>
                    {days.map((d) => {
                      const cell = cellMap.get(`${g.id}|${d}|DAY`);
                      return (
                        <td key={d} className="grazing-table-cell" onClick={() => openCell(g, d, "DAY")}>
                          {cell?.paddock.code ?? "—"}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="grazing-table-session">Night</td>
                    {days.map((d) => {
                      const cell = cellMap.get(`${g.id}|${d}|NIGHT`);
                      return (
                        <td key={d} className="grazing-table-cell" onClick={() => openCell(g, d, "NIGHT")}>
                          {cell?.paddock.code ?? "—"}
                        </td>
                      );
                    })}
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cellTarget && farm && (
        <CellEditor
          target={cellTarget}
          farmId={farm.id}
          paddocks={orderedPaddocks}
          onClose={() => setCellTarget(null)}
          onSaved={() => { setCellTarget(null); refetch(); }}
        />
      )}
    </div>
  );
}

function CellEditor({
  target,
  farmId,
  paddocks,
  onClose,
  onSaved,
}: {
  target: CellTarget;
  farmId: string;
  paddocks: { id: string; code: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [paddockId, setPaddockId] = useState(target.currentPaddockId);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleSave = async () => {
    if (!paddockId) return;
    setSaving(true);
    await fetch("/api/grazing-allocations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId: target.groupId,
        farmId,
        date: target.date,
        sessions: [{ session: target.session, paddockId }],
      }),
    });
    setSaving(false);
    onSaved();
  };

  const handleClear = async () => {
    if (!target.currentAllocationId) { onClose(); return; }
    setClearing(true);
    await fetch(`/api/grazing-allocations/${target.currentAllocationId}`, { method: "DELETE" });
    setClearing(false);
    onSaved();
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="edit-entry-overlay" onClick={onClose}>
      <div className="edit-entry-panel" onClick={(e) => e.stopPropagation()}>
        <div className="keypad-header">
          <div className="stock-panel-title">
            <span className="keypad-code">Group {target.groupName} — {target.session === "DAY" ? "Day" : "Night"} — {target.date}</span>
          </div>
          <X size={18} className="close" onClick={onClose} />
        </div>
        <div className="edit-entry-body">
          <label className="field">
            <span className="field-label">Camp</span>
            <select className="field-input" value={paddockId} onChange={(e) => setPaddockId(e.target.value)}>
              <option value="">Select…</option>
              {paddocks.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
            </select>
          </label>
          <div className="edit-entry-actions">
            <button className="save-btn" onClick={handleSave} disabled={saving || !paddockId}>
              {saving ? "Saving…" : "Save"}
            </button>
            {target.currentAllocationId && (
              <button className="delete-btn" onClick={handleClear} disabled={clearing}>
                {clearing ? "Clearing…" : "Clear this entry"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
