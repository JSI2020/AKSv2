import { NextResponse } from "next/server";

import { createPresignedUploadUrl } from "@/modules/platform/assets";

export async function POST(request: Request) {
  const body = (await request.json()) as { contentType?: string };
  if (!body.contentType) {
    return NextResponse.json({ error: "contentType required" }, { status: 400 });
  }
  const result = await createPresignedUploadUrl({
    contentType: body.contentType,
  });
  return NextResponse.json(result);
}
