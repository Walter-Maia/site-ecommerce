/**
 * Semeia o SQLite (data/kimekris.db) a partir de src/data e garante o admin.
 *
 *   npm run db:seed                         # idempotente
 *   npm run db:seed -- --reset-admin-password
 *   npm run db:reset                        # apaga o banco e semeia de novo (pare o `next dev` antes)
 *
 * Segredos: SESSION_SECRET e ADMIN_SEED_PASSWORD são gerados aleatoriamente
 * e gravados em .env.local (gitignored) se ainda não existirem. A senha do
 * admin nunca é impressa.
 */
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { databaseFile, openDatabase } from "@/server/db/client";
import { ADMIN_EMAIL, ensureAdmin, seedCatalog } from "@/server/db/seed";

const ROOT = process.cwd();
const ENV_FILE = path.join(ROOT, ".env.local");
const args = new Set(process.argv.slice(2));

function readEnvFile(): Map<string, string> {
  const map = new Map<string, string>();
  if (!fs.existsSync(ENV_FILE)) return map;
  for (const line of fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) map.set(m[1], m[2].replace(/^["']|["']$/g, ""));
  }
  return map;
}

function upsertEnv(updates: Record<string, string>) {
  const lines = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/) : [];
  for (const [key, value] of Object.entries(updates)) {
    const i = lines.findIndex((l) => new RegExp(`^\\s*${key}\\s*=`).test(l));
    if (i >= 0) lines[i] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  }
  const body = lines.filter((l, i, arr) => !(l === "" && i === arr.length - 1)).join("\n") + "\n";
  fs.writeFileSync(ENV_FILE, body, { mode: 0o600 });
}

const env = readEnvFile();
const updates: Record<string, string> = {};

if (!env.get("SESSION_SECRET") && !process.env.SESSION_SECRET) {
  updates.SESSION_SECRET = randomBytes(32).toString("base64url");
}
const resetAdmin = args.has("--reset-admin-password");
if (resetAdmin || (!env.get("ADMIN_SEED_PASSWORD") && !process.env.ADMIN_SEED_PASSWORD)) {
  updates.ADMIN_SEED_PASSWORD = randomBytes(18).toString("base64url");
}
if (Object.keys(updates).length) {
  upsertEnv(updates);
  console.log(`.env.local atualizado: ${Object.keys(updates).join(", ")}`);
}
for (const [k, v] of [...env, ...Object.entries(updates)]) process.env[k] ??= v;
if (updates.ADMIN_SEED_PASSWORD) process.env.ADMIN_SEED_PASSWORD = updates.ADMIN_SEED_PASSWORD;

const file = databaseFile();
if (args.has("--reset")) {
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      fs.rmSync(file + suffix, { force: true });
    } catch (err) {
      console.error(`Não foi possível apagar ${file + suffix} (o next dev está rodando?):`, (err as Error).message);
      process.exit(1);
    }
  }
  console.log("Banco apagado.");
}

const db = openDatabase(file);
const seeded = seedCatalog(db);
const admin = ensureAdmin(db, process.env.ADMIN_SEED_PASSWORD!, { resetPassword: resetAdmin });
const count = (sql: string) => Number((db.prepare(sql).get() as { n: number }).n);

console.log(`Banco: ${path.relative(ROOT, file)}`);
console.log(`Produtos: ${count("SELECT COUNT(*) AS n FROM products")} (novos: ${seeded.products})`);
console.log(`Manequins: ${count("SELECT COUNT(*) AS n FROM mannequins")} (novos: ${seeded.mannequins})`);
console.log(`Admin ${ADMIN_EMAIL}: ${admin} — senha em .env.local (ADMIN_SEED_PASSWORD)`);
db.close();
