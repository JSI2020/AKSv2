import { NextResponse } from "next/server";

import {
  PermissionDeniedError,
  requirePermission,
  UnauthenticatedError,
} from "@/modules/auth";

export const runtime = "nodejs";

/**
 * Same-origin download for AI Studio results. Renders live on fal's CDN, and
 * browsers ignore `<a download>` for cross-origin URLs (the image opens in a
 * tab instead). This streams the file back with `Content-Disposition:
 * attachment` so it saves directly.
 *
 * Only fal CDN hosts are fetched (no open proxy / SSRF), only images are
 * returned, and the caller needs AI Studio access.
 */
const MAX_BYTES = 40 * 1024 * 1024;

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "fal.media" || host.endsWith(".fal.media");
}

function safeFilename(raw: string | null): string {
  const base = (raw ?? "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || "aks-studio-photo";
}

function extensionFor(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  return "png";
}

export async function GET(request: Request) {
  try {
    await requirePermission("photoreal.view");
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    if (err instanceof PermissionDeniedError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw err;
  }

  const params = new URL(request.url).searchParams;
  let target: URL;
  try {
    target = new URL(params.get("url") ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (target.protocol !== "https:" || !isAllowedHost(target.hostname)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return NextResponse.json({ error: "Could not fetch image" }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "Not an image" }, { status: 415 });
  }
  const length = Number(upstream.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }

  const name = safeFilename(params.get("name"));
  const filename = /\.(png|jpe?g|webp)$/i.test(name)
    ? name
    : `${name}.${extensionFor(contentType)}`;

  return new Response(upstream.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
