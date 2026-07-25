import { NextResponse } from "next/server";

import {
  completeUpload,
  createPresignedReadUrl,
} from "@/modules/platform/assets";

export async function POST(request: Request) {
  const body = (await request.json()) as { key?: string; mime?: string };
  if (!body.key || !body.mime) {
    return NextResponse.json(
      { error: "key and mime required" },
      { status: 400 },
    );
  }
  const asset = await completeUpload({ key: body.key, mime: body.mime });
  const readUrl = await createPresignedReadUrl(asset.r2Key, 600);
  return NextResponse.json({ asset, readUrl });
}
