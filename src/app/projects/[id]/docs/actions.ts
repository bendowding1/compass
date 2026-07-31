"use server";

import { redirect } from "next/navigation";
import { getProject, writeProject, ConflictError } from "@/lib/git/projects";
import { docLinksFromForm } from "@/lib/doc-links-input";
import type { DocLink } from "@/lib/schema/project";
import { friendlyError } from "@/lib/friendly-error";
import { currentAuthor } from "@/lib/auth/current-user";

export type DocsState = { error?: string };

export async function updateDocs(_prev: DocsState, formData: FormData): Promise<DocsState> {
  const projectId = String(formData.get("projectId") ?? "");
  const sha = String(formData.get("sha") ?? "");
  if (!projectId) return { error: "Missing project id." };

  let docLinks: DocLink[];
  try {
    docLinks = docLinksFromForm(formData);
  } catch {
    return { error: "Each document needs a name and a valid URL (https://…)." };
  }

  try {
    const author = await currentAuthor();
    const current = await getProject(projectId);
    if (!current) return { error: "Project not found." };
    const now = new Date().toISOString();
    const updated = { ...current.project, docLinks, updatedBy: author.name, updatedAt: now };
    await writeProject(updated, sha || current.sha, author);
  } catch (e) {
    if (e instanceof ConflictError) {
      return { error: "This project changed since you opened it. Reload and try again." };
    }
    return { error: friendlyError(e, "Couldn't save the documents. Try again.") };
  }

  redirect(`/projects/${projectId}`);
}
