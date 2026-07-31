"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Milestone, StepKey } from "@/lib/schema/project";

const STEP_ORDER: StepKey[] = ["Requirements", "Build", "Test", "Deploy"];

type State = { error?: string };
type Action = (prev: State, formData: FormData) => Promise<State>;

export function MilestoneForm({
  action,
  projectId,
  sha,
  milestone,
  submitLabel,
}: {
  action: Action;
  projectId: string;
  sha: string;
  milestone?: Milestone;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(action, {});

  return (
    <form className="form" action={formAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="sha" value={sha} />
      {milestone && <input type="hidden" name="milestoneId" value={milestone.id} />}

      <div className="field">
        <label htmlFor="name">Milestone name</label>
        <input id="name" name="name" type="text" required defaultValue={milestone?.name ?? ""} placeholder="e.g. Release 2.2" />
      </div>

      <div className="field">
        <label htmlFor="targetDate">Target date</label>
        <input id="targetDate" name="targetDate" type="date" defaultValue={milestone?.targetDate ?? ""} />
      </div>

      <div className="field">
        <label htmlFor="actualDate">Delivered date (leave blank if not shipped)</label>
        <input id="actualDate" name="actualDate" type="date" defaultValue={milestone?.actualDate ?? ""} />
      </div>

      <div className="field">
        <label htmlFor="releaseUrl">Release package URL</label>
        <input
          id="releaseUrl"
          name="releaseUrl"
          type="url"
          placeholder="https://…"
          defaultValue={milestone?.releaseUrl ?? ""}
        />
      </div>

      <p className="form-section">Steps</p>
      {STEP_ORDER.map((key) => {
        const s = milestone?.steps[key];
        return (
          <div className="step-row" key={key}>
            <span className="step-row-label">{key}</span>
            <select name={`step.${key}.status`} defaultValue={s?.status ?? "upcoming"} aria-label={`${key} status`}>
              <option value="upcoming">upcoming</option>
              <option value="current">current</option>
              <option value="done">done</option>
            </select>
            <input name={`step.${key}.date`} type="date" defaultValue={s?.date ?? ""} aria-label={`${key} date`} />
          </div>
        );
      })}

      {state.error && <p className="form-error">{state.error}</p>}

      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link href={`/projects/${projectId}`}>Cancel</Link>
      </div>
    </form>
  );
}
