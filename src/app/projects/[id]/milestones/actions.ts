"use server";

import { redirect } from "next/navigation";
import { getProject, writeProject, ConflictError } from "@/lib/git/projects";
import { slugify } from "@/lib/format";
import { milestoneFromForm } from "@/lib/milestone-input";
import { friendlyError } from "@/lib/friendly-error";
import { currentAuthor } from "@/lib/auth/current-user";

export type MilestoneState = { error?: string };

export async function addMilestone(_prev: MilestoneState, formData: FormData): Promise<MilestoneState> {
  const projectId = String(formData.get("projectId") ?? "");
  const sha = String(formData.get("sha") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!projectId) return { error: "Missing project id." };
  if (!name) return { error: "Milestone name is required." };

  try {
    const author = await currentAuthor();
    const current = await getProject(projectId);
    if (!current) return { error: "Project not found." };

    const ids = new Set(current.project.milestones.map((m) => m.id));
    const base = slugify(name) || "milestone";
    let id = base;
    for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;

    const now = new Date().toISOString();
    const milestone = milestoneFromForm(id, formData, { by: author.name, at: now });
    const updated = {
      ...current.project,
      milestones: [...current.project.milestones, milestone],
      updatedBy: author.name,
      updatedAt: now,
    };
    await writeProject(updated, sha || current.sha, author);
  } catch (e) {
    if (e instanceof ConflictError) {
      return { error: "This project changed since you opened it. Reload and try again." };
    }
    return { error: friendlyError(e, "Couldn't save the milestone. Check the fields and try again.") };
  }

  redirect(`/projects/${projectId}`);
}

export async function updateMilestone(
  _prev: MilestoneState,
  formData: FormData,
): Promise<MilestoneState> {
  const projectId = String(formData.get("projectId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const sha = String(formData.get("sha") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!projectId || !milestoneId) return { error: "Missing ids." };
  if (!name) return { error: "Milestone name is required." };

  try {
    const author = await currentAuthor();
    const current = await getProject(projectId);
    if (!current) return { error: "Project not found." };

    const idx = current.project.milestones.findIndex((m) => m.id === milestoneId);
    if (idx < 0) return { error: "Milestone not found." };

    const now = new Date().toISOString();
    const milestone = milestoneFromForm(milestoneId, formData, { by: author.name, at: now });
    const milestones = [...current.project.milestones];
    milestones[idx] = milestone;
    const updated = { ...current.project, milestones, updatedBy: author.name, updatedAt: now };
    await writeProject(updated, sha || current.sha, author);
  } catch (e) {
    if (e instanceof ConflictError) {
      return { error: "This project changed since you opened it. Reload and try again." };
    }
    return { error: friendlyError(e, "Couldn't save the milestone. Check the fields and try again.") };
  }

  redirect(`/projects/${projectId}`);
}

export async function deleteMilestone(
  _prev: MilestoneState,
  formData: FormData,
): Promise<MilestoneState> {
  const projectId = String(formData.get("projectId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const sha = String(formData.get("sha") ?? "");
  if (!projectId || !milestoneId) return { error: "Missing ids." };

  try {
    const author = await currentAuthor();
    const current = await getProject(projectId);
    if (!current) return { error: "Project not found." };

    const milestones = current.project.milestones.filter((m) => m.id !== milestoneId);
    if (milestones.length === current.project.milestones.length) {
      return { error: "Milestone not found." };
    }

    const now = new Date().toISOString();
    const updated = { ...current.project, milestones, updatedBy: author.name, updatedAt: now };
    await writeProject(updated, sha || current.sha, author);
  } catch (e) {
    if (e instanceof ConflictError) {
      return { error: "This project changed since you opened it. Reload and try again." };
    }
    return { error: friendlyError(e, "Couldn't delete the milestone. Try again.") };
  }

  redirect(`/projects/${projectId}`);
}
