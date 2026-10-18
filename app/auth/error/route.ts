import { NextResponse } from "next/server";

import { authErrorRedirectUrl } from "@/modules/auth/error-redirect";

/**
 * Auth.js error landing. Shop OAuth must not dump people on /admin/login;
 * staff credential failures must not dump on the storefront.
 * The Location host is the public site, never the container bind address.
 */
export function GET(request: Request) {
  const url = new URL(request.url);
  return NextResponse.redirect(
    authErrorRedirectUrl(url.searchParams.get("error")),
  );
}
