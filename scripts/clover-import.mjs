// Weekly Clover quality-card import — reads the PDF "quality cards" Clover
// emails every week (one drops it into Desktop\Clover Quality Cards by
// hand — there's no automated export feeding this one) and writes
// butterfat/protein/lactose/bactoscan/somatic cell/MUN/alizarol readings,
// plus each tank's daily collection volume (litres), into the app's DB,
// one row per bulk tank per date.
//
// Run with: node --env-file=.env scripts/clover-import.mjs
//
// Each card covers the whole month to date and gets re-sent weekly with
// more dates filled in, so this is safe to re-run — every (tank, date) row
// is upserted, and each metric column is written independently since
// Clover doesn't sample every metric on the same day. A small state file
// (clover-import-state.json, gitignored — per-machine runtime state, not
// app data) remembers which PDFs have already been processed by filename,
// so a re-run only picks up new ones. If Clover ever re-sends a corrected
// card for a period already imported, save it under a new filename (or
// delete the old one's entry from the state file) to force a re-import —
// the upsert will just overwrite the old readings with the corrected ones.
//
// The PDF has no machine-readable structure, so this parses it by text
// position: pdfjs-dist hands back every text run with its (x, y) on the
// page, and the "Tests Used in Calculations" table is a fixed grid of 7
// metric columns (Butterfat/Protein/Lactose/Bactoscan/Somatic Cell/MUN/
// Alizarol), each with its own Date + value sub-column. Each column is
// read independently top-to-bottom and zipped date-with-value — columns
// don't all have the same number of rows (Clover doesn't sample every
// metric on every date), so there's no shared row grid to line up across
// columns.
//
// Burnview also sends some of its milk to Creighton Cheese Factory (out of
// the same two physical tanks as Clover) — their lab sends a separate
// weekly Excel (also dropped in this folder) with its own butterfat/
// protein/bacteria/somatic-cell readings. That's stored as a synthetic
// "tank 5" for Burnview so it folds into the farm's litres-weighted
// average alongside tanks 1 & 2 — see aggregateFarmQuality() in
// src/lib/milkQuality.ts. Unlike the Clover PDFs, the cheese Excel is
// always reprocessed (not tracked by filename) since the lab re-sends the
// whole history weekly, often under the same filename.

import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const EXPORT_DIR = process.env.CLOVER_EXPORT_DIR || "C:\\Users\\craig\\Desktop\\Clover Quality Cards";
const STATE_PATH = join(dirname(fileURLToPath(import.meta.url)), "clover-import-state.json");

// Clover's tank numbers are global across the whole business, not per-farm:
// Burnview has two bulk tanks (1 & 2), Everfair is tank 3, Stockton is 4.
// Tank 5 is Burnview's synthetic "cheese factory" line (see header comment).
const TANK_FARM_SLUG = { 1: "burnview", 2: "burnview", 3: "everfair", 4: "stockton", 5: "burnview" };
const CHEESE_TANK_NUMBER = 5;

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

const COLUMNS = [
  { header: "Butterfat", field: "butterfatPct", parse: parseFloatOrNull },
  { header: "Protein", field: "proteinPct", parse: parseFloatOrNull },
  { header: "Lactose", field: "lactosePct", parse: parseFloatOrNull },
  { header: "Bactoscan", field: "bactoscanCountPerMl", parse: parseIntCommaOrNull },
  { header: "Somatic Cell", field: "somaticCellCountPerMl", parse: parseIntCommaOrNull },
  { header: "MUN", field: "munMgPer100ml", parse: parseFloatOrNull },
  { header: "Alizarol", field: "alizarolPct", parse: parseFloatOrNull },
];

function parseFloatOrNull(s) {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function parseIntCommaOrNull(s) {
  const n = Number(String(s).replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function loadState() {
  if (!existsSync(STATE_PATH)) return { processed: [] };
  try { return JSON.parse(readFileSync(STATE_PATH, "utf-8")); } catch { return { processed: [] }; }
}
function saveState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

async function extractPageItems(page) {
  const content = await page.getTextContent();
  return content.items
    .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5] }))
    .filter((it) => it.str.trim() !== "");
}

