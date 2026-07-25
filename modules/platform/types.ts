import type { Database } from "@aks/db";

/** Drizzle transaction handle passed into transition/enqueue. */
export type DbTx = Parameters<Parameters<Database["transaction"]>[0]>[0];
