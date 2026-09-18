import Link from "next/link";
import { History, CalendarClock, ChevronRight } from "lucide-react";
import { Header } from "@/components/Header";

export default function MaizePage() {
  return (
    <div className="screen">
      <Header title="Maize" backHref="/farm" />
      <div className="menu-list">
        <Link className="menu-row" href="/farm/maize/history">
          <History size={18} strokeWidth={1.75} />
          <div className="menu-row-text">
            <span className="mr-title">Maize History</span>
            <span className="mr-sub">Past harvests and sales, per farm</span>
          </div>
          <ChevronRight size={16} />
        </Link>
        <Link className="menu-row" href="/farm/maize/future">
          <CalendarClock size={18} strokeWidth={1.75} />
          <div className="menu-row-text">
            <span className="mr-title">Future Maize Options</span>
            <span className="mr-sub">What&apos;s planned for next season</span>
          </div>
          <ChevronRight size={16} />
        </Link>
      </div>
    </div>
  );
}
