import { describe, it, expect } from "vitest";
import { isMilestoneLate, weeksLate, slipLabel } from "@/lib/slip";
import type { Milestone } from "@/lib/schema/project";

function milestone(over: Partial<Milestone> = {}): Milestone {
  return {
    id: "m",
    name: "Release",
    targetDate: "2026-06-01",
    steps: {
      Requirements: { status: "done" },
      Build: { status: "current" },
      Test: { status: "upcoming" },
      Deploy: { status: "upcoming" },
    },
    updatedBy: "Sam",
    updatedAt: "2026-06-20T10:00:00.000Z",
    ...over,
  };
}

const NOW = new Date("2026-06-16T12:00:00.000Z"); // 15 days after 2026-06-01

describe("isMilestoneLate", () => {
  it("is late when the target date passed and it is not delivered", () => {
    expect(isMilestoneLate(milestone(), NOW)).toBe(true);
  });

  it("is not late on the exact target date (boundary, not yet passed)", () => {
    expect(isMilestoneLate(milestone({ targetDate: "2026-06-16" }), NOW)).toBe(false);
  });

  it("is not late when delivered via an actual date, even if past target", () => {
    expect(isMilestoneLate(milestone({ actualDate: "2026-06-10" }), NOW)).toBe(false);
  });

  it("is not late when every step is done, even if past target", () => {
    const done = milestone({
      steps: {
        Requirements: { status: "done" },
        Build: { status: "done" },
        Test: { status: "done" },
        Deploy: { status: "done" },
      },
    });
    expect(isMilestoneLate(done, NOW)).toBe(false);
  });

  it("is not late when there is no target date", () => {
    expect(isMilestoneLate(milestone({ targetDate: undefined }), NOW)).toBe(false);
  });

  it("is timezone-stable: the day boundary is computed in UTC", () => {
    const m = milestone({ targetDate: "2026-06-10" });
    expect(isMilestoneLate(m, new Date("2026-06-10T23:59:59.000Z"))).toBe(false); // same UTC day
    expect(isMilestoneLate(m, new Date("2026-06-11T00:00:01.000Z"))).toBe(true); // next UTC day
  });
});

describe("weeksLate / slipLabel", () => {
  it("floors days-late into whole weeks", () => {
    expect(weeksLate(milestone(), NOW)).toBe(2); // 15 days -> 2 weeks
  });

  it("labels a late milestone", () => {
    expect(slipLabel(milestone(), NOW)).toBe("late 2w");
  });

  it("returns null when not late", () => {
    expect(slipLabel(milestone({ actualDate: "2026-06-01" }), NOW)).toBeNull();
  });

  it("labels a freshly-late milestone (<1 week) as 'late'", () => {
    expect(slipLabel(milestone({ targetDate: "2026-06-13" }), NOW)).toBe("late"); // 3 days
  });
});
