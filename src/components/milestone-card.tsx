import Link from "next/link";
import type { Milestone, StepKey } from "@/lib/schema/project";
import { milestoneStatus, type StatusKind } from "@/lib/milestone-status";
import { shortDate, sourceLabel } from "@/lib/format";
import { releaseHref } from "@/lib/release-link";

const STEP_ORDER: StepKey[] = ["Requirements", "Build", "Test", "Deploy"];
const PILL_CLASS: Record<StatusKind, string> = {
  shipped: "shipped",
  slip: "test",
  active: "active",
  planned: "planned",
};

/** One milestone: status pill + the fixed four-step tracker (knobs + connectors). */
export function MilestoneCard({
  milestone,
  projectId,
  now,
  current = false,
}: {
  milestone: Milestone;
  projectId: string;
  now: Date;
  current?: boolean;
}) {
  const status = milestoneStatus(milestone, now);

  return (
    <div className={`ms${current ? " cur" : ""}`} aria-current={current ? "true" : undefined}>
      <div className="ms-top">
        <div className="ms-namerow">
          <h3 className="ms-name">{milestone.name}</h3>
          <Link className="ms-edit" href={`/projects/${projectId}/milestones/${milestone.id}/edit`}>
            Edit
          </Link>
        </div>
        <div className="ms-right">
          <span className={`st ${PILL_CLASS[status.kind]}`}>{status.label}</span>
          {status.dateLabel && <span className="ms-date">{status.dateLabel}</span>}
        </div>
      </div>

      <div className="steps">
        {STEP_ORDER.map((step, i) => {
          const s = milestone.steps[step].status;
          const cls = s === "done" ? "done" : s === "current" ? "cur" : "up";
          const knob = s === "done" ? "✓" : s === "current" ? "●" : String(i + 1);
          const sub =
            s === "done"
              ? milestone.steps[step].date
                ? `done ${shortDate(milestone.steps[step].date)}`
                : "done"
              : s === "current"
                ? "in progress"
                : "—";
          return (
            <div className={`step ${cls}`} key={step}>
              <div className="knob">{knob}</div>
              <div className="sl">{step}</div>
              <div className="sd">{sub}</div>
            </div>
          );
        })}
      </div>

      {milestone.releaseUrl && (
        <div className="ms-release">
          {/* S3 URLs for the configured release bucket route through Compass
              (objects → /api/release presign redirect, folders → /release
              listing page); other hosts link raw. */}
          <a href={releaseHref(milestone.releaseUrl)}>Release package</a>
          <span className="src">{sourceLabel(milestone.releaseUrl)}</span>
          <span className="ext">{"↗"}</span>
        </div>
      )}
    </div>
  );
}
