import "server-only";
import { octokit, gitConfig, isNotFound } from "./client";
import { cached, clearCache } from "./cache";
import { CustomersFileSchema, CustomerSchema, type Customer } from "@/lib/schema/project";
import { slugify } from "@/lib/format";

const PATH = "data/customers.json";

/** Customer list plus the file's blob SHA (for concurrency-safe updates). Not
 *  cached — used by writes, which need a current SHA. */
export async function readCustomersWithSha(): Promise<{ customers: Customer[]; sha: string | null }> {
  const { owner, repo } = gitConfig();
  try {
    const res = await octokit().rest.repos.getContent({ owner, repo, path: PATH });
    if (Array.isArray(res.data) || res.data.type !== "file") {
      throw new Error("data/customers.json is not a file");
    }
    const json = Buffer.from(res.data.content, "base64").toString("utf8");
    return { customers: CustomersFileSchema.parse(JSON.parse(json)), sha: res.data.sha };
  } catch (e) {
    if (isNotFound(e)) return { customers: [], sha: null };
    throw e;
  }
}

/** The admin-maintained customer list (cached; cleared on write). */
export async function readCustomers(): Promise<Customer[]> {
  return cached("customers", async () => (await readCustomersWithSha()).customers);
}

async function writeCustomers(
  customers: Customer[],
  sha: string | undefined,
  author: { name: string; email: string },
): Promise<void> {
  const { owner, repo } = gitConfig();
  const valid = CustomersFileSchema.parse(customers);
  const content = Buffer.from(`${JSON.stringify(valid, null, 2)}\n`, "utf8").toString("base64");
  await octokit().rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: PATH,
    message: "update customers",
    content,
    sha,
    author,
    committer: author,
  });
  clearCache();
}

/**
 * Add a customer to the list. If one with the same name already exists
 * (case-insensitive), it is reused rather than duplicated. Returns the customer.
 */
export async function addCustomer(
  name: string,
  author: { name: string; email: string },
): Promise<Customer> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Customer name is required");

  const { customers, sha } = await readCustomersWithSha();
  const existing = customers.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing;

  const base = slugify(trimmed) || "customer";
  const ids = new Set(customers.map((c) => c.id));
  let id = base;
  for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;

  const customer = CustomerSchema.parse({ id, name: trimmed });
  await writeCustomers([...customers, customer], sha ?? undefined, author);
  return customer;
}
