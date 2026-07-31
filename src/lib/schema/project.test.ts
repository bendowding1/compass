import { describe, it, expect } from "vitest";
import {
  ProjectSchema,
  parseProject,
  newProject,
  type Project,
} from "@/lib/schema/project";

function validProject(): Project {
  return {
    schemaVersion: 1,
    id: "proj-1",
    name: "Acme Telemetry",
    customerId: "cust-acme",
    lifecycleStatus: "NPD",
    roles: { PM: "Sam", Development: "Dev", Test: "Tess", Deploy: "Dan", CustomerCare: "Cara" },
    milestones: [
      {
        id: "m1",
        name: "Release 1.0",
        targetDate: "2026-07-01",
        releaseUrl: "https://sharepoint.example.com/release-1.0.zip",
        steps: {
          Requirements: { status: "done", date: "2026-06-01" },
          Build: { status: "current" },
          Test: { status: "upcoming" },
          Deploy: { status: "upcoming" },
        },
        updatedBy: "Sam",
        updatedAt: "2026-06-20T10:00:00.000Z",
      },
    ],
    docLinks: [{ id: "d1", label: "Spec", url: "https://sharepoint.example.com/spec" }],
    archived: false,
    updatedBy: "Sam",
    updatedAt: "2026-06-20T10:00:00.000Z",
  };
}

describe("ProjectSchema — happy path", () => {
  it("parses a fully valid project", () => {
    expect(() => ProjectSchema.parse(validProject())).not.toThrow();
  });

  it("parses a brand-new empty-state project (no milestones, no customer, unassigned roles)", () => {
    const empty = newProject("p2", "New Project", { by: "Sam", at: "2026-06-27T00:00:00.000Z" });
    expect(() => ProjectSchema.parse(empty)).not.toThrow();
    expect(empty.milestones).toHaveLength(0);
    expect(empty.customerId).toBe("");
    expect(empty.roles.Test).toBe("");
  });
});

describe("ProjectSchema — rigidity (D1)", () => {
  it("rejects an unknown top-level field (strictObject)", () => {
    const p = { ...validProject(), surprise: "nope" };
    expect(() => ProjectSchema.parse(p)).toThrow();
  });

  it("rejects an invalid lifecycle status", () => {
    const p = { ...validProject(), lifecycleStatus: "Paused" };
    expect(() => ProjectSchema.parse(p)).toThrow();
  });

  it("rejects an invalid step status", () => {
    const p = validProject();
    // @ts-expect-error — intentionally invalid for the test
    p.milestones[0].steps.Build.status = "blocked";
    expect(() => ProjectSchema.parse(p)).toThrow();
  });

  it("rejects a sixth responsible role (fixed role set)", () => {
    const p = validProject();
    // @ts-expect-error — intentionally extra key
    p.roles.Hardware = "Hank";
    expect(() => ProjectSchema.parse(p)).toThrow();
  });

  it("rejects a fifth milestone step (fixed step set)", () => {
    const p = validProject();
    // @ts-expect-error — intentionally extra step
    p.milestones[0].steps.SignOff = { status: "upcoming" };
    expect(() => ProjectSchema.parse(p)).toThrow();
  });

  it("rejects a missing required field", () => {
    const p = validProject() as Partial<Project>;
    delete p.name;
    expect(() => ProjectSchema.parse(p)).toThrow();
  });

  it("rejects a malformed doc link url", () => {
    const p = validProject();
    p.docLinks[0].url = "not-a-url";
    expect(() => ProjectSchema.parse(p)).toThrow();
  });

  it("rejects a malformed release url", () => {
    const p = validProject();
    p.milestones[0].releaseUrl = "not-a-url";
    expect(() => ProjectSchema.parse(p)).toThrow();
  });

  it("rejects a malformed date", () => {
    const p = validProject();
    p.milestones[0].targetDate = "07/01/2026";
    expect(() => ProjectSchema.parse(p)).toThrow();
  });
});

describe("parseProject — schema version", () => {
  it("parses the current version", () => {
    expect(() => parseProject(validProject())).not.toThrow();
  });

  it("rejects an unknown schema version (no migration yet)", () => {
    const p = { ...validProject(), schemaVersion: 99 };
    expect(() => parseProject(p)).toThrow();
  });
});
