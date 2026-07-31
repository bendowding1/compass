---
title: "feat: Compass v1 — milestone-centric project page (Next.js + git-as-store)"
type: feat
status: active
date: 2026-06-26
origin: compass-design-doc.md
---

# feat: Compass v1 — milestone-centric project page (Next.js + git-as-store)

## Overview

Compass v1 is an internal, rigidly-standardized **project page** for a Microsoft/M365 shop. Every project renders in one fixed shape: a header (customer, lifecycle status, last-edited stamp), a stream of **milestones** each running the fixed `Requirements → Build → Test → Deploy` cycle, a **Responsible** panel of five named roles, and a **Project docs** hub of SharePoint links. The rigidity is the product: there is one shape, enforced, no per-project configuration.

This plan implements that page as a **Next.js 16 (App Router, TypeScript)** app deployed **serverless**, with **no database**. Each project is a single JSON document stored in a dedicated **git data repo**, read and written through the git provider's API. The file's blob SHA is the optimistic-concurrency token, and every save is a commit, so git itself provides the change history, audit trail, and backups the product needs. A shared **Zod schema** is the single source of truth for the shape (D1). Auth is **Microsoft Entra ID** (OIDC); any authenticated employee can read and edit (D2).

**This plan supersedes the relational-DB assumption in the origin design doc** (`compass-design-doc.md` → "Engineering Plan"). The decision and rationale are in Key Technical Decisions; the design doc should be synced after this plan is approved.

## Problem Frame

Internal project delivery is chaotic because there is no single standard shape for a project — information lives in email, SharePoint, Jira, chat, and people's heads, and every project is structured differently. Compass encodes and enforces one standard shape so anyone can find information, see who owns what, and trust where a release actually is. v1's value is "one understandable, standardized page per project, with the docs and the people," not live status (step status is human-entered). See origin: `compass-design-doc.md` (Problem Statement, The Model, Premises).

The eng review (`compass-design-doc.md` → "Engineering Plan" / "GSTACK REVIEW REPORT") locked the architecture decisions D1, D2, D5, D6 and produced build tasks E1–E10 in `compass-build-tasks.jsonl`. This plan refines those tasks for the file-based architecture chosen after the review (no DB; Next.js + git-as-store). Where this plan and E1–E10 differ, this plan is authoritative.

## Requirements Trace

- **R1** — One standardized milestone-centric page per project: header (customer, lifecycle, stamp), milestone stream with 4-step trackers, Responsible panel (5 roles), Project docs. (origin: Success Criteria, Design)
- **R2** — Rigid shape, no per-project config: lifecycle / role / step enums fixed and enforced; no add-field or new-type path. (origin: D1, Premise 2)
- **R3** — Open editing for any authenticated employee (D2); every edit writes `updatedBy`/`updatedAt` (D2a); archive/close, never hard-delete (D2b).
- **R4** — Sustaining work is an ordinary milestone; lifecycle is a project-level label (D5).
- **R5** — Concurrent edits never silently clobber each other (D6) via optimistic concurrency.
- **R6** — The "running late" flag is derived from date math (target passed AND step not done), never entered. (origin: auto-derived slip rule)
- **R7** — Doc hub: store/render raw SharePoint URLs only (no fetch); a developer can find every doc from one page. (origin: Dependencies, Success Criteria)
- **R8** — The empty state is the adoption screen and is built first. (origin: Design → empty state)
- **R9** — SSO via Entra ID; read for any authenticated employee. (origin: Dependencies)
- **R10** — Change history is preserved (directly addresses the "milestone changes vanishing" pain) via git commit history. (origin: Status Quo, change-history note)

## Scope Boundaries

- **Not** a live status system. Step status is human-entered; the only derived truth is the slip flag (R6). v1 must never be confused with accurate live status.
- **No** per-role views / per-role edit permissions. Read and edit are both "any authenticated employee" (D2). Role-scoped editing is phase 2.
- **No** dev board, build/test/deploy handoff ownership, test results, or deployment records. Modeled-adjacent (they hang off a milestone) but not built.
- **No** Microsoft Graph integration, doc-title fetch, thumbnails, or permission-trimmed previews. Raw links only (R7).
- **No** database, ORM, or hosted datastore.
- **No** cross-project dashboard / portfolio view, search, or reporting in v1 (the list page is a simple directory listing).

### Deferred to Separate Tasks

- **Read caching layer** (Next `cacheComponents` + `updateTag`, or Vercel KV / Upstash): future iteration when git API traffic grows or outage-resilience is needed. v1 reads are dynamic.
- **Index/manifest document** for fast listing/aggregation: future, when the list view outgrows a directory listing.
- **Multi-file atomic writes** (Git Data API blob→tree→commit→ref): only if a future feature must commit >1 file atomically. v1's one-file-per-project design stays on the simple atomic single-file path.
- **PII right-to-erasure tooling** (history rewrite / identity tokenization beyond `customerId`): policy + tooling deferred (see Risks).

