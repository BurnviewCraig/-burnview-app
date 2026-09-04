"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { X, Droplets, ZoomIn, ZoomOut, Maximize, Pencil } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { byPaddockNumber, withinRange, todayStr } from "@/lib/utils";
import { buildFieldLayout } from "@/lib/map-layout";
import { projectBoundariesShared, fitRingsToViewBox, type BoundaryGeometry } from "@/lib/geo";
import { LAND_TYPES, NUTRIENT_RANGES, LAND_TYPE_COLORS, UNCLASSIFIED_COLOR } from "@/lib/constants";
import type { WedgeFarm, FieldActivity, PastureWalk, FertilizerType, GrazingAllocation } from "@/lib/types";
import { EditEntryPanel, type EditableEntry } from "@/components/EditEntryPanel";

type ViewBox = { x: number; y: number; w: number; h: number };
const BASE_VIEW: ViewBox = { x: 0, y: 0, w: 900, h: 620 };
const MIN_W = BASE_VIEW.w / 8; // ~8x zoom
const DRAG_THRESHOLD = 4; // px, before a pointer-down counts as a pan (vs. a tap)

function landColor(landType: string | null): string {
  return (landType && LAND_TYPE_COLORS[landType]) || UNCLASSIFIED_COLOR;
}

// A brighter tint of the fill color, used as a thin outline so each field's
// edge is visible without a flat paper-colored border cutting across every
// crop color the same way.
function brighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function diffDays(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / 86400000);
}

function clientToViewBoxPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

