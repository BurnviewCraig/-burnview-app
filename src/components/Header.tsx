"use client";

import Link from "next/link";
import { ChevronLeft, Milk } from "lucide-react";
import type { ReactNode } from "react";

export function Header({
  title,
  backHref,
  action,
}: {
  title: string;
  backHref?: string;
  action?: ReactNode;
}) {
  return (
    <div className="hdr">
      {backHref ? (
        <Link className="back" href={backHref}>
          <ChevronLeft size={18} />
        </Link>
      ) : (
        <Milk size={20} strokeWidth={1.75} />
      )}
      <h1>{title}</h1>
      {action && <div className="hdr-action-slot">{action}</div>}
    </div>
  );
}
