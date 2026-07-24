import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

const globalForDb = globalThis as unknown as {
  aksSql?: ReturnType<typeof postgres>;
};

function createClient() {
  return postgres(requireDatabaseUrl(), { max: 10 });
}

export const sql = globalForDb.aksSql ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForDb.aksSql = sql;
}

export const db = drizzle(sql, { schema });

export type Database = typeof db;
export { schema };
