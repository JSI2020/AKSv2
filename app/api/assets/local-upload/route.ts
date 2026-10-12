import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getOrSetAnonToken } from "@/modules/measure/anon-cookie";
import {
  localDiskUploadsEnabled,
  saveLocalDevAsset,
  uploadKeyOwnedByPrefix,
} from "@/modules/platform/assets";

/**
 * Accepts the same PUT the presign flow uses when object storage is offline
 * or R2_FORCE_LOCAL is set. Bytes land under public/<key> (production mounts
 * public/uploads on a Docker volume) and are served by /api/assets/serve.
 */
export async function PUT(request: Request) {
  if (!localDiskUploadsEnabled()) {
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
