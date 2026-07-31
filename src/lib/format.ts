const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "Ben Dowding" -> "BD", "Sam" -> "SA", "" -> "?" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "2026-05-12" -> "12 May" */
export function shortDate(iso?: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]}`;
}

/** "Apollo Field Unit v2!" -> "apollo-field-unit-v2" (id from a project name) */
export function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "2026-06-20T..." -> "20 Jun 2026" */
export function longDate(iso?: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "2026-06-20T..." -> "2 days ago", relative to now. Pair with longDate() in a
 *  title attribute for the exact timestamp on hover. */
export function relativeTime(iso?: string): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const sec = Math.round((Date.now() - then) / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 45) return ago(min, "minute");
  const hr = Math.round(min / 60);
  if (hr < 24) return ago(hr, "hour");
  const day = Math.round(hr / 24);
  if (day < 30) return ago(day, "day");
  const mon = Math.round(day / 30);
  if (mon < 12) return ago(mon, "month");
  return ago(Math.round(mon / 12), "year");
}

function ago(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}

/** Label a link's source from its host: SharePoint, git artifacts, or S3. */
export function sourceLabel(url: string): string {
  try {
    const u = new URL(url);
    if (u.protocol === "s3:") return "S3";
    const host = u.hostname.toLowerCase();
    if (host.includes("sharepoint")) return "SharePoint";
    if (host.includes("github") || host.includes("gitlab") || host.includes("dev.azure")) {
      return "Git artifact";
    }
    if (host.endsWith(".amazonaws.com") && host.includes("s3")) return "S3";
    return "Link";
  } catch {
    return "Link";
  }
}
