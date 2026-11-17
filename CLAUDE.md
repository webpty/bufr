# bufr.cc

A buffer between Geotag and the NAS at home (David, 17 November 2026). Away
from home, Geotag on the phones and the Mac sends photos here, fast and to a
nearby Cloudflare server; a small container on the NAS fetches them home
every minute. At home, Geotag sends straight to the NAS as before.

Why: the home in Panama is behind the provider's shared address (CGNAT), so
Tailscale reaches the NAS only through its Miami relay, about 0.5 MB/s. An
upload to Cloudflare from Madrid ran at about 2 MB/s. An upload to a web
address is also the one transfer the iPhone finishes by itself, locked or
not, with no notification.

## Stack

- One Cloudflare Worker, `bufr`, on bufr.cc; the GitHub project is webpty/bufr, so Cloudflare names the Worker after it, as with David's other Workers (no domain ending). No web page, so no React or
  HeroUI (said in the plan): anyone without a key gets an empty 404.
- R2 bucket `bufr-photos`, binding `PHOTOS`: `waiting/<id>` for each photo
  (custom metadata: path, sha256, modified, update, sender, added) and
  `state/home.json` for the home's last address.
- Clean layout: `src/domain` (Buffer, model, ports), `src/adapters` (R2,
  keys), `src/http.ts`. Handlers never touch R2 directly.
- Deploys only by a push to `main`, built by Cloudflare. Never `wrangler
  deploy`. Ask David before every push.

## Keys

- Secret `KEYS`: JSON from the SHA-256 of each key to `{name, role, home}`;
  role `sender` (Geotag) or `fetcher` (the NAS). `home` is the NAS user
  whose home a phone's "home/..." path means: the iPhone reaches the NAS as
  the logged-in user's "home" share, so it sends "home/Geotag/...", which
  becomes "homes/<home>/Geotag/..." (david for David's keys, amanda for
  Amanda's). Set with
  `npx wrangler secret put KEYS`. The keys themselves are in `.keys/`
  (git-ignored), one file each. Never print one; hand over by clipboard.

## API, all under /v1/ with `Authorization: Bearer <key>`

- `GET /v1/status`: role, name, waiting count and bytes, `atHome` (this
  caller's address is the one the NAS last fetched from, within 10 min).
- `PUT /v1/photos` (sender): body is the photo; headers `X-Path`
  (URL-encoded, under the volume: `homes/david/Geotag/<day>/<name>`),
  `X-Sha256`, `X-Modified` (ISO), `X-Update: 1` (may replace Geotag's
  earlier copy), `Content-Length`. R2 checks the fingerprint and refuses a
  mismatch (422). The id is the SHA-256 of the path: a photo sent again
  replaces its waiting copy.
- `GET /v1/photos` (fetcher): the waiting list; records the home address.
- `GET /v1/photos/<id>` (fetcher): the photo. `DELETE` once it is on the NAS.

## The NAS container (`nas/`)

- `compose.yaml` and `fetch.py`, plus `.env` with `BUFR_KEY=` (git-ignored),
  in `/volume1/docker/bufr` on the Synology DS1525+, started as a project in
  Container Manager. Stock `python:3.13-alpine`, nothing built on the NAS.
  No SSH access to the NAS (David's choice): he sets it up from steps.
- It writes only under `/volume1/homes`; a path elsewhere is refused and
  stays waiting. Each photo: fetched under a hidden name, checked against
  its fingerprint, dated, owned like its folder, then named: its own name,
  or `name_2.ext` when another photo has it, unless it is the same photo
  (left as is) or `update` is set (Geotag's earlier copy, replaced).

## Testing

- `.dev.vars` holds test keys (see `test/api-test.mjs`), written with single
  quotes round the JSON: double quotes keep the backslashes and break it.
- `npx wrangler dev --port 8795`, then `node test/api-test.mjs`. The NAS
  script runs against it with `BUFR_URL`, `BUFR_KEY`, `BUFR_ROOT`,
  `BUFR_ALLOWED` and `BUFR_ONCE=1` pointed at a scratch folder.
