// Runs against the built Worker (`node scripts/serve-built.mjs`) on BASE,
// with .dev.vars holding the test keys below. Leaves nothing behind: every
// photo it sends is fetched and cleared, and the fetches it causes are taken
// back out of the local fetch log.
import { createHash } from "node:crypto";
import { clearTestFetches } from "./local-db.mjs";

const BASE = process.env.BASE ?? "http://127.0.0.1:8795";
const SENDER = "test-sender-key-0123456789abcdef";
const FETCHER = "test-fetcher-key-0123456789abcdef";

let failed = 0;
function check(what, ok, detail = "") {
  console.log(`${ok ? "pass" : "FAIL"}  ${what}${ok ? "" : "  " + detail}`);
  if (!ok) failed++;
}

const call = (path, key, init = {}) =>
  fetch(BASE + path, { ...init, headers: { ...(init.headers ?? {}), ...(key ? { authorization: "Bearer " + key } : {}) } });

const photo = Buffer.alloc(3 * 1024 * 1024 + 17);
for (let i = 0; i < photo.length; i++) photo[i] = (i * 31) % 251;
const sha = createHash("sha256").update(photo).digest("hex");
const path = "homes/david/Geotag/2026.11.17 Test/TEST0001.CR3";

const send = (body, fingerprint, extra = {}) =>
  call("/v1/photos", SENDER, {
    method: "PUT",
    body,
    headers: { "x-path": encodeURIComponent(path), "x-sha256": fingerprint, "x-modified": "2026-11-17T10:00:00Z", ...extra },
  });

// Nothing for strangers.
check("no key: nothing", (await call("/v1/status")).status === 404);
check("wrong key: nothing", (await call("/v1/status", "not-a-key-but-long-enough-0000")).status === 404);
{
  // The page is there for anybody, and says nothing about what this is.
  const r = await call("/");
  const html = await r.text();
  check("the front page is the bare page", r.status === 200 && html.includes('id="root"'), String(r.status));
  check("the page advertises nothing", !/name="description"|property="og:|name="twitter:/.test(html));
  check("a key gets no page from /v1/", (await call("/v1/", SENDER)).status === 404);
}

// A sender's view.
let r = await call("/v1/status", SENDER);
const before = await r.json();
check("status for a sender", r.status === 200 && before.role === "sender", JSON.stringify(before));

// A photo whose fingerprint does not match is refused.
r = await send(photo, "0".repeat(64));
check("a wrong fingerprint is refused", r.status === 422, `${r.status} ${await r.text()}`);

// A bad path is refused.
r = await call("/v1/photos", SENDER, { method: "PUT", body: photo, headers: { "x-path": encodeURIComponent("../etc/passwd"), "x-sha256": sha } });
check("a path with .. is refused", r.status === 400, String(r.status));

// The photo itself.
r = await send(photo, sha, { "x-update": "1" });
const kept = await r.json();
check("a photo is kept", r.status === 201 && kept.size === photo.length && kept.update === true, JSON.stringify(kept));

// A sender can't fetch.
check("a sender can't list", (await call("/v1/photos", SENDER)).status === 403);

// The fetcher's view, which also marks home.
r = await call("/v1/photos", FETCHER);
const list = (await r.json()).photos;
const mine = list.find((p) => p.path === path);
check("the fetcher sees it", r.status === 200 && mine && mine.sha256 === sha && mine.modified === "2026-11-17T10:00:00Z", JSON.stringify(list));

r = await call("/v1/status", SENDER);
const after = await r.json();
check("the waiting count", after.waiting === before.waiting + 1, JSON.stringify(after));
check("at home: same address as the NAS", after.atHome === true, JSON.stringify(after));

r = await call("/v1/photos/" + mine.id, FETCHER);
const got = Buffer.from(await r.arrayBuffer());
check("the fetcher gets the same bytes", createHash("sha256").update(got).digest("hex") === sha);

check(
  "cleared once fetched, with how long it took",
  (await call("/v1/photos/" + mine.id, FETCHER, { method: "DELETE", headers: { "x-seconds": "1.5", "x-size": String(photo.length) } })).status === 204,
);
check("gone after clearing", (await call("/v1/photos/" + mine.id, FETCHER)).status === 404);

// The phone's "home/..." becomes the key's own home.
{
  const b = Buffer.from("home folder test");
  const s = createHash("sha256").update(b).digest("hex");
  r = await call("/v1/photos", SENDER, { method: "PUT", body: b, headers: { "x-path": encodeURIComponent("home/Geotag/2026.11.17 Test/HOME.JPG"), "x-sha256": s } });
  const k = await r.json();
  check("home/ becomes homes/<user>/", r.status === 201 && k.path === "homes/testuser/Geotag/2026.11.17 Test/HOME.JPG", JSON.stringify(k));
  await call("/v1/photos/" + k.id, FETCHER, { method: "DELETE" });
}

// Geotag's sync lists: kept by path, the phone's "home/..." the key's own home.
{
  const list = JSON.stringify({ entries: [{ fileName: "A.JPG", size: 1 }], updatedAt: 1, updatedBy: "iphone" });
  const path = (p) => ({ "x-path": encodeURIComponent(p) });
  r = await call("/v1/lists", SENDER, { headers: path("homes/testuser/Lists Test/~Geotag/cameras.json") });
  check("a list never written: nothing", r.status === 204, String(r.status));
  r = await call("/v1/lists", SENDER, { method: "PUT", body: list, headers: path("home/Lists Test/~Geotag/saved.json") });
  check("a list is kept", r.status === 204, `${r.status} ${await r.text()}`);
  r = await call("/v1/lists", SENDER, { headers: path("homes/testuser/Lists Test/~Geotag/saved.json") });
  check("the same list read by its full path", r.status === 200 && (await r.text()) === list, String(r.status));
  check("a fetcher can't read a list", (await call("/v1/lists", FETCHER, { headers: path("homes/testuser/Lists Test/~Geotag/saved.json") })).status === 403);
  r = await call("/v1/lists", SENDER, { method: "PUT", body: list, headers: path("homes/testuser/Lists Test/notes.json") });
  check("only Geotag's lists are kept", r.status === 400, String(r.status));
  r = await call("/v1/lists", SENDER, { method: "PUT", body: "not json", headers: path("homes/testuser/Lists Test/~Geotag/saved.json") });
  check("a list that isn't JSON is refused", r.status === 400, String(r.status));
  r = await call("/v1/photos", FETCHER);
  check("the NAS never sees a list", !(await r.json()).photos.some((p) => p.path.includes("~Geotag")));
}

clearTestFetches();

console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
