"use server";

import { redirect } from "next/navigation";
import {
  readCustomers,
  renameCustomer as renameCustomerInStore,
  removeCustomer,
} from "@/lib/git/customers";
import { listAllProjects, getProject, writeProject } from "@/lib/git/projects";
import { friendlyError } from "@/lib/friendly-error";
import { currentAuthor } from "@/lib/auth/current-user";

export type CustomerActionState = { error?: string };

/** Rename a customer; the stable id makes the new name show everywhere at once. */
export async function renameCustomer(
  _prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id) return { error: "Missing customer id." };
  if (!name) return { error: "Customer name is required." };

  try {
    await renameCustomerInStore(id, name, await currentAuthor());
  } catch (e) {
    return { error: friendlyError(e, "Couldn't rename the customer. Try again.") };
  }
  redirect("/customers");
}

/**
 * Delete a customer. Any projects referencing it (archived included) are first
 * moved to `moveTo` ("" = no customer), so nothing is left dangling — a
 * dangling id would fail writeProject's validation on that project's next save.
 */
export async function deleteCustomer(
  _prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const id = String(formData.get("id") ?? "");
  const moveTo = String(formData.get("moveTo") ?? "");
  if (!id) return { error: "Missing customer id." };
  if (moveTo === id) return { error: "Choose a different customer to move projects to." };

  try {
    const author = await currentAuthor();
    if (moveTo) {
      const customers = await readCustomers();
      if (!customers.some((c) => c.id === moveTo)) {
        return { error: "Unknown customer to move projects to." };
      }
    }

    const referencing = (await listAllProjects()).filter((p) => p.customerId === id);
    for (const p of referencing) {
      const current = await getProject(p.id); // fresh sha per project
      if (!current || current.project.customerId !== id) continue;
      await writeProject(
        {
          ...current.project,
          customerId: moveTo,
          updatedBy: author.name,
          updatedAt: new Date().toISOString(),
        },
        current.sha,
        author,
      );
    }
    await removeCustomer(id, author);
  } catch (e) {
    return { error: friendlyError(e, "Couldn't delete the customer. Try again.") };
  }
  redirect("/customers");
}
