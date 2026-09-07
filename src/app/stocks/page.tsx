import Link from "next/link";
import { Wheat, Boxes, Syringe, ChevronRight } from "lucide-react";
import { Header } from "@/components/Header";

export default function StocksPage() {
  return (
    <div className="screen">
      <Header title="Stocks" backHref="/" />
      <div className="menu-list">
        <Link className="menu-row" href="/stocks/feed">
          <Wheat size={18} strokeWidth={1.75} />
          <div className="menu-row-text">
            <span className="mr-title">Feed</span>
            <span className="mr-sub">Silage, bales, dairy meal, commodities</span>
          </div>
          <ChevronRight size={16} />
        </Link>
        <Link className="menu-row" href="/stocks/land">
          <Boxes size={18} strokeWidth={1.75} />
          <div className="menu-row-text">
            <span className="mr-title">Land inputs</span>
            <span className="mr-sub">Fertilizer, chemicals, seed</span>
          </div>
          <ChevronRight size={16} />
        </Link>
        <Link className="menu-row" href="/stocks/dairy">
          <Syringe size={18} strokeWidth={1.75} />
          <div className="menu-row-text">
            <span className="mr-title">Dairy</span>
            <span className="mr-sub">Semen, meds</span>
          </div>
          <ChevronRight size={16} />
        </Link>
      </div>
    </div>
  );
}
