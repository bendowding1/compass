import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Project } from "@/lib/schema/project";

const { readCustomers, renameCustomerInStore, removeCustomer, listAllProjects, getProject, writeProject, redirect } =
  vi.hoisted(() => ({
    readCustomers: vi.fn(),
    renameCustomerInStore: vi.fn(),
    removeCustomer: vi.fn(),
    listAllProjects: vi.fn(),
    getProject: vi.fn(),
    writeProject: vi.fn(),
    redirect: vi.fn(),
  }));

vi.mock("@/lib/git/customers", () => ({
  readCustomers,
  renameCustomer: renameCustomerInStore,
  removeCustomer,
}));
vi.mock("@/lib/git/projects", () => ({ listAllProjects, getProject, writeProject }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/current-user", () => ({
  currentAuthor: vi.fn().mockResolvedValue({ name: "Test User", email: "test.user@n-andgroup.com" }),
}));

import { renameCustomer, deleteCustomer } from "./actions";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

function project(over: Partial<Project> = {}): Project {
  return {
    schemaVersion: 1,
    id: "p-aaaa2222",
    name: "P",
    customerId: "acme",
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

beforeEach(() => {
  readCustomers.mockReset();
  renameCustomerInStore.mockReset();
  removeCustomer.mockReset();
  listAllProjects.mockReset();
  getProject.mockReset();
  writeProject.mockReset();
  redirect.mockReset();
});

describe("renameCustomer action", () => {
  it("renames and redirects back to the customers page", async () => {
    await renameCustomer({}, fd({ id: "acme", name: "Acme Industrial" }));
    expect(renameCustomerInStore).toHaveBeenCalledWith(
      "acme",
      "Acme Industrial",
      expect.objectContaining({ name: "Test User" }),
    );
    expect(redirect).toHaveBeenCalledWith("/customers");
  });

  it("requires a non-empty name", async () => {
    const res = await renameCustomer({}, fd({ id: "acme", name: "   " }));
    expect(res).toEqual({ error: "Customer name is required." });
    expect(renameCustomerInStore).not.toHaveBeenCalled();
  });

  it("surfaces store errors (e.g. duplicate name)", async () => {
    renameCustomerInStore.mockRejectedValue(new Error("A customer named X already exists."));
    const res = await renameCustomer({}, fd({ id: "acme", name: "X" }));
    expect(res).toEqual({ error: "A customer named X already exists." });
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("deleteCustomer action", () => {
  it("deletes an unused customer without touching any project", async () => {
    listAllProjects.mockResolvedValue([project({ customerId: "northwind" })]);

    await deleteCustomer({}, fd({ id: "acme", moveTo: "" }));

    expect(writeProject).not.toHaveBeenCalled();
    expect(removeCustomer).toHaveBeenCalledWith("acme", expect.anything());
    expect(redirect).toHaveBeenCalledWith("/customers");
  });

  it("moves referencing projects (archived included) before removing the customer", async () => {
    readCustomers.mockResolvedValue([
      { id: "acme", name: "Acme" },
      { id: "northwind", name: "Northwind" },
    ]);
    const p1 = project({ id: "p-aaaa2222", customerId: "acme" });
    const p2 = project({ id: "p-bbbb2222", customerId: "acme", archived: true });
    listAllProjects.mockResolvedValue([p1, p2, project({ id: "p-cccc2222", customerId: "northwind" })]);
    getProject
      .mockResolvedValueOnce({ project: p1, sha: "s1" })
      .mockResolvedValueOnce({ project: p2, sha: "s2" });
    writeProject.mockResolvedValue({ sha: "new" });

    await deleteCustomer({}, fd({ id: "acme", moveTo: "northwind" }));

    expect(writeProject).toHaveBeenCalledTimes(2);
    for (const call of writeProject.mock.calls) {
      expect(call[0].customerId).toBe("northwind");
    }
    expect(removeCustomer).toHaveBeenCalledWith("acme", expect.anything());
    expect(redirect).toHaveBeenCalledWith("/customers");
  });

  it("can move projects to no customer at all", async () => {
    const p1 = project({ customerId: "acme" });
    listAllProjects.mockResolvedValue([p1]);
    getProject.mockResolvedValue({ project: p1, sha: "s1" });
    writeProject.mockResolvedValue({ sha: "new" });

    await deleteCustomer({}, fd({ id: "acme", moveTo: "" }));

    expect(writeProject.mock.calls[0][0].customerId).toBe("");
    expect(removeCustomer).toHaveBeenCalled();
  });

  it("rejects an unknown move-to customer", async () => {
    readCustomers.mockResolvedValue([{ id: "acme", name: "Acme" }]);
    const res = await deleteCustomer({}, fd({ id: "acme", moveTo: "ghost" }));
    expect(res).toEqual({ error: "Unknown customer to move projects to." });
    expect(writeProject).not.toHaveBeenCalled();
    expect(removeCustomer).not.toHaveBeenCalled();
  });

  it("rejects moving projects to the customer being deleted", async () => {
    const res = await deleteCustomer({}, fd({ id: "acme", moveTo: "acme" }));
    expect(res).toEqual({ error: "Choose a different customer to move projects to." });
    expect(removeCustomer).not.toHaveBeenCalled();
  });
});