## Context & Research

### Relevant Code and Patterns

Greenfield — no existing code, no `docs/solutions/`, not yet a git repo. The only prior artifacts are the origin design doc and the hand-built mockup `compass-pm-page-mockup-v3.html` (use as the visual reference for the page layout and empty state).

### External References (from research, June 2026)

Stack and versions: **Next.js 16.2.x** on **React 19.2** (Node 20.9+, TS 5.1+); **Auth.js v5** = `next-auth@beta` (`5.0.0-beta.31`, pin exact — `latest` is still the old v4); **Zod 4.4.3**; **Octokit 5.0.5** (ESM-only) or `@octokit/rest` 22.0.1 + `@octokit/auth-app`. Test stack: **Vitest** (ESM-native, required because octokit is ESM-only) + React Testing Library + **Playwright** for E2E.

Key external facts that shape the design:
- **Server Actions are public POST endpoints.** Every action must call `await auth()` and re-validate args with Zod inside its own body; TS types are not runtime enforcement. CSRF/Origin check is built in. (nextjs.org/blog/security-nextjs-server-components-actions)
- **Never authorize only in `proxy.ts`/middleware** (CVE-2025-29927). `proxy.ts` is a UX redirect layer; real authz is `await auth()` in each action/DAL function.
- **Auth.js with no adapter → JWT (encrypted cookie) sessions automatically** — exactly right for serverless, no DB. Provider `MicrosoftEntraID` (id `microsoft-entra-id`); single-tenant issuer `https://login.microsoftonline.com/<TENANT_ID>/v2.0` restricts sign-in to your employees. (authjs.dev)
- **Zod `z.strictObject` rejects unknown fields** — this is the runtime form of "no endpoint to add fields" (D1/R2). Validate on read (catch drift/corruption) and on write (reject bad input). `z.infer` derives all TS types from the one schema. (zod.dev/v4)
- **Git write/concurrency:** `repos.getContent` returns base64 content + blob `sha`; `repos.createOrUpdateFileContents` requires that `sha` to update — a stale SHA returns **409 Conflict**; the success response returns the new blob SHA, which is chained back to the form without a re-GET. Single-file PUT is atomic. (docs.github.com/en/rest/repos/contents)
- **The real rate ceiling is secondary limits** (~80 writes/min, ~500 writes/hour), not the 5,000/hr headline → one commit per explicit Save, never per keystroke. Replica lag can cause **spurious 409s** on rapid same-branch commits → serialize writes per project + retry with backoff, chaining the SHA from the write response.
- **The app needs its own git credential** (a GitHub App via `@octokit/auth-app`, preferred; or a fine-grained service PAT) — employees auth via Entra, not GitHub. Set the commit `author` to the signed-in Entra user for attribution; the authenticated principal stays the service account. Mark all git modules `import 'server-only'`.
- **Honest scale assessment:** git-as-store is sound here (small JSON docs, read-heavy, low write volume, change-history is the requirement). Documented failures are all at scale (10k+ docs, large blobs) — graduation triggers are in Risks.

### Carried-forward decisions (origin doc)

D1 (rigidity enforced), D2/D2a/D2b (open editing + stamp + archive), D5 (sustaining = milestone), D6 (optimistic locking), the auto-derived slip rule, and "SharePoint linked not integrated" all carry forward, re-expressed for the file-based stack below.

## Key Technical Decisions

