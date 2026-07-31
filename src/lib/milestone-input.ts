import { StepStatus, type Milestone, type Step, type StepKey } from "@/lib/schema/project";

const STEP_ORDER: StepKey[] = ["Requirements", "Build", "Test", "Deploy"];

function stepFromForm(formData: FormData, key: StepKey): Step {
  const status = StepStatus.parse(String(formData.get(`step.${key}.status`) ?? "upcoming"));
  const date = String(formData.get(`step.${key}.date`) ?? "").trim();
  return date ? { status, date } : { status };
}

/**
 * Build a Milestone from a submitted form. Pure (no I/O) so it's unit-testable.
 * Empty optional fields (target/actual date, release URL, step dates) are omitted
 * rather than written as "" — which would fail the schema's date/URL validators.
 * The whole project (including this milestone) is re-validated by writeProject.
 */
export function milestoneFromForm(
  id: string,
  formData: FormData,
  stamp: { by: string; at: string },
): Milestone {
  const name = String(formData.get("name") ?? "").trim();
  const targetDate = String(formData.get("targetDate") ?? "").trim();
  const actualDate = String(formData.get("actualDate") ?? "").trim();
  const releaseUrl = String(formData.get("releaseUrl") ?? "").trim();

  return {
    id,
    name,
    ...(targetDate ? { targetDate } : {}),
    ...(actualDate ? { actualDate } : {}),
    ...(releaseUrl ? { releaseUrl } : {}),
    steps: {
      Requirements: stepFromForm(formData, "Requirements"),
      Build: stepFromForm(formData, "Build"),
      Test: stepFromForm(formData, "Test"),
      Deploy: stepFromForm(formData, "Deploy"),
    },
    updatedBy: stamp.by,
    updatedAt: stamp.at,
  };
}

export { STEP_ORDER };
