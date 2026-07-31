import Link from "next/link";
import type { Roles, RoleKey } from "@/lib/schema/project";
import { initials } from "@/lib/format";

const ROLE_ORDER: RoleKey[] = ["PM", "Development", "Test", "Deploy", "CustomerCare"];
const ROLE_LABELS: Record<RoleKey, string> = {
  PM: "PM",
  Development: "Development",
  Test: "Test",
  Deploy: "Deploy",
  CustomerCare: "Customer Care",
};

/** The five fixed Responsible roles. Unassigned roles show "Assign". */
export function ResponsiblePanel({ roles, projectId }: { roles: Roles; projectId: string }) {
  return (
    <>
      <div className="seclab" style={{ marginTop: 0 }}>
        <h2 className="sec">Responsible</h2>
        <Link
          className="ms-edit"
          href={`/projects/${projectId}/responsible/edit`}
          style={{ marginLeft: "auto" }}
        >
          Edit
        </Link>
      </div>
      <div className="card">
        {ROLE_ORDER.map((key) => {
          const person = roles[key];
          return (
            <div className="trow" key={key}>
              <span className="trole">{ROLE_LABELS[key]}</span>
              <span className="tav" style={person ? undefined : { background: "var(--line2)" }}>
                {person ? initials(person) : "?"}
              </span>
              {person ? (
                <span className="tname">{person}</span>
              ) : (
                <span className="tname empty">Assign</span>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
