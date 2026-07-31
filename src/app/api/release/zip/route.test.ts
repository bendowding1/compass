// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";
import { NextRequest } from "next/server";

const { authFn, listFn, sendFn, getKeys } = vi.hoisted(() => ({
  authFn: vi.fn(),
  listFn: vi.fn(),
  sendFn: vi.fn(),
  getKeys: [] as string[],
}));

vi.mock("@/auth", () => ({ auth: authFn }));
vi.mock("@/lib/release-listing", () => ({ listReleaseFiles: listFn }));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = sendFn;
  },
  GetObjectCommand: class {
    constructor(public input: { Key: string }) {
      getKeys.push(input.Key);
    }
  },
}));

import { GET } from "./route";

const PREFIX = "bike/UI build/official/1.1.0 (11.02.26)/";
const SIGNED_IN = { user: { name: "Test User", email: "test.user@n-andgroup.com" } };

function request(query: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/release/zip${query}`);
}

beforeEach(() => {
  authFn.mockReset().mockResolvedValue(SIGNED_IN);
  listFn.mockReset();
  sendFn.mockReset();
  getKeys.length = 0;
  vi.stubEnv("COMPASS_RELEASE_BUCKET", "panattaversions");
});

describe("GET /api/release/zip", () => {
  it("streams one store-mode zip named after the folder, containing every file", async () => {
    listFn.mockResolvedValue({
      files: [
        { key: `${PREFIX}FMpackage.zip`, name: "FMpackage.zip", size: 3 },
        { key: `${PREFIX}sub/UIupdater.zip`, name: "sub/UIupdater.zip", size: 5 },
      ],
      truncated: false,
    });
    const bodies: Record<string, string> = {
      [`${PREFIX}FMpackage.zip`]: "fm!",
      [`${PREFIX}sub/UIupdater.zip`]: "ui...",
    };
    sendFn.mockImplementation((cmd: { input: { Key: string } }) =>
      Promise.resolve({ Body: Readable.from(Buffer.from(bodies[cmd.input.Key])) }),
    );

    const res = await GET(request(`?key=${encodeURIComponent(PREFIX)}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="1.1.0 (11.02.26).zip"',
    );

    const buf = Buffer.from(await res.arrayBuffer());
    // Zip local-file-header magic, entry names, and raw contents (store mode
    // keeps bytes verbatim) all visible in the stream.
    expect(buf.subarray(0, 4).toString("latin1")).toBe("PK\x03\x04");
    const raw = buf.toString("latin1");
    expect(raw).toContain("FMpackage.zip");
    expect(raw).toContain("sub/UIupdater.zip");
    expect(raw).toContain("fm!");
    expect(raw).toContain("ui...");
    // Files were fetched in listing order, one GetObject per file.
    expect(getKeys).toEqual([`${PREFIX}FMpackage.zip`, `${PREFIX}sub/UIupdater.zip`]);
  });

  it("returns 401 when there is no session", async () => {
    authFn.mockResolvedValue(null);
    expect((await GET(request(`?key=${encodeURIComponent(PREFIX)}`))).status).toBe(401);
    expect(listFn).not.toHaveBeenCalled();
  });

  it("returns 503 when the bucket is not configured", async () => {
    vi.stubEnv("COMPASS_RELEASE_BUCKET", "");
    expect((await GET(request(`?key=${encodeURIComponent(PREFIX)}`))).status).toBe(503);
  });

  it("rejects non-folder and malformed keys", async () => {
    expect((await GET(request("?key=treadmill%2Fofficial"))).status).toBe(400);
    expect((await GET(request("?key=a%2F..%2Fb%2F"))).status).toBe(400);
    expect((await GET(request(""))).status).toBe(400);
  });

  it("returns 404 for an empty folder", async () => {
    listFn.mockResolvedValue({ files: [], truncated: false });
    expect((await GET(request(`?key=${encodeURIComponent(PREFIX)}`))).status).toBe(404);
  });

  it("returns 500 when listing fails", async () => {
    listFn.mockRejectedValue(new Error("credentials expired"));
    expect((await GET(request(`?key=${encodeURIComponent(PREFIX)}`))).status).toBe(500);
  });
});
