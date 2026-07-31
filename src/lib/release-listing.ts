import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { releaseS3Client } from "@/lib/s3";

/**
 * List the files inside a release folder (S3 prefix). Backs the /release page:
 * releases live in the bucket as versioned folders of files (installer,
 * firmware, docs…), so the milestone link opens a listing and each file
 * downloads through the /api/release presign redirect.
 *
 * One unpaginated ListObjectsV2 call (first 1000 keys) — release folders are
 * small; `truncated` tells the page to say so rather than silently cap.
 */

export type ReleaseFile = {
  key: string;
  /** Path relative to the folder — nested files show as "sub/dir/file.bin". */
  name: string;
  size: number;
  lastModified?: string;
};

export type ReleaseListing = { files: ReleaseFile[]; truncated: boolean };

export async function listReleaseFiles(bucket: string, prefix: string): Promise<ReleaseListing> {
  const s3 = releaseS3Client();
  const out = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
  const files = (out.Contents ?? [])
    // Drop the zero-byte "folder marker" the console creates, and any nested markers.
    .filter((o) => o.Key && o.Key !== prefix && !o.Key.endsWith("/"))
    .map((o) => ({
      key: o.Key as string,
      name: (o.Key as string).slice(prefix.length),
      size: o.Size ?? 0,
      lastModified: o.LastModified?.toISOString(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { files, truncated: !!out.IsTruncated };
}
