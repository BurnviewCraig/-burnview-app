// Eskom electricity bill import — reads every PDF tax invoice Craig drops
// into his "Eskom Meter Readings" folder (organized into month subfolders,
// but this walks the whole tree so the folder layout doesn't matter) and
// writes one ElectricityBill per invoice.
//
// Run with: node --env-file=.env scripts/eskom-import.mjs
//
// Safe to re-run: bills are upserted by Eskom's own tax invoice number,
// which is globally unique per bill, so re-running on the same PDFs (or a
// folder with new ones dropped in) never duplicates. The whole tree is
// always rescanned rather than tracked by a state file — there are only a
// few hundred small PDFs total, so a full rescan is cheap and simpler than
// bookkeeping which files are "new".
//
// A meter (one Eskom account = one "transformer", per Craig) is created
// the first time its account number is seen, named from ESKOM_METER_NAMES
// below. After that, its name and farm assignment live in the DB and are
// NEVER overwritten by a re-import — Craig assigns farms and fixes names
// in the app itself, and this map only matters the first time.
//
// Two tariff shapes have been seen so far and both are handled: a 2-page
// demand tariff (e.g. Ruraflex Interval) with a peak/standard/off-peak kWh
// split and a kVA demand reading, and a 1-page flat tariff (e.g. Landrate)
// with just one all-in kWh total and no demand reading. Fields only one
// shape reports are left null for the other.

import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { PrismaClient } from "@prisma/client";

const EXPORT_DIR = process.env.ESKOM_EXPORT_DIR || "C:\\Users\\craig\\Desktop\\Eskom Meter Readings";

// Mirrors ESKOM_METER_NAMES in src/lib/constants.ts (kept in sync by hand —
// scripts run as plain Node ESM, not through the Next/TS build, so they
// can't import from src). Only read the first time a new account shows up.
const ESKOM_METER_NAMES = {
  "5271261442": "Burnside Dam",
  "5440672060": "Umzinkulu Pump",
  "5540951175": "Farmgate Dam",
  "5850905084": "Bongaan House",
  "6150887353": "Burnview Dairy Dam",
  "6203050406": "Smithfield Houses",
  "6377247446": "Smithfield Maize Pivots",
  "6503560467": "Stockton Dairy",
  "6925259619": "Middle Dam",
  "6989901990": "Everfair Corner Dam",
  "7161376382": "Burnview Slurry + Borehole",
  "7378128329": "Burnview Dairy",
  "7387876615": "Everfair Dairy",
  "8082136431": "Glenroy Pivots",
  "8107674733": "Everfair Drag Lines 2",
  "8290523034": "Charlie Dam",
  "8598797911": "Burnview Workshop",
  "8732740708": "Everfair Big Dam",
  "8920641141": "Everfair Home Pivot",
  "9229705578": "Glenroy Drag Lines",
  "9257389742": "Everfair Turkeys Nest Dam",
  "9315439376": "Stockton Didi Dam",
  "9520650258": "Stockton Didi River",
  "9836620624": "Burnview Silage Pits",
  "9856549163": "Glenroy Transfer",
  "9895856590": "Stockton P Pivot",
  "9898576664": "Stockton Gravity Pump",
  "9997945297": "Belt Pump",
};

const MONTHS = {
  JANUARY: "01", FEBRUARY: "02", MARCH: "03", APRIL: "04", MAY: "05", JUNE: "06",
  JULY: "07", AUGUST: "08", SEPTEMBER: "09", OCTOBER: "10", NOVEMBER: "11", DECEMBER: "12",
};

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) out.push(full);
  }
  return out;
}

function num(s) {
  if (s == null) return null;
  const n = Number(String(s).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function extractLines(filePath) {
  const data = new Uint8Array(readFileSync(filePath));
  const doc = await getDocument({ data }).promise;
  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5] }))
      .filter((it) => it.str.trim() !== "");
    // 3pt tolerance (not 2) because at least one bill template renders the
    // boxed "YOUR ACCOUNT NO" value's baseline ~2.4pt off from its label —
    // still well clear of genuinely separate table rows, which run ~4pt+ apart.
    const rows = [];
    for (const it of items) {
      const row = rows.find((r) => Math.abs(r.y - it.y) <= 3);
      if (row) row.items.push(it);
      else rows.push({ y: it.y, items: [it] });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const row of rows) {
      lines.push(row.items.sort((a, b) => a.x - b.x).map((i) => i.str).join(" "));
    }
  }
  return lines;
}

