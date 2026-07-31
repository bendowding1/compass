import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Project } from "@/lib/schema/project";

// server-only throws when imported outside an RSC bundle; stub it for the test.
vi.mock("server-only", () => ({}));

const getContent = vi.fn();
const createOrUpdateFileContents = vi.fn();
const listCommits = vi.fn();

vi.mock("@/lib/git/client", () => ({
  gitConfig: () => ({ owner: "o", repo: "r" }),
  octokit: () => ({ rest: { repos: { getContent, createOrUpdateFileContents, listCommits } } }),
  isNotFound: (e: { status?: number }) => e?.status === 404,
  isConflict: (e: { status?: number }) => e?.status === 409,
}));
vi.mock("@/lib/git/customers", () => ({
  readCustomers: vi.fn(async () => [{ id: "cust-acme", name: "Acme" }]),
}));

import {
  getProject,
  listProjects,
  writeProject,
  getProjectHistory,
  ConflictError,
} from "@/lib/git/projects";
import { clearCache } from "@/lib/git/cache";

function project(over: Partial<Project> = {}): Project {
  return {
    schemaVersion: 1,
    id: "p1",
    name: "P1",
    customerId: "cust-acme",
    lifecycleStatus: "NPD",
    roles: { PM: "", Development: "", Test: "", Deploy: "", CustomerCare: "" },
    milestones: [],
    docLinks: [],
    archived: false,
    updatedBy: "x",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}
const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj), "utf8").toString("base64");

beforeEach(() => {
  getContent.mockReset();
  createOrUpdateFileContents.mockReset();
  listCommits.mockReset();
  clearCache();
});

describe("git projects adapter", () => {
  it("getProject decodes, validates, and returns content + sha", async () => {
    getContent.mockResolvedValue({ data: { type: "file", sha: "abc", content: b64(project()) } });
    const r = await getProject("p1");
    expect(r?.sha).toBe("abc");
    expect(r?.project.name).toBe("P1");
  });

  it("getProject returns null on 404", async () => {
    getContent.mockRejectedValue({ status: 404 });
    expect(await getProject("missing")).toBeNull();
  });

  it("listProjects lists the dir, loads each, ignores non-json, and filters archived", async () => {
    getContent
      .mockResolvedValueOnce({
        data: [
          { type: "file", name: "a.json" },
          { type: "file", name: "b.json" },
          { type: "file", name: "README.md" },
        ],
      })
      .mockResolvedValueOnce({ data: { type: "file", sha: "1", content: b64(project({ id: "a", name: "A" })) } })
      .mockResolvedValueOnce({ data: { type: "file", sha: "2", content: b64(project({ id: "b", name: "B", archived: true })) } });
    const list = await listProjects();
    expect(list.map((p) => p.name)).toEqual(["A"]);
  });

  it("writeProject sends base64 content with the expected sha and returns the new sha", async () => {
    createOrUpdateFileContents.mockResolvedValue({ data: { content: { sha: "new" } } });
    const r = await writeProject(project(), "old", { name: "n", email: "e" });
    expect(r.sha).toBe("new");
    const arg = createOrUpdateFileContents.mock.calls[0][0];
    expect(arg.sha).toBe("old");
    expect(Buffer.from(arg.content, "base64").toString("utf8")).toContain('"id": "p1"');
  });

  it("writeProject maps a 409 to ConflictError (optimistic lock)", async () => {
    createOrUpdateFileContents.mockRejectedValue({ status: 409 });
    await expect(writeProject(project(), "stale", { name: "n", email: "e" })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("writeProject rejects an unknown customer", async () => {
    await expect(
      writeProject(project({ customerId: "ghost" }), undefined, { name: "n", email: "e" }),
    ).rejects.toThrow(/unknown customer/i);
  });

  it("getProjectHistory maps commits to entries (first line, author, date)", async () => {
    listCommits.mockResolvedValue({
      data: [
        {
          sha: "abc1234567",
          commit: {
            message: "update p1: P1\n\nbody",
            author: { name: "Sam", date: "2026-06-20T10:00:00Z" },
          },
        },
      ],
    });
    const h = await getProjectHistory("p1");
    expect(h).toEqual([
      { sha: "abc1234567", message: "update p1: P1", author: "Sam", date: "2026-06-20T10:00:00Z" },
    ]);
  });
});
