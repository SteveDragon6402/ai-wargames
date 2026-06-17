/**
 * Server-side admin authentication helper.
 * The password is read from ADMIN_PASSWORD env var (defaults to "admin" in dev).
 * The client passes it as a Bearer token in the Authorization header.
 */
export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? "admin";
}

export function checkAdminAuth(req: Request): boolean {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token === getAdminPassword();
}
