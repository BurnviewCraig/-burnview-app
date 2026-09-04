import Link from "next/link";
import { Footprints, ChevronRight } from "lucide-react";
import { Header } from "@/components/Header";

export default function DataEntryPage() {
  return (
    <div className="screen">
      <Header title="Data entry" backHref="/food/wedge" />
      <div className="menu-list">
        <Link className="menu-row" href="/food/data-entry/pasture-walk">
          <Footprints size={18} strokeWidth={1.75} />
          <div className="menu-row-text">
            <span className="mr-title">Pasture walk</span>
            <span className="mr-sub">Weekly cover reading — feeds the wedge</span>
          </div>
          <ChevronRight size={16} />
        </Link>
      </div>
    </div>
  );
}
