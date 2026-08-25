import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getOrSetAnonToken } from "@/modules/measure/anon-cookie";
import { createPresignedUploadUrl } from "@/modules/platform/assets";

/**
 * Presign an R2 upload.
 * Keys are namespaced to the signed-in user or guest anon token so finalize
 * can reject cross-account key registration.
 * Guests (bank receipt / try-on) are limited to images.
 */
export async function POST(request: Request) {
  let body: { contentType?: string };
  try {
    body = (await request.json()) as { contentType?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.contentType) {
    return NextResponse.json({ error: "contentType required" }, { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isStaff = Boolean(userId && role && role !== "CUSTOMER");

  if (!isStaff && !body.contentType.startsWith("image/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let keyPrefix: string;
  if (userId) {
    keyPrefix = `uploads/user/${userId}`;
  } else {
    const anon = await getOrSetAnonToken();
    keyPrefix = `uploads/anon/${anon}`;
  }

  try {
    const result = await createPresignedUploadUrl({
      contentType: body.contentType,
      keyPrefix,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Presign failed";
    const storageDown =
      message.includes("ECONNREFUSED") ||
      message.includes("ENOTFOUND") ||
      message.includes("R2_") ||
      message.includes("is not set");
    return NextResponse.json(
      {
        error: storageDown
          ? "Asset storage is unavailable. Start MinIO/R2 and try again."
          : "Could not prepare upload.",
      },
      { status: 503 },
    );
  }
}
