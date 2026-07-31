import Link from "next/link";
import type { Project, LifecycleStatus, Milestone } from "@/lib/schema/project";
import { isDelivered } from "@/lib/slip";
import { initials, longDate, relativeTime } from "@/lib/format";
import { TopBar } from "./top-bar";
import { ResponsiblePanel } from "./responsible-panel";
import { MilestoneCard } from "./milestone-card";

const LIFECYCLE: LifecycleStatus[] = ["NPD", "Sustaining", "Closed"];
const FAR_FUTURE = "9999-12-31";

/** Sort key: delivered date, else target date, else far future (undated sink to the bottom). */
function milestoneSortKey(m: Milestone): string {
  return m.actualDate ?? m.targetDate ?? FAR_FUTURE;
}

/** The active milestone = the earliest-dated one not yet delivered. */
function currentMilestoneId(ms: Milestone[]): string | null {
  const pending = ms.filter((m) => !isDelivered(m));
  if (pending.length === 0) return null;
  return [...pending].sort((a, b) => (milestoneSortKey(a) < milestoneSortKey(b) ? -1 : 1))[0].id;
}

type TimelineEntry =
  | { kind: "milestone"; m: Milestone; sort: string }
  | { kind: "today"; sort: string };

/** Read-only render of a populated project in the fixed standard shape. */
export function ProjectView({
  project,
  customerName,
  now,
}: {
  project: Project;
  customerName: string;
  now: Date;
}) {
  // Build a chronological timeline (oldest at top) with a "Today" marker dropped
  // in at its date position, so you can see at a glance what shipped, what is
  // overdue (a not-done milestone sitting above the Today line), and what's next.
  const todayISO = now.toISOString().slice(0, 10);
  const currentId = currentMilestoneId(project.milestones);
  const entries: TimelineEntry[] = [
    ...project.milestones.map((m) => ({ kind: "milestone" as const, m, sort: milestoneSortKey(m) })),
    { kind: "today" as const, sort: todayISO },
  ];
  entries.sort((a, b) =>
    a.sort !== b.sort ? (a.sort < b.sort ? -1 : 1) : a.kind === "today" ? 1 : -1,
  );

  return (
    <div className="app frame">
      <TopBar crumb={project.name} avatar={initials(project.updatedBy)} />

      <div className="head">
        <div className="head-row">
          <h1 className="pname">{project.name}</h1>
          <Link className="btn" href={`/projects/${project.id}/edit`}>
            Edit
          </Link>
        </div>
        <div className="meta">
          <span className={`cust${customerName ? "" : " empty"}`}>
            <span className="bld">{"■"}</span>
            <span className="clab">Customer</span>
            <span className="cval">{customerName || "Select customer"}</span>
            <span className="car">{"▾"}</span>
          </span>
          <span className="lifelab">Lifecycle</span>
          <span className="life">
            {LIFECYCLE.map((l) => (
              <span key={l} className={project.lifecycleStatus === l ? "on" : ""}>
                {l}
              </span>
            ))}
          </span>
          <span className="stamp">
            <span className="ic" />
            Updated by {project.updatedBy} ·{" "}
            <time dateTime={project.updatedAt} title={longDate(project.updatedAt)}>
              {relativeTime(project.updatedAt)}
            </time>
            {" · "}
            <Link href={`/projects/${project.id}/history`} className="stamp-link">
              History
            </Link>
          </span>
        </div>
      </div>

      <div className="split">
        <div className="main">
          <div className="seclab">
            <h2 className="sec">Milestones</h2>
            <span className="sub">
              every milestone delivers a release · Requirements → Build → Test → Deploy
            </span>
            <Link
              className="btn-sm"
              href={`/projects/${project.id}/milestones/new`}
              style={{ marginLeft: "auto" }}
            >
              + Add milestone
            </Link>
          </div>
          <div className="timeline">
            {entries.map((e) =>
              e.kind === "today" ? (
                <div className="tl-item tl-today" key="__today__">
                  <div className="tl-marker">
                    <span className="tl-dot today" />
                  </div>
                  <div className="tl-body">
                    <div className="today-row">
                      <span className="tday-label">Today</span>
                      <span className="tday-date">{longDate(todayISO)}</span>
                      <span className="tday-line" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="tl-item" key={e.m.id}>
                  <div className="tl-marker">
                    <span
                      className={`tl-dot ${
                        isDelivered(e.m) ? "done" : e.m.id === currentId ? "cur" : "up"
                      }`}
                    />
                  </div>
                  <div className="tl-body">
                    <MilestoneCard
                      milestone={e.m}
                      projectId={project.id}
                      now={now}
                      current={e.m.id === currentId}
                    />
                  </div>
                </div>
              ),
            )}
          </div>
        </div>

        <div className="rail">
          <ResponsiblePanel roles={project.roles} projectId={project.id} />

          <div className="seclab">
            <h2 className="sec">Project docs</h2>
            <Link
              className="ms-edit"
              href={`/projects/${project.id}/docs/edit`}
              style={{ marginLeft: "auto" }}
            >
              Edit
            </Link>
          </div>
          {project.docLinks.length === 0 ? (
            <div className="empty-box">
              <p>No documents linked yet.</p>
            </div>
          ) : (
            project.docLinks.map((d) => (
              <div className="doc" key={d.id}>
                {/* Raw SharePoint URL, rendered as a link, no fetch (R7). */}
                <a className="dt" href={d.url}>
                  {d.label}
                </a>
                <span className="src">SharePoint</span>
                <span className="ext">{"↗"}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
