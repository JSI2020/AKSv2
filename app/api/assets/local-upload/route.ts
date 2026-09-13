import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getOrSetAnonToken } from "@/modules/measure/anon-cookie";
import {
  saveLocalDevAsset,
  uploadKeyOwnedByPrefix,
} from "@/modules/platform/assets";

/**
 * Dev fallback when MinIO/R2 is offline — accepts the same PUT the presign
 * flow uses, writing bytes under public/<key> for local serving.
 */
export async function PUT(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const key = new URL(request.url).searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "key required" }, { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.id;
  let allowed = false;
  if (userId && uploadKeyOwnedByPrefix(key, [`uploads/user/${userId}`])) {
    allowed = true;
  } else if (!userId) {
    const anon = await getOrSetAnonToken();
    if (uploadKeyOwnedByPrefix(key, [`uploads/anon/${anon}`])) {
      allowed = true;
    }
  }

  if (!allowed) {
    return NextResponse.json({ error: "Forbidden key" }, { status: 403 });
  }

  try {
    const body = Buffer.from(await request.arrayBuffer());
    saveLocalDevAsset(key, body);
    return new Response(null, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
