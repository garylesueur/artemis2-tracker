# Space Tracker — VPS migration log

Guide: `/Users/gaz/dev/puregaz-vps/README.md`.
Manifest: `../../puregaz-vps.yaml` from this directory.

## 17 October 2026 — Cleanup and read-only inventory

The user approved starting cleanup and inventory. No staging, production
cutover or decommissioning is approved by this entry.

### Current hosting

- Vercel team `puregaz`, project `artemis2`, ID
  `prj_8H0nbyQhETXBqw5tH6GBFImtFng2`; Next.js, Node `24.x`, root `.`.
- Git source `garylesueur/artemis2-tracker`, production branch `main`.
- Production deployment `dpl_DajkdetGibEigs35Tsa4hwf1dDtu`, Ready, created
  11 October 2026, URL `https://artemis2-5f71gxp0w-lesueur.vercel.app`.
- `artemis2.gaz.dev` serves the app. Vercel maps `artemis2.lesueur.uk`
  to a 301 redirect to `artemis2.gaz.dev`; an HTTPS HEAD request confirmed it.
  The Vercel-generated alias `artemis2-lesueur.vercel.app` remains on Vercel.
- `vercel project inspect artemis2 --scope puregaz --non-interactive` verified
  the target. `vercel api` read project, environment metadata, project domains
  and DNS records using the existing authenticated CLI, version 51.8.0.
- Environment variable names: **none** across all configured environments.
  Therefore there are no current application secrets needing 1Password items.
  No environment values or CLI credentials were retrieved or saved.

### Source inventory and existing work

Inspected local checkout `/Users/gaz/dev/_garylesueur/artemis2-tracker`,
branch `main`, HEAD `e40e63b`. It already has unrelated changes: `package.json`
modified, `package-lock.json` deleted, and untracked `pnpm-lock.yaml` and
`pnpm-workspace.yaml`. These were preserved. The committed package versions
and working-tree versions differ; resolve the dependency work before choosing
the code PR base. Current working tree declares `pnpm@11.1.0` and Next 16.2.4.
Do not copy the earlier temporary npm-based Dockerfile over this work.

- No `vercel.json`/`vercel.ts`, middleware, route handlers, Vercel crons,
  database driver, Convex or Inngest integration found.
- `@vercel/analytics` is a dependency; `app/layout.tsx` imports and renders
  Analytics. Removal or retention requires a decision.
- No `process.env`, `VERCEL_ENV` or `VERCEL_URL` usage found in app/source config.
- Home and `/missions/[missionId]` are app routes. Both mission IDs are provided
  by `generateStaticParams`; verify all routes in the eventual container.
- Trajectory data is checked into source. JPL Horizons fetching occurs in the
  manual trajectory generation tool; no deployed scheduler was found.
- Fonts come from Google: Geist via `next/font/google` at build, plus a Google
  Fonts CSS import in tracker UI. Include fonts in build/browser verification.
- Metadata, canonical URLs and sitemap currently name `artemis2.lesueur.uk`,
  contrary to the active Vercel redirect. `robots.ts` names the obsolete
  `artemis2-ten.vercel.app` sitemap. Align these with the agreed hostname.
- No application OAuth, payment or inbound webhook callbacks found.
- No Dockerfile or standalone output setting in this checkout. A Docker build
  has not been verified. Docker Desktop daemon could not be reached on this Mac
  (checked outside the sandbox); it must run before the local image check.

### DNS rollback record — complete provider snapshots

- [gaz.dev snapshot](dns/2026-10-17-gaz.dev.json): all **11 records** returned
  by Vercel `/v4/domains/gaz.dev/records?limit=100`, `pagination.next: null`.
  Nameservers `ns1.vercel-dns.com`, `ns2.vercel-dns.com`.
- [lesueur.uk snapshot](dns/2026-10-17-lesueur.uk.json): all **13 records**
  returned by the configured Cloudflare connector with pagination exhausted.
  Active zone `22660f793c5535c826d0405056b104d2`, nameservers
  `rajeev.ns.cloudflare.com`, `sierra.ns.cloudflare.com`.
