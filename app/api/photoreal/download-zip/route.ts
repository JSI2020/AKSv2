import { NextResponse } from "next/server";

import {
  PermissionDeniedError,
  requirePermission,
  UnauthenticatedError,
} from "@/modules/auth";
import { buildStoredZip, type ZipEntry } from "@/modules/photoreal/zip";

export const runtime = "nodejs";

/**
 * "Download all" for an AI Studio shoot: bundles up to 12 renders into one
 * ZIP. Same rules as the single download — AI Studio access, fal CDN hosts
 * only, images only.
 */
const MAX_FILES = 12;
const MAX_BYTES_EACH = 40 * 1024 * 1024;

function isAllowed(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return url.protocol === "https:" && (host === "fal.media" || host.endsWith(".fal.media"));
}

function safeBase(raw: string | null): string {
  const base = (raw ?? "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "aks-studio-shoot";
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
  const raw = params.getAll("u");
  if (!raw.length || raw.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Send 1–${MAX_FILES} images` },
      { status: 400 },
    );
  }

  let urls: URL[];
  try {
    urls = raw.map((u) => new URL(u));
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (!urls.every(isAllowed)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 400 });
  }

  const base = safeBase(params.get("name"));
  const entries: ZipEntry[] = [];
  for (const [i, url] of urls.entries()) {
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      return NextResponse.json({ error: "Could not fetch an image" }, { status: 502 });
    }
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) {
      return NextResponse.json({ error: "An image was not found" }, { status: 404 });
    }
    const data = new Uint8Array(await res.arrayBuffer());
    if (data.length > MAX_BYTES_EACH) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    entries.push({ name: `${base}-${String(i + 1).padStart(2, "0")}.${ext}`, data });
  }

  const zip = buildStoredZip(entries);
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${base}.zip"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
