/**
 * Random, URL-safe project ids: "p-" + 8 chars from a 32-char alphabet
 * (lowercase alphanumerics minus the look-alikes l/o/0/1). The id is opaque
 * and permanent: it names the data-repo file and the URL, while the project
 * name is an ordinary field that can be renamed freely. Keeping the id stable
 * also keeps the per-file commit history reachable (history is fetched by
 * path). 32 divides 256, so `byte % 32` is unbiased; 40 bits of entropy makes
 * collisions negligible at this scale, and creation double-checks the store.
 *
 * The migration script (scripts/migrate-project-ids.mjs) duplicates this
 * alphabet; keep them in step if it ever changes.
 */
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export function randomProjectId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `p-${s}`;
}
