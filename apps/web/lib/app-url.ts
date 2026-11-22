function strip(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function isLocalHost(host: string): boolean {
  const name = host.split(":")[0]?.toLowerCase() ?? "";
  return name === "localhost" || name === "127.0.0.1" || name === "0.0.0.0" || name === "[::1]";
}

/** Public site origin. The container's own request URL is localhost on Railway. */
export function getAppBaseUrl(
  requestOrigin: string,
  forwarded?: { host?: string | null; proto?: string | null },
): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) return strip(configured);
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim() || process.env.RAILWAY_STATIC_URL?.trim();
  if (railway) {
    return railway.startsWith("http") ? strip(railway) : `https://${strip(railway)}`;
  }
  const host = forwarded?.host?.split(",")[0]?.trim() ?? "";
  const proto = forwarded?.proto?.split(",")[0]?.trim() || "https";
  if (host && !isLocalHost(host) && /^[a-z0-9.-]+(?::\d+)?$/i.test(host) && (proto === "http" || proto === "https")) {
    return `${proto}://${host}`;
  }
  return strip(requestOrigin);
}

export function appUrl(
  path: string,
  requestOrigin: string,
  forwarded?: { host?: string | null; proto?: string | null },
): URL {
  const base = getAppBaseUrl(requestOrigin, forwarded);
  return new URL(path, `${base}/`);
}

export function appUrlFromRequest(req: { nextUrl: { origin: string }; headers: { get(name: string): string | null } }, path: string): URL {
  return appUrl(path, req.nextUrl.origin, {
    host: req.headers.get("x-forwarded-host"),
    proto: req.headers.get("x-forwarded-proto"),
  });
}
