import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; pgPool?: Pool };

// Routed through the `pg` driver (via a Prisma driver adapter) instead of
// Prisma's default native engine: the native engine resolves hostnames itself
// at the OS level and isn't affected by the dns.lookup patch in
// instrumentation.ts, so it still fails on this network. `pg` connects
// through Node's own net/tls modules, which do respect that patch.
const pool = globalForPrisma.pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pool;
}