export default function FarmMapPage() {
  const { data, loading, error, refetch } = useApi<{ farms: WedgeFarm[] }>("/api/wedge");
  const { data: fertData } = useApi<{ types: FertilizerType[] }>("/api/fertilizer-types");
  const farms = data?.farms ?? [];
  const fertTypes = fertData?.types ?? [];

  const [activeFarmId, setActiveFarmId] = useState<string | "all">("all");
  const [landCategory, setLandCategory] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nutrientRange, setNutrientRange] = useState("ytd");

  const [view, setView] = useState<ViewBox>(BASE_VIEW);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const dragRef = useRef<{
    pointerId: number;
    startViewBoxPt: { x: number; y: number };
    startView: ViewBox;
    moved: boolean;
  } | null>(null);
  const pinchRef = useRef<{
    ids: [number, number];
    startDist: number;
    startView: ViewBox;
    anchor: { x: number; y: number };
  } | null>(null);
  const suppressClickRef = useRef(false);

  const resetView = useCallback(() => setView(BASE_VIEW), []);

  const zoomAt = useCallback((anchor: { x: number; y: number }, factor: number, fromView: ViewBox) => {
    const newW = Math.min(BASE_VIEW.w, Math.max(MIN_W, fromView.w * factor));
    const k = newW / fromView.w;
    setView({
      x: anchor.x - (anchor.x - fromView.x) * k,
      y: anchor.y - (anchor.y - fromView.y) * k,
      w: newW,
      h: fromView.h * k,
    });
  }, []);

  const zoomButton = (factor: number) => {
    const center = { x: view.x + view.w / 2, y: view.y + view.h / 2 };
    zoomAt(center, factor, view);
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const anchor = clientToViewBoxPoint(svg, e.clientX, e.clientY);
      const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
      setView((prev) => {
        const newW = Math.min(BASE_VIEW.w, Math.max(MIN_W, prev.w * factor));
        const k = newW / prev.w;
        return { x: anchor.x - (anchor.x - prev.x) * k, y: anchor.y - (anchor.y - prev.y) * k, w: newW, h: prev.h * k };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  const startPinch = (svg: SVGSVGElement) => {
    const pts = [...pointersRef.current.values()];
    const ids = [...pointersRef.current.keys()] as [number, number];
    const dist = Math.max(1, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y));
    pinchRef.current = {
      ids,
      startDist: dist,
      startView: view,
      anchor: clientToViewBoxPoint(svg, (pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2),
    };
    dragRef.current = null;
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size >= 2) {
      startPinch(svg);
      return;
    }
    dragRef.current = {
      pointerId: e.pointerId,
      startViewBoxPt: clientToViewBoxPoint(svg, e.clientX, e.clientY),
      startView: view,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || !pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const pinch = pinchRef.current;
    if (pinch) {
      const [id0, id1] = pinch.ids;
      const p0 = pointersRef.current.get(id0);
      const p1 = pointersRef.current.get(id1);
      if (!p0 || !p1) return;
      const dist = Math.max(1, Math.hypot(p1.x - p0.x, p1.y - p0.y));
      const k = pinch.startDist / dist;
      const newW = Math.min(BASE_VIEW.w, Math.max(MIN_W, pinch.startView.w * k));
      const kActual = newW / pinch.startView.w;
      setView({
        x: pinch.anchor.x - (pinch.anchor.x - pinch.startView.x) * kActual,
        y: pinch.anchor.y - (pinch.anchor.y - pinch.startView.y) * kActual,
        w: newW,
        h: pinch.startView.h * kActual,
      });
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const cur = clientToViewBoxPoint(svg, e.clientX, e.clientY);
    const thresholdInViewBoxUnits = DRAG_THRESHOLD * (view.w / BASE_VIEW.w);
    if (!drag.moved && Math.hypot(cur.x - drag.startViewBoxPt.x, cur.y - drag.startViewBoxPt.y) > thresholdInViewBoxUnits) {
      drag.moved = true;
    }
    if (!drag.moved) return;
    setView({
      ...drag.startView,
      x: drag.startView.x + (drag.startViewBoxPt.x - cur.x),
      y: drag.startView.y + (drag.startViewBoxPt.y - cur.y),
    });
  };

  const endPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pinchRef.current?.ids.includes(e.pointerId)) {
      pinchRef.current = null;
    }
    const drag = dragRef.current;
    if (drag && drag.pointerId === e.pointerId) {
      if (drag.moved) suppressClickRef.current = true;
      dragRef.current = null;
    }
  };

  const handlePaddockClick = (id: string) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setSelectedId(id);
  };

  useEffect(() => {
    resetView();
  }, [activeFarmId, landCategory, resetView]);

  const current = activeFarmId === "all" ? null : farms.find((f) => f.id === activeFarmId) ?? null;

  const totalPaddocks = farms.reduce((s, f) => s + f.paddockCount, 0);
  const totalNoData = farms.reduce((s, f) => s + f.noDataCount, 0);

  const landCounts = useMemo(() => {
    if (!current) return {} as Record<string, number>;
    const counts: Record<string, number> = { all: current.paddocks.length, unclassified: 0 };
    LAND_TYPES.forEach((t) => { counts[t] = 0; });
    current.paddocks.forEach((p) => {
      if (p.landType) counts[p.landType] = (counts[p.landType] || 0) + 1;
      else counts.unclassified += 1;
    });
    return counts;
  }, [current]);

  const displayPaddocks = useMemo(() => {
    if (!current) return [];
    let list = current.paddocks;
    if (landCategory !== "all") {
      list = list.filter((p) => (landCategory === "unclassified" ? !p.landType : p.landType === landCategory));
    }
    return [...list].sort(byPaddockNumber);
  }, [current, landCategory]);

  const geoPaddocks = useMemo(() => displayPaddocks.filter((p) => p.boundary), [displayPaddocks]);
  const nonGeoPaddocks = useMemo(() => displayPaddocks.filter((p) => !p.boundary), [displayPaddocks]);
  const layout = useMemo(() => buildFieldLayout(nonGeoPaddocks.length), [nonGeoPaddocks.length]);

  const projectedGeo = useMemo(() => {
    if (!geoPaddocks.length) return new Map<string, [number, number][][]>();
    const withBoundary = geoPaddocks.map((p) => ({ id: p.id, boundary: p.boundary as BoundaryGeometry }));
    const projected = projectBoundariesShared(withBoundary);
    const fitted = fitRingsToViewBox(projected.map((p) => p.rings), 900, 620, 24);
    return new Map(projected.map((p, i) => [p.id, fitted[i]]));
  }, [geoPaddocks]);

  const switchFarm = (id: string | "all") => {
    setActiveFarmId(id);
    setLandCategory("all");
    setSelectedId(null);
  };

  const selectedPaddock = current?.paddocks.find((p) => p.id === selectedId) ?? null;

  const { data: historyActivities, refetch: refetchActivities } = useApi<{ activities: FieldActivity[] }>(
    selectedPaddock ? `/api/field-activities?paddockId=${selectedPaddock.id}` : null
  );
  const { data: historyWalks, refetch: refetchWalks } = useApi<{ walks: PastureWalk[] }>(
    selectedPaddock ? `/api/pasture-walks?paddockId=${selectedPaddock.id}` : null
  );
  const { data: paddockGrazing } = useApi<{ allocations: GrazingAllocation[] }>(
    selectedPaddock ? `/api/grazing-allocations?paddockId=${selectedPaddock.id}` : null
  );
  const [editingEntry, setEditingEntry] = useState<EditableEntry | null>(null);

  const today = todayStr();
  const { data: todayGrazingData } = useApi<{ allocations: GrazingAllocation[] }>(
    current ? `/api/grazing-allocations?farmId=${current.id}&start=${today}&end=${today}` : null
  );
  // Which group letter(s) to show over each paddock right now. A group can
  // show on two paddocks if its day and night camp differ today — in that
  // case each marker is tagged "Day"/"Night" so two same-letter markers
  // don't look like an unexplained duplicate.
  const grazingNowByPaddock = useMemo(() => {
    const byGroup = new Map<string, { name: string; day: string | null; night: string | null }>();
    (todayGrazingData?.allocations ?? []).forEach((a) => {
      const entry = byGroup.get(a.groupId) ?? { name: a.group.name, day: null, night: null };
      if (a.session === "DAY") entry.day = a.paddockId;
      else entry.night = a.paddockId;
      byGroup.set(a.groupId, entry);
    });
    const map = new Map<string, { label: string; tag: string | null }[]>();
    const add = (paddockId: string, label: string, tag: string | null) => {
      const list = map.get(paddockId) ?? [];
      if (!list.some((m) => m.label === label && m.tag === tag)) list.push({ label, tag });
      map.set(paddockId, list);
    };
    byGroup.forEach(({ name, day, night }) => {
      if (day && day === night) add(day, name, null);
      else {
        if (day) add(day, name, "Day");
        if (night) add(night, name, "Night");
      }
    });
    return map;
  }, [todayGrazingData]);

  const openEdit = (id: string, isWalk: boolean) => {
    if (isWalk) {
      const w = historyWalks?.walks.find((x) => x.id === id);
      if (w) setEditingEntry({ kind: "walk", id: w.id, date: w.date, cover: w.cover });
    } else {
      const a = historyActivities?.activities.find((x) => x.id === id);
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
  const handleEntrySaved = () => {
    setEditingEntry(null);
    refetchActivities();
    refetchWalks();
  };
  const handleEntryDeleted = () => {
    setEditingEntry(null);
    refetchActivities();
    refetchWalks();
  };

  const history = useMemo(() => {
    if (!selectedPaddock) return [];
    const acts = (historyActivities?.activities ?? []).map((a) => ({
      id: a.id,
      isWalk: false,
      date: a.date,
      type: a.type.replace("_", " "),
      product: a.product,
      rate: a.rate,
      method: a.method,
      depth: a.depth,
      mix: a.mix,
      chemicals: a.chemicals,
      bales: a.bales,
      notes: a.notes,
    }));
    const walks = (historyWalks?.walks ?? []).map((w) => ({
      id: w.id,
      isWalk: true,
      date: w.date,
      type: "Pasture walk",
      notes: `${w.cover} kg DM/ha`,
    }));
    // Only past/today's grazing counts as history — a few days out shows on
    // the allocation calendar as a plan, not as something that's happened yet.
    // A group grazing the same camp for a run of consecutive days (day+night
    // included) collapses into one row dated at the end of that run, rather
    // than a row per session.
    const rows = (paddockGrazing?.allocations ?? [])
      .filter((g) => g.date.slice(0, 10) <= today)
      .map((g) => ({ groupId: g.groupId, groupName: g.group.name, date: g.date.slice(0, 10), count: g.count ?? null }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const byGroup = new Map<string, typeof rows>();
    rows.forEach((r) => byGroup.set(r.groupId, [...(byGroup.get(r.groupId) ?? []), r]));
    const grazed: { id: string; isWalk: boolean; isGrazing: boolean; date: string; type: string; notes: string }[] = [];
    byGroup.forEach((list, groupId) => {
      let spanStart = list[0];
      let spanEnd = list[0];
      for (let i = 1; i < list.length; i++) {
        const cur = list[i];
        if (diffDays(spanEnd.date, cur.date) <= 1) {
          spanEnd = cur;
        } else {
          grazed.push({
            id: `grazing-${groupId}-${spanStart.date}`,
            isWalk: false,
            isGrazing: true,
            date: spanEnd.date,
            type: "Grazed",
            notes: `${spanEnd.groupName}${spanEnd.count != null ? ` (${spanEnd.count})` : ""}`,
          });
          spanStart = cur;
          spanEnd = cur;
        }
      }
      grazed.push({
        id: `grazing-${groupId}-${spanStart.date}`,
        isWalk: false,
        isGrazing: true,
        date: spanEnd.date,
        type: "Grazed",
        notes: `${spanEnd.groupName}${spanEnd.count != null ? ` (${spanEnd.count})` : ""}`,
      });
    });
    return [...acts, ...walks, ...grazed].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [selectedPaddock, historyActivities, historyWalks, paddockGrazing, today]);

  const nutrientTotals = useMemo(() => {
    if (!selectedPaddock || !historyActivities) return null;
    const fertMap = Object.fromEntries(fertTypes.map((t) => [t.name, t]));
    const apps = historyActivities.activities.filter(
      (a) => a.type === "FERTILIZER" && a.product && a.rate && withinRange(a.date, nutrientRange)
    );
    return apps.reduce(
      (acc, e) => {
        const comp = fertMap[e.product!] || { nitrogenPct: 0, phosphorusPct: 0, potassiumPct: 0, sulfurPct: 0 };
        acc.N += (e.rate! * comp.nitrogenPct) / 100;
        acc.P += (e.rate! * comp.phosphorusPct) / 100;
        acc.K += (e.rate! * comp.potassiumPct) / 100;
        acc.S += (e.rate! * comp.sulfurPct) / 100;
        acc.count += 1;
        return acc;
      },
      { N: 0, P: 0, K: 0, S: 0, count: 0 }
    );
  }, [selectedPaddock, historyActivities, fertTypes, nutrientRange]);

  const setClassification = async (type: string | null) => {
    if (!selectedPaddock) return;
    await fetch(`/api/paddocks/${selectedPaddock.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ landType: type }),
    });
    refetch();
  };

  if (loading && !data) return <div className="screen"><Header title="Farm map" backHref="/farm" /><Spinner /></div>;
  if (error) return <div className="screen"><Header title="Farm map" backHref="/farm" /><div className="empty">{error}</div></div>;

  return (
    <div className="screen">
      <Header title="Farm map" backHref="/farm" />

      <div className="tabs">
        <button className={`tab${activeFarmId === "all" ? " active" : ""}`} onClick={() => switchFarm("all")}>All farms</button>
        {farms.map((f) => (
          <button key={f.id} className={`tab${activeFarmId === f.id ? " active" : ""}`} onClick={() => switchFarm(f.id)}>{f.name}</button>
        ))}
      </div>

      {activeFarmId === "all" && (
        <div className="all-farms">
          <div className="holistic-summary">
            <div><span className="num">{farms.length}</span><span className="lbl">farms</span></div>
            <div><span className="num">{totalPaddocks}</span><span className="lbl">paddocks total</span></div>
            <div><span className="num">{totalNoData}</span><span className="lbl">no data yet</span></div>
          </div>
          <div className="farm-cards">
            {farms.map((f) => (
              <button key={f.id} className="farm-card" onClick={() => switchFarm(f.id)}>
                <div className="fc-top"><span className="fc-name">{f.name}</span></div>
                <div className="fc-stats">
                  <div><span className="num">{f.paddockCount}</span><span className="lbl">paddocks</span></div>
                  <div><span className="num" style={{ color: f.noDataCount ? "var(--flagged)" : "var(--ink)" }}>{f.noDataCount}</span><span className="lbl">no data</span></div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {current && (
        <div className="land-cat-tabs">
          <button className={`tab${landCategory === "all" ? " active" : ""}`} onClick={() => { setLandCategory("all"); setSelectedId(null); }}>All ({landCounts.all})</button>
          {LAND_TYPES.map((t) => (
            <button key={t} className={`tab${landCategory === t ? " active" : ""}`} onClick={() => { setLandCategory(t); setSelectedId(null); }}>{t} ({landCounts[t] || 0})</button>
          ))}
          <button className={`tab${landCategory === "unclassified" ? " active" : ""}`} onClick={() => { setLandCategory("unclassified"); setSelectedId(null); }}>Unclassified ({landCounts.unclassified})</button>
        </div>
      )}

      {current && (
        <div className="land-color-key">
          {LAND_TYPES.map((t) => (
            <span key={t} className="land-color-key-item">
              <span className="land-color-swatch" style={{ background: LAND_TYPE_COLORS[t] ?? UNCLASSIFIED_COLOR }} />
              {t}
            </span>
          ))}
          <span className="land-color-key-item">
            <span className="land-color-swatch" style={{ background: UNCLASSIFIED_COLOR }} />
            Unclassified
          </span>
        </div>
      )}

      {current && geoPaddocks.length > 0 && (
        <div className="map-wrap">
          <svg
            ref={svgRef}
            viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
            width="100%"
            height="100%"
            style={{ touchAction: "none", cursor: "grab" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            onPointerLeave={endPointer}
          >
            {geoPaddocks.map((p) => {
              const rings = projectedGeo.get(p.id);
              if (!rings) return null;
              const isSel = selectedId === p.id;
              const allPts = rings.flat();
              const cx = allPts.reduce((s, [x]) => s + x, 0) / allPts.length;
              const cy = allPts.reduce((s, [, y]) => s + y, 0) / allPts.length;
              return (
                <g key={p.id} onClick={() => handlePaddockClick(p.id)} style={{ cursor: "pointer" }}>
                  {rings.map((ring, ri) => {
                    const fill = landColor(p.landType);
                    return (
                      <polygon
                        key={ri}
                        points={ring.map(([x, y]) => `${x},${y}`).join(" ")}
                        className={`geo-field${!p.hasData ? " flagged" : ""}`}
                        style={{
                          fill,
                          stroke: isSel ? "#fff" : "#0A0A0A",
                          strokeWidth: isSel ? 2.5 : 1,
                        }}
                      />
                    );
                  })}
                  {grazingNowByPaddock.has(p.id) && (() => {
                    const entries = grazingNowByPaddock.get(p.id)!;
                    const hasTag = entries.some((e) => e.tag);
                    return (
                      <g style={{ pointerEvents: "none" }}>
                        <circle cx={cx} cy={cy} r={7} fill="#0A0A0A" stroke="#fff" strokeWidth={1} />
                        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 7.5, fill: "white", fontWeight: 700 }}>
                          {entries.map((e) => e.label).join("·")}
                        </text>
                        {hasTag && (
                          <text x={cx} y={cy + 13} textAnchor="middle" style={{ fontSize: 5.5, fill: "#0A0A0A", fontWeight: 600 }}>
                            {entries.map((e) => e.tag ?? "").join("·")}
                          </text>
                        )}
                      </g>
                    );
                  })()}
                </g>
              );
            })}
          </svg>
          <div className="map-zoom-controls">
            <button className="map-zoom-btn" onClick={() => zoomButton(1 / 1.4)} aria-label="Zoom in"><ZoomIn size={16} /></button>
            <button className="map-zoom-btn" onClick={() => zoomButton(1.4)} aria-label="Zoom out"><ZoomOut size={16} /></button>
            <button className="map-zoom-btn" onClick={resetView} aria-label="Reset view"><Maximize size={16} /></button>
          </div>
        </div>
      )}

      {current && geoPaddocks.length === 0 && (
        <div className="map-wrap">
          <svg
            ref={svgRef}
            viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
            width="100%"
            height="100%"
            style={{ touchAction: "none", cursor: "grab" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            onPointerLeave={endPointer}
          >
            {displayPaddocks.map((p, i) => {
              const geo = layout[i];
              const isSel = selectedId === p.id;
              const fill = landColor(p.landType);
              return (
                <g key={p.id} onClick={() => handlePaddockClick(p.id)} style={{ cursor: "pointer" }}>
                  <polygon
                    points={geo.points}
                    className={`geo-field${!p.hasData ? " flagged" : ""}`}
                    style={{
                      fill,
                      stroke: isSel ? "var(--ink)" : brighten(fill, 0.4),
                      strokeWidth: isSel ? 2.5 : 1.25,
                    }}
                  />
                  <text x={geo.cx} y={geo.cy} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: geo.fontSize, fill: "white", fontWeight: 600, pointerEvents: "none" }}>
                    {p.code}
                  </text>
                  {grazingNowByPaddock.has(p.id) && (() => {
                    const entries = grazingNowByPaddock.get(p.id)!;
                    const hasTag = entries.some((e) => e.tag);
                    return (
                      <g style={{ pointerEvents: "none" }}>
                        <circle cx={geo.cx} cy={geo.cy - 14} r={8} fill="#0A0A0A" stroke="#fff" strokeWidth={1} />
                        <text x={geo.cx} y={geo.cy - 14} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 8, fill: "white", fontWeight: 700 }}>
                          {entries.map((e) => e.label).join("·")}
                        </text>
                        {hasTag && (
                          <text x={geo.cx} y={geo.cy - 14 + 14} textAnchor="middle" style={{ fontSize: 6, fill: "#0A0A0A", fontWeight: 600 }}>
                            {entries.map((e) => e.tag ?? "").join("·")}
                          </text>
                        )}
                      </g>
                    );
                  })()}
                </g>
              );
            })}
          </svg>
          <div className="map-zoom-controls">
            <button className="map-zoom-btn" onClick={() => zoomButton(1 / 1.4)} aria-label="Zoom in"><ZoomIn size={16} /></button>
            <button className="map-zoom-btn" onClick={() => zoomButton(1.4)} aria-label="Zoom out"><ZoomOut size={16} /></button>
            <button className="map-zoom-btn" onClick={resetView} aria-label="Reset view"><Maximize size={16} /></button>
          </div>
        </div>
      )}

      {current && geoPaddocks.length > 0 && nonGeoPaddocks.length > 0 && (
        <>
          <div className="paddock-picker-head">
            <span className="field-label">Not yet mapped ({nonGeoPaddocks.length})</span>
            <div className="paddock-picker-actions">
              <Link className="link-btn" href="/farm/field-editor/import">Import more</Link>
            </div>
          </div>
          <div className="paddock-picker-list">
            {nonGeoPaddocks.map((p) => (
              <button
                key={p.id}
                className={`paddock-chip${selectedId === p.id ? " on" : ""}${!p.hasData ? " flagged" : ""}`}
                style={{ borderLeft: `4px solid ${landColor(p.landType)}` }}
                onClick={() => setSelectedId(p.id)}
              >
                {p.code}
              </button>
            ))}
          </div>
        </>
      )}

      {selectedPaddock && (
        <div className="detail-sheet">
          <div className="ds-head">
            <div>
              <h2>{current?.name} — {selectedPaddock.code}</h2>
              {!selectedPaddock.hasData ? (
                <span className="pill flagged"><Droplets size={12} />No data yet</span>
              ) : (
                <span className="pill">In rotation · {selectedPaddock.cover} kg DM/ha</span>
              )}
            </div>
            <button className="close" onClick={() => setSelectedId(null)}><X size={18} /></button>
          </div>

          <p className="history-label">Land type</p>
          <div className="chip-wrap" style={{ marginBottom: 14 }}>
            {LAND_TYPES.map((t) => (
              <button
                key={t}
                className={`range-chip${selectedPaddock.landType === t ? " on" : ""}`}
                onClick={() => setClassification(selectedPaddock.landType === t ? null : t)}
              >
                {t}
              </button>
            ))}
          </div>

          <p className="history-label">Full history</p>
          {history.length === 0 && <p className="ds-note">No activity logged for this field yet.</p>}
          {history.length > 0 && (
            <ul className="history-list">
              {history.map((h) => (
                <li
                  key={h.id}
                  className={`history-row${"isGrazing" in h && h.isGrazing ? "" : " clickable"}`}
                  onClick={"isGrazing" in h && h.isGrazing ? undefined : () => openEdit(h.id, h.isWalk)}
                >
                  <span className="hr-date">{h.date.slice(0, 10)}</span>
                  <span className="hr-type">
                    {h.type}
                    {"product" in h && h.product ? ` — ${h.product}` : ""}
                    {"rate" in h && h.rate ? ` (${h.rate} kg/ha)` : ""}
                    {"method" in h && h.method ? ` — ${h.method}` : ""}
                    {"depth" in h && h.depth ? ` (${h.depth} cm)` : ""}
                    {"mix" in h && h.mix
                      ? ` — ${(h.mix as { crop: string; variety: string | null; rate: number; unit: string }[])
                          .map((m) => `${m.rate}${m.unit} ${m.crop}${m.variety ? ` (${m.variety})` : ""}`)
                          .join(", ")}`
                      : ""}
                    {"chemicals" in h && h.chemicals
                      ? ` — ${(h.chemicals as { name: string; rate: number; unit: string }[])
                          .map((c) => `${c.name} ${c.rate}${c.unit}`)
                          .join(", ")}`
                      : ""}
                    {"bales" in h && h.bales
                      ? ` × ${h.bales}${selectedPaddock?.sizeHa ? ` (${(h.bales / selectedPaddock.sizeHa).toFixed(1)}/ha)` : ""}`
                      : ""}
                  </span>
                  {h.notes && <span className="hr-notes">{h.notes}</span>}
                  {!("isGrazing" in h && h.isGrazing) && <Pencil size={13} strokeWidth={1.75} className="hr-edit-icon" />}
                </li>
              ))}
            </ul>
          )}

          <p className="history-label">Nutrients applied</p>
          <div className="chip-wrap nutrient-range-picker">
            {NUTRIENT_RANGES.map((r) => (
              <button key={r.id} className={`range-chip${nutrientRange === r.id ? " on" : ""}`} onClick={() => setNutrientRange(r.id)}>{r.label}</button>
            ))}
          </div>
          {nutrientTotals && nutrientTotals.count === 0 && <p className="ds-note">No fertilizer logged with a rate in this window.</p>}
          {nutrientTotals && nutrientTotals.count > 0 && (
            <div className="nutrient-grid">
              <div><span className="nutrient-val">{nutrientTotals.N.toFixed(1)}</span><span className="nutrient-lbl">N kg/ha</span></div>
              <div><span className="nutrient-val">{nutrientTotals.P.toFixed(1)}</span><span className="nutrient-lbl">P kg/ha</span></div>
              <div><span className="nutrient-val">{nutrientTotals.K.toFixed(1)}</span><span className="nutrient-lbl">K kg/ha</span></div>
              <div><span className="nutrient-val">{nutrientTotals.S.toFixed(1)}</span><span className="nutrient-lbl">S kg/ha</span></div>
            </div>
          )}
        </div>
      )}

      {editingEntry && selectedPaddock && (
        <EditEntryPanel
          entry={editingEntry}
          paddockCode={selectedPaddock.code}
          paddockSizeHa={selectedPaddock.sizeHa}
          onClose={closeEdit}
          onSaved={handleEntrySaved}
          onDeleted={handleEntryDeleted}
        />
      )}
    </div>
  );
}
