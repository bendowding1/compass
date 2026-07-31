import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import { cached, clearCache } from "@/lib/git/cache";

beforeEach(() => clearCache());

describe("read cache", () => {
  it("caches the value within TTL (fn runs once)", async () => {
    const fn = vi.fn(async () => "v");
    expect(await cached("k", fn)).toBe("v");
    expect(await cached("k", fn)).toBe("v");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("clearCache forces a refetch", async () => {
    const fn = vi.fn(async () => "x");
    await cached("k2", fn);
    clearCache();
    await cached("k2", fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("keys are independent", async () => {
    const a = vi.fn(async () => "a");
    const b = vi.fn(async () => "b");
    expect(await cached("ka", a)).toBe("a");
    expect(await cached("kb", b)).toBe("b");
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
