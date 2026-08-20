/**
 * One-off migration: rename project files from name-derived slugs to random
 * short ids (p-xxxxxxxx), updating the `id` field inside each document. Talks
 * to the data repo through the GitHub contents API, same as the app.
 *
 * Usage:
 *   node --env-file=.env.local scripts/migrate-project-ids.mjs           # dry run
 *   node --env-file=.env.local scripts/migrate-project-ids.mjs --apply   # migrate
 *
 * Per project: create data/projects/<new>.json, then delete the old file (two
 * commits). Old URLs stop working; per-file history restarts at the migration
 * commit (the GitHub commits API does not follow renames). Everything remains
 * recoverable from the data repo's git history. Re-running skips files whose
 * name already matches the new shape.
 */

import { Octokit } from "@octokit/rest";

const owner = process.env.COMPASS_DATA_OWNER;
const repo = process.env.COMPASS_DATA_REPO;
const token = process.env.COMPASS_GIT_TOKEN;
if (!owner || !repo || !token) {
  console.error("COMPASS_DATA_OWNER, COMPASS_DATA_REPO and COMPASS_GIT_TOKEN must be set");
  process.exit(1);
}
const apply = process.argv.includes("--apply");
const octokit = new Octokit({ auth: token });

const DIR = "data/projects";
const ID_RE = /^p-[a-z0-9]{8}$/;
const author = { name: "Ben Dowding", email: "ben.dowding@n-andgroup.com" };

// Same alphabet as src/lib/id.ts — keep in step.
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
function randomProjectId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return `p-${s}`;
}

const listing = await octokit.rest.repos.getContent({ owner, repo, path: DIR });
if (!Array.isArray(listing.data)) {
  console.error(`${DIR} is not a directory in ${owner}/${repo}`);
  process.exit(1);
}
const files = listing.data.filter((e) => e.type === "file" && e.name.endsWith(".json"));
const taken = new Set(files.map((f) => f.name.replace(/\.json$/, "")));

console.log(`${owner}/${repo}: ${files.length} project file(s)${apply ? "" : " — DRY RUN (pass --apply to migrate)"}\n`);

let migrated = 0;
for (const f of files) {
  const oldId = f.name.replace(/\.json$/, "");
  if (ID_RE.test(oldId)) {
    console.log(`  skip    ${oldId} (already migrated)`);
    continue;
  }

  const res = await octokit.rest.repos.getContent({ owner, repo, path: `${DIR}/${f.name}` });
  const doc = JSON.parse(Buffer.from(res.data.content, "base64").toString("utf8"));

  let newId = randomProjectId();
  while (taken.has(newId)) newId = randomProjectId();
  taken.add(newId);

  console.log(`  ${apply ? "migrate" : "would  "} ${oldId} -> ${newId}  (${doc.name})`);
  if (!apply) continue;

  // Spread keeps the original key order; `id` is replaced in place.
  const content = Buffer.from(`${JSON.stringify({ ...doc, id: newId }, null, 2)}\n`, "utf8").toString("base64");
  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: `${DIR}/${newId}.json`,
    message: `migrate ${oldId} -> ${newId}: ${doc.name}`,
    content,
    author,
    committer: author,
  });
  await octokit.rest.repos.deleteFile({
    owner,
    repo,
    path: `${DIR}/${f.name}`,
    message: `migrate ${oldId} -> ${newId}: remove old file`,
    sha: res.data.sha,
    author,
    committer: author,
  });
  migrated++;
}

console.log(`\n${apply ? `Migrated ${migrated} project(s).` : "Dry run only — nothing written."}`);
