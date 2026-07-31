import "server-only";

/**
 * Tiny in-process read cache with a short TTL, cleared on every write. Reduces
 * redundant git-API calls for the expensive reads (project list, customers)
 * without risking read-your-writes: a write clears the cache, so the next read
 * is fresh. (In serverless this is per-instance; a write on one instance is
 * reflected elsewhere within the TTL. Fine at internal scale.)
 */

type Entry = { value: unknown; expires: number };

const store = new Map<string, Entry>();
const TTL_MS = 30_000;

export async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await fn();
  store.set(key, { value, expires: Date.now() + TTL_MS });
  return value;
}

export function clearCache(): void {
  store.clear();
}
