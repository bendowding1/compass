import { describe, it, expect } from "vitest";
import { randomProjectId } from "./id";

describe("randomProjectId", () => {
  it("matches the p-xxxxxxxx shape", () => {
    for (let i = 0; i < 50; i++) {
      expect(randomProjectId()).toMatch(/^p-[a-z0-9]{8}$/);
    }
  });

  it("never uses the ambiguous characters l, o, 0, 1", () => {
    for (let i = 0; i < 50; i++) {
      expect(randomProjectId()).not.toMatch(/[lo01]/);
    }
  });

  it("does not repeat in a small sample", () => {
    const ids = new Set(Array.from({ length: 200 }, randomProjectId));
    expect(ids.size).toBe(200);
  });
});
