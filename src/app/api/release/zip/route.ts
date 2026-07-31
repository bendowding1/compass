import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import archiver from "archiver";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/auth";
import { releaseS3Client } from "@/lib/s3";
import { validateReleasePrefix, contentDispositionFilename } from "@/lib/release-link";
import { listReleaseFiles } from "@/lib/release-listing";

/**
 * Download a whole release folder as one zip:
 * GET /api/release/zip?key=<prefix ending in "/">.
 *
 * Unlike single-file downloads (presign + redirect, S3 → browser directly),
 * a combined zip has to be assembled somewhere, so this one route does stream
 * through the app. It stays cheap anyway:
 *
 * - **store mode** — the release files are already .zip; no recompression,
 *   so the work per byte is a copy, not CPU.
 * - **constant memory** — files are fetched from S3 one at a time, and each
 *   S3 body is piped straight into the archive. The next GetObject isn't
 *   issued until the previous entry finishes, so no socket sits idle for
 *   minutes under a multi-GB entry (S3 kills idle sockets).
 * - **no Content-Length** — the total isn't knowable up front (zip framing);
 *   the response is chunked and the archive is zip64-capable for >4 GB.
 *
 * Same auth posture as /api/release: gate re-checked here, fails closed.
 */

// The one long-running route: the function lives for as long as the download
// streams. 300 s is Vercel's ceiling on every plan with Fluid compute (Pro can
// raise it to 800); a zip cut off at the cap is the known trade-off for huge
// releases — per-file links are unaffected (browser downloads S3-direct).
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  let signedIn = false;
  try {
    signedIn = !!(await auth())?.user;
  } catch {
    // Auth unconfigured/unavailable — fall through to 401 (fail closed).
  }
  if (!signedIn) {
    return new NextResponse("Sign-in required.", { status: 401 });
  }

  const bucket = process.env.COMPASS_RELEASE_BUCKET;
  if (!bucket) {
    return new NextResponse(
      "Release downloads are not configured (COMPASS_RELEASE_BUCKET is unset).",
      { status: 503 },
    );
  }

  const prefix = req.nextUrl.searchParams.get("key") ?? "";
  const invalid = validateReleasePrefix(prefix);
  if (invalid) {
    return new NextResponse(invalid, { status: 400 });
  }

  let files;
  try {
    ({ files } = await listReleaseFiles(bucket, prefix));
  } catch (err) {
    console.error("release zip listing failed:", err);
    return new NextResponse(
      "Could not list the release folder — check the AWS credentials and region.",
      { status: 500 },
    );
  }
  if (files.length === 0) {
    return new NextResponse("This release folder is empty.", { status: 404 });
  }

  const segments = prefix.slice(0, -1).split("/");
  const zipName = contentDispositionFilename(segments[segments.length - 1], "release") + ".zip";

  const archive = archiver("zip", { store: true });
  archive.on("error", (err) => {
    console.error("release zip stream failed:", err);
  });
  // Browser cancelled the download → stop pulling from S3.
  req.signal.addEventListener("abort", () => archive.destroy(new Error("client aborted")));

  const s3 = releaseS3Client();
  // Feed entries sequentially in the background while the Response streams.
  void (async () => {
    try {
      for (const f of files) {
        const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: f.key }));
        const entryDone = new Promise<void>((resolve, reject) => {
          archive.once("entry", () => resolve());
          archive.once("error", reject);
        });
        archive.append(obj.Body as Readable, { name: f.name });
        await entryDone;
      }
      await archive.finalize();
    } catch (err) {
      if (!req.signal.aborted) console.error("release zip assembly failed:", err);
      archive.destroy(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return new NextResponse(Readable.toWeb(archive) as ReadableStream<Uint8Array>, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}"`,
      "Cache-Control": "no-store",
    },
  });
}
