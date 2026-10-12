"use client";

import { useApi } from "@/lib/useApi";
import { hasSectionAccess, hasTimebookFarmAccess, type SectionAccess, type SectionKey } from "@/lib/permissions";

type Me = { id: string; username: string; name: string; isAdmin: boolean; sectionAccess: SectionAccess | null };

export function useAccess() {
  const { data, loading } = useApi<{ user: Me }>("/api/me");
  const me = data?.user ?? null;
  return {
    loading,
    me,
    isAdmin: me?.isAdmin ?? false,
    canSee: (section: SectionKey) => (me ? hasSectionAccess(me.isAdmin, me.sectionAccess, section) : true),
    canSeeTimebookFarm: (farmSlug: string) => (me ? hasTimebookFarmAccess(me.isAdmin, me.sectionAccess, farmSlug) : true),
  };
}
