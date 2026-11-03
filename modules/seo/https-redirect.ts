const CANONICAL_HOSTS = new Set(["www.aks-atelier.com", "aks-atelier.com"]);

/**
 * Production requests that arrive as HTTP (Caddy sets X-Forwarded-Proto)
 * redirect to the canonical HTTPS host. Localhost and missing proto are left
 * alone so dev and in-container health checks keep working.
 */
export function canonicalHttpsRedirectTarget(input: {
  nodeEnv: string | undefined;
  forwardedProto: string | null;
  forwardedHost: string | null;
  host: string | null;
  pathname: string;
  search: string;
}): string | null {
  if (input.nodeEnv !== "production") return null;
  const proto = input.forwardedProto?.split(",")[0]?.trim().toLowerCase();
  if (proto !== "http") return null;
  const hostHeader = (input.forwardedHost ?? input.host ?? "")
    .split(",")[0]
    ?.trim()
    .toLowerCase();
  const hostname = hostHeader?.split(":")[0] ?? "";
  if (!CANONICAL_HOSTS.has(hostname)) return null;
  const path = input.pathname.startsWith("/")
    ? input.pathname
    : `/${input.pathname}`;
  const search = input.search
    ? input.search.startsWith("?")
      ? input.search
      : `?${input.search}`
    : "";
  return `https://www.aks-atelier.com${path}${search}`;
}