// Finds the first line matching a line-anchored regex and returns its
// capture group(s) — used instead of one big blob match since several
// labels (e.g. "ENERGY CONSUMPTION PEAK" vs "...OFF PEAK") would otherwise
// cross-match each other.
function matchLine(lines, re) {
  for (const line of lines) {
    const m = line.match(re);
    if (m) return m;
  }
  return null;
}

// pdfjs sometimes inserts a stray space mid-word for certain templates —
// observed on real bills as "ACCOUNT M ONTH" and "CURRENT DUE DAT E" (wide
// letter-spacing in that particular form gets read as a word break). A
// literal label match would silently never match those bills, so every
// label is matched letter-by-letter with optional whitespace between each
// character instead of as a fixed literal string.
function fuzzy(label) {
  return label
    .replace(/\s+/g, "")
    .split("")
    .map((c) => c.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"))
    .join("\\s*");
}
function labelRe(label, rest, flags) {
  return new RegExp(fuzzy(label) + rest, flags);
}

function parseBill(lines, fileName) {
  const accountNo = matchLine(lines, labelRe("YOUR ACCOUNT NO", "\\s+(\\d{10})"))?.[1];
  const invoiceNo = matchLine(lines, labelRe("TAX INVOICE NO", "\\s+(\\d+)"))?.[1];
  const billingDate = matchLine(lines, labelRe("BILLING DATE", "\\s+(\\d{4}-\\d{2}-\\d{2})"))?.[1];
  const dueDate = matchLine(lines, labelRe("CURRENT DUE DATE", "\\s+(\\d{4}-\\d{2}-\\d{2})"))?.[1];
  const accountMonthRaw = matchLine(lines, labelRe("ACCOUNT MONTH", "\\s+([A-Z]+)\\s+(\\d{4})"));
  if (!accountNo || !invoiceNo || !billingDate || !accountMonthRaw) {
    console.warn(`  ! ${fileName}: missing account/invoice/billing-date/account-month — skipping`);
    return null;
  }
  const monthNum = MONTHS[accountMonthRaw[1]];
  const accountMonth = monthNum ? `${accountMonthRaw[2]}-${monthNum}` : null;

  const totalAmountDue = num(matchLine(lines, labelRe("TOTAL AMOUNT DUE", "\\s+([\\d,]+\\.\\d{2})"))?.[1]);
  const chargesExclVat = num(matchLine(lines, labelRe("TOTAL CHARGES", "(?:\\s*FOR\\s*BILLING\\s*PERIOD)?\\s+R\\s+([\\d,]+\\.\\d{2})"))?.[1]);
  const vat = num(matchLine(lines, labelRe("VAT RAISED ON ITEMS AT 15%", "\\s+R\\s+([\\d,]+\\.\\d{2})"))?.[1]);
  // A bill can carry more than one "TARIFF NAME:" line (e.g. a small fixed
  // network charge under one legacy tariff alongside the real
  // consumption-based one) — the last one is reliably the consumption-
  // bearing tariff that the kWh figures below belong to.
  const tariffRe = labelRe("TARIFF NAME:", "\\s*(.+?)\\s*$");
  const tariffMatches = lines.map((l) => l.match(tariffRe)).filter(Boolean);
  const tariffName = tariffMatches.length ? tariffMatches[tariffMatches.length - 1][1].trim() : null;

  // Consumption period shows up in one of two label styles depending on
  // tariff — Ruraflex-style "CONSUMPTION DETAILS (yyyy-mm-dd - yyyy-mm-dd)"
  // or Landrate-style "READING DATES: yyyy/mm/dd - yyyy/mm/dd".
  const periodA = matchLine(lines, labelRe("CONSUMPTION DETAILS", "\\s*\\((\\d{4}-\\d{2}-\\d{2})\\s*-\\s*(\\d{4}-\\d{2}-\\d{2})\\)"));
  const periodB = matchLine(lines, labelRe("READING DATES:", "\\s*(\\d{4})\\/(\\d{2})\\/(\\d{2})\\s*-\\s*(\\d{4})\\/(\\d{2})\\/(\\d{2})"));
  const periodStart = periodA ? periodA[1] : periodB ? `${periodB[1]}-${periodB[2]}-${periodB[3]}` : null;
  const periodEnd = periodA ? periodA[2] : periodB ? `${periodB[4]}-${periodB[5]}-${periodB[6]}` : null;

  const kwhOffPeak = num(matchLine(lines, labelRe("ENERGY CONSUMPTION OFF PEAK", "\\s*kWH?\\s+([\\d,.]+)", "i"))?.[1]);
  const kwhStandard = num(matchLine(lines, labelRe("ENERGY CONSUMPTION STD", "\\s*kWh?\\s+([\\d,.]+)", "i"))?.[1]);
  const kwhPeak = num(matchLine(lines, new RegExp("^" + fuzzy("ENERGY CONSUMPTION PEAK") + "\\s*kWh?\\s+([\\d,.]+)", "i"))?.[1]);
  const kwhAll = num(matchLine(lines, labelRe("ENERGY CONSUMPTION ALL", "\\s*kWh?\\s+([\\d,.]+)", "i"))?.[1]);
  const kwhFlat = num(matchLine(lines, labelRe("TOTAL ENERGY CONSUMED FOR BILLING PERIOD", "\\s*\\(kWh\\)\\s+([\\d,.]+)", "i"))?.[1]);
  const demandKva = num(matchLine(lines, labelRe("DEMAND READING - KW/KVA", "\\s+([\\d,.]+)", "i"))?.[1]);

  return {
    accountNo, invoiceNo, billingDate, dueDate, accountMonth, tariffName,
    periodStart, periodEnd, totalAmountDue, chargesExclVat, vat,
    kwhTotal: kwhAll ?? kwhFlat, kwhPeak, kwhStandard, kwhOffPeak, demandKva,
  };
}

const prisma = new PrismaClient();
const meterCache = new Map();

async function meterFor(accountNo) {
  if (meterCache.has(accountNo)) return meterCache.get(accountNo);
  const name = ESKOM_METER_NAMES[accountNo] ?? `Unnamed (${accountNo})`;
  const meter = await prisma.electricityMeter.upsert({
    where: { accountNo },
    update: {},
    create: { accountNo, name },
  });
  meterCache.set(accountNo, meter);
  return meter;
}

async function main() {
  const files = walk(EXPORT_DIR).sort();
  if (!files.length) { console.log(`No PDFs found under ${EXPORT_DIR}`); return; }

  let written = 0;
  let skipped = 0;
  for (const filePath of files) {
    const fileName = filePath.slice(EXPORT_DIR.length + 1);
    let lines, bill;
    try {
      lines = await extractLines(filePath);
      bill = parseBill(lines, fileName);
    } catch (e) {
      console.warn(`  ! ${fileName}: threw while parsing (${e.message}) — skipping`);
      skipped++;
      continue;
    }
    if (!bill) { skipped++; continue; }

    const meter = await meterFor(bill.accountNo);
    await prisma.electricityBill.upsert({
      where: { invoiceNo: bill.invoiceNo },
      update: {
        accountMonth: bill.accountMonth,
        billingDate: new Date(bill.billingDate),
        dueDate: new Date(bill.dueDate),
        periodStart: bill.periodStart ? new Date(bill.periodStart) : null,
        periodEnd: bill.periodEnd ? new Date(bill.periodEnd) : null,
        tariffName: bill.tariffName,
        kwhTotal: bill.kwhTotal, kwhPeak: bill.kwhPeak, kwhStandard: bill.kwhStandard, kwhOffPeak: bill.kwhOffPeak,
        demandKva: bill.demandKva, chargesExclVat: bill.chargesExclVat, vat: bill.vat, totalAmountDue: bill.totalAmountDue,
        sourceFile: fileName,
      },
      create: {
        meterId: meter.id, invoiceNo: bill.invoiceNo, accountMonth: bill.accountMonth,
        billingDate: new Date(bill.billingDate), dueDate: new Date(bill.dueDate),
        periodStart: bill.periodStart ? new Date(bill.periodStart) : null,
        periodEnd: bill.periodEnd ? new Date(bill.periodEnd) : null,
        tariffName: bill.tariffName,
        kwhTotal: bill.kwhTotal, kwhPeak: bill.kwhPeak, kwhStandard: bill.kwhStandard, kwhOffPeak: bill.kwhOffPeak,
        demandKva: bill.demandKva, chargesExclVat: bill.chargesExclVat, vat: bill.vat, totalAmountDue: bill.totalAmountDue,
        sourceFile: fileName,
      },
    });
    written++;
  }

  console.log(`Upserted ${written} bill(s) across ${meterCache.size} meter(s), skipped ${skipped} unreadable file(s).`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
