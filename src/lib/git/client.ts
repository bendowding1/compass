import "server-only";
import { Octokit } from "@octokit/rest";
import { throttling } from "@octokit/plugin-throttling";
import { retry } from "@octokit/plugin-retry";

/**
 * Git-provider client for the data store. The app authenticates with its OWN
 * credential (a fine-grained PAT in COMPASS_GIT_TOKEN for v1, a GitHub App
 * later). The throttling + retry plugins make it resilient to GitHub's primary
 * and secondary rate limits and transient failures (honoring Retry-After).
 */

const CompassOctokit = Octokit.plugin(throttling, retry);
let instance: InstanceType<typeof CompassOctokit> | null = null;

export function gitConfig(): { owner: string; repo: string } {
  const owner = process.env.COMPASS_DATA_OWNER;
  const repo = process.env.COMPASS_DATA_REPO;
  if (!owner || !repo) {
    throw new Error("COMPASS_DATA_OWNER and COMPASS_DATA_REPO must be set");
  }
  return { owner, repo };
}

export function octokit(): InstanceType<typeof CompassOctokit> {
  const token = process.env.COMPASS_GIT_TOKEN;
  if (!token) throw new Error("COMPASS_GIT_TOKEN must be set to access the data repo");
  if (!instance) {
    instance = new CompassOctokit({
      auth: token,
      throttle: {
        onRateLimit: (_retryAfter: number, _options: object, _octokit: unknown, retryCount: number) =>
          retryCount < 2,
        onSecondaryRateLimit: () => true,
      },
    });
  }
  return instance;
}

export function isNotFound(e: unknown): boolean {
  return hasStatus(e, 404);
}

export function isConflict(e: unknown): boolean {
  return hasStatus(e, 409);
}

function hasStatus(e: unknown, status: number): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "status" in e &&
    (e as { status?: number }).status === status
  );
}
