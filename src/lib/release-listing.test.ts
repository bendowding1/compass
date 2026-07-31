import { describe, it, expect, vi, beforeEach } from "vitest";

const { send, listInputs } = vi.hoisted(() => ({
  send: vi.fn(),
  listInputs: [] as unknown[],
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = send;
  },
  ListObjectsV2Command: class {
    constructor(public input: unknown) {
      listInputs.push(input);
    }
  },
}));

import { listReleaseFiles } from "@/lib/release-listing";

const PREFIX = "treadmill/official/1.0.0 (25.04.2025)/";

beforeEach(() => {
  send.mockReset();
  listInputs.length = 0;
});

describe("listReleaseFiles", () => {
  it("lists files under the prefix: drops folder markers, relativizes, sorts", async () => {
    send.mockResolvedValue({
      Contents: [
        { Key: PREFIX, Size: 0 }, // the console's zero-byte folder marker
        { Key: `${PREFIX}setup.exe`, Size: 52_428_800, LastModified: new Date("2025-04-25T09:00:00Z") },
        { Key: `${PREFIX}docs/manual.pdf`, Size: 1_048_576 },
        { Key: `${PREFIX}docs/`, Size: 0 }, // nested folder marker
        { Key: `${PREFIX}CHANGELOG.txt`, Size: 512 },
      ],
      IsTruncated: false,
    });

    const { files, truncated } = await listReleaseFiles("panattaversions", PREFIX);

    expect(listInputs[0]).toEqual({ Bucket: "panattaversions", Prefix: PREFIX });
    expect(truncated).toBe(false);
    expect(files.map((f) => f.name)).toEqual(["CHANGELOG.txt", "docs/manual.pdf", "setup.exe"]);
    expect(files[2]).toEqual({
      key: `${PREFIX}setup.exe`,
      name: "setup.exe",
      size: 52_428_800,
      lastModified: "2025-04-25T09:00:00.000Z",
    });
  });

  it("returns an empty listing and flags truncation", async () => {
    send.mockResolvedValue({ IsTruncated: true });
    const { files, truncated } = await listReleaseFiles("panattaversions", PREFIX);
    expect(files).toEqual([]);
    expect(truncated).toBe(true);
  });
});
