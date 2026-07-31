# Deploying Compass to Vercel

Compass is a stateless Next.js server (no database — the `compass-data` git
repo is the store). We host it on **Vercel**, which runs Next natively: connect
the GitHub repo once, and every push to `main` builds and ships to production,
while every PR gets its own preview deployment. There is no container, no
image registry, and no deploy step in CI.

> **Supersedes the AWS App Runner plan (July 2026).** The earlier
> container-on-App-Runner footprint (ECR + App Runner + a CI push user) is
> gone: no Dockerfile, no `deploy.yml` workflow, no `compass-ci` IAM user.
> The only AWS piece left is the optional read-only user for release
> downloads ([`aws-access-request.md`](./aws-access-request.md)).

## The split: personal app repo, org-owned data

- **App:** `bendowding1/compass` (personal GitHub) → Vercel.
- **Data:** `N-AndGroup/compass-data` (org, private) — customers and project
  JSON stay under the company org.

The bridge is the `COMPASS_GIT_TOKEN` credential: a **fine-grained PAT whose
resource owner is `N-AndGroup`** (issued by an org member, org policy must
allow fine-grained PATs), scoped to Contents read/write on `compass-data`
only — or an org-installed GitHub App. The app repo being personal doesn't
change data access at all; only that token does.

## Plan note

An internal company tool is commercial use, which Vercel's **Hobby plan
fair-use policy excludes** — expect to need **Vercel Pro**. Everything below
works on either plan.

## One-time setup

### 1. Import the repo

[vercel.com/new](https://vercel.com/new) → import `bendowding1/compass`.
Vercel detects Next.js; leave build settings alone (`npm run build`, default
output). Node version comes from `"engines": { "node": "22.x" }` in
`package.json`.

### 2. Set the function region to London

Project → Settings → Functions → **Region: London (`lhr1`)**. Users and the
release bucket (`eu-west-2`) are both London; the zip route streams
S3 → function → browser, so keep the function next to the bucket.

### 3. Environment variables

Project → Settings → Environment Variables, all for **Production** (mark the
secrets as *Sensitive*):

| Variable | Value / note |
| --- | --- |
| `COMPASS_DATA_OWNER` | `N-AndGroup` |
| `COMPASS_DATA_REPO` | `compass-data` |
| `COMPASS_GIT_TOKEN` | the org-scoped fine-grained PAT (sensitive) |
| `AUTH_SECRET` | `npx auth secret --raw` (sensitive) |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Entra app registration client id |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Entra client secret (sensitive) |
| `AUTH_MICROSOFT_ENTRA_ID_ISSUER` | `https://login.microsoftonline.com/<tenant id>/v2.0` |

`AUTH_TRUST_HOST` is **not needed** — Auth.js detects Vercel.

*Release downloads only (optional — SSO-gated S3 presign, see README):*

| Variable | Value / note |
| --- | --- |
| `COMPASS_RELEASE_BUCKET` | `panattaversions` |
| `COMPASS_AWS_REGION` | the bucket's region, e.g. `eu-west-2` |
| `COMPASS_AWS_ACCESS_KEY_ID` | `compass-app` IAM user key |
| `COMPASS_AWS_SECRET_ACCESS_KEY` | its secret (sensitive) |

The `COMPASS_` prefix is required: Vercel **reserves the standard `AWS_*`
names** for its own runtime, so they can't be set on a project.
`src/lib/s3.ts` passes the prefixed values to the SDK explicitly.

### 4. Deploy and wire up the URL

Deploy (the import does it, or push to `main`). You get
`https://<project>.vercel.app`. Add its callback to the Entra app
registration (Authentication → Web → Redirect URIs):

```
https://<project>.vercel.app/api/auth/callback/microsoft-entra-id
```

Open the URL → you should be bounced to Microsoft sign-in. Done.

### 5. Custom domain (optional, later)

Project → Settings → Domains (e.g. `compass.n-andgroup.com` via a CNAME in
company DNS — Vercel manages the TLS cert). Add that domain's
`/api/auth/callback/microsoft-entra-id` to Entra too.

## Serverless behaviour to know about

- **Preview deployments can't complete SSO.** Entra redirect URIs are exact
  (no wildcards), and every preview gets a unique URL, so sign-in on a
  preview fails at the callback unless you register that specific URL. Treat
  previews as build/boot verification; test signed-in flows locally
  (`npm run build && npm start`) or on production. Vercel's own deployment
  protection on previews is a fine extra lock, not a substitute for SSO.
- **The in-process read cache is per-instance** (`src/lib/git/cache.ts` —
  written for this). Fluid compute reuses warm instances, but several may run
  at once: a write clears only the instance that handled it, and other
  instances can serve ≤30 s-stale reads until the TTL expires. Fine at
  internal scale; the cacheComponents/KV lever in `next.config.ts` is the
  upgrade path.
- **"Download all" zips are capped by function duration.** The zip route
  declares `maxDuration = 300` (the ceiling on every plan with Fluid
  compute; Pro can raise it to 800). A download that outlives it is cut
  off — per-file links are unaffected, they redirect the browser straight
  to S3.

## Ongoing

Merge to `main` → Vercel builds and ships production; PRs get preview builds
(CI still runs lint + typecheck + tests + a production build). Roll back
instantly from the Vercel dashboard (Deployments → ⋯ → Instant Rollback).
Rotate the Entra client secret, the data-repo PAT, and the `compass-app` AWS
key on whatever schedule applies — all three live only in Vercel env vars,
so rotation is: update the value, redeploy.
