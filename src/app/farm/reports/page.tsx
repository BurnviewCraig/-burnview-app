import Link from "next/link";
import { Sprout, ChevronRight } from "lucide-react";
import { Header } from "@/components/Header";

export default function ReportsPage() {
  return (
    <div className="screen">
      <Header title="Reports" backHref="/farm" />
      <div className="menu-list">
        <Link className="menu-row" href="/farm/reports/fertilizer">
          <Sprout size={18} strokeWidth={1.75} />
          <div className="menu-row-text">
            <span className="mr-title">Fertilizer</span>
            <span className="mr-sub">N/P/K/S applied per camp &amp; farm-wide average</span>
          </div>
          <ChevronRight size={16} />
        </Link>
      </div>
    </div>
  );
}
