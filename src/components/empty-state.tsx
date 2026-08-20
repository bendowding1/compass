import Link from "next/link";
import type { Project, LifecycleStatus } from "@/lib/schema/project";
import { initials, longDate, relativeTime } from "@/lib/format";
import { TopBar } from "./top-bar";
import { ResponsiblePanel } from "./responsible-panel";

const LIFECYCLE: LifecycleStatus[] = ["NPD", "Sustaining", "Closed"];

/**
 * The adoption screen — a brand-new project is not "no items found". It shows the
 * full fixed shape with one clear next action, so an empty project already looks
 * more organized than a blank SharePoint page. (compass-design-doc.md → empty state.)
 * The "Create the first milestone" / "Link a document" actions are wired in Unit 6.
 */
export function EmptyState({
  project,
  customerName,
}: {
  project: Project;
  customerName?: string;
}) {
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
            Created{" "}
            <time dateTime={project.updatedAt} title={longDate(project.updatedAt)}>
              {relativeTime(project.updatedAt)}
            </time>
          </span>
        </div>
      </div>

      <div className="split">
        <div className="main">
          <div className="seclab">
            <h2 className="sec">Milestones</h2>
            <span className="sub">every milestone delivers a release</span>
          </div>
          <div className="empty-box">
            <p>
              No milestones yet. In Compass, nothing happens outside a milestone — each one carries
              its own Requirements, Build, Test and Deploy and ends in a delivered release. Create
              the first to start.
            </p>
            <Link className="btn" href={`/projects/${project.id}/milestones/new`}>
              <span>+</span> Create the first milestone
            </Link>
          </div>
        </div>

        <div className="rail">
          <ResponsiblePanel roles={project.roles} projectId={project.id} />

          <div className="seclab">
            <h2 className="sec">Project docs</h2>
            {project.docLinks.length > 0 && (
              <Link
                className="ms-edit"
                href={`/projects/${project.id}/docs/edit`}
                style={{ marginLeft: "auto" }}
              >
                Edit
              </Link>
            )}
          </div>
          {project.docLinks.length === 0 ? (
            <div className="empty-box">
              <p>Link the project brief and specs so the team stops hunting through email and SharePoint.</p>
              <Link className="btn" href={`/projects/${project.id}/docs/edit`}>
                <span>+</span> Link a document
              </Link>
            </div>
          ) : (
            // Docs can be linked before the first milestone exists — this screen
            // keys off milestones, so it must still render saved links (same
            // markup as ProjectView; raw URL, no fetch, R7).
            project.docLinks.map((d) => (
              <div className="doc" key={d.id}>
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
