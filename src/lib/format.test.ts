import { describe, it, expect } from "vitest";
import { slugify, initials, relativeTime, sourceLabel } from "@/lib/format";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Apollo Field Unit v2")).toBe("apollo-field-unit-v2");
  });
  it("strips punctuation and collapses separators", () => {
    expect(slugify("Acme / Telemetry!!  Gateway")).toBe("acme-telemetry-gateway");
  });
  it("trims leading/trailing separators", () => {
    expect(slugify("  -Hello-  ")).toBe("hello");
  });
  it("returns empty string for non-alphanumeric input", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("initials", () => {
  it("uses first+last initials for multi-word names", () => {
    expect(initials("Ben Dowding")).toBe("BD");
  });
  it("uses first two letters for a single word", () => {
    expect(initials("Sam")).toBe("SA");
  });
  it("returns ? for empty", () => {
    expect(initials("")).toBe("?");
  });
});

describe("relativeTime", () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  it("says 'just now' for very recent times", () => {
    expect(relativeTime(ago(10_000))).toBe("just now");
  });
  it("formats minutes, hours, and days", () => {
    expect(relativeTime(ago(5 * 60_000))).toBe("5 minutes ago");
    expect(relativeTime(ago(2 * 3_600_000))).toBe("2 hours ago");
    expect(relativeTime(ago(3 * 86_400_000))).toBe("3 days ago");
  });
  it("uses singular with no trailing s", () => {
    expect(relativeTime(ago(60_000))).toBe("1 minute ago");
  });
  it("returns empty string for empty or invalid input", () => {
    expect(relativeTime("")).toBe("");
    expect(relativeTime("not-a-date")).toBe("");
  });
});

describe("sourceLabel", () => {
  it("labels SharePoint hosts", () => {
    expect(sourceLabel("https://nandgroup.sharepoint.com/sites/x/doc")).toBe("SharePoint");
  });
  it("labels git artifact hosts", () => {
    expect(sourceLabel("https://github.com/o/r/releases/download/v1/a.zip")).toBe("Git artifact");
    expect(sourceLabel("https://dev.azure.com/o/p/_artifacts")).toBe("Git artifact");
  });
  it("labels S3 object URLs and s3:// URIs", () => {
    expect(sourceLabel("https://releases.s3.eu-west-2.amazonaws.com/apollo/a.zip")).toBe("S3");
    expect(sourceLabel("https://s3.eu-west-2.amazonaws.com/releases/apollo/a.zip")).toBe("S3");
    expect(sourceLabel("s3://releases/apollo/a.zip")).toBe("S3");
  });
  it("falls back to Link for other hosts and non-URLs", () => {
    expect(sourceLabel("https://example.com/a.zip")).toBe("Link");
    expect(sourceLabel("not a url")).toBe("Link");
  });
});
