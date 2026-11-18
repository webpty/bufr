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

- One Cloudflare Worker, `bufr`, on bufr.cc; the GitHub project is webpty/bufr, so Cloudflare names the Worker after it, as with David's other Workers (no domain ending).
- Since 0.2.0 a signed-in page at bufr.cc (David, 17 Nov 2026): React, Vite
  and TypeScript, HeroUI v3 and HeroUI Pro, served by the same Worker with
  Assets and single-page fallback. `/v1/` is the API for keys, `/api/` the
  API for the page, everything else the page (`run_worker_first` sends
  `/v1/*` and `/api/*` to the Worker even for a browser).
- Clean layout. Worker: `src/domain` (Buffer, overview, sign-in, settings,
  model, ports), `src/adapters` (R2, D1, mail, keys), `src/http.ts` (/v1),
  `src/page.ts` (/api), `src/index.ts`. Page: `web/` (views in `web/views`).
  Shared by both: `shared/` (types, strings). Handlers never touch R2 or D1
  directly.
- Deploys only by a push to `main`, built by Cloudflare. Never `wrangler
  deploy`. Ask David before every push. Raise `version` in package.json in
  the commit that goes out; it shows at the foot of the settings page.

## Bindings

| Binding | What | Name / id |
| --- | --- | --- |
| `PHOTOS` | R2 | `bufr-photos`: `waiting/<id>` (custom metadata: path, sha256, modified, update, sender, added), `state/home.json` (the home's last address), `media/avatars/<user>/<random>` (profile photos), `lists/<id>` (Geotag's sync lists) |
| `DB` | D1 | `bufr-db`, `432e95c6-e3e3-4ea0-80b0-b28d1901fd96` (created 17 Nov 2026, region WEUR) |
| `EMAIL` | send_email | Cloudflare Email Service, codes from `sign-in@bufr.cc` |
| `SIGN_IN_LIMIT` | ratelimit | namespace `1003`, 20 sign-in requests a minute per internet address. 1001 is blucat's, trako's and tracpac's, 1002 geome.cc's: never share one |
| `ASSETS` | the built page | written by the Vite plugin |

Account `db5243138f80078fa690e86952c29d88`. Secrets `KEYS` and
`SESSION_SECRET`, set with `npx wrangler secret put <NAME>`; never in
`wrangler.toml`, never printed.

`HEROUI_AUTH_TOKEN` must be a **build** variable on Workers Builds, holding
the **CI/CD token** from https://heroui.pro/dashboard, or the install
fetches nothing and the build stops at `scripts/check-build-env.mjs`.
Locally, install with the token read from `/Users/david/Sites/.env`
(written `KEY = value`, not shell-sourceable: parse it, never echo it).

## The page

- Private: no description, no social card, no copy saying what it is.
  Anybody not signed in sees the sign-in and nothing else.
- Sign-in as on blucat: a six-digit code by mail, typed into HeroUI's
  `InputOTP` with saved-password suggestions stopped. The `users` table is
  the allow-list; an address off it gets exactly the answer one on it gets,
  and a code row is written for it too, so the limits say nothing either.
  Three codes per address per ten minutes, only the newest alive, five
  wrong ones close the address for 15 minutes, and `SIGN_IN_LIMIT` stops a
  burst from one machine first. Codes and session ids are kept only as an
  HMAC with `SESSION_SECRET`; the cookie is `bufr`, HttpOnly, SameSite=Lax,
  90 days. No passkeys.
- Nobody is added from the page. A user row goes in by hand, and only with
  David's yes, like every change to the live database.
- The overview refreshes every 10 s: when the NAS last checked in (when it
  last asked for the list), each photo waiting (name, size, sender, how
  long), the last 20 fetched (when, how long it took) and the fetching speed
  (all their bytes over all their seconds). Names only reach the page,
  never a full path and never the home's address.
- Settings: two cards, You (photo through a cropper, 512 px JPEG cut in the
  browser; initials when none; name; e-mail shown, not editable; country)
  and Language and time (language, with `language_chosen` set only when
  picked here; date order with live samples; 24-hour clock; time zone).
  One Save with a status line beside it. A photo is kept as soon as it is
  cut, and the old one deleted.
- Three languages: English (British spelling), Spanish, French. Every word
  is in `shared/strings.ts`; the Worker answers the page with a key, never a
  sentence.
- Light and dark: the device's until the switch in the header is pressed,
  then remembered in the browser.

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
- `GET /v1/photos/<id>` (fetcher): the photo. `DELETE` once it is on the
  NAS, with `X-Seconds` (how long the fetch took) and `X-Size` (bytes that
  arrived), both optional. The Worker writes `{path, size, seconds, sender,
  at}` to the D1 table `fetched`, keeping the newest 200, for the overview.
  A failure to write it never fails the DELETE.
