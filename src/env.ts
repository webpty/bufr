// Everything the Worker is handed at run time. Bindings come from
// wrangler.toml; secrets from `wrangler secret put` and, locally, .dev.vars.
export interface Env {
  /** The built page. */
  ASSETS: Fetcher;
  /** Waiting photos, state/home.json, and profile photos under media/avatars/. */
  PHOTOS: R2Bucket;
  /** bufr-db: users, codes, sign_in_tries, sessions, fetched. */
  DB: D1Database;
  /** Cloudflare Email Service, for sign-in codes. */
  EMAIL: SendEmail;
  /** Cloudflare's own counting, in front of the sign-in. Absent locally. */
  SIGN_IN_LIMIT?: { limit(what: { key: string }): Promise<{ success: boolean }> };
  /** The key book: SHA-256 of each key to its name and role. */
  KEYS?: string;
  /** HMACs the sign-in codes and session ids. Rotating it signs everyone out. */
  SESSION_SECRET?: string;
}
