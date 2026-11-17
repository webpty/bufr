// Signing in to the page: a six-digit code by mail. The users table is the
// allow-list. An address not on it is answered exactly as one that is, so
// the page cannot be used to find out who is on the list.

import { nearestLanguage, t } from "../../shared/strings";
import type { User } from "./model";
import type { Clock, CodeStore, Mailer, Random, SessionStore, UserStore } from "./ports";
import { hashCode, hashSession, mintCode, toBase64Url } from "./secrets";

/** How long a code is good for, and how long a session lasts. */
export const CODE_MINUTES = 10;
const SESSION_DAYS = 90;
/** Three codes per address per ten minutes, so a mailbox cannot be flooded. */
const CODES_PER_WINDOW = 3;
/** Five wrong codes for one address and none is taken for a quarter of an
    hour: six digits are only worth anything while the guesses are few. */
const TRIES_ALLOWED = 5;
const LOCK_MINUTES = 15;
const TRIES_KEPT_HOURS = 24;

export interface SignInDeps {
  users: UserStore;
  codes: CodeStore;
  sessions: SessionStore;
  mailer: Mailer;
  clock: Clock;
  random: Random;
  secret: string;
  /** Where codes come from: sign-in@bufr.cc. */
  from: string;
}

const clean = (email: string) => email.trim().toLowerCase();

export async function requestCode(deps: SignInDeps, email: string, asksFor: string | null): Promise<"sent" | "too-many"> {
  const now = deps.clock.now();
  const address = clean(email);

  // Asking for a code is itself limited, so sweeping here costs nothing.
  await deps.codes.pruneTries(new Date(now.getTime() - TRIES_KEPT_HOURS * 3_600_000).toISOString()).catch(() => {});

  const since = new Date(now.getTime() - CODE_MINUTES * 60_000).toISOString();
  if ((await deps.codes.recentCount(address, since)) >= CODES_PER_WINDOW) return "too-many";

  // Counted for every address, on the list or not, and the same answer
  // either way, so the limit says nothing about who is on it either.
  const code = mintCode(deps.random);
  const user = await deps.users.byEmail(address);
  await deps.codes.expireAll(address, now.toISOString());
  await deps.codes.put(
    address,
    // Not on the list: a code nobody is sent, which no one can ever claim.
    user ? await hashCode(deps.secret, address, code) : "none",
    new Date(now.getTime() + CODE_MINUTES * 60_000).toISOString(),
    now.toISOString(),
  );
  if (!user) return "sent";

  const language = user.languageChosen && user.language ? nearestLanguage([user.language]) : nearestLanguage([asksFor ?? ""]);
  await deps.mailer.send({
    to: address,
    from: deps.from,
    fromName: "bufr.cc",
    subject: t(language, "mail.codeSubject", { code }),
    text: t(language, "mail.codeBody", { code, minutes: CODE_MINUTES }),
  });
  return "sent";
}

export interface SignedIn {
  /** Goes in the cookie; only its HMAC is kept. */
  sessionId: string;
  expiresAt: Date;
  user: User;
}

export async function redeemCode(deps: SignInDeps, email: string, code: string): Promise<SignedIn | "wrong" | "locked"> {
  const now = deps.clock.now();
  const address = clean(email);
  const window = new Date(now.getTime() - LOCK_MINUTES * 60_000).toISOString();

  if ((await deps.codes.triesSince(address, window)) >= TRIES_ALLOWED) return "locked";

  const digits = code.trim();
  const ok = /^\d{6}$/.test(digits) && (await deps.codes.claim(address, await hashCode(deps.secret, address, digits), now.toISOString()));
  if (!ok) {
    await deps.codes.addTry(address, now.toISOString());
    // Whoever is guessing has had their five: the code in flight goes too.
    if ((await deps.codes.triesSince(address, window)) >= TRIES_ALLOWED) await deps.codes.expireAll(address, now.toISOString());
    return "wrong";
  }

  const user = await deps.users.byEmail(address);
  if (!user) return "wrong";

  const sessionId = toBase64Url(deps.random.bytes(32));
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  await deps.sessions.create(await hashSession(deps.secret, sessionId), user.id, expiresAt.toISOString(), now.toISOString());
  return { sessionId, expiresAt, user };
}

export async function whoIs(deps: Pick<SignInDeps, "sessions" | "clock" | "secret">, sessionId: string | null): Promise<User | null> {
  if (!sessionId) return null;
  return deps.sessions.userFor(await hashSession(deps.secret, sessionId), deps.clock.now().toISOString());
}

export async function signOut(deps: Pick<SignInDeps, "sessions" | "secret">, sessionId: string | null): Promise<void> {
  if (sessionId) await deps.sessions.destroy(await hashSession(deps.secret, sessionId));
}
