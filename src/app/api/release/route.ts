import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { auth } from "@/auth";
import { releaseS3Client } from "@/lib/s3";
import {
  validateReleaseKey,
  validateReleasePrefix,
  contentDispositionFilename,
} from "@/lib/release-link";

/**
 * SSO-gated release download: GET /api/release?key=<bucket-relative-key>.
 *
 * The release bucket is private; this route is what makes its objects
 * clickable for signed-in employees. It mints a short-lived presigned GET URL
 * and 302-redirects, so the download goes browser -> S3 directly — big release
 * zips never stream through the app. Presigning is local crypto (no AWS round
 * trip), and the AWS key never leaves the server.
 *
 * Two auth layers, same as the server actions: the proxy matcher already
 * bounces no-session requests to sign-in (src/proxy.ts), and this handler
 * re-checks so the route stays closed even if the matcher changes. It fails
 * closed (401) when auth is unavailable — the opposite of currentAuthor()'s
 * fallback, because handing out files is not like attributing a commit.
 *
 * The bucket comes from env, never the request: this route can only ever sign
 * for COMPASS_RELEASE_BUCKET, so it can't be steered into proxying arbitrary
 * URLs with the app's credentials.
 */

/** Presigned URL lifetime. Only needs to outlive the redirect hop; short so a
 *  copied Location header goes stale fast. The stable, shareable link is this
 *  route itself. */
const EXPIRES_SECONDS = 300;

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

  const key = req.nextUrl.searchParams.get("key") ?? "";

  // Folder prefix (releases are versioned folders of files): hand off to the
  // /release listing page rather than presigning a non-object.
  if (key.endsWith("/")) {
    const invalidPrefix = validateReleasePrefix(key);
    if (invalidPrefix) {
      return new NextResponse(invalidPrefix, { status: 400 });
    }
    return NextResponse.redirect(
      new URL(`/release?key=${encodeURIComponent(key)}`, req.nextUrl),
      302,
    );
  }

  const invalid = validateReleaseKey(key);
  if (invalid) {
    return new NextResponse(invalid, { status: 400 });
  }

  try {
    const s3 = releaseS3Client();
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${contentDispositionFilename(key.split("/").pop() ?? "", "download")}"`,
      }),
      { expiresIn: EXPIRES_SECONDS },
    );
    return NextResponse.redirect(url, {
      status: 302,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("release presign failed:", err);
    return new NextResponse(
      "Could not create the download link — check the AWS credentials and region.",
      { status: 500 },
    );
  }
}
