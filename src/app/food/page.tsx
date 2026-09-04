import Link from "next/link";
import { CalendarRange, Layers, Wheat, ChevronRight } from "lucide-react";
import { Header } from "@/components/Header";

export default function FoodPage() {
  return (
    <div className="screen">
      <Header title="Feed" backHref="/" />
      <div className="menu-list">
        <Link className="menu-row" href="/food/grazing-allocation">
          <CalendarRange size={18} strokeWidth={1.75} />
          <div className="menu-row-text">
            <span className="mr-title">Grazing allocation</span>
            <span className="mr-sub">Day &amp; night camps per group, by date</span>
          </div>
          <ChevronRight size={16} />
        </Link>
        <Link className="menu-row" href="/food/wedge">
          <Layers size={18} strokeWidth={1.75} />
          <div className="menu-row-text">
            <span className="mr-title">Farm wedge</span>
            <span className="mr-sub">Cover &amp; growth by paddock</span>
          </div>
          <ChevronRight size={16} />
        </Link>
        <div className="menu-row disabled">
          <Wheat size={18} strokeWidth={1.75} />
          <div className="menu-row-text">
            <span className="mr-title">Feed budget</span>
            <span className="mr-sub">Coming soon</span>
          </div>
        </div>
      </div>
    </div>
  );
}
