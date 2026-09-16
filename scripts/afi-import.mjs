// Nightly AFI import — reads the two CSVs AFI drops into the shared OneDrive
// folder and writes per-group averages / milk-sold rows into the app's DB.
//
// Run with:  node --env-file=.env scripts/afi-import.mjs
// (the --env-file flag loads DATABASE_URL the same way Next.js does, since
// this runs standalone outside the Next.js server)
//
// Intended to run nightly via Windows Task Scheduler shortly after AFI's
// 8pm export (e.g. 8:30pm). Safe to re-run: group readings are upserted per
// (group, date), and milk-sold rows are deduped by AFI's own invoice number
// (sourceRef), so a shipment entered into AFI late and re-exported the next
// night won't be double-counted.

import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const EXPORT_DIR =
  process.env.AFI_EXPORT_DIR ||
  "C:\\Users\\craig\\OneDrive - Burnview\\Burnview Dairy's files - Craig Export";

// AFI group number -> which farm + which CattleGroup.name it is. 70/71 are
// the Burnview/Everfair hospital pens — deliberately not one of the four
// tracked groups, so they're just left out.
const GROUP_MAP = {
  1: { farmSlug: "burnview", groupName: "A" },
  2: { farmSlug: "burnview", groupName: "B" },
  3: { farmSlug: "burnview", groupName: "C" },
  4: { farmSlug: "everfair", groupName: "EA" },
};

// AFI tank number -> which farm's milk it is.
const TANK_FARM = { 1: "burnview", 2: "everfair" };

const prisma = new PrismaClient();

