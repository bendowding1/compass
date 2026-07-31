import { ZodError } from "zod";

/**
 * Turn a thrown value into a message safe to show a user. Zod's raw error is a
 * JSON blob, so it is never surfaced directly: URL issues get a clear hint and
 * anything else falls back to the caller's friendly message. Plain Errors (our
 * own "Unknown customer…", a git-API message) pass their text through.
 */
export function friendlyError(e: unknown, fallback: string): string {
  if (e instanceof ZodError) {
    const text = e.issues
      .map((i) => i.message)
      .join(" ")
      .toLowerCase();
    if (text.includes("url")) return "Links must be valid URLs that start with https://";
    return fallback;
  }
  if (e instanceof Error) return e.message;
  return fallback;
}
