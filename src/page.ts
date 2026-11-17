// The API behind the page, under /api/. Everything but asking for a code and
// using it needs a session. The page is told which thing went wrong as a key
// from shared/strings.ts, never as a sentence, so it says it in the reader's
// own language.

import { isStringKey, type StringKey } from "../shared/strings";
import type { SettingsPatch } from "../shared/types";
import { R2AvatarStore, R2PhotoStore } from "./adapters/r2";
import { CloudflareMailer } from "./adapters/mail";
import { D1Codes, D1FetchLog, D1Sessions, D1Users } from "./adapters/d1";
import { clearSession, readSession, setSession } from "./cookies";
import { Refused } from "./domain/model";
import { overview } from "./domain/overview";
import { Settings, toMe } from "./domain/settings";
import { redeemCode, requestCode, signOut, whoIs, type SignInDeps } from "./domain/signin";
import type { Clock, Random } from "./domain/ports";
import type { Env } from "./env";

const clock: Clock = { now: () => new Date() };
const random: Random = { bytes: (n) => crypto.getRandomValues(new Uint8Array(n)) };

const bad = (key: StringKey, status = 400) => Response.json({ error: key }, { status });

async function body<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

export async function handlePage(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const secure = url.protocol === "https:";

  // Without the secret nothing can be signed in safely, so nothing is.
  if (!env.SESSION_SECRET) {
    console.error("SESSION_SECRET is not set");
    return bad("error.somethingWentWrong", 500);
  }

  const users = new D1Users(env.DB);
  const deps: SignInDeps = {
    users,
    codes: new D1Codes(env.DB),
    sessions: new D1Sessions(env.DB),
    mailer: new CloudflareMailer(env.EMAIL),
    clock,
    random,
    secret: env.SESSION_SECRET,
    from: "sign-in@bufr.cc",
  };

  try {
    // A burst from one machine is stopped before it reaches any code, so five
    // guesses an address is the floor rather than the ceiling.
    if (path.startsWith("/api/sign-in/") && !(await withinLimit(env, request))) return bad("error.tooFast", 429);

    if (path === "/api/sign-in/code" && method === "POST") {
      const { email, language } = await body<{ email?: string; language?: string }>(request);
      if (typeof email !== "string" || !email.trim()) return bad("error.emailNeeded");
      const outcome = await requestCode(deps, email.slice(0, 200), typeof language === "string" ? language : null);
      if (outcome === "too-many") return bad("error.tooManyCodes", 429);
      return Response.json({ ok: true });
    }

    if (path === "/api/sign-in/verify" && method === "POST") {
      const { email, code } = await body<{ email?: string; code?: string }>(request);
      if (typeof email !== "string" || typeof code !== "string" || !email || !code) return bad("error.codeAndEmailNeeded");
      const outcome = await redeemCode(deps, email.slice(0, 200), code);
      if (outcome === "locked") return bad("error.tooManyTries", 429);
      if (outcome === "wrong") return bad("error.codeWrong", 401);
      return Response.json({ me: toMe(outcome.user) }, { headers: { "set-cookie": setSession(outcome.sessionId, outcome.expiresAt, secure) } });
    }

    if (path === "/api/sign-out" && method === "POST") {
      await signOut(deps, readSession(request));
      return new Response(null, { status: 204, headers: { "set-cookie": clearSession(secure) } });
    }

    // Everything past here needs a session.
    const user = await whoIs(deps, readSession(request));
    if (!user) return bad("error.notSignedIn", 401);
    const settings = new Settings(users, new R2AvatarStore(env.PHOTOS), random);

    if (path === "/api/me" && method === "GET") return Response.json({ me: toMe(user) });

    if (path === "/api/me" && method === "PATCH") {
      return Response.json({ me: toMe(await settings.save(user, await body<SettingsPatch>(request))) });
    }

    if (path === "/api/me/photo") {
      if (method === "PUT") {
        const type = (request.headers.get("content-type") ?? "").split(";")[0].trim();
        return Response.json({ me: toMe(await settings.setPhoto(user, type, await request.arrayBuffer())) });
      }
      if (method === "DELETE") return Response.json({ me: toMe(await settings.removePhoto(user)) });
      if (method === "GET") {
        const found = await settings.photo(user);
        if (!found) return new Response(null, { status: 404 });
        // Asked for by its own name (?v=), so it can be kept for good.
        return new Response(found.body, { headers: { "content-type": found.type, "cache-control": "private, max-age=31536000, immutable" } });
      }
    }

    if (path === "/api/overview" && method === "GET") {
      return Response.json(await overview(new R2PhotoStore(env.PHOTOS), new D1FetchLog(env.DB), clock), {
        headers: { "cache-control": "no-store" },
      });
    }

    return new Response(null, { status: 404 });
  } catch (error) {
    if (error instanceof Refused && isStringKey(error.message)) return bad(error.message, error.status);
    console.error(error);
    return bad("error.somethingWentWrong", 500);
  }
}

/** Per data centre and approximate, which is all a burst needs. A failure to
    count is never a reason to turn somebody away. */
async function withinLimit(env: Env, request: Request): Promise<boolean> {
  if (!env.SIGN_IN_LIMIT) return true;
  try {
    return (await env.SIGN_IN_LIMIT.limit({ key: request.headers.get("cf-connecting-ip") ?? "unknown" })).success;
  } catch {
    return true;
  }
}
