/**
 * OPTIONAL deep-scrub — normal deletion does not need this. The in-app Delete
 * removes data/projects/<id>.json at HEAD, and the frontend shows nothing
 * about the project afterwards; the data repo's git history deliberately keeps
 * the old versions so an admin can restore a deleted project. Run this only
 * when that history itself must go (e.g. sensitive data): it rewrites history
 * without the file and force-updates the branch. Commits that become empty
 * (every write to that project, plus the delete commit itself) are pruned, so
 * their messages — which contain the project name — disappear as well.
 *
 * Usage:
 *   node --env-file=.env.local scripts/purge-project-history.mjs --list-deleted
 *   node --env-file=.env.local scripts/purge-project-history.mjs <id> [<id>…]           # dry run
 *   node --env-file=.env.local scripts/purge-project-history.mjs <id> [<id>…] --apply   # rewrite
 *
 * The data repo carries a ruleset blocking force-pushes ("compass-data: protect
 * history"). COMPASS_GIT_TOKEN can't toggle it, so for --apply also provide a
 * repo-admin token and the script will disable the rule for the seconds of the
 * push and re-enable it afterwards:
 *   PowerShell:  $env:COMPASS_ADMIN_TOKEN = gh auth token --user BenDowding
 *
 * Notes:
 * - The data repo's history is linear (all writes go through the contents
 *   API); the script verifies that and aborts on a merge commit.
 * - Rewriting is safe for the app: nothing persistent references commit SHAs,
 *   and blob SHAs of untouched files (the optimistic-concurrency tokens) are
 *   content-addressed, so they don't change.
 * - A commit is pruned when every file it changed is a purge target. Pruned
 *   commits make no other changes by definition, so re-parenting past them
 *   preserves every non-target diff exactly.
 * - GitHub may keep unreachable objects for a while after the force-push
 *   (until server-side gc), and any local clones still have the old history.
 *   For truly sensitive data, GitHub support can expedite removal.
 */

import { Octokit } from "@octokit/rest";

const owner = process.env.COMPASS_DATA_OWNER;
const repo = process.env.COMPASS_DATA_REPO;
const token = process.env.COMPASS_GIT_TOKEN;
if (!owner || !repo || !token) {
  console.error("COMPASS_DATA_OWNER, COMPASS_DATA_REPO and COMPASS_GIT_TOKEN must be set");
  process.exit(1);
}

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const listDeleted = args.includes("--list-deleted");
const ids = args.filter((a) => !a.startsWith("--"));
const octokit = new Octokit({ auth: token });

const pathOf = (id) => `data/projects/${id}.json`;

async function allCommits(branch) {
  const commits = [];
  for (let page = 1; ; page++) {
    const res = await octokit.rest.repos.listCommits({ owner, repo, sha: branch, per_page: 100, page });
    commits.push(...res.data);
    if (res.data.length < 100) break;
  }
  return commits;
}

async function existsAt(path, ref) {
  try {
    await octokit.rest.repos.getContent({ owner, repo, path, ref });
    return true;
  } catch (e) {
    if (e.status === 404) return false;
    throw e;
  }
}

const { data: repoInfo } = await octokit.rest.repos.get({ owner, repo });
const branch = repoInfo.default_branch;
const commits = await allCommits(branch);

// Rebuild the linear chain tip -> root, then reverse to oldest-first.
const bySha = new Map(commits.map((c) => [c.sha, c]));
const chain = [];
for (let sha = commits[0].sha; sha; ) {
  const c = bySha.get(sha);
  if (!c) throw new Error(`commit ${sha} missing from listing — aborting`);
  if (c.parents.length > 1) throw new Error(`merge commit ${sha} — history is not linear, aborting`);
  chain.push(c);
  sha = c.parents[0]?.sha;
}
chain.reverse();
console.log(`${owner}/${repo} (${branch}): ${chain.length} commits`);

if (listDeleted) {
  // Candidates: ids named in "delete <id>: …" commit messages whose file is gone at HEAD.
  const seen = new Set();
  for (const c of chain) {
    const m = c.commit.message.match(/^delete (\S+):/);
    if (m && !seen.has(m[1]) && !(await existsAt(pathOf(m[1]), branch))) {
      seen.add(m[1]);
      console.log(`  ${m[1]}  (${c.commit.message.split("\n")[0]})`);
    }
  }
  if (seen.size === 0) console.log("  no deleted projects found in history");
  process.exit(0);
}

if (ids.length === 0) {
  console.error("Pass one or more project ids (or --list-deleted to find candidates).");
  process.exit(1);
}
for (const id of ids) {
  if (await existsAt(pathOf(id), branch)) {
    console.error(`${id} still exists at HEAD — delete it in the app first, then purge.`);
    process.exit(1);
  }
}
const targets = new Set(ids.map(pathOf));
console.log(`${apply ? "Purging" : "Dry run for"}: ${ids.join(", ")}\n`);

// Which target paths exist at each commit (drives tree stripping + the start
// of the rewrite span).
const presence = new Map(); // sha -> target paths present at that commit
for (const c of chain) {
  const present = [];
  for (const t of targets) if (await existsAt(t, c.sha)) present.push(t);
  presence.set(c.sha, present);
}

