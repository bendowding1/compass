"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateRoles, type RolesState } from "./actions";
import type { Roles, RoleKey } from "@/lib/schema/project";

const ROLE_ORDER: RoleKey[] = ["PM", "Development", "Test", "Deploy", "CustomerCare"];
const ROLE_LABELS: Record<RoleKey, string> = {
  PM: "PM",
  Development: "Development",
  Test: "Test",
  Deploy: "Deploy",
  CustomerCare: "Customer Care",
};

export function ResponsibleForm({
  projectId,
  sha,
  roles,
}: {
  projectId: string;
  sha: string;
  roles: Roles;
}) {
  const [state, action, pending] = useActionState<RolesState, FormData>(updateRoles, {});

  return (
    <form className="form" action={action}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="sha" value={sha} />

      {ROLE_ORDER.map((key) => (
        <div className="field" key={key}>
          <label htmlFor={`role.${key}`}>{ROLE_LABELS[key]}</label>
          <input
            id={`role.${key}`}
            name={`role.${key}`}
            type="text"
            placeholder="Unassigned"
            defaultValue={roles[key]}
          />
        </div>
      ))}

      {state.error && <p className="form-error">{state.error}</p>}

      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save responsible"}
        </button>
        <Link href={`/projects/${projectId}`}>Cancel</Link>
      </div>
    </form>
  );
}
