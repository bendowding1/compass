import { TopBar } from "@/components/top-bar";
import { validateReleasePrefix } from "@/lib/release-link";
import { listReleaseFiles } from "@/lib/release-listing";

/**
 * Release folder view: /release?key=<prefix ending in "/">.
 *
 * Releases live in the S3 bucket as versioned folders (e.g.
 * `treadmill/official/1.0.0 (25.04.2025)/`), so a milestone's release link
 * lands here and each file downloads via the SSO-gated /api/release presign
 * redirect. Sign-in is enforced by the proxy matcher like every other page;
 * the download route re-checks the session itself.
 */

export const dynamic = "force-dynamic";

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes;
  let u = -1;
  do {
    v /= 1024;
    u += 1;
  } while (v >= 1024 && u < units.length - 1);
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[u]}`;
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <div className="app frame">
      <TopBar crumb="Release" />
      <div className="head">
        <h1 className="pname">Release</h1>
      </div>
      <div className="empty-box">
        <p>{children}</p>
      </div>
    </div>
  );
}

export default async function ReleasePage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const bucket = process.env.COMPASS_RELEASE_BUCKET;
  if (!bucket) {
    return (
      <Message>
        Release downloads are not configured (<code>COMPASS_RELEASE_BUCKET</code> is unset).
      </Message>
    );
  }

  const prefix = (await searchParams).key ?? "";
  const invalid = validateReleasePrefix(prefix);
  if (invalid) return <Message>{invalid}</Message>;

  let listing;
  try {
    listing = await listReleaseFiles(bucket, prefix);
  } catch (err) {
    console.error("release listing failed:", err);
    return (
      <Message>
        Could not list this release folder — check the AWS credentials and region, then reload.
      </Message>
    );
  }

  // "treadmill/official/1.0.0 (25.04.2025)/" -> "1.0.0 (25.04.2025)"
  const segments = prefix.slice(0, -1).split("/");
  const folderName = segments[segments.length - 1];

  return (
    <div className="app frame">
      <TopBar crumb={`Release / ${folderName}`} />
      <div className="head">
        <h1 className="pname">{folderName}</h1>
      </div>
      <p style={{ color: "var(--faint)", fontSize: 13, margin: "0 0 18px" }}>
        {prefix} — {listing.files.length} file{listing.files.length === 1 ? "" : "s"} in the
        release bucket. Downloads are signed per click.
      </p>

      {listing.files.length > 0 && (
        <div style={{ margin: "0 0 14px" }}>
          {/* One combined zip, named after the folder, streamed store-mode
              through /api/release/zip (see that route for why this one
              doesn't presign+redirect like per-file links). */}
          <a className="btn" href={`/api/release/zip?key=${encodeURIComponent(prefix)}`}>
            <span>{"⤓"}</span> Download all (
            {fmtSize(listing.files.reduce((sum, f) => sum + f.size, 0))} zip)
          </a>
        </div>
      )}

      {listing.files.length === 0 ? (
        <div className="empty-box">
          <p>This release folder is empty (or the folder name has changed in S3).</p>
        </div>
      ) : (
        <div>
          {listing.files.map((f) => (
            <div className="doc" key={f.key}>
              <a className="dt" href={`/api/release?key=${encodeURIComponent(f.key)}`}>
                {f.name}
              </a>
              <span className="src">{fmtSize(f.size)}</span>
              <span className="ext">{"↓"}</span>
            </div>
          ))}
          {listing.truncated && (
            <p style={{ color: "var(--faint)", fontSize: 13, marginTop: 12 }}>
              Showing the first 1000 files — this folder has more.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
