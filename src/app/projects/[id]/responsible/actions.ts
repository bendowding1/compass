"use server";

import { redirect } from "next/navigation";
import { RolesSchema } from "@/lib/schema/project";
import { getProject, writeProject, ConflictError } from "@/lib/git/projects";
import { friendlyError } from "@/lib/friendly-error";
import { currentAuthor } from "@/lib/auth/current-user";

export type RolesState = { error?: string };

export async function updateRoles(_prev: RolesState, formData: FormData): Promise<RolesState> {
  const projectId = String(formData.get("projectId") ?? "");
  const sha = String(formData.get("sha") ?? "");
  if (!projectId) return { error: "Missing project id." };

  const roles = RolesSchema.parse({
    PM: String(formData.get("role.PM") ?? "").trim(),
    Development: String(formData.get("role.Development") ?? "").trim(),
    Test: String(formData.get("role.Test") ?? "").trim(),
    Deploy: String(formData.get("role.Deploy") ?? "").trim(),
    CustomerCare: String(formData.get("role.CustomerCare") ?? "").trim(),
  });

  try {
    const author = await currentAuthor();
    const current = await getProject(projectId);
    if (!current) return { error: "Project not found." };
    const updated = {
      ...current.project,
      roles,
      updatedBy: author.name,
      updatedAt: new Date().toISOString(),
    };
    await writeProject(updated, sha || current.sha, author);
  } catch (e) {
    if (e instanceof ConflictError) {
      return { error: "This project changed since you opened it. Reload and try again." };
    }
    return { error: friendlyError(e, "Couldn't save the responsible list. Try again.") };
  }

  redirect(`/projects/${projectId}`);
}
