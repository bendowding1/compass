import "server-only";
import { octokit, gitConfig, isNotFound, isConflict } from "./client";
import { readCustomers } from "./customers";
import { cached, clearCache } from "./cache";
import { parseProject, ProjectSchema, type Project } from "@/lib/schema/project";

const DIR = "data/projects";
const filePath = (id: string) => `${DIR}/${id}.json`;

export type ProjectWithSha = { project: Project; sha: string };
export type HistoryEntry = { sha: string; message: string; author: string; date: string };

/** Thrown when a write loses the optimistic-concurrency race (stale blob SHA). */
export class ConflictError extends Error {
  constructor() {
    super("This project changed since you opened it. Reload and reapply.");
    this.name = "ConflictError";
  }
}

/** Read one project document + its blob SHA. Not cached — callers (incl. the
 *  edit forms) need a current SHA for optimistic concurrency. null if absent. */
export async function getProject(id: string): Promise<ProjectWithSha | null> {
  const { owner, repo } = gitConfig();
  try {
    const res = await octokit().rest.repos.getContent({ owner, repo, path: filePath(id) });
    if (Array.isArray(res.data) || res.data.type !== "file") return null;
    const json = Buffer.from(res.data.content, "base64").toString("utf8");
    return { project: parseProject(JSON.parse(json)), sha: res.data.sha };
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

/** Every project document, archived included — for reference counting (e.g.
 *  "can this customer be deleted?"), where an archived project's references
 *  still matter. Cached briefly (cleared on any write), since it fans out to
 *  one read per project; a few seconds of staleness is fine, and writes clear
 *  the cache so you always see your own changes. */
export async function listAllProjects(): Promise<Project[]> {
  return cached("projects:all", async () => {
    const { owner, repo } = gitConfig();
    let ids: string[] = [];
    try {
      const res = await octokit().rest.repos.getContent({ owner, repo, path: DIR });
      if (Array.isArray(res.data)) {
        ids = res.data
          .filter((e) => e.type === "file" && e.name.endsWith(".json"))
          .map((e) => e.name.replace(/\.json$/, ""));
      }
    } catch (e) {
      if (isNotFound(e)) return [];
      throw e;
    }
    const loaded = await Promise.all(ids.map((id) => getProject(id)));
    return loaded.filter((r): r is ProjectWithSha => r !== null).map((r) => r.project);
  });
}

/** All non-archived projects — what the UI lists. */
export async function listProjects(): Promise<Project[]> {
  return (await listAllProjects()).filter((p) => !p.archived);
}

/** The project's change history — every edit is a commit on its JSON file. */
export async function getProjectHistory(id: string, limit = 30): Promise<HistoryEntry[]> {
  const { owner, repo } = gitConfig();
  try {
    const res = await octokit().rest.repos.listCommits({
      owner,
      repo,
      path: filePath(id),
      per_page: limit,
    });
    return res.data.map((c) => ({
      sha: c.sha,
      message: c.commit.message.split("\n")[0],
      author: c.commit.author?.name ?? "unknown",
      date: c.commit.author?.date ?? "",
    }));
  } catch (e) {
    if (isNotFound(e)) return [];
    throw e;
  }
}

/**
 * Create or update a project document. Pass the expected blob SHA for an update
 * (optimistic concurrency; omit for a create). Returns the new blob SHA.
 */
export async function writeProject(
  project: Project,
  expectedSha: string | undefined,
  author: { name: string; email: string },
): Promise<{ sha: string }> {
  const { owner, repo } = gitConfig();
  const valid = ProjectSchema.parse(project); // enforce the fixed shape on write (D1)

  if (valid.customerId) {
    const customers = await readCustomers();
    if (!customers.some((c) => c.id === valid.customerId)) {
      throw new Error(`Unknown customer: ${valid.customerId}`);
    }
  }

  const content = Buffer.from(`${JSON.stringify(valid, null, 2)}\n`, "utf8").toString("base64");
  try {
    const res = await octokit().rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath(valid.id),
      message: `update ${valid.id}: ${valid.name}`,
      content,
      sha: expectedSha,
      author,
      committer: author,
    });
    clearCache();
    return { sha: res.data.content?.sha ?? "" };
  } catch (e) {
    if (isConflict(e)) throw new ConflictError();
    throw e;
  }
}

/** Archive (soft-hide, reversible) a project. For permanent removal use
 *  deleteProject below. */
export async function archiveProject(
  id: string,
  author: { name: string; email: string },
): Promise<void> {
  const current = await getProject(id);
  if (!current) return;
  await writeProject({ ...current.project, archived: true }, current.sha, author);
}

/**
 * Hard-delete a project's document. Removing the file at HEAD makes the project
 * vanish from the whole app — the list skips it and every /projects/[id] route
 * 404s via getProject. Past versions deliberately remain in the data repo's git
 * history (never shown in the app), so an admin can restore a deleted project
 * from there; scripts/purge-project-history.mjs is the optional deep-scrub for
 * the rare case that history itself must go. Returns false if absent.
 */
export async function deleteProject(
  id: string,
  author: { name: string; email: string },
): Promise<boolean> {
  const current = await getProject(id);
  if (!current) return false;
  const { owner, repo } = gitConfig();
  try {
    await octokit().rest.repos.deleteFile({
      owner,
      repo,
      path: filePath(id),
      message: `delete ${id}: ${current.project.name}`,
      sha: current.sha,
      author,
      committer: author,
    });
  } catch (e) {
    if (isConflict(e)) throw new ConflictError();
    throw e;
  }
  clearCache();
  return true;
}
