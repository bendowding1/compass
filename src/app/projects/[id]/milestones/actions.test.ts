import { describe, it, expect, vi, beforeEach } from "vitest";

const { getProject, writeProject, redirect } = vi.hoisted(() => ({
  getProject: vi.fn(),
  writeProject: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/git/projects", () => ({
  getProject,
  writeProject,
  ConflictError: class ConflictError extends Error {},
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/current-user", () => ({
  currentAuthor: vi.fn().mockResolvedValue({ name: "Test User", email: "test.user@n-andgroup.com" }),
}));

import { addMilestone, deleteMilestone } from "./actions";
import { ConflictError } from "@/lib/git/projects";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

const project = (over: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  id: "p1",
  name: "P1",
  customerId: "",
  lifecycleStatus: "NPD",
  roles: { PM: "", Development: "", Test: "", Deploy: "", CustomerCare: "" },
  milestones: [],
  docLinks: [],
  archived: false,
  updatedBy: "x",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

beforeEach(() => {
  getProject.mockReset();
  writeProject.mockReset();
  redirect.mockReset();
});

describe("milestone actions", () => {
  it("addMilestone appends the milestone (slug id) and redirects", async () => {
    getProject.mockResolvedValue({ project: project(), sha: "sha1" });
    writeProject.mockResolvedValue({ sha: "sha2" });

    await addMilestone({}, fd({ projectId: "p1", sha: "sha1", name: "Pilot Release" }));

    expect(writeProject).toHaveBeenCalledTimes(1);
    const [proj, sha] = writeProject.mock.calls[0];
    expect(proj.milestones).toHaveLength(1);
    expect(proj.milestones[0].name).toBe("Pilot Release");
    expect(proj.milestones[0].id).toBe("pilot-release");
    expect(sha).toBe("sha1");
    expect(redirect).toHaveBeenCalledWith("/projects/p1");
  });

  it("addMilestone requires a name", async () => {
    const res = await addMilestone({}, fd({ projectId: "p1", sha: "s" }));
    expect(res).toEqual({ error: "Milestone name is required." });
    expect(writeProject).not.toHaveBeenCalled();
  });

  it("deleteMilestone removes the milestone and redirects", async () => {
    getProject.mockResolvedValue({
      project: project({ milestones: [{ id: "m1", name: "M1" }] }),
      sha: "sha1",
    });
    writeProject.mockResolvedValue({ sha: "sha2" });

    await deleteMilestone({}, fd({ projectId: "p1", milestoneId: "m1", sha: "sha1" }));

    const [proj] = writeProject.mock.calls[0];
    expect(proj.milestones).toHaveLength(0);
    expect(redirect).toHaveBeenCalledWith("/projects/p1");
  });

  it("deleteMilestone errors when the milestone is missing", async () => {
    getProject.mockResolvedValue({ project: project({ milestones: [] }), sha: "s" });
    const res = await deleteMilestone({}, fd({ projectId: "p1", milestoneId: "ghost", sha: "s" }));
    expect(res).toEqual({ error: "Milestone not found." });
    expect(writeProject).not.toHaveBeenCalled();
  });

  it("deleteMilestone maps a ConflictError to a reload message", async () => {
    getProject.mockResolvedValue({
      project: project({ milestones: [{ id: "m1", name: "M1" }] }),
      sha: "s",
    });
    writeProject.mockRejectedValue(new ConflictError());
    const res = await deleteMilestone({}, fd({ projectId: "p1", milestoneId: "m1", sha: "s" }));
    expect(res?.error).toMatch(/changed since you opened it/i);
  });
});
