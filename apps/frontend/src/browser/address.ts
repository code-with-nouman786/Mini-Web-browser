export function normalizeAddress(address: string): string {
  return address
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

// This is an opaque database identifier, never an external navigation URL.
// Keep the link boundary aligned with the backend sanitizer.
export function isCanonicalInternalAddress(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 2048 &&
    normalizeAddress(value) === value &&
    /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9._~%+-]+)*$/.test(value)
  );
}

export function enteredAddress(value: string): string | null {
  const address = normalizeAddress(value);
  return isCanonicalInternalAddress(address) ? address : null;
}
