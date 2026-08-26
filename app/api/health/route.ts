import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { db } from "@aks/db";

export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe. Returns 200 only when the database is reachable, so
 * orchestrators and uptime monitors can tell "up" from "up but DB down".
 */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({
      status: "ok",
      db: "up",
      time: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "degraded", db: "down" },
      { status: 503 },
    );
  }
}
