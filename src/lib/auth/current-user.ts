import "server-only";
import { auth } from "@/auth";

/**
 * Commit identity for the current request. Behind the sign-in gate this is the
 * signed-in Microsoft user, so every project edit is attributed to a real person
 * (which is what makes the per-project change-history view meaningful).
 *
 * The fallback to a placeholder exists only so a write never crashes if it is
 * somehow reached without a session (the gate makes that unreachable in normal
 * operation, and `auth()` may also throw before Entra is configured).
 */
const FALLBACK_AUTHOR = { name: "Compass", email: "compass@n-andgroup.com" };

export async function currentAuthor(): Promise<{ name: string; email: string }> {
  try {
    const session = await auth();
    const user = session?.user;
    if (user?.email) return { name: user.name ?? user.email, email: user.email };
  } catch {
    // Auth not configured / unavailable — fall through to the placeholder.
  }
  return FALLBACK_AUTHOR;
}
