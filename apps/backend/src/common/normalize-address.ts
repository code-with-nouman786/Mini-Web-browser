/** Canonical, case-insensitive address for the application's stored sites. */
export function normalizeAddress(address: string): string {
  return address
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}
