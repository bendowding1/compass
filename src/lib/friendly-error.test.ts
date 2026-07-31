import { describe, it, expect } from "vitest";
import { z } from "zod";
import { friendlyError } from "@/lib/friendly-error";

describe("friendlyError", () => {
  it("maps a URL Zod issue to a clear https hint", () => {
    const r = z.url().safeParse("not-a-url");
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(friendlyError(r.error, "fallback")).toMatch(/https:\/\//);
    }
  });

  it("uses the fallback for other Zod issues, never raw JSON", () => {
    const r = z.string().min(5).safeParse("x");
    if (!r.success) {
      expect(friendlyError(r.error, "Friendly fallback")).toBe("Friendly fallback");
    }
  });

  it("passes through a plain Error message", () => {
    expect(friendlyError(new Error("Unknown customer: ghost"), "fb")).toBe("Unknown customer: ghost");
  });

  it("uses the fallback for non-error values", () => {
    expect(friendlyError("weird", "fb")).toBe("fb");
  });
});
