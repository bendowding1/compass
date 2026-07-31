import { S3Client } from "@aws-sdk/client-s3";

/**
 * S3 client for the release bucket. Region + credentials come from the
 * COMPASS_AWS_* env vars, passed explicitly because Vercel reserves the
 * standard AWS_* names (its own runtime sets them, so a project can't).
 * Where the COMPASS_ vars are unset (local dev, tests), construction falls
 * through to the SDK's default provider chain, which does read the standard
 * AWS_* names — so either naming works off Vercel.
 */
export function releaseS3Client(): S3Client {
  const region = process.env.COMPASS_AWS_REGION;
  const accessKeyId = process.env.COMPASS_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.COMPASS_AWS_SECRET_ACCESS_KEY;
  return new S3Client({
    ...(region ? { region } : {}),
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
  });
}
