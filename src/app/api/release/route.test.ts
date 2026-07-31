// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { authFn } = vi.hoisted(() => ({ authFn: vi.fn() }));
vi.mock("@/auth", () => ({ auth: authFn }));

import { GET } from "./route";

const SIGNED_IN = { user: { name: "Test User", email: "test.user@n-andgroup.com" } };

function request(query: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/release${query}`);
}

beforeEach(() => {
  authFn.mockReset();
  authFn.mockResolvedValue(SIGNED_IN);
  // Presigning is local crypto — fake credentials produce a real signed URL.
  vi.stubEnv("COMPASS_RELEASE_BUCKET", "nand-releases");
  vi.stubEnv("AWS_REGION", "eu-west-2");
  vi.stubEnv("AWS_ACCESS_KEY_ID", "AKIATESTTESTTESTTEST");
  vi.stubEnv("AWS_SECRET_ACCESS_KEY", "test-secret-test-secret-test-secret");
});

describe("GET /api/release", () => {
  it("redirects to a short-lived presigned S3 URL for the configured bucket", async () => {
    const res = await GET(request("?key=apollo%2Fv2.2.zip"));
    expect(res.status).toBe(302);
    expect(res.headers.get("cache-control")).toBe("no-store");

    const location = new URL(res.headers.get("location")!);
    expect(location.hostname).toBe("nand-releases.s3.eu-west-2.amazonaws.com");
    expect(location.pathname).toBe("/apollo/v2.2.zip");
    expect(location.searchParams.get("X-Amz-Signature")).toBeTruthy();
    expect(Number(location.searchParams.get("X-Amz-Expires"))).toBeLessThanOrEqual(300);
    expect(location.searchParams.get("response-content-disposition")).toBe(
      'attachment; filename="v2.2.zip"',
    );
  });

  it("returns 401 when there is no session", async () => {
    authFn.mockResolvedValue(null);
    const res = await GET(request("?key=a.zip"));
    expect(res.status).toBe(401);
  });

  it("returns 401 (fails closed) when auth() throws", async () => {
    authFn.mockRejectedValue(new Error("auth not configured"));
    const res = await GET(request("?key=a.zip"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when the release bucket is not configured", async () => {
    vi.stubEnv("COMPASS_RELEASE_BUCKET", "");
    const res = await GET(request("?key=a.zip"));
    expect(res.status).toBe(503);
  });

  it("rejects missing and malformed keys", async () => {
    expect((await GET(request(""))).status).toBe(400);
    expect((await GET(request("?key=..%2Fother.zip"))).status).toBe(400);
  });

  it("redirects folder prefixes to the /release listing page", async () => {
    const folderKey = "treadmill/official/1.0.0 (25.04.2025)/";
    const res = await GET(request(`?key=${encodeURIComponent(folderKey)}`));
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("location")!);
    expect(location.origin).toBe("http://localhost:3000");
    expect(location.pathname).toBe("/release");
    expect(location.searchParams.get("key")).toBe(folderKey);
  });

  it("rejects malformed folder prefixes instead of redirecting", async () => {
    expect((await GET(request("?key=a%2F..%2Fb%2F"))).status).toBe(400);
  });
});
