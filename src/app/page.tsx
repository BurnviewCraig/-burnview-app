"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Milk, Beef, Wheat, Boxes, Settings, LogOut, Map as MapIcon, CalendarDays } from "lucide-react";
import { useMemo } from "react";
import { useApi } from "@/lib/useApi";
import { todayStr } from "@/lib/utils";
import { addDays, eventsFromCalendarData, type RawActivity, type RawWalk, type RawGrazing } from "@/lib/calendarFormat";

const WIDGET_DAYS = 4; // today + previous 3 — fits comfortably in the card's width

export default function HomePage() {
  const { data: session } = useSession();
  const today = todayStr();
  const start = addDays(today, -(WIDGET_DAYS - 1));
  const { data: calendarData } = useApi<{ activities: RawActivity[]; walks: RawWalk[]; grazing: RawGrazing[] }>(
    `/api/calendar?start=${start}&end=${today}`
  );
  const eventsByDate = useMemo(() => {
    const map = new Map<string, ReturnType<typeof eventsFromCalendarData>>();
    eventsFromCalendarData(calendarData ?? null).forEach((e) => {
      const d = e.raw.date.slice(0, 10);
      map.set(d, [...(map.get(d) ?? []), e]);
    });
    return map;
  }, [calendarData]);
  const widgetDays = useMemo(() => {
    const list: string[] = [];
    for (let i = 0; i < WIDGET_DAYS; i++) list.push(addDays(start, i));
    return list;
  }, [start]);

  return (
    <div className="screen home">
      <div className="brand">
        <div className="brand-left">
          <Milk size={22} strokeWidth={1.75} />
          <span>Burnview Farming</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/settings" style={{ color: "inherit", display: "flex" }} title="Settings">
            <Settings size={18} strokeWidth={1.75} />
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={{ background: "none", border: "none", color: "inherit", display: "flex", cursor: "pointer", padding: 0 }}
            title={`Sign out${session?.user?.name ? ` (${session.user.name})` : ""}`}
          >
            <LogOut size={18} strokeWidth={1.75} />
          </button>
        </div>
      </div>
      <div className="home-cards">
        <Link className="home-card calendar-widget" href="/calendar">
          <div className="calendar-widget-head">
            <CalendarDays size={20} strokeWidth={1.5} />
            <span className="hc-title">Calendar</span>
          </div>
          <div className="calendar-widget-days">
            {widgetDays.map((day) => {
              const events = eventsByDate.get(day) ?? [];
              const dt = new Date(day + "T00:00:00");
              const isToday = day === today;
              return (
                <div key={day} className={`calendar-widget-day${isToday ? " today" : ""}`}>
                  <span className="calendar-widget-day-label">
                    {isToday ? "Today" : dt.toLocaleDateString(undefined, { weekday: "short" })}
                  </span>
                  {events.length === 0 && <span className="calendar-widget-empty">—</span>}
                  {events.slice(0, 2).map((e) => (
                    <span key={e.id} className="calendar-widget-event">{e.label}</span>
                  ))}
                  {events.length > 2 && <span className="hc-sub">+{events.length - 2} more</span>}
                </div>
              );
            })}
          </div>
        </Link>

        <Link className="home-card" href="/farm">
          <MapIcon size={30} strokeWidth={1.5} />
          <span className="hc-title">Farm</span>
          <span className="hc-sub">Map &amp; field activities</span>
        </Link>
        <Link className="home-card" href="/cattle">
          <Beef size={30} strokeWidth={1.5} />
          <span className="hc-title">Cattle</span>
          <span className="hc-sub">Herds &amp; movements</span>
        </Link>
        <Link className="home-card" href="/food">
          <Wheat size={30} strokeWidth={1.5} />
          <span className="hc-title">Feed</span>
          <span className="hc-sub">Pastures &amp; feed</span>
        </Link>
        <Link className="home-card" href="/stocks">
          <Boxes size={30} strokeWidth={1.5} />
          <span className="hc-title">Stocks</span>
          <span className="hc-sub">Fertilizer, diesel &amp; inputs</span>
        </Link>
      </div>
    </div>
  );
}
