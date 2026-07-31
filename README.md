# Compass

Internal, rigidly-standardized **milestone-centric project pages** for an M365 shop. Every project has the same fixed shape: a header (customer, lifecycle, last-edited stamp), a stream of milestones each running `Requirements → Build → Test → Deploy`, the five Responsible roles, and a document hub. Because every page looks the same, anyone can find a project's status without hunting through email and SharePoint.

- Design source of truth: [`compass-design-doc.md`](./compass-design-doc.md)
- Implementation plan: [`docs/plans/2026-06-26-001-feat-compass-v1-project-page-plan.md`](./docs/plans/2026-06-26-001-feat-compass-v1-project-page-plan.md)

## Architecture

- **TypeScript + Next.js 16** (App Router, React 19). Server Components for reads, Server Actions for writes. Built to deploy serverless.
- **No database — "git as store."** Each project is a JSON document in a separate git data repo (`compass-data`), read and written via the GitHub API. The blob SHA is the optimistic-lock token, and every save is a commit — so change history, audit, and backups come for free. All data access sits behind a storage adapter in [`src/lib/git/`](./src/lib/git).
- **Rigidity** is enforced by a shared **Zod** schema ([`src/lib/schema/project.ts`](./src/lib/schema/project.ts)): fixed enums, `strictObject`, validated on both read and write.
- **Resilience:** the GitHub client uses the throttling + retry plugins (honors rate limits and `Retry-After`), and the expensive reads (project list, customers) are cached briefly and cleared on every write.

## Two repos

| Repo | What | `main` policy |
| --- | --- | --- |
| `bendowding1/compass` (this one, personal GitHub) | the app — deployed on **Vercel** ([`docs/deploy-vercel.md`](./docs/deploy-vercel.md)) | protected — land changes via branch + PR |
| `N-AndGroup/compass-data` (company org) | private data store (customers + per-project JSON) | must **allow direct pushes** (the app commits to it) |

Keep `compass-data` **private** — it holds customer and people names. The app
repo living outside the org changes nothing about data access: the app reaches
`compass-data` with an org-scoped credential (`COMPASS_GIT_TOKEN`) either way.

## Prerequisites

- Node 22+ (see `.nvmrc`)
- A token with Contents read/write on `compass-data`, in `COMPASS_GIT_TOKEN`

## Environment

Copy `.env.example` to `.env.local` and fill in:

```
COMPASS_DATA_OWNER=N-AndGroup
COMPASS_DATA_REPO=compass-data
COMPASS_GIT_TOKEN=<token with contents read/write on compass-data>
```

For local dev a `gh auth token` works. For deploy, use a **fine-grained PAT** scoped to Contents read/write on `compass-data` only, with **resource owner `N-AndGroup`** (or a GitHub App installed on the org). `.env.local` is gitignored — never commit a token.

## Authentication (Microsoft Entra ID SSO)

The app is gated behind **company Microsoft sign-in** via Auth.js v5 ([`src/auth.ts`](./src/auth.ts), [`src/proxy.ts`](./src/proxy.ts)). Sessions are JWT cookies — no database, in keeping with "git as store". Every project edit is committed as the signed-in user, which is what makes the change-history view meaningful.

To switch it on, register an app in **Microsoft Entra ID** (Azure portal → *App registrations*) and set the env vars:

1. **New registration** → *Single tenant*. Add a **Web redirect URI**: `https://<your-domain>/api/auth/callback/microsoft-entra-id` (plus `http://localhost:3000/api/auth/callback/microsoft-entra-id` for local dev).
2. Copy the **Application (client) ID** → `AUTH_MICROSOFT_ENTRA_ID_ID`, and put the **Directory (tenant) ID** into the issuer: `AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/<TENANT_ID>/v2.0`.
3. **Certificates & secrets → New client secret** → `AUTH_MICROSOFT_ENTRA_ID_SECRET`.
4. Generate `AUTH_SECRET` with `npx auth secret`. `AUTH_TRUST_HOST` is not needed on Vercel (Auth.js detects it) — set it to `true` only when running the production build elsewhere (locally via `npm start`, or behind another proxy/CDN).

