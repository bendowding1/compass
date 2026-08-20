import { describe, it, expect, vi, beforeEach } from "vitest";

const { getProject, writeProject, readCustomers, addCustomer, redirect } = vi.hoisted(() => ({
  getProject: vi.fn(),
  writeProject: vi.fn(),
  readCustomers: vi.fn(),
  addCustomer: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/git/projects", () => ({ getProject, writeProject }));
vi.mock("@/lib/git/customers", () => ({ readCustomers, addCustomer }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/current-user", () => ({
  currentAuthor: vi.fn().mockResolvedValue({ name: "Test User", email: "test.user@n-andgroup.com" }),
}));

import { createProject } from "./actions";

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

beforeEach(() => {
  getProject.mockReset();
  writeProject.mockReset();
  readCustomers.mockReset();
  addCustomer.mockReset();
  redirect.mockReset();
});

describe("createProject action", () => {
  it("creates with an existing customer and redirects to the new project", async () => {
    readCustomers.mockResolvedValue([{ id: "cust-acme", name: "Acme" }]);
    getProject.mockResolvedValue(null); // the random id is free
    writeProject.mockResolvedValue({ sha: "s" });

    await createProject({}, fd({ name: "New Thing", customerId: "cust-acme", lifecycleStatus: "NPD" }));

    expect(writeProject).toHaveBeenCalledTimes(1);
    const [proj] = writeProject.mock.calls[0];
    expect(proj.id).toMatch(/^p-[a-z0-9]{8}$/); // opaque id, not derived from the name
    expect(proj.name).toBe("New Thing");
    expect(proj.customerId).toBe("cust-acme");
    expect(proj.lifecycleStatus).toBe("NPD");
    expect(redirect).toHaveBeenCalledWith(`/projects/${proj.id}`);
  });

  it("regenerates the id if it is already taken", async () => {
    readCustomers.mockResolvedValue([{ id: "cust-acme", name: "Acme" }]);
    getProject
      .mockResolvedValueOnce({ project: {}, sha: "x" }) // first candidate collides
      .mockResolvedValue(null);
    writeProject.mockResolvedValue({ sha: "s" });

    await createProject({}, fd({ name: "New Thing", customerId: "cust-acme", lifecycleStatus: "NPD" }));

    expect(getProject).toHaveBeenCalledTimes(2);
    const [proj] = writeProject.mock.calls[0];
    expect(proj.id).toMatch(/^p-[a-z0-9]{8}$/);
    expect(proj.id).not.toBe(getProject.mock.calls[0][0]); // not the colliding one
  });

  it("requires a name", async () => {
    const res = await createProject({}, fd({ name: "   " }));
    expect(res).toEqual({ error: "Project name is required." });
    expect(writeProject).not.toHaveBeenCalled();
  });

  it("rejects an unknown customer", async () => {
    readCustomers.mockResolvedValue([{ id: "cust-acme", name: "Acme" }]);
    const res = await createProject({}, fd({ name: "X", customerId: "ghost", lifecycleStatus: "NPD" }));
    expect(res).toEqual({ error: "Unknown customer." });
    expect(writeProject).not.toHaveBeenCalled();
  });

  it("adds a brand-new customer inline and uses its id", async () => {
    addCustomer.mockResolvedValue({ id: "globex", name: "Globex" });
    getProject.mockResolvedValue(null);
    writeProject.mockResolvedValue({ sha: "s" });

    await createProject({}, fd({ name: "X", newCustomerName: "Globex", lifecycleStatus: "NPD" }));

    expect(addCustomer).toHaveBeenCalledWith("Globex", expect.anything());
    const [proj] = writeProject.mock.calls[0];
    expect(proj.customerId).toBe("globex");
  });
});
