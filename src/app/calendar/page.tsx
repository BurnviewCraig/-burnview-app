"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, CheckSquare, Square, Trash2 } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { todayStr } from "@/lib/utils";
import { EditEntryPanel, type EditableEntry } from "@/components/EditEntryPanel";
import { BulkEditPanel } from "@/components/BulkEditPanel";
import { addDays, eventsFromCalendarData, type RawActivity, type RawWalk, type RawGrazing, type WalkGroup, type CalendarEvent } from "@/lib/calendarFormat";
import type { Farm } from "@/lib/types";

export default function CalendarPage() {
  const router = useRouter();
  const { data: farmsData } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];

  const [farmId, setFarmId] = useState<string | "all">("all");
  const [daysBack, setDaysBack] = useState(7);

  const today = todayStr();
  const start = addDays(today, -(daysBack - 1));

  const { data, loading, refetch } = useApi<{ activities: RawActivity[]; walks: RawWalk[]; grazing: RawGrazing[] }>(
    `/api/calendar?start=${start}&end=${today}${farmId !== "all" ? `&farmId=${farmId}` : ""}`
  );

  const [editingEntry, setEditingEntry] = useState<EditableEntry | null>(null);
  const [editingPaddock, setEditingPaddock] = useState<{ code: string; sizeHa: number | null } | null>(null);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    eventsFromCalendarData(data ?? null).forEach((e) => {
      const d = e.raw.date.slice(0, 10);
      const list = map.get(d) ?? [];
      list.push(e);
      map.set(d, list);
    });
    return map;
  }, [data]);

  const openEdit = (e: CalendarEvent) => {
    if (e.isGrazing) return; // shown for reference here — edit/delete from Cattle or Grazing allocation
    if (e.isWalkGroup) {
      const g = e.raw as WalkGroup;
      router.push(`/food/data-entry/pasture-walk?farmId=${g.farmId}&date=${g.date}`);
    } else {
      const a = e.raw as RawActivity;
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
      setEditingPaddock({ code: a.paddock.code, sizeHa: a.paddock.sizeHa });
    }
  };
  const closeEdit = () => { setEditingEntry(null); setEditingPaddock(null); };

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const allEvents = useMemo(() => Array.from(eventsByDate.values()).flat(), [eventsByDate]);
  const selectedEvents = useMemo(
    () => allEvents.filter((e) => selectedIds.has(e.id)),
    [allEvents, selectedIds]
  );
  const selectedTypeKey = (e: CalendarEvent) => (e.isWalk ? "WALK" : (e.raw as RawActivity).type);
  const selectedTypes = new Set(selectedEvents.map(selectedTypeKey));
  const canBulkEdit = selectedEvents.length > 0 && selectedTypes.size === 1;

  const toggleSelectMode = () => {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
    setConfirmingBulkDelete(false);
  };
  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => { setSelectedIds(new Set()); setConfirmingBulkDelete(false); };

  const handleBulkDelete = async () => {
    if (!confirmingBulkDelete) { setConfirmingBulkDelete(true); return; }
    setBulkDeleting(true);
    await Promise.all(
      selectedEvents.map((e) =>
        fetch(e.isWalk ? `/api/pasture-walks/${e.id}` : `/api/field-activities/${e.id}`, { method: "DELETE" })
      )
    );
    setBulkDeleting(false);
    clearSelection();
    refetch();
  };

  const handleEventClick = (e: CalendarEvent) => {
    if (e.isGrazing) return;
    if (e.isWalkGroup) { if (!selectMode) openEdit(e); return; } // a whole day's sheet, not a single selectable/deletable row
    if (selectMode) toggleSelected(e.id);
    else openEdit(e);
  };

  const days = useMemo(() => {
    const list: string[] = [];
    for (let i = 0; i < daysBack; i++) list.push(addDays(start, i));
    return list;
  }, [start, daysBack]);

  return (
    <div className="screen">
      <Header title="Calendar" backHref="/" />

      <div className="tabs">
        <button className={`tab${farmId === "all" ? " active" : ""}`} onClick={() => setFarmId("all")}>All farms</button>
        {farms.map((f) => (
          <button key={f.id} className={`tab${farmId === f.id ? " active" : ""}`} onClick={() => setFarmId(f.id)}>{f.name}</button>
        ))}
        <button className={`tab${selectMode ? " active" : ""}`} onClick={toggleSelectMode} style={{ marginLeft: "auto" }}>
          {selectMode ? "Cancel" : "Select"}
        </button>
      </div>

      {loading && !data ? (
        <Spinner />
      ) : (
        <div className="calendar-scroll">
          <button className="link-btn calendar-load-more" onClick={() => setDaysBack((d) => d + 7)}>
            ← Load 7 more days
          </button>
          <div className="calendar-columns">
            {days.map((day) => {
              const events = eventsByDate.get(day) ?? [];
              const dt = new Date(day + "T00:00:00");
              const dayName = dt.toLocaleDateString(undefined, { weekday: "short" });
              const dayNum = dt.toLocaleDateString(undefined, { day: "numeric", month: "short" });
              const isToday = day === today;
              return (
                <div key={day} className={`calendar-day${isToday ? " today" : ""}`}>
                  <div className="calendar-day-head">
                    <span className="calendar-day-name">{dayName}</span>
                    <span className="calendar-day-num">{dayNum}</span>
                  </div>
                  <div className="calendar-day-events">
                    {events.length === 0 && <span className="calendar-empty">Nothing logged</span>}
                    {events.map((e) => {
                      const isSelected = selectedIds.has(e.id);
                      const selectable = !e.isGrazing && !e.isWalkGroup;
                      const clickable = !e.isGrazing && !(e.isWalkGroup && selectMode);
                      return (
                        <div
                          key={e.id}
                          className={`calendar-event${clickable ? " clickable" : ""}${isSelected ? " selected" : ""}`}
                          onClick={clickable ? () => handleEventClick(e) : undefined}
                        >
                          {selectable && selectMode && (isSelected ? <CheckSquare size={13} className="calendar-event-check" /> : <Square size={13} className="calendar-event-check" />)}
                          {farmId === "all" && <span className="calendar-event-farm">{e.farmName}</span>}
                          {e.label}
                          {clickable && !selectMode && <Pencil size={12} strokeWidth={1.75} className="hr-edit-icon" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectMode && selectedEvents.length > 0 && (
        <div className="calendar-select-bar">
          <span className="mr-sub">{selectedEvents.length} selected</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="link-btn" onClick={clearSelection}>Clear</button>
            <button className="save-btn small" onClick={() => setBulkEditOpen(true)} disabled={!canBulkEdit} title={!canBulkEdit ? "Select entries of the same type to bulk-edit" : ""}>
              Edit
            </button>
            <button className={`delete-btn${confirmingBulkDelete ? " confirm" : ""}`} onClick={handleBulkDelete} disabled={bulkDeleting}>
              <Trash2 size={14} strokeWidth={1.75} />
              {bulkDeleting ? "Deleting…" : confirmingBulkDelete ? "Confirm delete" : "Delete"}
            </button>
          </div>
        </div>
      )}

      {bulkEditOpen && canBulkEdit && (
        <BulkEditPanel
          targets={selectedEvents.map((e) => ({ id: e.id, isWalk: e.isWalk }))}
          type={selectedTypeKey(selectedEvents[0])}
          onClose={() => setBulkEditOpen(false)}
          onDone={() => { setBulkEditOpen(false); clearSelection(); refetch(); }}
        />
      )}

      {editingEntry && editingPaddock && (
        <EditEntryPanel
          entry={editingEntry}
          paddockCode={editingPaddock.code}
          paddockSizeHa={editingPaddock.sizeHa}
          onClose={closeEdit}
          onSaved={() => { closeEdit(); refetch(); }}
          onDeleted={() => { closeEdit(); refetch(); }}
        />
      )}
    </div>
  );
}
