/**
 * Release downloads via S3 (presign-and-redirect).
 *
 * The release bucket is private, so a raw S3 URL on a milestone would 403 for
 * everyone. Instead, when `COMPASS_RELEASE_BUCKET` is configured and a
 * milestone's releaseUrl points at that bucket, the card links to
 * `/api/release?key=<object-key>` — an SSO-gated route that mints a short-lived
 * presigned URL and redirects (see src/app/api/release/route.ts). PMs keep
 * pasting whatever the S3 console gives them; Compass makes it clickable for
 * every signed-in employee. Non-S3 URLs (SharePoint, git hosts) are untouched.
 *
 * Deliberately key-based, never URL-based: the route accepts a bucket-relative
 * object key and the bucket comes from env, so the app can't be steered into
 * fetching arbitrary URLs with its AWS credentials.
 */

export type S3ObjectRef = { bucket: string; key: string };

/**
 * Parse an S3 object URL into { bucket, key }, or null if it isn't one.
 * Accepts the forms people actually paste:
 *   - virtual-hosted: https://<bucket>.s3.<region>.amazonaws.com/<key> (also
 *     legacy no-region, `s3-<region>`, and dualstack hosts)
 *   - path-style:     https://s3.<region>.amazonaws.com/<bucket>/<key>
 *   - URI:            s3://<bucket>/<key>
 */
export function parseS3Url(raw: string): S3ObjectRef | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol === "s3:") {
    const key = keyFromPath(url.pathname);
    return url.hostname && key ? { bucket: url.hostname, key } : null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase();

  const virtualHosted = host.match(/^(.+)\.s3(?:[.-][a-z0-9.-]+)?\.amazonaws\.com$/);
  if (virtualHosted) {
    const key = keyFromPath(url.pathname);
    return key ? { bucket: virtualHosted[1], key } : null;
  }

  if (/^s3(?:[.-][a-z0-9.-]+)?\.amazonaws\.com$/.test(host)) {
    const path = keyFromPath(url.pathname);
    const slash = path?.indexOf("/") ?? -1;
    if (path && slash > 0 && slash < path.length - 1) {
      return { bucket: path.slice(0, slash), key: path.slice(slash + 1) };
    }
    return null;
  }

  return null;
}

/** "/releases/a%20b.zip" -> "releases/a b.zip"; null when empty or undecodable. */
function keyFromPath(pathname: string): string | null {
  const p = pathname.replace(/^\/+/, "");
  if (!p) return null;
  try {
    return decodeURIComponent(p);
  } catch {
    return null;
  }
}

/**
 * Validate a bucket-relative object key from the query string. S3 keys are
 * flat names (no directory semantics), so this is hygiene, not traversal
 * defence — but it keeps junk out and stays safe if a prefix rule is added.
 * Returns an error message, or null when the key is acceptable.
 */
export function validateReleaseKey(key: string): string | null {
  if (!key) return "Missing release key.";
  if (key.length > 1024) return "Release key is too long.";
  if (/[\u0000-\u001f\u007f]/.test(key)) return "Release key contains control characters.";
  if (key.split("/").some((seg) => seg === "" || seg === "." || seg === "..")) {
    return "Release key contains an invalid path segment.";
  }
  return null;
}

/**
 * Releases are usually whole folders (e.g.
 * `s3://panattaversions/treadmill/official/1.0.0 (25.04.2025)/`): a prefix is
 * a key that ends with "/" and whose segments follow the same rules.
 */
export function validateReleasePrefix(prefix: string): string | null {
  if (!prefix.endsWith("/")) return "Release folder must end with '/'.";
  return validateReleaseKey(prefix.slice(0, -1));
}

/**
 * The href a release link should render with. S3 URLs for the configured
 * bucket route through Compass: objects to the /api/release presign redirect,
 * folder prefixes (trailing "/") to the /release file-listing page. Everything
 * else (SharePoint, git hosts, other buckets, or no bucket configured) renders
 * as-is.
 */
export function releaseHrefFor(url: string, bucket: string | undefined): string {
  if (!bucket) return url;
  const ref = parseS3Url(url);
  if (!ref || ref.bucket !== bucket) return url;
  if (ref.key.endsWith("/")) {
    if (validateReleasePrefix(ref.key) !== null) return url;
    return `/release?key=${encodeURIComponent(ref.key)}`;
  }
  if (validateReleaseKey(ref.key) !== null) return url;
  return `/api/release?key=${encodeURIComponent(ref.key)}`;
}

/** releaseHrefFor against the configured bucket (server components only). */
export function releaseHref(url: string): string {
  return releaseHrefFor(url, process.env.COMPASS_RELEASE_BUCKET);
}

/** Reduce a name to characters safe inside a quoted Content-Disposition
 *  filename (keeps spaces, dots, parens — the release-folder alphabet). */
export function contentDispositionFilename(raw: string, fallback: string): string {
  const safe = raw.replace(/[^\w. ()-]/g, "_").trim();
  return safe || fallback;
}
