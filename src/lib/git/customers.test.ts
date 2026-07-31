import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const getContent = vi.fn();
const createOrUpdateFileContents = vi.fn();

vi.mock("@/lib/git/client", () => ({
  gitConfig: () => ({ owner: "o", repo: "r" }),
  octokit: () => ({ rest: { repos: { getContent, createOrUpdateFileContents } } }),
  isNotFound: (e: { status?: number }) => e?.status === 404,
}));

import { addCustomer, readCustomers } from "@/lib/git/customers";

const author = { name: "n", email: "e" };
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o), "utf8").toString("base64");

beforeEach(() => {
  getContent.mockReset();
  createOrUpdateFileContents.mockReset();
});

describe("customers adapter", () => {
  it("readCustomers returns [] when the file is missing", async () => {
    getContent.mockRejectedValue({ status: 404 });
    expect(await readCustomers()).toEqual([]);
  });

  it("addCustomer appends a new customer and writes with the file sha", async () => {
    getContent.mockResolvedValue({
      data: { type: "file", sha: "s1", content: b64([{ id: "cust-acme", name: "Acme" }]) },
    });
    createOrUpdateFileContents.mockResolvedValue({ data: { content: { sha: "s2" } } });

    const c = await addCustomer("Northwind Traders", author);
    expect(c).toEqual({ id: "northwind-traders", name: "Northwind Traders" });

    const arg = createOrUpdateFileContents.mock.calls[0][0];
    expect(arg.sha).toBe("s1"); // optimistic concurrency
    const written = JSON.parse(Buffer.from(arg.content, "base64").toString("utf8"));
    expect(written).toHaveLength(2);
    expect(written[1]).toEqual({ id: "northwind-traders", name: "Northwind Traders" });
  });

  it("addCustomer reuses an existing customer matched by name (case-insensitive)", async () => {
    getContent.mockResolvedValue({
      data: { type: "file", sha: "s1", content: b64([{ id: "cust-acme", name: "Acme Industrial" }]) },
    });
    const c = await addCustomer("acme industrial", author);
    expect(c.id).toBe("cust-acme");
    expect(createOrUpdateFileContents).not.toHaveBeenCalled();
  });

  it("addCustomer de-duplicates a colliding generated id", async () => {
    getContent.mockResolvedValue({
      data: { type: "file", sha: "s1", content: b64([{ id: "acme", name: "Acme Inc" }]) },
    });
    createOrUpdateFileContents.mockResolvedValue({ data: { content: { sha: "s2" } } });
    const c = await addCustomer("Acme!", author); // slug "acme" collides with existing id
    expect(c.id).toBe("acme-2");
  });
});
