import type { Milestone, StepKey } from "@/lib/schema/project";
import { isDelivered, slipLabel } from "@/lib/slip";
import { shortDate } from "@/lib/format";

const STEP_ORDER: StepKey[] = ["Requirements", "Build", "Test", "Deploy"];

export type StatusKind = "shipped" | "slip" | "active" | "planned";

/** The milestone status pill shown top-right: derived from step state + the slip rule. */
export function milestoneStatus(
  m: Milestone,
  now: Date,
): { label: string; kind: StatusKind; dateLabel: string } {
  const late = slipLabel(m, now); // null or "late Nw"
  const currentStep = STEP_ORDER.find((s) => m.steps[s].status === "current");

  if (isDelivered(m)) {
    return {
      label: "Shipped",
      kind: "shipped",
      dateLabel: m.actualDate ? `delivered ${shortDate(m.actualDate)}` : "delivered",
    };
  }

  const target = m.targetDate ? `target ${shortDate(m.targetDate)}` : "";

  if (currentStep) {
    return {
      label: late ? `In ${currentStep} · ${late}` : `In ${currentStep}`,
      kind: late ? "slip" : "active",
      dateLabel: target,
    };
  }
  if (late) {
    return { label: `${late[0].toUpperCase()}${late.slice(1)}`, kind: "slip", dateLabel: target };
  }
  return { label: "Planned", kind: "planned", dateLabel: target };
}