function parsePage(items, fileName, pageNum) {
  const tag = `${fileName} p${pageNum}`;

  const tankMatch = items.map((i) => i.str).join(" ").match(/\d+\s*\/\s*\d+\s*\/\s*(\d)\b/);
  if (!tankMatch) { console.warn(`  ! ${tag}: couldn't find the tank number — skipping`); return null; }
  const tankNumber = Number(tankMatch[1]);
  const farmSlug = TANK_FARM_SLUG[tankNumber];
  if (!farmSlug) { console.warn(`  ! ${tag}: unknown tank number ${tankNumber} — skipping`); return null; }

  const periodItem = items.find((i) => /^Period:/.test(i.str));
  const periodMatch = periodItem?.str.match(/Period:\s*(\d{2})-(\w{3})-(\d{4})\s*TO\s*(\d{2})-(\w{3})-(\d{4})/);
  if (!periodMatch) { console.warn(`  ! ${tag}: couldn't find the report period — skipping`); return null; }
  const [, , startMonAbbr, startYearStr, endDayStr, endMonAbbr, endYearStr] = periodMatch;
  const startMonth = MONTHS[startMonAbbr];
  const endMonth = MONTHS[endMonAbbr];
  const startYear = Number(startYearStr);
  const endYear = Number(endYearStr);
  const endDay = Number(endDayStr);

  // "Tests Used in Calculations" section: its header row (the 7 metric
  // names) sits a bit below the section title, and the Date/value
  // sub-header row sits a bit below that again — find both by content
  // rather than a fixed offset, in case Clover ever reflows the template.
  const sectionTitle = items.find((i) => i.str === "Tests Used in Calculations");
  if (!sectionTitle) { console.warn(`  ! ${tag}: no "Tests Used in Calculations" table — skipping`); return null; }
  const belowTitle = items.filter((i) => i.y < sectionTitle.y - 2 && i.y > sectionTitle.y - 40);
  const headerRow = belowTitle.filter((i) => COLUMNS.some((c) => c.header === i.str));
  const headerY = headerRow[0]?.y;
  if (headerY == null || headerRow.length < COLUMNS.length) {
    console.warn(`  ! ${tag}: only found ${headerRow.length}/${COLUMNS.length} metric columns — skipping`);
    return null;
  }
  const subHeaderY = items.find((i) => i.str === "Date" && i.y < headerY && i.y > headerY - 20)?.y;
  if (subHeaderY == null) { console.warn(`  ! ${tag}: couldn't find the Date/value sub-header row — skipping`); return null; }
  // Each column's sub-header is a "Date" item immediately followed (to its
  // right) by its value-unit item ("%", "Count/ml", "mg/100ml") — the Date
  // item sits to the *left* of the metric name above it, not under it, so
  // bucketing by the header x would clip it. Pairing the whole row's items
  // left-to-right sidesteps that: 7 columns always produce 7 (Date, value)
  // pairs in the same left-to-right order as the metric header row.
  const subHeaderRow = items.filter((i) => Math.abs(i.y - subHeaderY) < 2).sort((a, b) => a.x - b.x);
  const dateXs = [];
  const valueXs = [];
  for (let i = 0; i < subHeaderRow.length; i += 2) {
    dateXs.push(subHeaderRow[i]?.x ?? null);
    valueXs.push(subHeaderRow[i + 1]?.x ?? null);
  }

  // Floor of 100pt keeps this well clear of the "Page N" footer.
  const dataRows = items.filter((i) => i.y < subHeaderY - 2 && i.y > 100);

  const fields = {};
  COLUMNS.forEach((c, i) => {
    if (dateXs[i] == null || valueXs[i] == null) return;
    const dateItems = dataRows.filter((it) => Math.abs(it.x - dateXs[i]) <= 5).sort((a, b) => b.y - a.y);
    const valueItems = dataRows.filter((it) => Math.abs(it.x - valueXs[i]) <= 5).sort((a, b) => b.y - a.y);
    const n = Math.min(dateItems.length, valueItems.length);
    if (dateItems.length !== valueItems.length) {
      console.warn(`  ! ${tag}: ${c.header} tank ${tankNumber} — ${dateItems.length} dates vs ${valueItems.length} values, using first ${n}`);
    }
    const entries = [];
    for (let r = 0; r < n; r++) {
      const dm = dateItems[r].str.match(/^(\d{2})\/(\d{2})$/);
      if (!dm) continue;
      const [, dd, mm] = dm;
      const month = Number(mm) - 1;
      const year = month === endMonth ? endYear : month === startMonth ? startYear : startYear;
      const value = c.parse(valueItems[r].str);
      if (value == null) continue;
      entries.push({ date: `${year}-${mm}-${dd}`, value });
    }
    fields[c.field] = entries;
  });

  fields.litres = parseLitreTable(items, startMonth, startYear, endDay, tag);

  return { tankNumber, farmSlug, fields };
}