- **No database; per-project JSON in a git data repo (via provider API).** Rationale: the data is document-shaped (one project = one self-contained doc = one page load, which also moots the eng review's N+1 note); git gives change history + audit + backups for free, which is a real requirement (R10) a DB would make harder; JSON is AI-accessible; no datastore to operate. Reversible — the Zod schema makes a later DB import mechanical. **Supersedes the design doc's relational-DB assumption.**
- **D1 enforced by Zod, not DB constraints.** A shared `z.strictObject` schema with fixed `z.enum`s is the one shape, validated on every read and write. There is deliberately no endpoint to add fields or types. `schemaVersion: z.literal(1)` + migrate-on-read handles shape changes — cheaper here than a DB migration (a scripted transform over JSON files, runnable by an agent), which softens (but does not remove) the need to settle the Sign-off question before shipping the step enum.
- **D6 via the blob SHA as optimistic-concurrency token.** Read returns the SHA; write requires it; stale → 409 → conflict UX. Serialize writes per project + retry-with-backoff to absorb replica-lag spurious 409s. Single-file-per-project keeps writes atomic with no Git Data API dance.
- **Mutations via Server Actions; reads via Server Components.** Form-heavy human-driven page → `<form action={saveProject}>` with `useActionState`/`useFormStatus`. Only one Route Handler (the Auth.js catch-all). Authz is `await auth()` inside every action/DAL function; `proxy.ts` only redirects anonymous users.
- **Reads dynamic for v1** (no `cacheComponents`) → always fresh, read-your-writes for free, simplest. Caching is the first scale lever (Deferred).
- **One commit per explicit Save** (no per-keystroke autosave) to stay well under the secondary write rate limits.
- **GitHub as the default provider** (clearest API, GitHub App auth model). **Azure DevOps is the M365-native alternative** (PAT/service principal; native multi-file-atomic push; branch-tip concurrency rather than per-blob SHA). Final provider choice is an Open Question; the storage adapter isolates it.
- **Storage behind a thin adapter** (`readProject`/`writeProject`/`listProjects`/`readCustomers`) so the provider — and a future DB — is swappable.

## Open Questions

### Resolved During Planning

- Stack? → TypeScript + Next.js 16 (App Router), serverless. (user decision)
- Database or files? → Files, git-as-store, no DB. (user decision; rationale above)
- Host? → Serverless (Vercel / AWS Amplify) + git-provider API store. (user decision)
- Auth without a DB? → Auth.js v5 JWT sessions, Entra provider. (research)
- How is D1 enforced without a DB? → Zod `strictObject` + enums, validated on read/write. (research)

### Deferred to Implementation

- **Caching:** whether/when to enable `cacheComponents` + `updateTag` vs. dynamic reads — decide from observed internal traffic against the git rate limits. v1 ships dynamic.
- **Exact JSON field names / form widgets:** finalized while building Units 2, 5, 6 against the mockup.
- **GitHub App vs service PAT** for v1: start with whichever is faster to provision; the DAL hides it.

### Blocking — resolve before the noted unit

- **Provider choice (GitHub vs Azure DevOps):** confirm before Unit 4 (changes the DAL implementation, not its interface).
- **Sign-off step:** is `Requirements → Sign-off → Build → Test → Deploy` a real fifth step? Settle before Unit 2 ships the step enum. (origin: Open Questions). Cheaper to change later here than under a DB, but still resolve early.
- **Prerequisite gate — The Assignment:** the eng review gated the build on The Assignment passing (the N=1 real-project mock validation, using `compass-pm-page-mockup-v3.html`). Treat as a precondition before Unit 1. (origin: The Assignment, GSTACK REVIEW REPORT)

## Output Structure

    compass/
      src/
        app/
          layout.tsx                         # root layout (Server Component)
          page.tsx                           # project list (Server Component; lists git dir)
          projects/
            [id]/
              page.tsx                       # await params; load + Zod-parse; render view + form shell
              loading.tsx                    # skeleton of the known milestone/step nodes
              error.tsx                      # inline "couldn't load — retry"
              actions.ts                     # "use server"; saveProject(): auth() -> Zod -> commit
              _components/
                project-form.tsx             # "use client"; useActionState + useFormStatus
          api/
            auth/[...nextauth]/route.ts      # export const { GET, POST } = handlers
        components/
          project-view.tsx                   # read-only render of a project (Server Component)
          milestone-card.tsx                 # one milestone + its 4-step tracker + slip badge
          responsible-panel.tsx             # the 5 fixed roles
          empty-state.tsx                    # the adoption screen (build first)
        lib/
          auth.ts                            # NextAuth(): handlers, auth, signIn, signOut (jwt)
          auth.config.ts                     # providers/callbacks (slim; shared with proxy)
          slip.ts                            # pure derive-slip function (no I/O)
          git/
            client.ts                        # 'server-only'; Octokit via GitHub App / PAT
            projects.ts                      # 'server-only'; DAL: read/list/write/archive project JSON
            customers.ts                     # 'server-only'; read customers.json
          schema/
            project.ts                       # Zod strictObject + enums + z.infer types (single source)
        proxy.ts                             # export default NextAuth(authConfig).auth (UX redirect only)
      tests/
        e2e/                                 # Playwright: create-project, edit->stamp->slip, empty-state, conflict
      next.config.ts
      vitest.config.ts
      eslint.config.mjs
      .env.example
      package.json
      tsconfig.json

    <data repo, separate>
      data/
        projects/<projectId>.json
        customers.json

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

**Project document shape** (the Zod schema is the source of truth; fixed-key objects for roles/steps make the rigid set structural — you cannot add a sixth role):

    data/projects/<id>.json
    {
      schemaVersion: 1,
      id, name,
      customerId,                                  // must exist in customers.json
      lifecycleStatus: "NPD" | "Sustaining" | "Closed",
      roles: { PM, Development, Test, Deploy, CustomerCare },   // person (string) per fixed role
      milestones: [
        { id, name, targetDate, actualDate?, releaseUrl?,   // releaseUrl: the release package — SharePoint now, git artifact later
          steps: {
            Requirements: { status, date? },       // status: "upcoming"|"current"|"done"
            Build:        { status, date? },
            Test:         { status, date? },
            Deploy:       { status, date? } },
          updatedBy, updatedAt }
      ],
      docLinks: [ { id, label, url } ],            // raw SharePoint URLs, rendered as links
      archived: false,
      updatedBy, updatedAt                          // last-edit stamp (D2a)
    }

    data/customers.json  ->  [ { id, name }, ... ]  // admin-maintained

**Save (write) flow — the non-obvious part (auth, validation, concurrency, conflict):**

    Browser  project-form.tsx ("use client")
      | submit  (useActionState -> saveProject(prev, formData))
      v
    Server Action  app/projects/[id]/actions.ts ("use server")   <- PUBLIC POST endpoint
      | 1. await auth()            -> no session?  return { error: "unauthorized" }     (R9)
      | 2. ProjectSchema.parse()   -> invalid/extra field? return { fieldErrors }        (D1/R2)
      | 3. stamp updatedBy/updatedAt from session user (Entra oid/email)                 (D2a/R3)
      v
    Git DAL  lib/git/projects.ts ("server-only")
      | 4. createOrUpdateFileContents({ path, content, sha: expectedSha,
      |                                 author: <entra user>, message })                 (D6/R5/R10)
      |      |- stale sha -> 409  --> re-getContent -> return { conflict, latestSha }  -> form shows
      |      |                                                                            "reload" UX
      |      |- spurious 409 (replica lag) -> retry w/ backoff, chain SHA from response
      |      \- ok -> returns new commit + new blob sha
      v
      | 5. return { ok, newSha }   (form chains newSha for the next save)
      v
    Browser  <- success state, or conflict prompt

**Read flow:** Server Component calls the DAL → `getContent` → base64 decode → `JSON.parse` → `ProjectSchema.parse` (migrate-on-read if `schemaVersion` < current) → render. Dynamic per request in v1.

## Implementation Units

- [ ] **Unit 1: Project scaffold + tooling**

**Goal:** A booting Next.js 16 App Router app in TypeScript with lint/test tooling and env scaffolding, ready for feature work.

**Requirements:** Enables all.

**Dependencies:** The Assignment gate passed (prerequisite).

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `.env.example`
- Create: `src/app/layout.tsx`, `src/app/page.tsx` (placeholder list)
- Test: `src/app/layout.test.tsx` (smoke render)

**Approach:**
- `next@latest` (16.2.x), React 19.2, Node 20.9+, TS 5.1+. Turbopack default. ESLint flat config (`next lint` is removed). Vitest + RTL configured for the App Router.
- `.env.example` documents `AUTH_*` and git-credential vars (filled in Units 3, 4, 8).

**Patterns to follow:** Next 16 default project structure with `src/` (nextjs.org/docs project-structure).

**Test scenarios:**
- Test expectation: none beyond a smoke test — pure scaffolding. Happy path: app builds, typechecks, and the root layout renders without error.

**Verification:** `next build` and the typecheck pass; dev server boots; a smoke test renders the layout.

- [ ] **Unit 2: Domain schema — the D1 contract (Zod)**

**Goal:** One Zod schema defining the fixed shape, with derived TS types. This is rigidity-as-code (D1/R2).

**Requirements:** R2, R4 (lifecycle states incl. Sustaining), R3 (stamp fields), R7 (docLinks).

**Dependencies:** Unit 1.

**Files:**
- Create: `src/lib/schema/project.ts` (enums, `ProjectSchema` via `z.strictObject`, `CustomerSchema`, `z.infer` types, `schemaVersion`)
- Test: `src/lib/schema/project.test.ts`

**Approach:**
- Fixed enums: `lifecycleStatus` (NPD/Sustaining/Closed), `role` keys (PM/Development/Test/Deploy/CustomerCare), step keys (Requirements/Build/Test/Deploy), step `status` (upcoming/current/done).
- `roles` and `steps` as fixed-key `strictObject`s (cannot add a key) — structural rigidity. `docLinks` an array of `{id,label,url}`.
- `schemaVersion: z.literal(1)`; document a migrate-on-read seam for future bumps.
- Export `type Project = z.infer<typeof ProjectSchema>` etc. — never hand-write types.

**Execution note:** Resolve the **Sign-off step** Open Question before finalizing the step enum.

**Patterns to follow:** Zod 4 `strictObject`, `z.enum`, `z.infer` (zod.dev/v4).

**Test scenarios:**
- Happy path: a fully-valid project parses; types infer correctly.
- Edge case: a project with zero milestones (empty-state data) parses.
- Error path (this IS the rigidity test, R2): an unknown/extra top-level field is **rejected** (`strictObject`); an invalid `lifecycleStatus` is rejected; an invalid step `status` is rejected; a missing required field is rejected; a sixth role key is rejected.
- Edge case: `schemaVersion` mismatch routes to the migrate-on-read seam (stub returns current shape).

**Verification:** Valid fixtures parse; every malformed fixture throws with a clear path; types are derived, not duplicated.

- [ ] **Unit 3: Entra authentication (Auth.js v5, JWT, no DB)**

**Goal:** Microsoft Entra SSO; every authenticated employee can sign in; server-side `auth()` available everywhere; anonymous users redirected.

**Requirements:** R9 (and the gate enforced by R2/R3 actions).

**Dependencies:** Unit 1.

**Files:**
- Create: `src/lib/auth.ts` (`NextAuth({ providers:[MicrosoftEntraID], session:{strategy:"jwt"} })` → `handlers, auth, signIn, signOut`)
- Create: `src/lib/auth.config.ts` (slim providers/callbacks shared with proxy)
- Create: `src/app/api/auth/[...nextauth]/route.ts` (`export const { GET, POST } = handlers`)
- Create: `src/proxy.ts` (`export default NextAuth(authConfig).auth` + `config.matcher`)
- Modify: `.env.example` (`AUTH_MICROSOFT_ENTRA_ID_ID/SECRET/ISSUER`, `AUTH_SECRET`, `AUTH_TRUST_HOST`)
- Test: `src/lib/auth.test.ts`

**Approach:**
- `next-auth@beta` (pin exact `5.0.0-beta.31`). No adapter → JWT cookie sessions (serverless-friendly, no DB).
- Single-tenant issuer restricts sign-in to your employees. Expose only `name`, `email`, Entra `oid` via the session callback.
- `proxy.ts` redirects anonymous users only — **not** an authz boundary (CVE-2025-29927). Real authz lives in actions/DAL.
- A small `requireUser()` helper wrapping `await auth()` for reuse in actions.

**Execution note:** Provider integration is verified manually/E2E (real Entra). Unit-test the `requireUser()` helper and the "action rejects when no session" behavior with a mocked `auth()`.

**Patterns to follow:** authjs.dev Entra provider + v5 migration + "protecting resources" guidance.

**Test scenarios:**
- Happy path: `requireUser()` returns the user when a session exists.
- Error path: `requireUser()` / a guarded action rejects (unauthorized) when no session.
- Integration (E2E, Unit 8): full Entra sign-in redirect → callback → authenticated session; a non-tenant account cannot sign in.

**Verification:** Anonymous hits redirect to sign-in; authenticated server code reads the user; the catch-all route handles the OAuth dance.

- [ ] **Unit 4: Git storage adapter (the data layer)**

**Goal:** A `server-only` DAL that reads, lists, writes, and archives project JSON via the git provider, validating with Zod, using the blob SHA for optimistic concurrency, and attributing commits to the Entra user.

**Requirements:** R2 (validate on read/write), R3 (stamp, archive-not-delete), R5/D6 (concurrency), R7 (customers), R10 (commit history).

**Dependencies:** Unit 2 (schema), Unit 3 (user identity for attribution). **Provider choice resolved.**

**Files:**
- Create: `src/lib/git/client.ts` (`import 'server-only'`; Octokit via `@octokit/auth-app` or service PAT; throttling/retry plugins)
- Create: `src/lib/git/projects.ts` (`readProject`, `listProjects`, `writeProject(expectedSha)`, `archiveProject`)
- Create: `src/lib/git/customers.ts` (`readCustomers`)
- Test: `src/lib/git/projects.test.ts` (mock Octokit)

**Approach:**
- `readProject`: `getContent` → base64 decode → `JSON.parse` → `ProjectSchema.parse` (migrate-on-read) → return `{ project, sha }`.
- `writeProject`: validate with Zod → `createOrUpdateFileContents({ sha: expectedSha, author: <entra user>, message })` → return new SHA. On 409: distinguish replica-lag (retry w/ backoff, chain SHA from response) from real conflict (return a conflict result with the latest SHA). Serialize writes per project id.
- `archiveProject`: set `archived: true` (or move under an `archived/` path) and commit — never `deleteFile` from ordinary edits (D2b).
- Customer existence check: validate `customerId` against `readCustomers()` before write (R2 referential integrity, app-layer).
- `listProjects`: `getContent` on the projects directory (array, fine ≤1000). One commit per write (rate-limit discipline).

**Execution note:** Characterization-first — write the mocked-Octokit tests for the read/write/conflict contract before wiring real calls.

**Patterns to follow:** GitHub Contents API (sha token, base64, 409 semantics); `@octokit/plugin-throttling` + `@octokit/plugin-retry`; `import 'server-only'`.

**Test scenarios:**
- Happy path: `readProject` decodes, parses, and returns content + SHA; `writeProject` commits and returns the new SHA; `listProjects` returns summaries.
- Error path (R5/D6): `writeProject` with a stale SHA → returns a conflict result (no overwrite), surfacing the latest SHA.
- Edge case: a spurious 409 (replica lag, content matches intent) → retried/treated as success, not a user-facing conflict.
- Error path (R2): `writeProject` with data failing Zod → rejected before any commit; `customerId` not in `customers.json` → rejected.
- Happy path (R3/D2b): `archiveProject` sets the flag/moves the file and commits; no hard delete path exists.
- Integration (R3/R10): the commit author equals the signed-in Entra user; the document `updatedBy` matches.

**Verification:** All DAL operations behave against a mocked provider; conflicts are returned, never silently resolved; commits attribute to the real user.

- [ ] **Unit 5: Project page (read), states, and empty state**

**Goal:** Render a project in the fixed shape, plus loading/error states and the empty-state adoption screen (built first within this unit).

**Requirements:** R1, R4, R7, R8.

**Dependencies:** Unit 3 (auth), Unit 4 (read).

**Files:**
- Create: `src/app/page.tsx` (list — `listProjects`), `src/app/projects/[id]/page.tsx` (`await params`; read + render)
- Create: `src/app/projects/[id]/loading.tsx`, `src/app/projects/[id]/error.tsx`
- Create: `src/components/project-view.tsx`, `src/components/milestone-card.tsx`, `src/components/responsible-panel.tsx`, `src/components/empty-state.tsx`
- Test: `src/components/empty-state.test.tsx`, `src/components/project-view.test.tsx`, `src/components/milestone-card.test.tsx`

**Approach:**
- Server Components read server-side (token never reaches the browser). `await params` (Next 16 async params).
- Layout mirrors `compass-pm-page-mockup-v3.html`: header (customer chip, lifecycle 3-way, "updated by X on Y" stamp), milestone stream with highlighted current milestone, Responsible panel (5 roles), Project docs (raw links).
- **Empty state (R8, build first):** lifecycle NPD, "Select customer" required, PM set + other roles "Assign", milestones area stating "nothing happens outside a milestone" with one action: "Create the first milestone."
- `loading.tsx` = skeleton of the known nodes; `error.tsx` = inline "couldn't load — retry."

**Patterns to follow:** mockup `compass-pm-page-mockup-v3.html`; Next 16 Server Components + `loading.tsx`/`error.tsx` conventions.

**Test scenarios:**
- Happy path (R1): a populated project renders header, milestone stream, Responsible (5 roles), and doc links; the current milestone is visually highlighted.
- Edge case (R8): a brand-new (zero-milestone) project renders the empty-state adoption screen with the create-first-milestone action, not "no items."
- Edge case (R7): doc links render as anchors to the raw URLs with no network fetch.
- Error path: the project page error boundary shows the retry message when the read fails.
- Integration (E2E, Unit 8): empty-state renders for a new project end-to-end.

**Verification:** Populated and empty projects render correctly against the mockup; states behave; no token in client bundles.

- [ ] **Unit 6: Editing — server actions + conflict UX**

**Goal:** Open editing of a project via a Server Action, with per-edit stamping, optimistic-lock conflict handling, archive, and milestone creation.

**Requirements:** R3 (open edit + stamp + archive), R5/D6 (conflict), R2 (validation), R8 (create first milestone).

**Dependencies:** Unit 4 (DAL write), Unit 5 (page/form shell).

**Files:**
- Create: `src/app/projects/[id]/actions.ts` (`saveProject`, `createMilestone`, `archiveProject` actions)
- Create: `src/app/projects/[id]/_components/project-form.tsx` (`"use client"`, `useActionState` + `useFormStatus`)
- Test: `src/app/projects/[id]/actions.test.ts`, `src/app/projects/[id]/_components/project-form.test.tsx`

**Approach:**
- Each action: `await requireUser()` → `ProjectSchema.parse(args)` → stamp `updatedBy`/`updatedAt` → DAL `writeProject(expectedSha)`. Return structured results (`{ ok, newSha }` | `{ fieldErrors }` | `{ conflict, latestSha }`) via `useActionState` — do not throw for expected validation/conflict cases.
- One commit per explicit Save (no per-keystroke autosave) — rate-limit discipline.
- Conflict UX (D6): on a real 409, show "This project changed since you opened it — reload to see the latest"; never silently overwrite. The form chains the returned SHA for the next save.
- Archive action confirms then sets archived (D2b). Create-first-milestone wires the empty-state CTA.

**Execution note:** Test-first on the action contract (auth → validate → conflict → success), since it is the trust boundary.

**Patterns to follow:** Next 16 Server Actions security model (`auth()` + Zod inside the action); `useActionState`/`useFormStatus`.

**Test scenarios:**
- Happy path (R3): a valid edit by an authenticated user commits and returns the new SHA; `updatedBy`/`updatedAt` reflect the user; a new milestone is created with the four fixed steps.
- Error path (R9): an unauthenticated invocation is rejected (actions are public endpoints).
- Error path (R2): invalid/extra-field input returns field errors and does **not** commit.
- Error path (R5/D6): a stale-SHA save returns the conflict result and shows the reload prompt; no overwrite occurs.
- Happy path (R3/D2b): archive sets the flag/commits; there is no hard-delete path.
- Integration (E2E, Unit 8): edit a step → stamp updates → slip badge re-derives; two concurrent edits → second sees the conflict prompt.

**Verification:** Edits commit with attribution; bad input and stale writes are handled as data, not crashes; conflicts never lose work.

- [ ] **Unit 7: Slip rule (derived truth)**

**Goal:** A pure function that derives the "running late" flag from date math, surfaced as a badge on the page.

**Requirements:** R6.

**Dependencies:** Unit 2 (types), Unit 5 (page to surface the badge).

**Files:**
- Create: `src/lib/slip.ts` (pure `isLate(step, now)` / `milestoneSlip(milestone, now)`)
- Modify: `src/components/milestone-card.tsx` (render the "late Nw" badge)
- Test: `src/lib/slip.test.ts`

**Approach:**
- `late = (step.targetDate has passed) AND (step.status !== "done")`. Pure, no I/O; `now` injected for testability. Never stored, never entered (R6) — the one derived-truth signal.

**Patterns to follow:** keep it a pure function (mirrors origin "auto-derived slip rule").

**Test scenarios:**
- Happy path: target date passed AND not done → late; not-yet-passed → not late.
- Edge case: exactly on the target date (boundary); done-but-late (done → never late); no target date set (→ not late); timezone boundary (date-only comparison is stable across TZ).

**Verification:** All slip cases pass deterministically with injected `now`; the badge appears only when derived-late.

- [ ] **Unit 8: Deploy + provider setup (distribution)**

**Goal:** Compass running in the cloud with working Entra SSO and git-backed saves, plus the E2E suite.

**Requirements:** R9, R10 (and end-to-end proof of all).

**Dependencies:** Units 1–7.

**Files:**
- Create: deploy config (`vercel.json` or Amplify config), `tests/e2e/*` (Playwright: create-project, edit→stamp→slip, empty-state, conflict), `README.md` (setup runbook)
- Modify: `.env.example` → real secrets in the platform secret manager

**Approach:**
- Serverless deploy (Vercel or Amplify). `AUTH_TRUST_HOST=true` behind a proxy/CDN (Amplify/CloudFront).
- Entra app registration: redirect URI `https://<host>/api/auth/callback/microsoft-entra-id` (+ localhost for dev), single-tenant.
- Git data repo provisioned (private); GitHub App (or service PAT) created and scoped to that repo; private key in the platform secret manager. Seed `customers.json`.
- If self-hosting/Amplify behind your own proxy, strip the `x-middleware-subrequest` header at the edge (CVE-2025-29927 hardening).

**Test scenarios:**
- Test expectation: none for config itself. Integration (E2E): sign in via Entra; create a project from empty state; edit a step and see the stamp + slip badge; trigger a concurrent-edit conflict and see the reload prompt; confirm a real commit lands in the data repo with the user as author.

**Verification:** A signed-in employee completes the create→edit flow in the deployed app, and the edit appears as an attributed commit in the data repo.

## System-Wide Impact

- **Interaction graph:** Server Actions are public POST endpoints → every action and DAL function independently enforces `auth()` + Zod; `proxy.ts` is UX-only. The git provider is an external dependency in the request path for both reads and writes.
- **Error propagation:** expected cases (validation failure, 409 conflict, unauthorized) are returned as structured data via `useActionState`, not thrown; unexpected cases hit `error.tsx`. Write failures must be loud and non-destructive ("couldn't save, your changes are kept, retry") — silently dropping a write recreates the "changes vanishing" problem the product exists to fix.
- **State lifecycle risks:** optimistic concurrency via blob SHA (D6); serialize-per-project + retry to absorb replica-lag 409s; archive-not-delete (D2b) means no destructive path; one-commit-per-save keeps writes atomic and under rate limits.
- **API surface parity:** any future programmatic/agent access to project data must go through the same Zod validation and stamping (ideally the same DAL), or rigidity and attribution can be bypassed.
- **Integration coverage:** the Entra sign-in flow and a real git commit-with-attribution are only proven E2E (Unit 8), not by unit mocks.
- **Unchanged invariants:** SharePoint remains the document store (Compass links, never replaces — R7); Compass tracks releases, it is not the build/deploy system.

## Risks & Dependencies

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Spurious 409s from git read-replica lag on rapid saves | Med | Med | Chain the SHA from the write response; serialize writes per project; retry w/ backoff; distinguish replica lag from real conflict |
| Secondary write rate limits (~80/min, ~500/hr) | Low (at v1 scale) | Med | One commit per explicit Save (no per-keystroke autosave); throttling/retry plugins; batch only via a future index |
| Git provider outage makes saves (and dynamic reads) fail | Low | High | Loud non-destructive write failures + retry UX; read-caching is the first scale lever (Deferred) for outage resilience; data repo is a clone-able cold backup |
| Same-project concurrent edits under open editing (D2) | Med | Med | Optimistic-lock conflict UX ("reload to see latest"); optional soft-presence indicator later |
| PII (customer/people names) in immutable git history vs. right-to-erasure | Low | Med-High | Private data repo, least-privilege Entra-gated access; projects reference `customerId` not raw names; document an erasure policy; treat history rewrite as a rare planned op (Deferred) |
| Auth.js v5 is a pinned beta | Low | Low | Pin exact version; it is widely run in production; upgrade deliberately |
| Authorizing only in `proxy.ts` (CVE-2025-29927 class) | Low | High | `auth()` inside every action/DAL; strip `x-middleware-subrequest` at the edge if self-proxied |
| Listing/aggregation has no query layer (N+1) | Low (v1) | Med (later) | v1 uses a directory listing; add an index/manifest doc when the list view grows (Deferred) |

**Dependencies / Prerequisites:**
- **The Assignment passes** (N=1 mock validation) before Unit 1 — the eng-review build gate.
- **Sign-off step** resolved before Unit 2; **provider (GitHub vs Azure DevOps)** resolved before Unit 4.
- Entra app registration + tenant ID; a private git data repo + service credential; a serverless host (Vercel/Amplify).

## Phased Delivery

- **Phase 0 (gate, no code):** The Assignment — validate the standardized page against one real project using `compass-pm-page-mockup-v3.html`. Resolve the Sign-off and provider questions. Go/no-go.
- **Phase 1 (foundation):** Units 1–4 — scaffold, schema, auth, DAL. Internally testable end-to-end at the data layer.
- **Phase 2 (the page):** Units 5, 7 — read render, empty state, slip. The "visibly better shared place" that earns adoption, read-only first.
- **Phase 3 (editing):** Unit 6 — open editing, stamping, conflict UX.
- **Phase 4 (ship):** Unit 8 — deploy, Entra + git provisioning, E2E.

## Documentation / Operational Notes

- README runbook: env vars, Entra app registration, GitHub App/data-repo setup, deploy.
- Secrets in the platform secret manager only; data repo private.
- Monitoring: watch git API rate-limit headers and 409 rates; both are early signals to enable caching or revisit the store (graduation triggers in Context).
- After approval, sync `compass-design-doc.md` (Engineering Plan / GSTACK REVIEW REPORT) to reflect the no-DB, git-as-store architecture so the origin doc and this plan agree.

## Sources & References

- **Origin document:** `compass-design-doc.md` (Problem Statement, The Model, Premises, Engineering Plan, GSTACK REVIEW REPORT)
- **Build tasks refined by this plan:** `compass-build-tasks.jsonl` (eng-review E1–E10)
- Visual reference: `compass-pm-page-mockup-v3.html`
- Next.js 16 / caching / security: https://nextjs.org/blog/next-16 · https://nextjs.org/docs/app/getting-started/caching · https://nextjs.org/blog/security-nextjs-server-components-actions
- Auth.js v5 + Entra: https://authjs.dev/getting-started/providers/microsoft-entra-id · https://authjs.dev/getting-started/migrating-to-v5
- CVE-2025-29927: https://github.com/advisories/GHSA-f82v-jwr5-mffw
- Zod 4: https://zod.dev/v4
- GitHub Contents API + rate limits + 409: https://docs.github.com/en/rest/repos/contents · https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api · https://github.com/orgs/community/discussions/62198
- Octokit / GitHub App auth: https://github.com/octokit/auth-app.js/
- Azure DevOps Pushes (alternative provider): https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pushes/create?view=azure-devops-rest-7.1
