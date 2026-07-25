/** Routes a TAILOR (production-only) role may access. */
export const TAILOR_ALLOWED_PREFIXES = [
  "/admin/login",
  "/admin/2fa",
  "/admin/production",
] as const;

export function isTailorAllowedPath(pathname: string): boolean {
  if (pathname === "/admin" || pathname === "/admin/") {
    return true;
  }
  return TAILOR_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isProductionOnlyRole(role: string | undefined): boolean {
  return role === "TAILOR";
}
