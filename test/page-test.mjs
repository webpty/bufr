// The page's API, against the built Worker (`node scripts/serve-built.mjs`)
// on BASE: sign-in by code, the allow-list, the limits, settings, the photo,
// and the overview with a fetch the NAS reported.
//
// Its users are put in the LOCAL database first and everything they leave,
// codes, tries, sessions, photos and fetches, is taken out again at the end.
// Codes are read from the mail wrangler dev writes under
// dist/bufr/.wrangler/tmp/email/ instead of sending.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { clearTestFetches, sql, TEST_FOLDER } from "./local-db.mjs";

const BASE = process.env.BASE ?? "http://127.0.0.1:8795";
const SENDER = "test-sender-key-0123456789abcdef";
const FETCHER = "test-fetcher-key-0123456789abcdef";
const MAIL = fileURLToPath(new URL("../dist/bufr/.wrangler/tmp/email/", import.meta.url));

const ME = { id: "page-test-1", email: "page-test@bufr.test" };
const LOCKED = { id: "page-test-2", email: "page-test-lock@bufr.test" };
const STRANGER = "page-test-stranger@bufr.test";
const EMAILS = [ME.email, LOCKED.email, STRANGER];

let failed = 0;
function check(what, ok, detail = "") {
  console.log(`${ok ? "pass" : "FAIL"}  ${what}${ok ? "" : "  " + detail}`);
  if (!ok) failed++;
}

function cleanUp() {
  const ids = `'${ME.id}', '${LOCKED.id}'`;
  const emails = EMAILS.map((e) => `'${e}'`).join(", ");
  sql(`DELETE FROM sessions WHERE user_id IN (${ids})`);
  sql(`DELETE FROM codes WHERE email IN (${emails})`);
  sql(`DELETE FROM sign_in_tries WHERE email IN (${emails})`);
  sql(`DELETE FROM users WHERE id IN (${ids})`);
  clearTestFetches();
}

const json = (path, init = {}, cookie) =>
  fetch(BASE + path, {
    ...init,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...(init.headers ?? {}) },
  });

const post = (path, body, cookie) => json(path, { method: "POST", body: JSON.stringify(body) }, cookie);

/** Every mail file wrangler has written, newest last. */
function mails() {
  const out = [];
  const walk = (dir) => {
    let names = [];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (full.endsWith(".txt")) out.push({ full, at: statSync(full).mtimeMs });
    }
  };
  walk(MAIL);
  return out.sort((a, b) => a.at - b.at);
}

async function codeSentAfter(count) {
  for (let i = 0; i < 40; i++) {
    const all = mails();
    if (all.length > count) return readFileSync(all[all.length - 1].full, "utf8").match(/\b(\d{6})\b/)?.[1] ?? null;
    await new Promise((go) => setTimeout(go, 100));
  }
  return null;
}

cleanUp();
sql(
  `INSERT INTO users (id, email, name, role, created_at) VALUES
   ('${ME.id}', '${ME.email}', 'Page Test', 'member', '2026-11-17T00:00:00Z'),
   ('${LOCKED.id}', '${LOCKED.email}', 'Lock Test', 'member', '2026-11-17T00:00:00Z')`,
);

