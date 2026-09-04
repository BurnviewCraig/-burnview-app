"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, X } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { byPaddockNumber, todayStr } from "@/lib/utils";
import { buildFieldHistory } from "@/lib/fieldHistory";
import { EditEntryPanel, type EditableEntry } from "@/components/EditEntryPanel";
import type { Farm, Paddock, FieldActivity, PastureWalk, GrazingAllocation } from "@/lib/types";

export default function FullFieldHistoryPage() {
  const { data, loading } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = data?.farms ?? [];
  const [farmId, setFarmId] = useState<string | null>(null);
  const farm = farms.find((f) => f.id === (farmId ?? farms[0]?.id)) ?? farms[0];
  const orderedPaddocks = useMemo(() => (farm ? [...farm.paddocks].sort(byPaddockNumber) : []), [farm]);

  const [selected, setSelected] = useState<Paddock | null>(null);
  const today = todayStr();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: actsData, refetch: refetchActs } = useApi<{ activities: FieldActivity[] }>(
    selected ? `/api/field-activities?paddockId=${selected.id}` : null
  );
  const { data: walksData, refetch: refetchWalks } = useApi<{ walks: PastureWalk[] }>(
    selected ? `/api/pasture-walks?paddockId=${selected.id}` : null
  );
  const { data: grazingData } = useApi<{ allocations: GrazingAllocation[] }>(
    selected ? `/api/grazing-allocations?paddockId=${selected.id}` : null
  );

  const history = useMemo(() => {
    if (!selected) return [];
    return buildFieldHistory({
      activities: actsData?.activities ?? [],
      walks: walksData?.walks ?? [],
      grazing: grazingData?.allocations ?? [],
      today,
    });
  }, [selected, actsData, walksData, grazingData, today]);

  const [editingEntry, setEditingEntry] = useState<EditableEntry | null>(null);

  const openEdit = (id: string, isWalk: boolean) => {
    if (isWalk) {
      const w = walksData?.walks.find((x) => x.id === id);
      if (w) setEditingEntry({ kind: "walk", id: w.id, date: w.date, cover: w.cover });
    } else {
      const a = actsData?.activities.find((x) => x.id === id);
      if (a) {
        setEditingEntry({
          kind: "activity",
          id: a.id,
          type: a.type,
          date: a.date,
          notes: a.notes,
          product: a.product,
          rate: a.rate,
          method: a.method,
          depth: a.depth,
          mix: a.mix,
          chemicals: a.chemicals,
          bales: a.bales,
        });
      }
    }
  };
  const closeEdit = () => setEditingEntry(null);
  const handleEntryChanged = () => {
    setEditingEntry(null);
    refetchActs();
    refetchWalks();
  };

  const switchFarm = (id: string) => {
    setFarmId(id);
    setSelected(null);
  };

  if (loading) return <div className="screen"><Header title="Full field history" backHref="/farm/field-editor" /><Spinner /></div>;
  if (!farm) return <div className="screen"><Header title="Full field history" backHref="/farm/field-editor" /><div className="empty">No farms found.</div></div>;

  return (
    <div className="screen">
      <Header title="Full field history" backHref="/farm/field-editor" />

      <div className="tabs">
        {farms.map((f) => (
          <button key={f.id} className={`tab${farm.id === f.id ? " active" : ""}`} onClick={() => switchFarm(f.id)}>{f.name}</button>
        ))}
      </div>

      <div className="walk-list">
        {orderedPaddocks.map((p) => (
          <button key={p.id} className={`walk-row${selected?.id === p.id ? " active" : ""}`} onClick={() => setSelected(p)}>
            <span className="wr-code">{p.code}</span>
            <span className="field-editor-sub">{p.sizeHa ? `${p.sizeHa} ha` : "No size set"} · {p.landType || "Unclassified"}</span>
          </button>
        ))}
      </div>

      {selected && mounted && createPortal(
        <div className="detail-sheet-overlay" onClick={() => setSelected(null)}>
          <div className="detail-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="ds-head">
              <div><h2>{farm.name} — {selected.code}</h2></div>
              <button className="close" onClick={() => setSelected(null)}><X size={18} /></button>
            </div>

            <p className="history-label">Full history ({history.length})</p>
            {history.length === 0 && <p className="ds-note">No activity logged for this field yet.</p>}
            {history.length > 0 && (
              <ul className="history-list">
                {history.map((h) => (
                  <li
                    key={h.id}
                    className={`history-row${h.isGrazing ? "" : " clickable"}`}
                    onClick={h.isGrazing ? undefined : () => openEdit(h.id, h.isWalk)}
                  >
                    <span className="hr-date">{h.date.slice(0, 10)}</span>
                    <span className="hr-type">
                      {h.type}
                      {h.product ? ` — ${h.product}` : ""}
                      {h.rate ? ` (${h.rate} kg/ha)` : ""}
                      {h.method ? ` — ${h.method}` : ""}
                      {h.depth ? ` (${h.depth} cm)` : ""}
                      {h.mix?.length
                        ? ` — ${h.mix.map((m) => `${m.rate}${m.unit} ${m.crop}${m.variety ? ` (${m.variety})` : ""}`).join(", ")}`
                        : ""}
                      {h.chemicals?.length ? ` — ${h.chemicals.map((c) => `${c.name} ${c.rate}${c.unit}`).join(", ")}` : ""}
                      {h.bales ? ` × ${h.bales}${selected.sizeHa ? ` (${(h.bales / selected.sizeHa).toFixed(1)}/ha)` : ""}` : ""}
                    </span>
                    {h.notes && <span className="hr-notes">{h.notes}</span>}
                    {!h.isGrazing && <Pencil size={13} strokeWidth={1.75} className="hr-edit-icon" />}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>,
        document.body
      )}

      {editingEntry && selected && (
        <EditEntryPanel
          entry={editingEntry}
          paddockCode={selected.code}
          paddockSizeHa={selected.sizeHa}
          onClose={closeEdit}
          onSaved={handleEntryChanged}
          onDeleted={handleEntryChanged}
        />
      )}
    </div>
  );
}