The single-tenant issuer restricts sign-in to your directory, so only employees can get in. The default OIDC scopes (`openid profile email`) are enough — no admin consent beyond registering the app. Authorization is currently flat (any signed-in employee can edit); view-vs-edit roles are a later layer (an Entra app role or group claim checked in middleware).

## Release downloads (private S3 bucket)

Release packages live in a private S3 bucket (`panattaversions`), as versioned
folders — e.g. `s3://panattaversions/treadmill/official/1.0.0 (25.04.2025)/` —
and Compass makes them clickable for signed-in employees. Paste the folder URI
(or a single object's URL) straight from the S3 console into a milestone's
**Release package URL** field. When the URL points at `COMPASS_RELEASE_BUCKET`:

- a **folder URI** (trailing `/`) opens `/release` ([`src/app/release/page.tsx`](./src/app/release/page.tsx)),
  an SSO-gated listing of the files in that release, with a **Download all**
  button that streams the whole folder as one zip named after it
  ([`src/app/api/release/zip/route.ts`](./src/app/api/release/zip/route.ts) —
  store-mode, constant memory, zip64; the only release path that streams
  through the app rather than redirecting to S3);
- a **single object** links to `/api/release` ([`src/app/api/release/route.ts`](./src/app/api/release/route.ts)),
  which presigns a 5-minute GET URL with the app's read-only AWS key and
  302-redirects, so the browser downloads directly from S3.

> **Deploy caveat:** on Vercel the zip route runs under a function-duration
> cap — it declares `maxDuration = 300` (the ceiling on every plan with Fluid
> compute; raiseable to 800 on Pro), so a multi-GB "Download all" that
> outlives it is cut off. Per-file links are unaffected — they download from
> S3 directly. Treat Download all as a small-release convenience.

The bucket stays private, the key never leaves the server, and the links on
the page never go stale (presigning happens per click). SharePoint and git
links are unaffected.

To switch it on, set `COMPASS_RELEASE_BUCKET` plus `COMPASS_AWS_REGION` /
`COMPASS_AWS_ACCESS_KEY_ID` / `COMPASS_AWS_SECRET_ACCESS_KEY` for an IAM user
whose only permissions are `s3:GetObject` + `s3:ListBucket` on that bucket
(see `.env.example` and [`docs/aws-access-request.md`](./docs/aws-access-request.md)).
The vars are `COMPASS_`-prefixed because Vercel reserves the standard `AWS_*`
names ([`src/lib/s3.ts`](./src/lib/s3.ts)); off Vercel the standard names also
work. Left unset, S3 links render raw like any other URL. Authorization is flat,
same as editing: any signed-in employee can download any release in the bucket.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000 — reads/writes the live compass-data repo

npm test           # vitest: schema, slip, formatting, cache, git adapter, components, actions
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

CI (`.github/workflows/ci.yml`) runs lint + typecheck + test + a production build on every PR to `main`. Deploys are separate: Vercel builds and ships every push to `main` and gives each PR a preview deployment.

## Status

**Live:** the git-as-store data layer; project pages (milestone timeline with a live "today" marker and slip flags); search + lifecycle filter; full editing (create/edit projects and customers, per-section editors for header / responsible / milestones / docs, milestone delete); per-project change history; brief read caching + rate-limit resilience; friendly loading and error states; SSO-gated release downloads from the private S3 release bucket (env-gated, see [Release downloads](#release-downloads-private-s3-bucket)).

**Before a real deploy:**

- **Turn on SSO.** Microsoft Entra ID single sign-on is implemented (Auth.js v5) — the app is gated behind company Microsoft login and commits are attributed to the signed-in user. It activates once you register an Entra app and set the `AUTH_*` env vars (see [Authentication](#authentication-microsoft-entra-id-sso)). Until then it falls back to placeholder attribution. Optional follow-up: view-vs-edit roles.
- **Deploy on Vercel** — one-time setup in [`docs/deploy-vercel.md`](./docs/deploy-vercel.md), with a fine-grained PAT or GitHub App (resource owner `N-AndGroup`) instead of a personal token.