- There is no explicit `artemis2` record in gaz.dev. Vercel manages wildcard
  ALIAS `* → cname.vercel-dns-016.com.` (TTL 60). Public resolution returned
  `216.150.16.65` and `216.150.1.65` with TTL 1800; those are observations,
  not fixed rollback targets. At cutover use an explicit subdomain override;
  rollback removes only that new override to restore Vercel routing.
- Cloudflare record `9e58967c1058b9ee66facb8d61d7331f` is DNS-only CNAME
  `artemis2.lesueur.uk → cd88319fe40e9522.vercel-dns-017.com`, TTL 600.
  Restore its exact provider settings if changed. Preserve `_vercel` TXT
  verification records, mail records and unrelated applications.
- Preserve Vercel's domain mappings and the 301 redirect through the rollback
  period. Re-read both zones immediately before any approved DNS change.

### VPS readiness and cleanup

Current platform docs record GitHub App source installed for all garylesueur
repos. Backups remain deliberately deferred; this app has no database or user
uploads. The shared puregaz.com wildcard covers the proposed flat staging name
`artemis2-web-staging.puregaz.com`; staging still needs approval and HTTPS checks.

Using the platform's `tools/vps.py`, removed the unused root-owned regular file
`/tmp/create-artemis2.php` (1,266 bytes) and verified its absence. It was not
executed. Read-only Coolify SQL returned projects `platform` and `helpfable`, no
application rows and zero queued deployments. Docker server version: 29.9.1.
The platform evidence log records this cleanup separately.

### Remaining gates

Draft manifest and DNS snapshots are prepared. Nothing is committed or pushed;
the runbook's committed-branch completion criterion is still outstanding,
because repository instructions require an explicit request before committing.
Decisions are pending: keep current host/redirect, analytics, PR previews,
cutover window and rollback duration. No code changes or server provisioning
have been made in this inventory step. Complete the code review and local image
checks before requesting staging approval. Cutover and decommissioning each
require their own later approval; retain Vercel for the proposed 14 days.


## 17 October 2026 — No fixed Vercel retention period

The user changed the proposed rollback policy: “dont need to keep vercel on
once we verify the new page is up”. This supersedes the proposed 14-day
retention period above. Keep the current deployment available until the VPS
production site passes the manifest smoke checks, including both mission
pages, assets, valid HTTPS and the lesueur.uk redirect. Then proceed to Vercel
removal without a fixed waiting period, following the runbook's action approval
gate. Preserve the gaz.dev DNS zone and unrelated Vercel projects.

Updated the draft manifest to record zero retention days and removal after
production verification. Other questionnaire decisions remain pending; this
answer changes the retention policy only. No deployment, DNS, Vercel removal,
commit or push was performed.


## 18 October 2026 — Decisions agreed; legacy hostname retired

The user approved artemis2.gaz.dev as the production hostname, removal of
Vercel Analytics without replacement, one staging site at
artemis2-web-staging.puregaz.com with PR previews disabled, and cutover after
successful checks and separate DNS approval. No fixed Vercel retention period
is needed after production verification.

The user also explicitly requested retirement of artemis2.lesueur.uk now,
instead of preserving its redirect. Read its Cloudflare record, verified the
exact name/type/target, and deleted only CNAME ID
9e58967c1058b9ee66facb8d61d7331f in zone 22660f793c5535c826d0405056b104d2.
The configured Cloudflare connector returned HTTP 200 and success. A full
read-back returned 12 records on one page; comparison with the historical
snapshot confirms every other record's type, value, TTL, proxy flag and settings
is unchanged. An authoritative query to rajeev.ns.cloudflare.com returned no
CNAME, only the zone SOA. Existing resolver caches can retain the old entry
until its TTL expires. The Vercel project-domain redirect mapping is untouched
and will go with the Vercel hosting; there is no longer DNS pointing to it.
gaz.dev, its live deployment and unrelated domains were not changed.

Code preparation uses isolated worktree /Users/gaz/dev/_garylesueur/artemis2-vps,
branch migrate/artemis2-vps, from committed e40e63b. This preserves the original
checkout's uncommitted pnpm/dependency upgrade and tests the committed npm
dependency set. Neither dependency work nor this migration is committed/pushed.
Earlier log entries about retaining the lesueur.uk redirect are superseded.


## 18 October 2026 — Container preparation and local verification

