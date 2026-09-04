import { Utensils } from "lucide-react";
import { Header } from "@/components/Header";

export default function FeedingPage() {
  return (
    <div className="screen">
      <Header title="Feeding" backHref="/" />
      <div className="empty">
        <Utensils size={26} strokeWidth={1.5} />
        <p>Feeding isn&apos;t built yet. Once it is, what&apos;s logged here will draw down the matching item in Stocks — it&apos;ll just live as its own section, not inside Stocks itself.</p>
      </div>
    </div>
  );
}
