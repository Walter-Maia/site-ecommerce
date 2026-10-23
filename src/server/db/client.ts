import "server-only";
import fs from "node:fs";
import path from "node:path";
// Turbopack trata `node:sqlite` como módulo nativo externo (verificado no Next 16.4,
// runtime Node). Se algum bundler reclamar, trocar por
// `process.getBuiltinModule("node:sqlite")`, que não passa pelo bundler.
import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";
import { MIGRATIONS, SCHEMA_VERSION } from "./schema";
import { seedIfEmpty } from "./seed";

export type Param = SQLInputValue;

const g = globalThis as unknown as {
  __qdDb?: DatabaseSync;
  __qdDbStmts?: Map<string, StatementSync>;
  __qdDbVersion?: number;
  __qdDbFile?: string;
};

export function databaseFile(): string {
  // QUADRA_DB_PATH mantido por compatibilidade (testes usam ":memory:").
  return process.env.KIMKRISS_DB_PATH || process.env.QUADRA_DB_PATH || path.join(process.cwd(), "data", "kimekris.db");
}

function migrate(db: DatabaseSync) {
  const current = Number((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version);
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(m.sql);
      db.exec(`PRAGMA user_version = ${Number(m.version)}`);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
}

/** Abre (e migra) um banco. Usado pelo singleton e pelo script de seed. */
export function openDatabase(file = databaseFile()): DatabaseSync {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);
  migrate(db);
  return db;
}

/**
 * Conexão única por processo, guardada em globalThis para sobreviver ao HMR.
 * Na primeira conexão com banco vazio, semeia catálogo e manequins.
 */
export function getDb(): DatabaseSync {
  const file = databaseFile();
  if (!g.__qdDb || !g.__qdDb.isOpen || g.__qdDbFile !== file) {
    if (g.__qdDb?.isOpen) g.__qdDb.close(); // arquivo mudou (ex.: HMR após trocar o caminho)
    g.__qdDbFile = file;
    g.__qdDb = openDatabase();
    g.__qdDbStmts = new Map();
    g.__qdDbVersion = SCHEMA_VERSION;
    seedIfEmpty(g.__qdDb, { adminPassword: process.env.ADMIN_SEED_PASSWORD });
  } else if (g.__qdDbVersion !== SCHEMA_VERSION) {
    migrate(g.__qdDb);
    g.__qdDbStmts = new Map();
    g.__qdDbVersion = SCHEMA_VERSION;
  }
  return g.__qdDb;
}

function stmt(sql: string): StatementSync {
  const db = getDb();
  const cache = (g.__qdDbStmts ??= new Map());
  let s = cache.get(sql);
  if (!s) {
    s = db.prepare(sql);
    cache.set(sql, s);
  }
  return s;
}

/* Helpers tipados. SEMPRE parâmetros posicionais (`?`): nunca interpolar valores. */

export function all<T>(sql: string, ...params: Param[]): T[] {
  return stmt(sql).all(...params) as T[];
}

export function get<T>(sql: string, ...params: Param[]): T | undefined {
  return stmt(sql).get(...params) as T | undefined;
}

export function run(sql: string, ...params: Param[]): { changes: number; lastInsertRowid: number } {
  const r = stmt(sql).run(...params);
  return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
}

let savepointSeq = 0;

/**
 * Transação SÍNCRONA. A conexão é compartilhada entre requisições, então não
 * pode haver `await` entre BEGIN e COMMIT (outra requisição entraria na
 * transação). Por isso `fn` não pode ser async. Aninhamento vira SAVEPOINT.
 */
export function transaction<T>(fn: () => T): T {
  const db = getDb();
  const nested = db.isTransaction;
  const sp = `sp_${++savepointSeq}`;
  db.exec(nested ? `SAVEPOINT ${sp}` : "BEGIN IMMEDIATE");
  try {
    const result = fn();
    if (result instanceof Promise) throw new Error("transaction(): fn não pode ser assíncrona");
    db.exec(nested ? `RELEASE ${sp}` : "COMMIT");
    return result;
  } catch (err) {
    db.exec(nested ? `ROLLBACK TO ${sp}; RELEASE ${sp}` : "ROLLBACK");
    throw err;
  }
}

export const bool = (v: boolean | undefined | null): number => (v ? 1 : 0);
