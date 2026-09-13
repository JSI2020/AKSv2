import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { assets, db } from "@aks/db";
import { getObjectBytes } from "@/modules/platform/assets";

/** Serve asset bytes with the correct Content-Type (local dev + R2). */
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key || key.includes("..")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: Buffer;
  try {
    body = await getObjectBytes(key);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [row] = await db
    .select({ mime: assets.mime })
    .from(assets)
    .where(eq(assets.r2Key, key))
    .limit(1);

  const mime = row?.mime ?? "application/octet-stream";

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
