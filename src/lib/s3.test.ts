// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { releaseS3Client } from "@/lib/s3";

// Resolved credentials may be a static object or a provider function
// depending on how the SDK normalized them.
async function resolvedCredentials(client: ReturnType<typeof releaseS3Client>) {
  const creds = client.config.credentials;
  return typeof creds === "function" ? await creds() : creds;
}

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("releaseS3Client", () => {
  it("uses the COMPASS_AWS_* vars when set (Vercel reserves the AWS_* names)", async () => {
    vi.stubEnv("COMPASS_AWS_REGION", "eu-west-2");
    vi.stubEnv("COMPASS_AWS_ACCESS_KEY_ID", "AKIACOMPASSCOMPASS00");
    vi.stubEnv("COMPASS_AWS_SECRET_ACCESS_KEY", "compass-secret-compass-secret");
    // Standard names must lose to the COMPASS_ ones when both are present.
    vi.stubEnv("AWS_REGION", "us-east-1");

    const client = releaseS3Client();
    expect(await client.config.region()).toBe("eu-west-2");
    expect((await resolvedCredentials(client))?.accessKeyId).toBe("AKIACOMPASSCOMPASS00");
  });

  it("falls back to the SDK default chain (standard AWS_* names) when unset", async () => {
    vi.stubEnv("COMPASS_AWS_REGION", "");
    vi.stubEnv("COMPASS_AWS_ACCESS_KEY_ID", "");
    vi.stubEnv("COMPASS_AWS_SECRET_ACCESS_KEY", "");
    vi.stubEnv("AWS_REGION", "eu-west-1");
    vi.stubEnv("AWS_ACCESS_KEY_ID", "AKIASTANDARDSTAND000");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "standard-secret-standard-secret");

    const client = releaseS3Client();
    expect(await client.config.region()).toBe("eu-west-1");
    expect((await resolvedCredentials(client))?.accessKeyId).toBe("AKIASTANDARDSTAND000");
  });
});
