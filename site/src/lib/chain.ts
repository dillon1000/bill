/** JSON with sorted keys, so equal values hash equally: the canonical form Bill's audit log hashes. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const GENESIS = "0".repeat(64);

/** Each event's hash covers its fields and the hash before it. */
export async function chain<T extends object>(events: T[]): Promise<{ previous: string; hash: string }[]> {
  const out: { previous: string; hash: string }[] = [];
  let previous = GENESIS;
  for (const e of events) {
    const hash = await sha256(canonical({ ...e, previousHash: previous }));
    out.push({ previous, hash });
    previous = hash;
  }
  return out;
}
