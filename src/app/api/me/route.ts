import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Fetched fresh on every page load rather than embedded in the JWT, so a
// permission change made by an admin takes effect immediately instead of
// waiting out the 3-day session.
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, name: true, isAdmin: true, sectionAccess: true },
  });
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({ user });
}
