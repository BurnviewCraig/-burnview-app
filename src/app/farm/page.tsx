import Link from "next/link";
import { Map as MapIcon, ClipboardList, Pencil, ChevronRight } from "lucide-react";
import { Header } from "@/components/Header";

export default function FarmPage() {
  return (
    <div className="screen">
      <Header title="Farm" backHref="/" />
      <div className="menu-list">
        <Link className="menu-row" href="/farm/map">
          <MapIcon size={18} strokeWidth={1.75} />
          <div className="menu-row-text">
            <span className="mr-title">Map</span>
            <span className="mr-sub">All 3 farms — herds &amp; field history</span>
          </div>
          <ChevronRight size={16} />
        </Link>
        <Link className="menu-row" href="/farm/activities">
          <ClipboardList size={18} strokeWidth={1.75} />
          <div className="menu-row-text">
            <span className="mr-title">Field activities</span>
            <span className="mr-sub">Fertilizer, mulching, planting, land prep, spraying</span>
          </div>
          <ChevronRight size={16} />
        </Link>
        <Link className="menu-row" href="/farm/field-editor">
          <Pencil size={18} strokeWidth={1.75} />
          <div className="menu-row-text">
            <span className="mr-title">Edit fields</span>
            <span className="mr-sub">Size &amp; classification per paddock</span>
          </div>
          <ChevronRight size={16} />
        </Link>
      </div>
    </div>
  );
}
