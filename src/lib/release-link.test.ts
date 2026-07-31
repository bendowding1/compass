import { describe, it, expect } from "vitest";
import {
  parseS3Url,
  validateReleaseKey,
  validateReleasePrefix,
  releaseHrefFor,
} from "@/lib/release-link";

describe("parseS3Url", () => {
  it("parses virtual-hosted URLs (regioned, legacy, dualstack)", () => {
    expect(parseS3Url("https://releases.s3.eu-west-2.amazonaws.com/apollo/v2.2.zip")).toEqual({
      bucket: "releases",
      key: "apollo/v2.2.zip",
    });
    expect(parseS3Url("https://releases.s3.amazonaws.com/a.zip")).toEqual({
      bucket: "releases",
      key: "a.zip",
    });
    expect(parseS3Url("https://releases.s3.dualstack.eu-west-2.amazonaws.com/a.zip")).toEqual({
      bucket: "releases",
      key: "a.zip",
    });
    expect(parseS3Url("https://releases.s3-eu-west-1.amazonaws.com/a.zip")).toEqual({
      bucket: "releases",
      key: "a.zip",
    });
  });

  it("keeps dots in bucket names", () => {
    expect(parseS3Url("https://my.releases.s3.eu-west-2.amazonaws.com/a.zip")).toEqual({
      bucket: "my.releases",
      key: "a.zip",
    });
  });

  it("parses path-style URLs", () => {
    expect(parseS3Url("https://s3.eu-west-2.amazonaws.com/releases/apollo/v2.2.zip")).toEqual({
      bucket: "releases",
      key: "apollo/v2.2.zip",
    });
    expect(parseS3Url("https://s3.amazonaws.com/releases/a.zip")).toEqual({
      bucket: "releases",
      key: "a.zip",
    });
  });

  it("parses s3:// URIs", () => {
    expect(parseS3Url("s3://releases/apollo/v2.2.zip")).toEqual({
      bucket: "releases",
      key: "apollo/v2.2.zip",
    });
  });

  it("decodes percent-encoded keys (what the console copies)", () => {
    expect(parseS3Url("https://releases.s3.eu-west-2.amazonaws.com/apollo%20v2/a%20b.zip")).toEqual(
      { bucket: "releases", key: "apollo v2/a b.zip" },
    );
  });

  it("rejects non-S3 URLs, lookalike hosts, and bucket-only URLs", () => {
    expect(parseS3Url("https://nandgroup.sharepoint.com/doc")).toBeNull();
    expect(parseS3Url("https://releases.s3.eu-west-2.amazonaws.com.evil.com/a.zip")).toBeNull();
    expect(parseS3Url("https://releases.s3.eu-west-2.amazonaws.com/")).toBeNull();
    expect(parseS3Url("https://s3.eu-west-2.amazonaws.com/only-bucket")).toBeNull();
    expect(parseS3Url("not a url")).toBeNull();
  });
});

describe("validateReleaseKey", () => {
  it("accepts a normal key", () => {
    expect(validateReleaseKey("apollo/releases/v2.2.zip")).toBeNull();
  });
  it("rejects empty, oversized, and control-character keys", () => {
    expect(validateReleaseKey("")).toMatch(/missing/i);
    expect(validateReleaseKey("x".repeat(1025))).toMatch(/too long/i);
    expect(validateReleaseKey("a\tb.zip")).toMatch(/control/i);
    expect(validateReleaseKey("a b.zip")).toBeNull(); // spaces are legal in S3 keys
  });
  it("rejects dot, dot-dot, and empty path segments", () => {
    expect(validateReleaseKey("../secrets.zip")).toMatch(/invalid path/i);
    expect(validateReleaseKey("a/./b.zip")).toMatch(/invalid path/i);
    expect(validateReleaseKey("/leading.zip")).toMatch(/invalid path/i);
    expect(validateReleaseKey("a//b.zip")).toMatch(/invalid path/i);
  });
});

describe("release folders (prefix keys)", () => {
  // Real-world shapes: releases are versioned folders, with spaces and
  // parentheses in the version segment — and sometimes in middle segments too.
  const REAL_URI = "s3://panattaversions/treadmill/official/1.0.0 (25.04.2025)/";
  const REAL_URI_2 = "s3://panattaversions/bike/UI build/official/1.1.0 (11.02.26)/";

  it("parses the real folder URI, keeping the trailing slash and spaces", () => {
    expect(parseS3Url(REAL_URI)).toEqual({
      bucket: "panattaversions",
      key: "treadmill/official/1.0.0 (25.04.2025)/",
    });
  });

  it("handles spaces in middle segments (bike/UI build/…)", () => {
    expect(parseS3Url(REAL_URI_2)).toEqual({
      bucket: "panattaversions",
      key: "bike/UI build/official/1.1.0 (11.02.26)/",
    });
    expect(releaseHrefFor(REAL_URI_2, "panattaversions")).toBe(
      "/release?key=bike%2FUI%20build%2Fofficial%2F1.1.0%20(11.02.26)%2F",
    );
    expect(validateReleasePrefix("bike/UI build/official/1.1.0 (11.02.26)/")).toBeNull();
  });

  it("routes folder URIs to the /release listing page", () => {
    expect(releaseHrefFor(REAL_URI, "panattaversions")).toBe(
      "/release?key=treadmill%2Fofficial%2F1.0.0%20(25.04.2025)%2F",
    );
    expect(
      releaseHrefFor(
        "https://panattaversions.s3.eu-west-2.amazonaws.com/treadmill/official/1.0.0%20(25.04.2025)/",
        "panattaversions",
      ),
    ).toBe("/release?key=treadmill%2Fofficial%2F1.0.0%20(25.04.2025)%2F");
  });

  it("validates prefixes: trailing slash required, same segment rules", () => {
    expect(validateReleasePrefix("treadmill/official/1.0.0 (25.04.2025)/")).toBeNull();
    expect(validateReleasePrefix("treadmill/official")).toMatch(/end with/i);
    expect(validateReleasePrefix("a/../b/")).toMatch(/invalid path/i);
    expect(validateReleasePrefix("/")).toMatch(/missing/i);
  });
});

describe("releaseHrefFor", () => {
  const BUCKET = "nand-releases";

  it("rewrites configured-bucket S3 URLs to the download route", () => {
    expect(
      releaseHrefFor(`https://${BUCKET}.s3.eu-west-2.amazonaws.com/apollo/v2.2.zip`, BUCKET),
    ).toBe("/api/release?key=apollo%2Fv2.2.zip");
    expect(releaseHrefFor(`s3://${BUCKET}/apollo/v2.2.zip`, BUCKET)).toBe(
      "/api/release?key=apollo%2Fv2.2.zip",
    );
  });

  it("leaves other buckets, other hosts, and bad keys untouched", () => {
    const otherBucket = "https://other.s3.eu-west-2.amazonaws.com/a.zip";
    const sharepoint = "https://nandgroup.sharepoint.com/doc";
    expect(releaseHrefFor(otherBucket, BUCKET)).toBe(otherBucket);
    expect(releaseHrefFor(sharepoint, BUCKET)).toBe(sharepoint);
    const dotDot = `https://${BUCKET}.s3.eu-west-2.amazonaws.com/..%2Fa.zip`;
    expect(releaseHrefFor(dotDot, BUCKET)).toBe(dotDot);
  });

  it("leaves everything untouched when no bucket is configured", () => {
    const url = "https://x.s3.eu-west-2.amazonaws.com/a.zip";
    expect(releaseHrefFor(url, undefined)).toBe(url);
    expect(releaseHrefFor(url, "")).toBe(url);
  });
});
