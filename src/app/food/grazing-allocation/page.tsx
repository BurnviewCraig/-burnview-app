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
type CellTarget = { groupId: string; groupName: string; date: string; session: Session; currentPaddockIds: string[] };

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
    const map = new Map<string, GrazingAllocation[]>();
    allocations.forEach((a) => {
      const key = `${a.groupId}|${a.date.slice(0, 10)}|${a.session}`;
      map.set(key, [...(map.get(key) ?? []), a]);
    });
    return map;
  }, [allocations]);

  const cellLabel = (cell: GrazingAllocation[] | undefined) =>
    cell && cell.length
      ? [...cell].map((a) => a.paddock.code).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join("+")
      : "—";

  const [cellTarget, setCellTarget] = useState<CellTarget | null>(null);

  const switchFarm = (id: string) => {
    setFarmId(id);
    setAnchor(today);
  };

  const openCell = (g: CattleGroup, date: string, session: Session) => {
    const existing = cellMap.get(`${g.id}|${date}|${session}`) ?? [];
    setCellTarget({
      groupId: g.id,
      groupName: g.name,
      date,
      session,
      currentPaddockIds: existing.map((a) => a.paddockId),
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
                          {cellLabel(cell)}
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
                          {cellLabel(cell)}
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

type CampRow = { rowId: string; paddockId: string };
const newCampRow = (paddockId = ""): CampRow => ({ rowId: Math.random().toString(36).slice(2), paddockId });

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
  const [rows, setRows] = useState<CampRow[]>(
    target.currentPaddockIds.length ? target.currentPaddockIds.map((id) => newCampRow(id)) : [newCampRow()]
  );
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const chosenIds = new Set(rows.map((r) => r.paddockId).filter(Boolean));
  const validPaddockIds = rows.map((r) => r.paddockId).filter(Boolean);

  const updateRow = (rowId: string, paddockId: string) =>
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, paddockId } : r)));
  const addRow = () => setRows((prev) => [...prev, newCampRow()]);
  const removeRow = (rowId: string) => setRows((prev) => prev.filter((r) => r.rowId !== rowId));

  const postSessions = async (paddockIds: string[]) => {
    await fetch("/api/grazing-allocations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId: target.groupId,
        farmId,
        date: target.date,
        sessions: [{ session: target.session, paddockIds }],
      }),
    });
  };

  const handleSave = async () => {
    if (!validPaddockIds.length) return;
    setSaving(true);
    await postSessions(validPaddockIds);
    setSaving(false);
    onSaved();
  };

  const handleClear = async () => {
    if (!target.currentPaddockIds.length) { onClose(); return; }
    setClearing(true);
    await postSessions([]);
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
          <div className="field">
            <span className="field-label">Camp(s) — add a second camp if this session is split across two</span>
            <div className="chem-rows">
              {rows.map((row) => (
                <div key={row.rowId} className="chem-row">
                  <select
                    className="field-input"
                    value={row.paddockId}
                    onChange={(e) => updateRow(row.rowId, e.target.value)}
                  >
                    <option value="">Select…</option>
                    {paddocks
                      .filter((p) => p.id === row.paddockId || !chosenIds.has(p.id))
                      .map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
                  </select>
                  <button
                    type="button"
                    className="link-btn chem-row-remove"
                    onClick={() => removeRow(row.rowId)}
                    disabled={rows.length === 1}
                    aria-label="Remove camp"
                  >
                    <X size={16} strokeWidth={1.75} />
                  </button>
                </div>
              ))}
              <button type="button" className="link-btn" onClick={addRow} disabled={chosenIds.size >= paddocks.length}>
                + Add camp
              </button>
            </div>
          </div>
          <div className="edit-entry-actions">
            <button className="save-btn" onClick={handleSave} disabled={saving || !validPaddockIds.length}>
              {saving ? "Saving…" : "Save"}
            </button>
            {target.currentPaddockIds.length > 0 && (
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
