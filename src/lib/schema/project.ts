import { z } from "zod";

/**
 * The one fixed shape (D1). Rigidity is enforced here, not by a database:
 * fixed enums + strictObject (rejects unknown fields), validated on every read
 * and write. There is deliberately no way to add a field or a new type without
 * editing this file. See compass-design-doc.md (Engineering Plan) and
 * docs/plans/2026-06-26-001-feat-compass-v1-project-page-plan.md.
 */

export const SCHEMA_VERSION = 1;

export const LifecycleStatus = z.enum(["NPD", "Sustaining", "Closed"]);
export type LifecycleStatus = z.infer<typeof LifecycleStatus>;

export const RoleKey = z.enum(["PM", "Development", "Test", "Deploy", "CustomerCare"]);
export type RoleKey = z.infer<typeof RoleKey>;

/**
 * The fixed milestone steps. Sign-off is folded into Requirements for now
 * (compass-design-doc.md, Open Questions). If The Assignment shows sign-off
 * needs its own step, add it here, bump SCHEMA_VERSION, and add a migrate-on-read
 * transform in migrateProject(). Cheap with the file-based store; do not treat
 * this as frozen.
 */
export const StepKey = z.enum(["Requirements", "Build", "Test", "Deploy"]);
export type StepKey = z.infer<typeof StepKey>;

export const StepStatus = z.enum(["upcoming", "current", "done"]);
export type StepStatus = z.infer<typeof StepStatus>;

/** "YYYY-MM-DD" — date-only, validated by shape, compared timezone-stably in slip.ts. */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected a YYYY-MM-DD date");

export const StepSchema = z.strictObject({
  status: StepStatus,
  date: isoDate.optional(),
});
export type Step = z.infer<typeof StepSchema>;

/**
 * Fixed-key object: exactly the four steps, no more, no fewer. This is the
 * structural form of D1 — you cannot add a fifth step without changing the schema.
 */
export const StepsSchema = z.strictObject({
  Requirements: StepSchema,
  Build: StepSchema,
  Test: StepSchema,
  Deploy: StepSchema,
});
export type Steps = z.infer<typeof StepsSchema>;

export const MilestoneSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  targetDate: isoDate.optional(),
  actualDate: isoDate.optional(),
  // Link to the delivered release package. SharePoint for now; later a git
  // artifact URL. The UI auto-labels the source from the host (see format.ts).
  releaseUrl: z.url().optional(),
  steps: StepsSchema,
  updatedBy: z.string(),
  updatedAt: z.string(),
});
export type Milestone = z.infer<typeof MilestoneSchema>;

/**
 * Fixed-key object: exactly the five Responsible roles. A person may be "" in
 * the empty state ("Assign"); the role set itself is fixed.
 */
export const RolesSchema = z.strictObject({
  PM: z.string(),
  Development: z.string(),
  Test: z.string(),
  Deploy: z.string(),
  CustomerCare: z.string(),
});
export type Roles = z.infer<typeof RolesSchema>;

export const DocLinkSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  url: z.url(),
});
export type DocLink = z.infer<typeof DocLinkSchema>;

export const ProjectSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().min(1),
  name: z.string().min(1),
  // "" until a customer is picked (the empty-state "Select customer"). The
  // "customer must exist in customers.json" rule is enforced on save (Unit 4),
  // not as a schema invariant, so a brand-new project is still a valid document.
  customerId: z.string(),
  lifecycleStatus: LifecycleStatus,
  roles: RolesSchema,
  milestones: z.array(MilestoneSchema),
  docLinks: z.array(DocLinkSchema),
  archived: z.boolean(),
  updatedBy: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const CustomerSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
});
export type Customer = z.infer<typeof CustomerSchema>;

export const CustomersFileSchema = z.array(CustomerSchema);

/**
 * Parse + validate a project document read from the store. Runs migrate-on-read
 * for older schema versions, then strict validation. Throws on any drift.
 */
export function parseProject(raw: unknown): Project {
  return ProjectSchema.parse(migrateProject(raw));
}

/** Migrate-on-read seam. v1 is current; when SCHEMA_VERSION bumps, transform
 *  older shapes to the current shape here before ProjectSchema.parse. */
function migrateProject(raw: unknown): unknown {
  return raw;
}

/** A brand-new, valid (empty-state) project document. */
export function newProject(id: string, name: string, stamp: { by: string; at: string }): Project {
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    name,
    customerId: "",
    lifecycleStatus: "NPD",
    roles: { PM: "", Development: "", Test: "", Deploy: "", CustomerCare: "" },
    milestones: [],
    docLinks: [],
    archived: false,
    updatedBy: stamp.by,
    updatedAt: stamp.at,
  };
}