const firstAffected = chain.findIndex((c) => presence.get(c.sha).length > 0);
if (firstAffected === -1) {
  console.log("No commit in history contains these files — nothing to purge.");
  process.exit(0);
}

// A commit is pruned when every file it changed is a target.
async function changesOnlyTargets(sha) {
  const { data } = await octokit.rest.repos.getCommit({ owner, repo, ref: sha });
  const files = data.files ?? [];
  return files.length > 0 && files.every((f) => targets.has(f.filename));
}

// Replay: keep the untouched prefix verbatim; from the first affected commit,
// rebuild each tree without the targets, prune empties, remap parents.
let mappedParent = null; // rewritten parent: { sha } (sha is real only in apply mode)
let rewritten = 0;
let pruned = 0;
for (let i = 0; i < chain.length; i++) {
  const c = chain[i];
  if (i < firstAffected) {
    mappedParent = { sha: c.sha };
    continue;
  }

  const line = `  ${c.sha.slice(0, 7)}  ${c.commit.message.split("\n")[0]}`;
  if (await changesOnlyTargets(c.sha)) {
    pruned++;
    console.log(`${line}  -> prune`);
    continue; // children re-parent past this commit
  }

  const present = presence.get(c.sha);
  rewritten++;
  console.log(`${line}  -> ${present.length > 0 ? "strip file + rewrite" : "rewrite (re-parent)"}`);
  if (apply) {
    let newTree = c.commit.tree.sha;
    if (present.length > 0) {
      const res = await octokit.rest.git.createTree({
        owner,
        repo,
        base_tree: c.commit.tree.sha,
        tree: present.map((p) => ({ path: p, mode: "100644", type: "blob", sha: null })),
      });
      newTree = res.data.sha;
    }
    const res = await octokit.rest.git.createCommit({
      owner,
      repo,
      message: c.commit.message,
      tree: newTree,
      parents: mappedParent ? [mappedParent.sha] : [],
      author: c.commit.author,
      committer: c.commit.committer,
    });
    mappedParent = { sha: res.data.sha };
  } else {
    mappedParent = { sha: `${c.sha.slice(0, 7)}(rewritten)` };
  }
}

console.log(`\n${rewritten} commit(s) rewritten, ${pruned} pruned.`);
if (!apply) {
  console.log("Dry run only — nothing written. Re-run with --apply to rewrite history.");
  process.exit(0);
}
if (!mappedParent) {
  console.error("Everything in history would be pruned — refusing to leave an empty branch.");
  process.exit(1);
}

await forceUpdateRef(mappedParent.sha);
console.log(`Force-updated ${branch} -> ${mappedParent.sha.slice(0, 7)}.`);
console.log(
  "Note: GitHub may retain unreachable objects until server-side gc; local clones keep old history.",
);

/** Force-update the branch; if a ruleset blocks force-pushes, use the admin
 *  token to disable exactly the non_fast_forward rulesets, push, re-enable. */
async function forceUpdateRef(sha) {
  const ref = `heads/${branch}`;
  try {
    await octokit.rest.git.updateRef({ owner, repo, ref, sha, force: true });
    return;
  } catch (e) {
    const blocked = e.status === 422 && /rule violation|force-push/i.test(e.message ?? "");
    if (!blocked) throw e;
  }

  const adminToken = process.env.COMPASS_ADMIN_TOKEN;
  if (!adminToken) {
    console.error(
      "\nA repository ruleset blocks force-pushes. Provide a repo-admin token so the\n" +
        "script can disable it for the seconds of the push and re-enable it after:\n" +
        "  PowerShell:  $env:COMPASS_ADMIN_TOKEN = gh auth token --user BenDowding\n" +
        "then re-run with --apply. (No history was rewritten on the branch yet; the\n" +
        "prepared commits are unreachable objects and re-running is safe.)",
    );
    process.exit(1);
  }

  const admin = new Octokit({ auth: adminToken });
  const { data: rulesets } = await admin.request("GET /repos/{owner}/{repo}/rulesets", { owner, repo });
  const toToggle = [];
  for (const r of rulesets) {
    if (r.enforcement !== "active" || r.source_type !== "Repository") continue;
    const { data: full } = await admin.request("GET /repos/{owner}/{repo}/rulesets/{id}", {
      owner,
      repo,
      id: r.id,
    });
    if ((full.rules ?? []).some((rule) => rule.type === "non_fast_forward")) toToggle.push(full);
  }
  if (toToggle.length === 0) {
    throw new Error("force-push blocked, but no active repo-level non_fast_forward ruleset found (org-level rule?)");
  }

  try {
    for (const r of toToggle) {
      await admin.request("PUT /repos/{owner}/{repo}/rulesets/{id}", {
        owner,
        repo,
        id: r.id,
        enforcement: "disabled",
      });
      console.log(`temporarily disabled ruleset: ${r.name}`);
    }
    await octokit.rest.git.updateRef({ owner, repo, ref, sha, force: true });
  } finally {
    for (const r of toToggle) {
      await admin.request("PUT /repos/{owner}/{repo}/rulesets/{id}", {
        owner,
        repo,
        id: r.id,
        enforcement: "active",
      });
      console.log(`re-enabled ruleset: ${r.name}`);
    }
  }
}