- `GET /v1/lists` and `PUT /v1/lists` (sender), header `X-Path`: Geotag's
  sync lists (0.2.1, David, 18 November 2026: a phone away from home did
  not know what was copied). Only `.../~Geotag/saved.json` and
  `.../~Geotag/cameras.json` under `homes/<user>/`, the phone's `home/`
  made the key's home as for photos. Kept in R2 as `lists/<sha256 of the
  path>`, never under `waiting/`, so the NAS never fetches one. GET answers
  204 when none was written. Geotag merges and writes the whole list back;
  entries are never removed.
- Anything refused before an upload is read is read off first: answering in
  the middle of one drops the connection (seen locally as a 500).

## The NAS container (`nas/`)

- `docker-compose.yml` and `fetch.py`, plus `bufr.env` with `BUFR_KEY=` (git-ignored; not `.env`, which Finder hides and File Station can't pick),
  in `/volume1/docker/bufr` on the Synology DS1525+, started as a project in
  Container Manager. Stock `python:3.13-alpine`, nothing built on the NAS.
  No SSH access to the NAS (David's choice): he sets it up from steps.
- It calls itself `bufr-fetch/0.2` (Cloudflare turns Python's own name away,
  error 1010) and reports each fetch's duration and size on its DELETE.
  Copy the new `fetch.py` to the NAS for the overview to show durations and
  speed; 0.1 still works and its fetches show without them.
- It writes only under `/volume1/homes`; a path elsewhere is refused and
  stays waiting. Each photo: fetched under a hidden name, checked against
  its fingerprint, dated, owned like its folder, then named: its own name,
  or `name_2.ext` when another photo has it, unless it is the same photo
  (left as is) or `update` is set (Geotag's earlier copy, replaced).

## Migrations

`migrations/` is applied by hand, oldest first: `npm run db:local --
migrations/<file>` and `npm run db:remote -- migrations/<file>`. **The remote
one needs David's yes first**, and runs before the push that needs it. D1
refuses `BEGIN` or `COMMIT` in a file.

On 17 Nov 2026 all four were applied locally only. The live database is
empty: 0001 to 0004 and the first user row still wait for David's approval.

Before the push that ships 0.2.0, all four of these, or the page fails:
the build variable `HEROUI_AUTH_TOKEN` (without it the build fails and the
old Worker keeps serving), `SESSION_SECRET` on the Worker, bufr.cc
onboarded under Email Sending, and the four migrations with a first user
row on the live database. Until `fetched` exists live, the NAS's clearing
still works; only the record of it is lost.

## Testing

- Test the built Worker, never the Vite dev server: `npm run serve` builds
  and runs `dist` through `wrangler dev` on port 8795, with the bufr.cc route
  stripped from dist's copy of the config (left in, wrangler presents the
  Worker as bufr.cc and nothing local reaches it). Local data is in
  `.wrangler/state`, where `npm run db:local` writes too.
- `.dev.vars` holds the test keys (see `test/api-test.mjs`), written with
  single quotes round the JSON (double quotes keep the backslashes and break
  it), and a local `SESSION_SECRET`. The build copies it into `dist/bufr/`,
  which is the copy wrangler reads: build again after changing it.
- `npm test` runs `test/api-test.mjs` (/v1) and `test/page-test.mjs` (/api)
  against the server on 8795. The page test puts its users in the local
  database through wrangler and takes out everything they leave.
- Local mail is simulated: the subject (with the code) is in the server's
  output and the text under `dist/bufr/.wrangler/tmp/email/`.
- The NAS script runs against it with `BUFR_URL`, `BUFR_KEY`, `BUFR_ROOT`,
  `BUFR_ALLOWED` and `BUFR_ONCE=1` pointed at a scratch folder.
- Screenshots: headless only, 500 x 1082 for a phone (Chromium will not lay
  out narrower) and a desktop width. This Mac has no Google Chrome; headless
  Vivaldi (the default browser) never answers DevTools, so drive headless
  Brave over DevTools, with a fresh profile and `--remote-allow-origins=*`.

## Gotchas

- `@heroui-pro/react` is imported by subpath (`@heroui-pro/react/cell-select`,
  `/chat-loader`): the barrel pulls every Pro component's peers. Its KPI
  component pulls the area chart and recharts, so it is not used.
- HeroUI's surface is the page's colour in the light theme: `.surface`
  carries a border, set once in `web/index.css`, inside `@layer components`
  like every house override (unlayered CSS beats Tailwind utilities).
- npm 11 blocks install scripts: `allowScripts` in package.json lists the
  ones that must run, HeroUI Pro's among them.

## Workers Builds

- Build command `npm run build`, deploy command left as Cloudflare set it
  (`npx wrangler deploy`, which reads the config the Vite plugin writes).
  With no build command the deploy fails: "The `assets` property ... is
  missing the required `directory` property" (18 November 2026).
- `HEROUI_AUTH_TOKEN` (the CI/CD token) is a build variable there.
