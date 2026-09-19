// Nightly logical backup — dumps every table's rows to JSON so accidental
// deletes/mistakes (ours or the app's) can be recovered without relying on
// Neon's own retention window. Runs from Task Scheduler; see the "DB Backup"
// task (daily) alongside the existing AFI import tasks.
import { PrismaClient, Prisma } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

const BACKUP_ROOT = "C:\\Users\\craig\\OneDrive\\Backups\\burnview-db";
const KEEP_DAYS = 30;

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

async function main() {
  const dir = path.join(BACKUP_ROOT, stamp());
  fs.mkdirSync(dir, { recursive: true });

  const models = Prisma.dmmf.datamodel.models;
  let totalRows = 0;
  for (const model of models) {
    const accessor = model.name.charAt(0).toLowerCase() + model.name.slice(1);
    const rows = await prisma[accessor].findMany();
    fs.writeFileSync(path.join(dir, `${model.name}.json`), JSON.stringify(rows, null, 2));
    totalRows += rows.length;
    console.log(`${model.name}: ${rows.length} rows`);
  }
  console.log(`Backup complete: ${totalRows} rows across ${models.length} tables -> ${dir}`);

  // Prune anything older than KEEP_DAYS so this doesn't grow forever.
  const cutoff = Date.now() - KEEP_DAYS * 86400000;
  for (const entry of fs.readdirSync(BACKUP_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(BACKUP_ROOT, entry.name);
    if (fs.statSync(full).mtimeMs < cutoff) {
      fs.rmSync(full, { recursive: true, force: true });
      console.log(`Pruned old backup: ${entry.name}`);
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
