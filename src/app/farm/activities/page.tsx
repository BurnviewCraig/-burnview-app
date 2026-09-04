import Link from "next/link";
import { Sprout, Layers, Leaf, Tractor, SprayCan, Scissors, Package, ChevronRight } from "lucide-react";
import { Header } from "@/components/Header";
import { ACTIVITY_TYPES } from "@/lib/constants";

const ICONS: Record<string, typeof Sprout> = {
  FERTILIZER: Sprout,
  MULCHING: Layers,
  PLANTING: Leaf,
  LAND_PREP: Tractor,
  SPRAYING: SprayCan,
  MOWING: Scissors,
  BAILING: Package,
};

export default function ActivitiesPage() {
  return (
    <div className="screen">
      <Header title="Field activities" backHref="/farm" />
      <div className="menu-list">
        {ACTIVITY_TYPES.map((a) => {
          const Icon = ICONS[a.id];
          return (
            <Link key={a.id} className="menu-row" href={`/farm/activities/${a.id.toLowerCase().replace(/_/g, "-")}`}>
              <Icon size={18} strokeWidth={1.75} />
              <div className="menu-row-text">
                <span className="mr-title">{a.name}</span>
                <span className="mr-sub">Log a {a.name.toLowerCase()} event</span>
              </div>
              <ChevronRight size={16} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
