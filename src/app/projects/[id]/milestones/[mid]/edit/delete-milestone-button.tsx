"use client";

import { useActionState } from "react";
import { deleteMilestone, type MilestoneState } from "../../actions";

export function DeleteMilestoneButton({
  projectId,
  milestoneId,
  sha,
}: {
  projectId: string;
  milestoneId: string;
  sha: string;
}) {
  const [state, action, pending] = useActionState<MilestoneState, FormData>(deleteMilestone, {});

  return (
    <form className="delete-row" action={action}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="milestoneId" value={milestoneId} />
      <input type="hidden" name="sha" value={sha} />
      <button
        type="submit"
        className="btn-danger"
        disabled={pending}
        onClick={(e) => {
          if (
            !confirm("Delete this milestone? It's removed from the project (its history stays in git).")
          ) {
            e.preventDefault();
          }
        }}
      >
        {pending ? "Deleting…" : "Delete milestone"}
      </button>
      {state.error && <p className="form-error">{state.error}</p>}
    </form>
  );
}
