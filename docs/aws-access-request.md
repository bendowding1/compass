# AWS access request — Compass release downloads

Hand this to IT. Since the move to Vercel ([`deploy-vercel.md`](./deploy-vercel.md)),
Compass **no longer runs on AWS** — the App Runner / ECR / `compass-ci` items
from the earlier version of this request are obsolete and can be torn down if
they were ever created. One optional item remains:

## The one item: read-only release downloads

Release packages live in the private S3 bucket **`panattaversions`**, as
versioned folders (e.g. `treadmill/official/1.0.0 (25.04.2025)/`). Compass
makes them downloadable to signed-in employees: the app holds a read-only
key, shows the files in a release folder, presigns a short-lived GET URL per
click, and redirects the browser to S3. The key never leaves the server and
the bucket stays private.

- An **IAM user** `compass-app` with **programmatic access keys** and exactly
  this policy (nothing else):
  - `s3:GetObject` on `arn:aws:s3:::panattaversions/*`
  - `s3:ListBucket` on `arn:aws:s3:::panattaversions` (to show a release
    folder's files)
- No bucket-policy change, no public access, no writes.
- The keys are stored as encrypted environment variables on the Vercel
  project (`COMPASS_AWS_ACCESS_KEY_ID` / `COMPASS_AWS_SECRET_ACCESS_KEY`,
  plus `COMPASS_AWS_REGION` and `COMPASS_RELEASE_BUCKET`), marked sensitive
  so they are write-only after creation.
- Long-lived keys are the honest trade-off here: the app no longer runs on
  AWS, so an instance role isn't an option. I'll rotate them on your
  schedule — rotation is create-new-key → update the Vercel env var →
  redeploy → delete-old-key.

## What I need back from you

- The **`compass-app` access keys**, sent securely (a password-manager share
  or a call — not email/chat in plaintext), and the **bucket's region**
  (assumed `eu-west-2`).
- If the keys are declined: say so, and release links will simply render as
  raw S3 URIs in Compass (the feature is env-gated and off by default).