try {
  // Signed out, nothing but the sign-in.
  let r = await json("/api/me");
  check("signed out: /api/me refused", r.status === 401 && (await r.json()).error === "error.notSignedIn");
  check("signed out: no overview", (await json("/api/overview")).status === 401);

  // An address on the list and one off it get the same answer, and only one
  // of them gets mail.
  let before = mails().length;
  r = await post("/api/sign-in/code", { email: STRANGER, language: "fr" });
  const strangerAnswer = `${r.status} ${await r.text()}`;
  check("off the list: no mail", mails().length === before);
  r = await post("/api/sign-in/code", { email: ME.email.toUpperCase(), language: "en" });
  const listedAnswer = `${r.status} ${await r.text()}`;
  check("on and off the list answered alike", strangerAnswer === listedAnswer, `${strangerAnswer} / ${listedAnswer}`);
  const code = await codeSentAfter(before);
  check("on the list: a code by mail", !!code);

  // The code.
  r = await post("/api/sign-in/verify", { email: ME.email, code: code === "000000" ? "111111" : "000000" });
  check("a wrong code is refused", r.status === 401 && (await r.json()).error === "error.codeWrong");
  r = await post("/api/sign-in/verify", { email: ME.email, code });
  const cookieLine = r.headers.get("set-cookie") ?? "";
  const signedIn = await r.json();
  check("the right code signs in", r.status === 200 && signedIn.me?.email === ME.email, JSON.stringify(signedIn));
  check("the cookie is bufr, HttpOnly", /^bufr=[^;]+/.test(cookieLine) && /HttpOnly/i.test(cookieLine) && /SameSite=Lax/i.test(cookieLine), cookieLine);
  const cookie = cookieLine.split(";")[0];
  r = await post("/api/sign-in/verify", { email: ME.email, code });
  check("a code works once", r.status === 401);
  check("signed in: /api/me", (await (await json("/api/me", {}, cookie)).json()).me?.id === ME.id);

  // Five wrong codes close an address for a while, the right one included.
  before = mails().length;
  await post("/api/sign-in/code", { email: LOCKED.email });
  const lockCode = await codeSentAfter(before);
  for (let i = 0; i < 5; i++) await post("/api/sign-in/verify", { email: LOCKED.email, code: String(100000 + i) === lockCode ? "999999" : String(100000 + i) });
  r = await post("/api/sign-in/verify", { email: LOCKED.email, code: lockCode });
  check("five wrong codes lock the address", r.status === 429 && (await r.json()).error === "error.tooManyTries");

  // Three codes in ten minutes, on the list or not.
  await post("/api/sign-in/code", { email: STRANGER });
  await post("/api/sign-in/code", { email: STRANGER });
  r = await post("/api/sign-in/code", { email: STRANGER });
  check("a fourth code in ten minutes is refused", r.status === 429 && (await r.json()).error === "error.tooManyCodes");

  // Settings.
  r = await json("/api/me", { method: "PATCH", body: JSON.stringify({ name: "  Renamed  ", country: "PA", dateOrder: "ymd", clock24h: false, timeZone: "Europe/Madrid", email: "x@y.z", role: "owner" }) }, cookie);
  let me = (await r.json()).me;
  check(
    "settings are saved",
    r.status === 200 && me.name === "Renamed" && me.country === "PA" && me.dateOrder === "ymd" && me.clock24h === false && me.timeZone === "Europe/Madrid",
    JSON.stringify(me),
  );
  check("the address and the role stay put", me.email === ME.email && me.role === "member");
  check("language not chosen yet", me.languageChosen === false);
  r = await json("/api/me", { method: "PATCH", body: JSON.stringify({ language: "es", timeZone: "Not/AZone", dateOrder: "nonsense" }) }, cookie);
  me = (await r.json()).me;
  check("a language chosen is flagged", me.language === "es" && me.languageChosen === true);
  check("a zone or order that does not exist is ignored", me.timeZone === "Europe/Madrid" && me.dateOrder === "ymd");

  // The photo.
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Buffer.from("test photo bytes"), 0xff, 0xd9]);
  r = await fetch(BASE + "/api/me/photo", { method: "PUT", body: jpeg, headers: { "content-type": "image/jpeg", cookie } });
  me = (await r.json()).me;
  check("a photo is kept", r.status === 200 && !!me.photo);
  r = await fetch(BASE + `/api/me/photo?v=${me.photo}`, { headers: { cookie } });
  check("and handed back", r.status === 200 && Buffer.from(await r.arrayBuffer()).equals(jpeg));
  r = await fetch(BASE + "/api/me/photo", { method: "PUT", body: "not a picture", headers: { "content-type": "text/plain", cookie } });
  check("something else is refused", r.status === 415 && (await r.json()).error === "error.photoNotTaken");
  check("no photo for a stranger", (await fetch(BASE + `/api/me/photo?v=${me.photo}`)).status === 401);
  r = await json("/api/me/photo", { method: "DELETE" }, cookie);
  check("a photo is removed", r.status === 200 && (await r.json()).me.photo === null);

  // The overview, with one photo waiting and one the NAS fetched.
  const call = (path, key, init = {}) => fetch(BASE + path, { ...init, headers: { ...(init.headers ?? {}), authorization: "Bearer " + key } });
  const body = Buffer.alloc(2_000_000, 7);
  const sha = createHash("sha256").update(body).digest("hex");
  const put = async (name) =>
    (
      await call("/v1/photos", SENDER, {
        method: "PUT",
        body,
        headers: { "x-path": encodeURIComponent(`homes/david/Geotag/${TEST_FOLDER}/${name}`), "x-sha256": sha },
      })
    ).json();
  const waiting = await put("PAGE0001.JPG");
  const fetchedOne = await put("PAGE0002.JPG");
  await call("/v1/photos", FETCHER); // the NAS checking in
  r = await call("/v1/photos/" + fetchedOne.id, FETCHER, { method: "DELETE", headers: { "x-seconds": "4", "x-size": String(body.length) } });
  check("the NAS clears with how long it took", r.status === 204);

  const zone = encodeURIComponent("America/Panama");
  r = await json(`/api/overview?period=day&zone=${zone}`, {}, cookie);
  const o = await r.json();
  check("overview: last checked in", r.status === 200 && typeof o.lastCheckIn === "string" && Date.now() - Date.parse(o.lastCheckIn) < 60_000, JSON.stringify(o.lastCheckIn));
  check("overview: waiting now, counted and sized", o.waiting?.count >= 1 && o.waiting.bytes >= body.length, JSON.stringify(o.waiting));
  check("overview: copied in the period", o.copied?.count >= 1 && o.copied.bytes >= body.length, JSON.stringify(o.copied));
  check("overview: upload speed timed", typeof o.upload?.average === "number" && o.upload.average > 0, JSON.stringify(o.upload));
  check("overview: download speed from the NAS's report", typeof o.download?.average === "number" && o.download.average > 0, JSON.stringify(o.download));
  check("overview: time on bufr.cc before the NAS", o.wait && o.wait.average >= 0 && o.wait.longest >= o.wait.shortest, JSON.stringify(o.wait));
  check("overview: 24 hourly bars", o.unit === "hour" && o.points?.length === 24, String(o.points?.length));
  const last = o.points?.[o.points.length - 1];
  check("overview: running total ends at the all-time total", last?.total === o.total?.count, `${last?.total} vs ${o.total?.count}`);
  check("overview: waiting now ends the waiting line", last?.waiting === o.waiting.count, `${last?.waiting} vs ${o.waiting.count}`);
  check("overview: no photo name, path or sender in it", !/PAGE000|Geotag|test sender/.test(JSON.stringify(o)));
  check("overview: no internet address in it", !JSON.stringify(o).includes("127.0.0.1"));
  for (const [period, unit, bars] of [["week", "day", 7], ["month", "day", 30], ["year", "week", null], ["all", "month", null]]) {
    r = await json(`/api/overview?period=${period}&zone=${zone}`, {}, cookie);
    const p = await r.json();
    const ok = r.status === 200 && p.period === period && p.unit === unit && (bars === null ? p.points.length >= 1 : p.points.length === bars);
    check(`overview: ${period}, by ${unit}`, ok && p.points[p.points.length - 1].total === p.total.count, JSON.stringify({ unit: p.unit, n: p.points?.length }));
  }
  r = await json("/api/overview?period=nonsense&zone=Not%2FA_Zone", {}, cookie);
  check("overview: an unknown period or zone falls back", r.status === 200 && (await r.json()).period === "day");
  await call("/v1/photos/" + waiting.id, FETCHER, { method: "DELETE" });

  // Signing out ends the session for good.
  r = await post("/api/sign-out", {}, cookie);
  check("sign out clears the cookie", r.status === 204 && /bufr=;/.test(r.headers.get("set-cookie") ?? ""));
  check("and the session", (await json("/api/me", {}, cookie)).status === 401);
} finally {
  cleanUp();
}

console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