// The "Milk Delivery (litre)" table at the top of the page: one row per day
// of the month, in two side-by-side blocks (days 1-16, days 17-31), each
// row printing Day/Temp/Litre. When a day had no collection, Clover prints
// only Day + "0.0" (that "0.0" sits at the Temp column's x, not Litre's) and
// omits the litre figure entirely — so a 2-item row means litres = 0, and a
// 3-item row's 3rd item is the actual litre reading.
function parseLitreTable(items, startMonth, startYear, endDay, tag) {
  const headerDayItems = items.filter((i) => i.str === "Day");
  if (headerDayItems.length < 2) {
    console.warn(`  ! ${tag}: couldn't find the Milk Delivery (litre) table — skipping litres`);
    return [];
  }
  const headerY = headerDayItems[0].y;
  const rows = items.filter((i) => i.x < 250 && i.y < headerY - 2 && i.y > headerY - 260);
  const byY = new Map();
  for (const it of rows) {
    const key = it.y.toFixed(1);
    byY.set(key, [...(byY.get(key) ?? []), it]);
  }

  const byDay = new Map();
  for (const group of byY.values()) {
    const left = group.filter((i) => i.x < 130).sort((a, b) => a.x - b.x);
    const right = group.filter((i) => i.x >= 130).sort((a, b) => a.x - b.x);
    for (const side of [left, right]) {
      if (side.length === 0 || !/^\d{1,2}$/.test(side[0].str)) continue;
      const day = Number(side[0].str);
      if (day < 1 || day > 31) continue;
      const litres = side.length >= 3 ? parseFloatOrNull(side[2].str.replace(/\s/g, "")) ?? 0 : 0;
      byDay.set(day, litres);
    }
  }

  const entries = [];
  for (let day = 1; day <= Math.min(31, endDay); day++) {
    if (!byDay.has(day)) continue;
    const dd = String(day).padStart(2, "0");
    const mm = String(startMonth + 1).padStart(2, "0");
    entries.push({ date: `${startYear}-${mm}-${dd}`, value: byDay.get(day) });
  }
  return entries;
}

// The lab's workbook bundles several of their clients' results into one
// file (sheets "Burnview", "Conference", "DKJ", ...) — only "Burnview" is
// ours. Columns: Analysis Date, Week, BF (%), Protein (%), SCC (x1000),
// IBC (x1000) — no MUN. SCC/IBC are in thousands, so ×1000 to match
// Clover's raw count/ml units. IBC isn't the same instrument as Clover's
// Bactoscan, but both are a bacteria-count-per-ml reading, so it's folded
// into the same bactoscanCountPerMl field for one unified "Bactoscan"
// figure per farm.
//
// Some rows have a blank Analysis Date (a second sample the same week) —
// treated as the same date as the most recent dated row above it, and
// averaged together with it, rather than guessed at or dropped.
function parseCheeseSheet(workbook, tag) {
  const sheet = workbook.Sheets["Burnview"];
  if (!sheet) { console.warn(`  ! ${tag}: no "Burnview" sheet in this workbook — skipping`); return []; }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  if (!rows.length) return [];

  const header = rows[0].map((h) => String(h).trim());
  const col = (name) => header.indexOf(name);
  const dateCol = col("Analysis Date");
  const bfCol = col("BF (%)");
  const proteinCol = col("Protein (%)");
  const sccCol = col("SCC (x1000)");
  const ibcCol = col("IBC (x1000)");
  if ([dateCol, bfCol, proteinCol, sccCol, ibcCol].some((i) => i < 0)) {
    console.warn(`  ! ${tag}: didn't recognize the Burnview sheet's columns — skipping`);
    return [];
  }

  const byDate = new Map();
  let currentDate = null;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rawDate = String(row[dateCol] ?? "").trim();
    const dm = rawDate.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (dm) {
      const [, dd, mm, yy] = dm;
      currentDate = `20${yy}-${mm}-${dd}`;
    } else if (rawDate !== "") {
      // Unparseable date text (e.g. "No BV 08/01") — a gap, not a continuation.
      currentDate = null;
      continue;
    }
    if (!currentDate) continue;

    const bf = parseFloatOrNull(row[bfCol]);
    const protein = parseFloatOrNull(row[proteinCol]);
    const scc = parseFloatOrNull(row[sccCol]);
    const ibc = parseFloatOrNull(row[ibcCol]);
    if (bf == null && protein == null && scc == null && ibc == null) continue;

    const entry = byDate.get(currentDate) ?? { bf: [], protein: [], scc: [], ibc: [] };
    if (bf != null) entry.bf.push(bf);
    if (protein != null) entry.protein.push(protein);
    if (scc != null) entry.scc.push(scc);
    if (ibc != null) entry.ibc.push(ibc);
    byDate.set(currentDate, entry);
  }

  const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
  return [...byDate.entries()].map(([date, v]) => ({
    date,
    butterfatPct: avg(v.bf),
    proteinPct: avg(v.protein),
    somaticCellCountPerMl: v.scc.length ? Math.round(avg(v.scc) * 1000) : null,
    bactoscanCountPerMl: v.ibc.length ? Math.round(avg(v.ibc) * 1000) : null,
  }));
}

