import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  FARM_DEFS,
  FERTILIZER_TYPES,
  FERTILIZER_NUTRIENTS,
  FEED_ITEMS_SEED,
  CATTLE_GROUPS_BY_FARM_SLUG,
} from "../src/lib/constants";

const prisma = new PrismaClient();

async function main() {
  // Farms + paddocks — real codes, defaulted to "Rye grass" since every
  // paddock entered so far is an irrigated ryegrass camp.
  for (let i = 0; i < FARM_DEFS.length; i++) {
    const def = FARM_DEFS[i];
    const farm = await prisma.farm.upsert({
      where: { slug: def.slug },
      update: {},
      create: { slug: def.slug, name: def.name, sortOrder: i },
    });

    const allCodes = [...def.codes, ...Object.keys(def.replants)];
    for (const code of allCodes) {
      await prisma.paddock.upsert({
        where: { farmId_code: { farmId: farm.id, code } },
        update: {},
        create: { farmId: farm.id, code, landType: "Rye grass" },
      });
    }

    // Known real replant events — logged as historical Planting entries so
    // field history isn't empty for these paddocks. Mix breakdown wasn't
    // recorded at the time, so it's left blank.
    for (const [code, date] of Object.entries(def.replants)) {
      if (!date) continue;
      const paddock = await prisma.paddock.findUnique({
        where: { farmId_code: { farmId: farm.id, code } },
      });
      if (!paddock) continue;
      const existing = await prisma.fieldActivity.findFirst({
        where: { paddockId: paddock.id, type: "PLANTING", date: new Date(date) },
      });
      if (existing) continue;
      await prisma.fieldActivity.create({
        data: {
          farmId: farm.id,
          paddockId: paddock.id,
          type: "PLANTING",
          date: new Date(date),
          notes: "Replanted",
        },
      });
    }

    // Milking groups for this farm.
    const groupNames = CATTLE_GROUPS_BY_FARM_SLUG[def.slug] ?? [];
    for (let g = 0; g < groupNames.length; g++) {
      await prisma.cattleGroup.upsert({
        where: { farmId_name: { farmId: farm.id, name: groupNames[g] } },
        update: {},
        create: { farmId: farm.id, name: groupNames[g], sortOrder: g },
      });
    }
  }

  // Fertilizer types — real product names, placeholder N/P/K/S until real
  // bag/spec-sheet numbers are entered via Settings.
  for (const name of FERTILIZER_TYPES) {
    const n = FERTILIZER_NUTRIENTS[name];
    await prisma.fertilizerType.upsert({
      where: { name },
      update: {},
      create: {
        name,
        nitrogenPct: n.N,
        phosphorusPct: n.P,
        potassiumPct: n.K,
        sulfurPct: n.S,
        isPlaceholder: true,
      },
    });
  }

  // Feed stock items, starting at 0 — real opening balances need a restock
  // entry once this is live.
  for (const item of FEED_ITEMS_SEED) {
    const existing = await prisma.stockItem.findFirst({
      where: { kind: "FEED", name: item.name },
    });
    if (!existing) {
      await prisma.stockItem.create({
        data: { kind: "FEED", name: item.name, unit: item.unit, qty: 0 },
      });
    }
  }

  // First login — change the password after signing in.
  const seedUsername = process.env.SEED_ADMIN_USERNAME || "craig";
  const seedPassword = process.env.SEED_ADMIN_PASSWORD || "burnview2026";
  const existingUser = await prisma.user.findUnique({ where: { username: seedUsername } });
  if (!existingUser) {
    const passwordHash = await bcrypt.hash(seedPassword, 10);
    await prisma.user.create({
      data: { username: seedUsername, name: "Craig", passwordHash },
    });
    console.log(`Created user "${seedUsername}" with password "${seedPassword}" — change it after first login.`);
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
