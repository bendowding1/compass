"use server";

import { redirect } from "next/navigation";
import { newProject, LifecycleStatus } from "@/lib/schema/project";
import { getProject, writeProject } from "@/lib/git/projects";
import { readCustomers, addCustomer } from "@/lib/git/customers";
import { randomProjectId } from "@/lib/id";
import { friendlyError } from "@/lib/friendly-error";
import { currentAuthor } from "@/lib/auth/current-user";

export type CreateState = { error?: string };

/**
 * Create a new project document in the data repo, optionally adding a brand-new
 * customer inline. Server Actions are public POST endpoints, so this re-validates.
 */
export async function createProject(_prev: CreateState, formData: FormData): Promise<CreateState> {
  const name = String(formData.get("name") ?? "").trim();
  const lifecycleRaw = String(formData.get("lifecycleStatus") ?? "NPD");
  const newCustomerName = String(formData.get("newCustomerName") ?? "").trim();
  let customerId = String(formData.get("customerId") ?? "").trim();

  if (!name) return { error: "Project name is required." };

  const lifecycle = LifecycleStatus.safeParse(lifecycleRaw);
  if (!lifecycle.success) return { error: "Invalid lifecycle status." };

  let createdId = "";
  try {
    const author = await currentAuthor();
    if (newCustomerName) {
      customerId = (await addCustomer(newCustomerName, author)).id;
    } else if (customerId) {
      const customers = await readCustomers();
      if (!customers.some((c) => c.id === customerId)) return { error: "Unknown customer." };
    }

    let id = randomProjectId();
    while (await getProject(id)) id = randomProjectId();
    createdId = id;

    const stamp = { by: author.name, at: new Date().toISOString() };
    await writeProject(
      { ...newProject(id, name, stamp), customerId, lifecycleStatus: lifecycle.data },
      undefined,
      author,
    );
  } catch (e) {
    return { error: friendlyError(e, "Couldn't create the project. Check the fields and try again.") };
  }

  redirect(`/projects/${createdId}`);
}
