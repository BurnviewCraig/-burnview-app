"use client";

import Link from "next/link";
import { Droplet, Gauge, ChevronRight } from "lucide-react";
import { Header } from "@/components/Header";
import { AccessGate } from "@/components/AccessGate";

export default function WaterMetersHubPage() {
  return (
    <AccessGate section="farm" title="Water meters">
      <div className="screen">
        <Header title="Water meters" backHref="/farm/irrigation" />
        <div className="menu-list">
          <Link className="menu-row" href="/farm/irrigation/water-meters/readings">
            <Droplet size={18} strokeWidth={1.75} />
            <div className="menu-row-text">
              <span className="mr-title">Readings</span>
              <span className="mr-sub">Log each meter&apos;s dial reading &amp; see usage per billing group</span>
            </div>
            <ChevronRight size={16} />
          </Link>
          <Link className="menu-row" href="/settings/water-meters">
            <Gauge size={18} strokeWidth={1.75} />
            <div className="menu-row-text">
              <span className="mr-title">Meter settings</span>
              <span className="mr-sub">Name &amp; billing group for each water meter</span>
            </div>
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    </AccessGate>
  );
}
