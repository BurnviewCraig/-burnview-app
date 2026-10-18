"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Check, Repeat } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { AccessGate } from "@/components/AccessGate";
import { useApi } from "@/lib/useApi";
import { todayStr, daysBetween } from "@/lib/utils";
import { addDays } from "@/lib/calendarFormat";
import { REPEAT_PRESETS, dueLabel } from "@/lib/diaryFormat";
import type { Farm, DiaryEntry } from "@/lib/types";

const WEEK_LENGTH = 7;

export default function DiaryPage() {
  return (
    <AccessGate section="diary" title="Diary">
      <DiaryPageInner />
    </AccessGate>
  );
}

function DiaryPageInner() {
  const today = todayStr();
  const { data: farmsData } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];
  const { data, loading, error, refetch } = useApi<{ diaryEntries: DiaryEntry[] }>("/api/diary-entries");
  const entries = data?.diaryEntries ?? [];

  const [farmFilter, setFarmFilter] = useState<string | "all">("all");
  const filtered = useMemo(
    () => (farmFilter === "all" ? entries : entries.filter((e) => e.farmId === farmFilter || e.farmId === null)),
    [entries, farmFilter]
  );

  // Overdue stays pinned above the week grid regardless of which week is
  // being browsed — a reminder that fell behind must never scroll out of
  // sight just because the viewed week moved on.
  const overdue = useMemo(
    () => filtered.filter((e) => daysBetween(today, e.dueDate) < 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [filtered, today]
  );

  const [anchor, setAnchor] = useState(today);
  const days = useMemo(() => {
    const list: string[] = [];
    for (let i = 0; i < WEEK_LENGTH; i++) list.push(addDays(anchor, i));
    return list;
  }, [anchor]);

  const byDate = useMemo(() => {
    const map = new Map<string, DiaryEntry[]>();
    filtered.forEach((e) => {
      const d = e.dueDate.slice(0, 10);
      map.set(d, [...(map.get(d) ?? []), e]);
    });
    return map;
  }, [filtered]);

  const [active, setActive] = useState<DiaryEntry | "new" | null>(null);

  if (loading) return <div className="screen"><Header title="Diary" backHref="/" /><Spinner /></div>;
  if (error) return <div className="screen"><Header title="Diary" backHref="/" /><div className="empty">{error}</div></div>;

  return (
    <div className="screen">
      <Header title="Diary" backHref="/" />

      <div className="tabs">
        <button className={`tab${farmFilter === "all" ? " active" : ""}`} onClick={() => setFarmFilter("all")}>All</button>
        {farms.map((f) => (
          <button key={f.id} className={`tab${farmFilter === f.id ? " active" : ""}`} onClick={() => setFarmFilter(f.id)}>{f.name}</button>
        ))}
      </div>

      <div style={{ padding: "10px 18px 0" }}>
        <button className="link-btn" onClick={() => setActive("new")}>
          <Plus size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
          New reminder
        </button>
      </div>

      {overdue.length > 0 && (
        <div style={{ padding: "10px 18px 0" }}>
          <div className="field-hint" style={{ fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 4px" }}>Overdue</div>
          <div className="walk-list">
            {overdue.map((e) => {
              const due = dueLabel(e.dueDate, today);
              return (
                <button key={e.id} className="walk-row" onClick={() => setActive(e)}>
                  <span className="wr-code">{e.title}</span>
                  <span className="field-editor-sub">
                    <span className={`diary-due diary-due-${due.tone}`}>{due.text}</span>
                    {e.farm ? ` · ${e.farm.name}` : " · All farms"}
                    {e.repeatDays ? ` · repeats every ${e.repeatDays}d` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grazing-week-nav">
        <button className="map-zoom-btn" onClick={() => setAnchor(addDays(anchor, -WEEK_LENGTH))} aria-label="Previous week"><ChevronLeft size={16} /></button>
        <button className="link-btn" onClick={() => setAnchor(today)}>This week</button>
        <button className="map-zoom-btn" onClick={() => setAnchor(addDays(anchor, WEEK_LENGTH))} aria-label="Next week"><ChevronRight size={16} /></button>
      </div>

      <div className="calendar-scroll">
        <div className="calendar-columns">
          {days.map((day) => {
            const dayEntries = byDate.get(day) ?? [];
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
                  {dayEntries.length === 0 && <span className="calendar-empty">Nothing due</span>}
                  {dayEntries.map((e) => (
                    <div key={e.id} className="calendar-event clickable" onClick={() => setActive(e)}>
                      {farmFilter === "all" && <span className="calendar-event-farm">{e.farm ? e.farm.name : "All farms"}</span>}
                      {e.title}
                      {e.repeatDays ? <Repeat size={11} strokeWidth={2} style={{ verticalAlign: "-1px", marginLeft: 4, opacity: 0.6 }} /> : null}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {active && (
        <DiaryEditor
          entry={active === "new" ? null : active}
          farms={farms}
          today={today}
          onClose={() => setActive(null)}
          onSaved={() => { setActive(null); refetch(); }}
        />
      )}
    </div>
  );
}

function DiaryEditor({
  entry,
  farms,
  today,
  onClose,
  onSaved,
}: {
  entry: DiaryEntry | null;
  farms: Farm[];
  today: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(entry?.title ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [dueDate, setDueDate] = useState(entry?.dueDate.slice(0, 10) ?? today);
  const [farmId, setFarmId] = useState(entry?.farmId ?? "");
  const [repeatDays, setRepeatDays] = useState(entry?.repeatDays != null ? String(entry.repeatDays) : "");
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !dueDate) return;
    setSaving(true);
    const body = {
      title: title.trim(),
      notes: notes.trim(),
      dueDate,
      farmId: farmId || null,
      repeatDays: repeatDays ? Number(repeatDays) : null,
    };
    if (entry) {
      await fetch(`/api/diary-entries/${entry.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } else {
      await fetch("/api/diary-entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    setSaving(false);
    onSaved();
  };

  const handleComplete = async () => {
    if (!entry) return;
    setCompleting(true);
    await fetch(`/api/diary-entries/${entry.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ complete: true }) });
    setCompleting(false);
    onSaved();
  };

  const handleDelete = async () => {
    if (!entry) return;
    if (!confirmingDelete) { setConfirmingDelete(true); return; }
    setDeleting(true);
    await fetch(`/api/diary-entries/${entry.id}`, { method: "DELETE" });
    setDeleting(false);
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
            <span className="keypad-code">{entry ? "Edit reminder" : "New reminder"}</span>
          </div>
          <X size={18} className="close" onClick={onClose} />
        </div>
        <div className="edit-entry-body">
          <label className="field">
            <span className="field-label">Title</span>
            <input className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Vaccinate SA herd — Botulism" autoFocus />
          </label>

          <label className="field">
            <span className="field-label">Notes</span>
            <textarea className="field-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any detail managers need" />
          </label>

          <label className="field">
            <span className="field-label">Due date</span>
            <input className="field-input small" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>

          <label className="field">
            <span className="field-label">Farm</span>
            <select className="field-input small" value={farmId} onChange={(e) => setFarmId(e.target.value)}>
              <option value="">All farms</option>
              {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Repeats every (days) — leave blank for a one-off</span>
            <input
              className="field-input small"
              type="number"
              min={1}
              value={repeatDays}
              onChange={(e) => setRepeatDays(e.target.value)}
              placeholder="e.g. 180"
            />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {REPEAT_PRESETS.map((p) => (
                <button key={p.days} type="button" className="link-btn" onClick={() => setRepeatDays(String(p.days))}>{p.label}</button>
              ))}
              {repeatDays && <button type="button" className="link-btn" onClick={() => setRepeatDays("")}>Clear</button>}
            </div>
          </label>

          <div className="edit-entry-actions">
            <button className="save-btn" onClick={handleSave} disabled={saving || !title.trim() || !dueDate}>
              {saving ? "Saving…" : "Save"}
            </button>
            {entry && (
              <button className="save-btn" onClick={handleComplete} disabled={completing} style={{ background: "var(--normal)" }}>
                <Check size={14} strokeWidth={2} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                {completing
                  ? "Marking done…"
                  : entry.repeatDays
                  ? <>Mark done <Repeat size={12} strokeWidth={2} style={{ verticalAlign: "-1px", margin: "0 2px" }} /> again in {entry.repeatDays}d</>
                  : "Mark done"}
              </button>
            )}
            {entry && (
              <button className={`delete-btn${confirmingDelete ? " confirm" : ""}`} onClick={handleDelete} disabled={deleting}>
                <Trash2 size={14} strokeWidth={1.75} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                {deleting ? "Deleting…" : confirmingDelete ? "Click again to confirm" : "Delete"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
