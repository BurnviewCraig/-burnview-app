"use client";

import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useAccess } from "@/lib/useAccess";
import type { SectionKey } from "@/lib/permissions";

// Wraps a top-level section's page. Shows a "Restricted access" screen
// instead of the page content when the signed-in user isn't permitted to
// see this section. Calendar never uses this — it's always visible to
// everyone.
export function AccessGate({ section, title, children }: { section: SectionKey; title: string; children: ReactNode }) {
  const { loading, canSee } = useAccess();

  if (loading) {
    return (
      <div className="screen">
        <Header title={title} backHref="/" />
        <Spinner />
      </div>
    );
  }

  if (!canSee(section)) {
    return (
      <div className="screen">
        <Header title={title} backHref="/" />
        <div className="empty" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingTop: 40 }}>
          <ShieldAlert size={28} strokeWidth={1.5} />
          <span>Restricted access</span>
          <span className="hc-sub">Ask Craig if you need access to this.</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
