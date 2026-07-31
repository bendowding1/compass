import { describe, it, expect } from "vitest";
import { milestoneFromForm } from "@/lib/milestone-input";

function fd(obj: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}
const stamp = { by: "x", at: "2026-01-01T00:00:00.000Z" };

describe("milestoneFromForm", () => {
  it("builds a milestone and omits empty optional fields", () => {
    const m = milestoneFromForm(
      "m1",
      fd({
        name: "Release 2.2",
        "step.Requirements.status": "done",
        "step.Requirements.date": "2026-05-01",
        "step.Build.status": "current",
        "step.Test.status": "upcoming",
        "step.Deploy.status": "upcoming",
      }),
      stamp,
    );
    expect(m.id).toBe("m1");
    expect(m.name).toBe("Release 2.2");
    expect(m.targetDate).toBeUndefined();
    expect(m.releaseUrl).toBeUndefined();
    expect(m.steps.Requirements).toEqual({ status: "done", date: "2026-05-01" });
    expect(m.steps.Build).toEqual({ status: "current" });
    expect(m.updatedBy).toBe("x");
  });

  it("includes target/actual dates and release URL when provided", () => {
    const m = milestoneFromForm(
      "m2",
      fd({
        name: "Release 1.0",
        targetDate: "2026-07-01",
        actualDate: "2026-07-05",
        releaseUrl: "https://sharepoint.example.com/a.zip",
        "step.Requirements.status": "done",
        "step.Build.status": "done",
        "step.Test.status": "done",
        "step.Deploy.status": "done",
      }),
      stamp,
    );
    expect(m.targetDate).toBe("2026-07-01");
    expect(m.actualDate).toBe("2026-07-05");
    expect(m.releaseUrl).toBe("https://sharepoint.example.com/a.zip");
  });

  it("rejects an invalid step status", () => {
    expect(() =>
      milestoneFromForm("m3", fd({ name: "R", "step.Requirements.status": "bogus" }), stamp),
    ).toThrow();
  });
});
