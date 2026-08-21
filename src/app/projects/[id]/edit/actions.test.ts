import { describe, it, expect, vi, beforeEach } from "vitest";

const { getProject, writeProject, deleteProjectDoc, redirect } = vi.hoisted(() => ({
  getProject: vi.fn(),
  writeProject: vi.fn(),
  deleteProjectDoc: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/git/projects", () => ({
  getProject,
  writeProject,
  deleteProject: deleteProjectDoc,
  ConflictError: class ConflictError extends Error {},
}));
vi.mock("@/lib/git/customers", () => ({ readCustomers: vi.fn(), addCustomer: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/current-user", () => ({
  currentAuthor: vi.fn().mockResolvedValue({ name: "Test User", email: "test.user@n-andgroup.com" }),
}));

import { deleteProject } from "./actions";
import { newProject } from "@/lib/schema/project";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

const existing = {
  project: newProject("p-abc23456", "Bike", { by: "Sam", at: "2026-01-01T00:00:00.000Z" }),
  sha: "cur",
};

beforeEach(() => {
  getProject.mockReset();
  deleteProjectDoc.mockReset();
  redirect.mockReset();
});

describe("deleteProject action", () => {
  it("deletes when the typed name matches (trimmed) and redirects home", async () => {
    getProject.mockResolvedValue(existing);
    deleteProjectDoc.mockResolvedValue(true);

    await deleteProject({}, fd({ id: "p-abc23456", confirmName: "  Bike  " }));

    expect(deleteProjectDoc).toHaveBeenCalledWith("p-abc23456", expect.objectContaining({ name: "Test User" }));
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("refuses when the typed name doesn't match", async () => {
    getProject.mockResolvedValue(existing);

    const res = await deleteProject({}, fd({ id: "p-abc23456", confirmName: "Bikes" }));

    expect(res).toEqual({ error: "Type the project name exactly to confirm deletion." });
    expect(deleteProjectDoc).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("errors when the project no longer exists", async () => {
    getProject.mockResolvedValue(null);

    const res = await deleteProject({}, fd({ id: "p-gone2345", confirmName: "Bike" }));

    expect(res).toEqual({ error: "Project not found." });
    expect(deleteProjectDoc).not.toHaveBeenCalled();
  });

  it("requires a project id", async () => {
    const res = await deleteProject({}, fd({ confirmName: "Bike" }));
    expect(res).toEqual({ error: "Missing project id." });
    expect(getProject).not.toHaveBeenCalled();
  });
});
