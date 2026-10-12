import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Returns the signed-in admin's user id, or null if not signed in / not an admin.
export async function requireAdmin(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return null;
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  return me?.isAdmin ? userId : null;
}
