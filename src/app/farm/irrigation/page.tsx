"use client";

import Link from "next/link";
import { CalendarClock, Activity, ChevronRight } from "lucide-react";
import { Header } from "@/components/Header";
import { AccessGate } from "@/components/AccessGate";

export default function IrrigationHubPage() {
  return (
    <AccessGate section="farm" title="Irrigation">
      <div className="screen">
        <Header title="Irrigation" backHref="/" />
        <div className="menu-list">
          <Link className="menu-row" href="/farm/irrigation/scheduling">
            <CalendarClock size={18} strokeWidth={1.75} />
            <div className="menu-row-text">
              <span className="mr-title">Irrigation scheduling</span>
              <span className="mr-sub">Weekly pivot run planner &amp; water meters</span>
            </div>
            <ChevronRight size={16} />
          </Link>
          <Link className="menu-row" href="/farm/irrigation/monitoring">
            <Activity size={18} strokeWidth={1.75} />
            <div className="menu-row-text">
              <span className="mr-title">Live monitoring</span>
              <span className="mr-sub">Tank levels, pump status, remote start/stop &amp; triggers</span>
            </div>
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    </AccessGate>
  );
}
