# Deploying Space Tracker on the PureGaz VPS

The migration is in preparation. Production still runs on Vercel at
`https://artemis2.gaz.dev`. `artemis2.lesueur.uk` was retired on 18 October 2026.
The inventory and decisions are in [log.md](log.md); resource names are in
[`puregaz-vps.yaml`](../../puregaz-vps.yaml).

Use the shared [PureGaz VPS guide](https://github.com/garylesueur/puregaz-vps)
for provisioning, approvals and evidence. No database, jobs, application secrets
or data import are required. Vercel Analytics is removed without replacement.

## Local image verification

Local production and staging images passed ARM64 smoke checks on 18 October
2026. AMD64 emulation crashed; a native VPS build remains required. See the log.

The migration branch uses the committed npm dependency set; the separate pnpm
upgrade in the original checkout is not part of this branch. Node is pinned in
`.node-version` and the Dockerfile. Install with `npm ci`, not `npm install`.

Build for the VPS architecture:

```sh
docker build --platform linux/amd64 --build-arg DEPLOY_ENV=production -t artemis2-web:local .
docker run --rm --name artemis2-web-local -p 127.0.0.1:13080:3000 --memory 256m artemis2-web:local
```

The multi-stage build copies standalone server output, static chunks and public
assets. The final process runs as the unprivileged `node` user on port 3000. The
image health check requests `/`. Build dependencies and Git/secret files are
excluded from the final image.

`DEPLOY_ENV` is a **build argument**, not a secret. Set it to `staging` for the
staging build: this emits `noindex, nofollow` headers and metadata, plus a
disallow rule in `robots.txt`. Set it to `production` for the production image.
Rebuild when changing environment; static metadata is baked in. All canonical
URLs point to `https://artemis2.gaz.dev` in either environment.

Verify home, both mission pages, missing-mission 404, textures and crew images,
JavaScript/CSS, `robots.txt`, sitemap and Open Graph image. In a browser, verify
3D rendering and mission/playback/camera controls. Check the running user,
container health, restart and memory usage. The manifest lists the smoke checks.

## Coolify configuration — pending approval

After the code review and merge gate, provision project `artemis2`, application
`web`, from the existing GitHub App source. Use the Dockerfile at the repository
root, port 3000, health path `/`, and the verified runtime memory budget.

- Staging: `artemis2-web-staging.puregaz.com`, build argument `DEPLOY_ENV=staging`.
- Production: `artemis2.gaz.dev`, build argument `DEPLOY_ENV=production`.
- No application runtime env vars, database or persistent user-data volumes.
- PR previews disabled initially. Only one staging site.

Do not use the obsolete lesueur.uk hostname or configure a redirect for it.
The VPS builds each environment separately. Optional Next.js cache content is
recreated with the container; this application has no configured ISR schedule.

## Cutover and removal — separate approvals

Re-read the gaz.dev zone and keep its snapshot before changing DNS. Create an
explicit record for `artemis2` pointing to the VPS; preserve the Vercel-managed
wildcard, mail records and every unrelated project. The zone stays on Vercel.
Verify public DNS, valid HTTPS, HTTP-to-HTTPS redirection and all smoke checks on
the production hostname.

No 14-day holding period is required. Once production is verified, proceed to
the separately approved removal of Artemis2's Vercel hosting. The old
project-domain mapping for the retired lesueur.uk name can be removed at the
same time. Leave the gaz.dev zone and unrelated Vercel resources intact.
Until removal, rollback restores the prior explicit-record state (currently no
explicit `artemis2` record), allowing Vercel's existing wildcard routing again.
After Vercel removal there is no instant fallback deployment on that provider.