async function cheeseLitresByDate(farmId, dates) {
  const sales = await prisma.milkSaleEntry.findMany({
    where: { farmId, date: { in: dates.map((d) => new Date(d)) }, takenBy: { contains: "cheese", mode: "insensitive" } },
  });
  const byDate = new Map();
  for (const s of sales) {
    const d = s.date.toISOString().slice(0, 10);
    byDate.set(d, (byDate.get(d) ?? 0) + s.litres);
  }
  return byDate;
}

async function importCheeseFile(filePath, fileName) {
  const workbook = XLSX.readFile(filePath);
  const rows = parseCheeseSheet(workbook, fileName);
  if (!rows.length) { console.log(`\n${fileName}: no usable Burnview rows`); return; }

  const farm = await prisma.farm.findUnique({ where: { slug: "burnview" } });
  if (!farm) { console.warn(`  ! No Burnview farm found — skipping ${fileName}`); return; }

  const litresByDate = await cheeseLitresByDate(farm.id, rows.map((r) => r.date));

  let written = 0;
  for (const r of rows) {
    const litres = litresByDate.get(r.date) ?? null;
    const data = {
      ...(r.butterfatPct != null && { butterfatPct: r.butterfatPct }),
      ...(r.proteinPct != null && { proteinPct: r.proteinPct }),
      ...(r.somaticCellCountPerMl != null && { somaticCellCountPerMl: r.somaticCellCountPerMl }),
      ...(r.bactoscanCountPerMl != null && { bactoscanCountPerMl: r.bactoscanCountPerMl }),
      ...(litres != null && { litres }),
      sourceFile: fileName,
    };
    await prisma.milkQualityEntry.upsert({
      where: { tankNumber_date: { tankNumber: CHEESE_TANK_NUMBER, date: new Date(r.date) } },
      update: data,
      create: { farmId: farm.id, tankNumber: CHEESE_TANK_NUMBER, date: new Date(r.date), ...data },
    });
    written++;
  }
  console.log(`\n${fileName}: upserted ${written} date(s) for Burnview's cheese-factory line (tank ${CHEESE_TANK_NUMBER}).`);
}

const prisma = new PrismaClient();

async function importFile(filePath, fileName) {
  const data = new Uint8Array(readFileSync(filePath));
  const doc = await getDocument({ data }).promise;
  console.log(`\n${fileName}: ${doc.numPages} page(s)`);

  const farms = {};
  for (const slug of new Set(Object.values(TANK_FARM_SLUG))) {
    farms[slug] = await prisma.farm.findUnique({ where: { slug } });
  }

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const items = await extractPageItems(page);
    const parsed = parsePage(items, fileName, p);
    if (!parsed) continue;
    const farm = farms[parsed.farmSlug];
    if (!farm) { console.warn(`  ! No Farm found for slug "${parsed.farmSlug}" — skipping tank ${parsed.tankNumber}`); continue; }

    // Collect every date touched by any metric column into one upsert per
    // (tank, date), writing only the fields that column actually produced.
    const byDate = new Map();
    for (const [field, entries] of Object.entries(parsed.fields)) {
      for (const { date, value } of entries) {
        const row = byDate.get(date) ?? {};
        row[field] = value;
        byDate.set(date, row);
      }
    }

    let written = 0;
    for (const [date, rowFields] of byDate.entries()) {
      await prisma.milkQualityEntry.upsert({
        where: { tankNumber_date: { tankNumber: parsed.tankNumber, date: new Date(date) } },
        update: { ...rowFields, sourceFile: fileName },
        create: { farmId: farm.id, tankNumber: parsed.tankNumber, date: new Date(date), ...rowFields, sourceFile: fileName },
      });
      written++;
    }
    console.log(`  Tank ${parsed.tankNumber} (${parsed.farmSlug}): upserted ${written} date(s).`);
  }
}

async function main() {
  const state = loadState();
  const processed = new Set(state.processed ?? []);
  const allEntries = readdirSync(EXPORT_DIR);
  const pdfFiles = allEntries.filter((f) => f.toLowerCase().endsWith(".pdf")).sort();
  const xlsxFiles = allEntries.filter((f) => f.toLowerCase().endsWith(".xlsx")).sort();
  const newPdfs = pdfFiles.filter((f) => !processed.has(f));

  if (!newPdfs.length && !xlsxFiles.length) { console.log("No new Clover quality cards or cheese-factory exports."); return; }

  for (const fileName of newPdfs) {
    await importFile(join(EXPORT_DIR, fileName), fileName);
    processed.add(fileName);
    state.processed = [...processed];
    saveState(state);
  }

  for (const fileName of xlsxFiles) {
    await importCheeseFile(join(EXPORT_DIR, fileName), fileName);
  }

  console.log("\nDone.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
