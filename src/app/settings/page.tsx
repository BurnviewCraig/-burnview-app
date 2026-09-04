import Link from "next/link";
import { Users, Sprout, FlaskConical, Leaf, ChevronRight } from "lucide-react";
import { Header } from "@/components/Header";

export default function SettingsPage() {
  return (
    <div className="screen">
      <Header title="Settings" backHref="/" />
      <div className="menu-list">
        <Link className="menu-row" href="/settings/users">
          <Users size={18} strokeWidth={1.75} />
          <div className="menu-row-text">
            <span className="mr-title">Users</span>
            <span className="mr-sub">Add accounts for workers entering data</span>
          </div>
          <ChevronRight size={16} />
        </Link>
        <Link className="menu-row" href="/settings/fertilizer">
          <Sprout size={18} strokeWidth={1.75} />
          <div className="menu-row-text">
            <span className="mr-title">Fertilizer nutrients</span>
            <span className="mr-sub">N/P/K/S % per product — replace placeholders with real values</span>
          </div>
          <ChevronRight size={16} />
        </Link>
        <Link className="menu-row" href="/settings/chemicals">
          <FlaskConical size={18} strokeWidth={1.75} />
          <div className="menu-row-text">
            <span className="mr-title">Chemicals</span>
            <span className="mr-sub">Manage the spray chemical list used when logging spraying</span>
          </div>
          <ChevronRight size={16} />
        </Link>
        <Link className="menu-row" href="/settings/seed-varieties">
          <Leaf size={18} strokeWidth={1.75} />
          <div className="menu-row-text">
            <span className="mr-title">Seed varieties</span>
            <span className="mr-sub">Named cultivars for any crop, used in the Planting form</span>
          </div>
          <ChevronRight size={16} />
        </Link>
      </div>
    </div>
  );
}