Prepared code in the isolated `migrate/artemis2-vps` worktree. Removed the
Analytics component and dependency; npm 11.16.0 regenerated package-lock.json
through `npm uninstall --package-lock-only`. Existing dependency versions were
preserved. npm also recorded bundled optional Tailwind WASI dependency metadata;
no generated files were hand-edited. Pinned Node 24.18.0 and npm 11.16.0.

Added standalone Next.js output, a multi-stage Dockerfile with the pinned
multi-architecture Node image digest, a non-root runtime, a root-path health
check, and a dockerignore excluding local dependencies, Git and secret files.
Centralised canonical host in lib/site.ts and fixed robots/sitemap metadata.
DEPLOY_ENV is a build argument: production permits indexing; staging emits
noindex/nofollow metadata and headers plus Disallow in robots.txt. The runtime
also retains the selected environment for any dynamically rendered responses.

The initial lint run found two existing react/display-name errors in tracker
panels. Added only the two display-name assignments; tracker behaviour is
unchanged. Final `npm run lint` passes with six existing warnings (unused names,
an unused eslint directive and an img optimisation suggestion). Host lint ran
under Node 26.7.0/npm 11.19.0. Next.js builds and TypeScript checks ran in the
pinned Linux Node 24.18.0/npm 11.16.0 image.

### Build limitation and tested images

The linux/amd64 Docker build failed before Next.js compilation with
`qemu: uncaught target signal 11 (Segmentation fault)`, exit 139. Native
linux/arm64 production and staging builds both passed, including TypeScript
and prerendering of all routes. This verifies local functionality, not the
VPS's amd64 architecture. A native amd64 build remains a required staging check.
The Dockerfile uses a multi-architecture digest; no architecture workaround or
dependency upgrade was added. Docker Desktop reports 29.8.0. A separate
`docker system df` call reported a missing cache snapshot; both subsequent
native builds succeeded without changing Docker settings or purging caches.

Locally tested image IDs:

- Production: sha256:3d0aeeb4751d7c33a8f397b7b2b4a2ca0ec3425f97351e09f06fea9a1aa5c07b
- Staging: sha256:52a6a675df12bfb72e669467d0817703dc9c88bbb633e2c004efd2154fdef6ba

Both run as UID 1000 (`node`), have a 256 MiB memory limit, become healthy,
and show no OOM termination. After HTTP checks, memory was 56.04 MiB production
and 55.82 MiB staging; this is a smoke-test observation, not a load-test result.
Production served HTTP 200 again after a container restart.

### HTTP and browser evidence

For both images, checked HTTP 200 on home and both mission pages, correct
production canonical URLs, all 11 referenced JS/CSS resources, every public
asset, PNG Open Graph image, robots.txt and all three sitemap URLs. Next image
optimisation served the crew photo successfully as the non-root runtime.
Unknown mission returned HTTP 404. No old lesueur.uk canonical or Vercel
Analytics endpoint appeared in page output. Production and staging indexing
metadata/headers differed as intended.

Using the T3 collaborative browser against loopback production, opened home,
followed the Artemis II card, observed the 3D scene and textures, started and
paused playback, changed camera to Earth, opened and closed the crew panel,
and moved the timeline to its end with the keyboard (100% / splashdown).
Directly navigated to Artemis I and observed its 3D scene. Browser snapshots
reported no console entries or failed HTTP requests during these checks.

Self-reviewed the full task diff and new files using the Calm Craft branch
self-review checklist and React/Next.js guidance: no blocking code finding.
The remaining gates are commit/push authorisation, PR review/merge, native
amd64 staging build and VPS HTTPS smoke checks. No staging or production app
was provisioned, and production gaz.dev DNS and Vercel hosting remain unchanged.
Temporary local check containers and diagnostic scratch are removed after
verification; images/build caches remain available. Original dependency work
is preserved. No commits or pushes.


## 18 October 2026 — Migration branch publication authorised

The user explicitly approved committing and pushing the isolated migration
branch and opening a PR. Publishing only this worktree's migration changes;
the original checkout's dependency/pnpm changes and the platform repository
are outside the commit. The fetched origin/main still matches the branch base.
Local verification above remains current; native amd64 build, VPS staging,
production cutover and removal remain subsequent gates.