function latestFile(prefix) {
  const files = readdirSync(EXPORT_DIR).filter((f) => f.startsWith(prefix) && f.endsWith(".csv"));
  if (!files.length) return null;
  // "Prefix - DD-MM-YYYY HH-MM.csv" — sort by that timestamp, not just mtime,
  // so this is correct even if OneDrive re-touches file times on sync.
  const parsed = files
    .map((f) => {
      const m = f.match(/(\d{2})-(\d{2})-(\d{4}) (\d{2})-(\d{2})\.csv$/);
      if (!m) return null;
      const [, dd, mm, yyyy, hh, min] = m;
      return { file: f, ts: new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00`) };
    })
    .filter(Boolean)
    .sort((a, b) => b.ts.getTime() - a.ts.getTime());
  return parsed[0] ?? null;
}

function ddmmyyyyToIso(d) {
  const [dd, mm, yyyy] = d.split(/[-/]/);
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

async function importCraigReport() {
  const found = latestFile("Craig Report");
  if (!found) { console.log("No Craig Report file found."); return; }
  const date = `${found.ts.getFullYear()}-${String(found.ts.getMonth() + 1).padStart(2, "0")}-${String(found.ts.getDate()).padStart(2, "0")}`;
  console.log(`\nCraig Report: ${found.file} -> date ${date}`);

  const text = readFileSync(join(EXPORT_DIR, found.file), "utf-8");
  const lines = text.split(/\r?\n/).slice(3).filter((l) => l.trim());

  const byGroup = {}; // grp -> { count, yieldSum, yieldN, weightSum, weightN, feedSum, feedN }
  for (const line of lines) {
    const cols = line.split(",");
    const grp = Number(cols[2]);
    if (!GROUP_MAP[grp]) continue; // skip 70/71 and anything unexpected
    const alloc = cols[3] === "--" || cols[3] === "" ? null : Number(cols[3]);
    const yield_ = cols[4] === "--" || cols[4] === "" ? null : Number(cols[4]);
    const weight = cols[5] === "--" || cols[5] === "" ? null : Number(cols[5]);

    const g = (byGroup[grp] ??= { count: 0, yieldSum: 0, yieldN: 0, weightSum: 0, weightN: 0, feedSum: 0, feedN: 0 });
    g.count++;
    if (yield_ != null && !Number.isNaN(yield_)) { g.yieldSum += yield_; g.yieldN++; }
    if (weight != null && !Number.isNaN(weight)) { g.weightSum += weight; g.weightN++; }
    if (alloc != null && !Number.isNaN(alloc)) { g.feedSum += alloc; g.feedN++; }
  }

  for (const [grpStr, stats] of Object.entries(byGroup)) {
    const grp = Number(grpStr);
    const { farmSlug, groupName } = GROUP_MAP[grp];
    const group = await prisma.cattleGroup.findFirst({ where: { name: groupName, farm: { slug: farmSlug } } });
    if (!group) { console.warn(`  ! No CattleGroup found for ${farmSlug} ${groupName} — skipping group ${grp}`); continue; }

    const avgYield = stats.yieldN ? Math.round((stats.yieldSum / stats.yieldN) * 10) / 10 : null;
    const avgWeight = stats.weightN ? Math.round((stats.weightSum / stats.weightN) * 10) / 10 : null;
    const avgFeed = stats.feedN ? Math.round((stats.feedSum / stats.feedN) * 10) / 10 : null;

    console.log(`  ${farmSlug} ${groupName}: ${stats.count} cows, yield ${avgYield ?? "—"} L/cow, weight ${avgWeight ?? "—"} kg, dairy meal ${avgFeed ?? "—"} kg`);

    await prisma.cattleCountEntry.upsert({
      where: { groupId_date: { groupId: group.id, date: new Date(date) } },
      update: { count: stats.count },
      create: { groupId: group.id, date: new Date(date), count: stats.count },
    });
    if (avgYield != null) {
      await prisma.milkProductionEntry.upsert({
        where: { groupId_date: { groupId: group.id, date: new Date(date) } },
        update: { litresPerCow: avgYield },
        create: { groupId: group.id, date: new Date(date), litresPerCow: avgYield },
      });
    }
    if (avgWeight != null) {
      await prisma.groupWeightEntry.upsert({
        where: { groupId_date: { groupId: group.id, date: new Date(date) } },
        update: { avgWeightKg: avgWeight },
        create: { groupId: group.id, date: new Date(date), avgWeightKg: avgWeight },
      });
    }
    if (avgFeed != null) {
      await prisma.groupFeedEntry.upsert({
        where: { groupId_date: { groupId: group.id, date: new Date(date) } },
        update: { dairyMealKg: avgFeed },
        create: { groupId: group.id, date: new Date(date), dairyMealKg: avgFeed },
      });
    }
  }
}

async function importMilkShipments() {
  const found = latestFile("Primary Milk Shipment Report");
  if (!found) { console.log("No Primary Milk Shipment Report file found."); return; }
  console.log(`\nPrimary Milk Shipment Report: ${found.file}`);

  const text = readFileSync(join(EXPORT_DIR, found.file), "utf-8");
  const lines = text.split(/\r?\n/).slice(2).filter((l) => l.trim());

  const farms = {};
  for (const slug of Object.values(TANK_FARM)) {
    farms[slug] = await prisma.farm.findUnique({ where: { slug } });
  }

  let imported = 0;
  let skipped = 0;
  for (const line of lines) {
    const cols = line.split(",");
    const invoice = cols[1];
    if (!invoice || invoice === "--" || cols[0] === "Sum") continue;
    const date = ddmmyyyyToIso(cols[2]);
    const tank = Number(cols[4]);
    const quantity = Number(cols[5]);
    const creamery = cols[6];
    const farmSlug = TANK_FARM[tank];
    if (!farmSlug || !farms[farmSlug]) { console.warn(`  ! Unknown tank ${tank} on invoice ${invoice} — skipping`); skipped++; continue; }
    if (!quantity || Number.isNaN(quantity)) { skipped++; continue; }

    await prisma.milkSaleEntry.upsert({
      where: { sourceRef: invoice },
      update: { farmId: farms[farmSlug].id, date: new Date(date), litres: quantity, takenBy: creamery || null },
      create: { farmId: farms[farmSlug].id, date: new Date(date), litres: quantity, takenBy: creamery || null, sourceRef: invoice },
    });
    imported++;
  }
  console.log(`  Upserted ${imported} shipment(s), skipped ${skipped}.`);
}

async function main() {
  console.log(`AFI import starting — folder: ${EXPORT_DIR}`);
  await importCraigReport();
  await importMilkShipments();
  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
