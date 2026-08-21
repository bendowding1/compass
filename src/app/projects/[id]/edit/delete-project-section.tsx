"use client";

import { useActionState, useState } from "react";
import { deleteProject, type DeleteState } from "./actions";

/**
 * GitHub-style danger zone: the delete button stays disabled until the project
 * name is typed exactly, then one click deletes — no confirm() on top. The
 * server action re-checks the typed name, so this gate is UX, not the security.
 */
export function DeleteProjectSection({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteProject, {});
  const [confirmName, setConfirmName] = useState("");
  const armed = confirmName.trim() === projectName;

  return (
    <form className="danger-zone" action={action}>
      <input type="hidden" name="id" value={projectId} />
      <h2 className="sec">Delete this project</h2>
      <p className="danger-note">
        Removes the project from Compass everywhere — milestones, documents, roles and its history
        page. Only an admin can bring it back, from the data repo&apos;s git history. Type{" "}
        <b>{projectName}</b> to confirm.
      </p>
      <div className="danger-row">
        <input
          name="confirmName"
          type="text"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          placeholder={projectName}
          aria-label="Type the project name to confirm deletion"
          autoComplete="off"
        />
        <button className="btn-danger" type="submit" disabled={!armed || pending}>
          {pending ? "Deleting…" : "Delete project"}
        </button>
      </div>
      {state.error && <p className="form-error">{state.error}</p>}
    </form>
  );
}
