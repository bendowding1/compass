import type { Milestone } from "@/lib/schema/project";

/**
 * The auto-derived "running late" rule — the one place v1 shows truth from date
 * math instead of typed-in status, so it cannot be faked. Derived, never stored.
 * `now` is injected for testability. All comparison is date-only and computed in
 * UTC so the result does not flip with the server's timezone.
 */

const MS_PER_DAY = 86_400_000;

function utcMidnight(isoDateOnly: string): number {
  return Date.parse(`${isoDateOnly}T00:00:00.000Z`);
}

/** Whole days `targetDate` is in the past relative to `now` (negative = future). */
function daysPast(targetDate: string, now: Date): number {
  const today = utcMidnight(now.toISOString().slice(0, 10));
  return Math.round((today - utcMidnight(targetDate)) / MS_PER_DAY);
}

/** A milestone is delivered when it has an actual date or every step is done. */
export function isDelivered(m: Milestone): boolean {
  if (m.actualDate) return true;
  return Object.values(m.steps).every((s) => s.status === "done");
}

/**
 * A milestone is "running late" when it has a target date, that date has passed,
 * and it is not yet delivered.
 */
export function isMilestoneLate(m: Milestone, now: Date): boolean {
  if (!m.targetDate) return false;
  if (isDelivered(m)) return false;
  return daysPast(m.targetDate, now) > 0;
}

/** Whole weeks a not-yet-delivered milestone is past its target (0 if not late). */
export function weeksLate(m: Milestone, now: Date): number {
  if (!isMilestoneLate(m, now)) return 0;
  return Math.floor(daysPast(m.targetDate as string, now) / 7);
}

/** Badge label such as "late 2w", or null when the milestone is not late. */
export function slipLabel(m: Milestone, now: Date): string | null {
  if (!isMilestoneLate(m, now)) return null;
  const w = weeksLate(m, now);
  return w >= 1 ? `late ${w}w` : "late";
}
