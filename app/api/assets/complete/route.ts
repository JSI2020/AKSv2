import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  completeUpload,
  createPresignedReadUrl,
  uploadKeyOwnedByPrefix,
} from "@/modules/platform/assets";

/**
 * Finalize an upload into an assets row.
 * Requires a signed-in user; key must live under uploads/user/<userId>/.
 * Guest bank-transfer completion goes through submitBankTransferReceipt.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { key?: string; mime?: string };
  if (!body.key || !body.mime) {
    return NextResponse.json(
      { error: "key and mime required" },
      { status: 400 },
    );
  }

  const prefix = `uploads/user/${session.user.id}`;
  if (!uploadKeyOwnedByPrefix(body.key, [prefix])) {
    return NextResponse.json({ error: "Forbidden key" }, { status: 403 });
  }

  if (
    !body.mime.startsWith("image/") &&
    !body.mime.startsWith("video/") &&
    body.mime !== "application/pdf"
  ) {
    return NextResponse.json({ error: "Unsupported mime" }, { status: 400 });
  }

  const asset = await completeUpload({
    key: body.key,
    mime: body.mime,
    uploadedById: session.user.id,
  });
  const readUrl = await createPresignedReadUrl(asset.r2Key, 600);
  return NextResponse.json({ asset, readUrl });
}
