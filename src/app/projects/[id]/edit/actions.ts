"use server";

import { redirect } from "next/navigation";
import { LifecycleStatus } from "@/lib/schema/project";
import {
  getProject,
  writeProject,
  ConflictError,
  deleteProject as deleteProjectDoc,
} from "@/lib/git/projects";
import { readCustomers, addCustomer } from "@/lib/git/customers";
import { friendlyError } from "@/lib/friendly-error";
import { currentAuthor } from "@/lib/auth/current-user";

export type UpdateState = { error?: string };

/**
 * Update a project's header details (name, customer, lifecycle). Roles, milestones,
 * docLinks, and archived are preserved untouched (each has its own section editor).
 * Writes with the SHA the form loaded, so concurrent edits are caught, not clobbered.
 */
export async function updateProject(_prev: UpdateState, formData: FormData): Promise<UpdateState> {
  const id = String(formData.get("id") ?? "");
  const sha = String(formData.get("sha") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const lifecycleRaw = String(formData.get("lifecycleStatus") ?? "");
  const newCustomerName = String(formData.get("newCustomerName") ?? "").trim();
  let customerId = String(formData.get("customerId") ?? "").trim();

  if (!id) return { error: "Missing project id." };
  if (!name) return { error: "Project name is required." };
  const lifecycle = LifecycleStatus.safeParse(lifecycleRaw);
  if (!lifecycle.success) return { error: "Invalid lifecycle status." };

  try {
    const author = await currentAuthor();
    if (newCustomerName) {
      customerId = (await addCustomer(newCustomerName, author)).id;
    } else if (customerId) {
      const customers = await readCustomers();
      if (!customers.some((c) => c.id === customerId)) return { error: "Unknown customer." };
    }

    const current = await getProject(id);
    if (!current) return { error: "Project not found." };

    const updated = {
      ...current.project,
      name,
      customerId,
      lifecycleStatus: lifecycle.data,
      updatedBy: author.name,
      updatedAt: new Date().toISOString(),
    };
    await writeProject(updated, sha || current.sha, author);
  } catch (e) {
    if (e instanceof ConflictError) {
      return { error: "This project changed since you opened it. Reload and try again." };
    }
    return { error: friendlyError(e, "Couldn't save your changes. Check the fields and try again.") };
  }

  redirect(`/projects/${id}`);
}

export type DeleteState = { error?: string };

/**
 * Permanently delete a project. Server Actions are public POST endpoints, so
 * the type-the-name confirmation is re-checked here, not only in the UI.
 */
export async function deleteProject(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const id = String(formData.get("id") ?? "");
  const confirmName = String(formData.get("confirmName") ?? "").trim();
  if (!id) return { error: "Missing project id." };

  try {
    const author = await currentAuthor();
    const current = await getProject(id);
    if (!current) return { error: "Project not found." };
    if (confirmName !== current.project.name) {
      return { error: "Type the project name exactly to confirm deletion." };
    }
    await deleteProjectDoc(id, author);
  } catch (e) {
    if (e instanceof ConflictError) {
      return { error: "This project changed since you opened it. Reload and try again." };
    }
    return { error: friendlyError(e, "Couldn't delete the project. Try again.") };
  }

  redirect("/");
}
