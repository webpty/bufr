// The page's data in D1: the allow-list, sign-in codes, sessions, and the
// fetches the NAS reported. The domain sees only the ports.

import type { Fetched, User } from "../domain/model";
import type { CodeStore, FetchLog, SessionStore, UserStore } from "../domain/ports";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  photo_key: string | null;
  country: string | null;
  language: string | null;
  language_chosen: number;
  date_order: string;
  clock_24h: number;
  time_zone: string;
  created_at: string;
}

const COLUMNS = `u.id, u.email, u.name, u.role, u.photo_key, u.country, u.language, u.language_chosen,
  u.date_order, u.clock_24h, u.time_zone, u.created_at`;

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role === "owner" ? "owner" : "member",
    photoKey: row.photo_key,
    country: row.country,
    language: row.language,
    languageChosen: row.language_chosen === 1,
    dateOrder: row.date_order as User["dateOrder"],
    clock24h: row.clock_24h === 1,
    timeZone: row.time_zone,
    createdAt: row.created_at,
  };
}

/** Which field writes which column. Anything not here cannot be changed by
    update(), which is how id, email, role and created_at stay put. */
const WRITABLE: Partial<Record<keyof User, string>> = {
  name: "name",
  photoKey: "photo_key",
  country: "country",
  language: "language",
  languageChosen: "language_chosen",
  dateOrder: "date_order",
  clock24h: "clock_24h",
  timeZone: "time_zone",
};

export class D1Users implements UserStore {
  constructor(private db: D1Database) {}

  async byId(id: string) {
    const row = await this.db.prepare(`SELECT ${COLUMNS} FROM users u WHERE u.id = ?`).bind(id).first<UserRow>();
    return row ? toUser(row) : null;
  }

  async byEmail(email: string) {
    const row = await this.db.prepare(`SELECT ${COLUMNS} FROM users u WHERE u.email = ?`).bind(email.toLowerCase()).first<UserRow>();
    return row ? toUser(row) : null;
  }

  async update(id: string, patch: Partial<User>) {
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [field, column] of Object.entries(WRITABLE) as [keyof User, string][]) {
      if (!(field in patch)) continue;
      const value = patch[field];
      sets.push(`${column} = ?`);
      values.push(typeof value === "boolean" ? (value ? 1 : 0) : (value ?? null));
    }
    if (!sets.length) return;
    await this.db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).bind(...values, id).run();
  }
}

export class D1Codes implements CodeStore {
  constructor(private db: D1Database) {}

  async recentCount(email: string, since: string) {
    const row = await this.db.prepare(`SELECT count(*) AS n FROM codes WHERE email = ? AND created_at > ?`).bind(email, since).first<{ n: number }>();
    return row?.n ?? 0;
  }

  async put(email: string, codeHash: string, expiresAt: string, now: string) {
    await this.db
      .prepare(`INSERT INTO codes (id, email, code_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), email, codeHash, expiresAt, now)
      .run();
  }

  // Found and spent in one statement, so a code cannot be used twice however
  // fast the second try comes.
  async claim(email: string, codeHash: string, now: string) {
    const result = await this.db
      .prepare(
        `UPDATE codes SET used_at = ?
         WHERE id = (SELECT id FROM codes
                     WHERE email = ? AND code_hash = ? AND used_at IS NULL AND expires_at > ?
                     ORDER BY created_at DESC LIMIT 1)`,
      )
      .bind(now, email, codeHash, now)
      .run();
    return (result.meta.changes ?? 0) > 0;
  }

  async expireAll(email: string, now: string) {
    await this.db.prepare(`UPDATE codes SET used_at = ? WHERE email = ? AND used_at IS NULL`).bind(now, email).run();
  }

  async addTry(email: string, now: string) {
    await this.db.prepare(`INSERT INTO sign_in_tries (email, at) VALUES (?, ?)`).bind(email, now).run();
  }

  async triesSince(email: string, since: string) {
    const row = await this.db.prepare(`SELECT count(*) AS n FROM sign_in_tries WHERE email = ? AND at > ?`).bind(email, since).first<{ n: number }>();
    return row?.n ?? 0;
  }

  async pruneTries(before: string) {
    await this.db.batch([
      this.db.prepare(`DELETE FROM sign_in_tries WHERE at < ?`).bind(before),
      this.db.prepare(`DELETE FROM codes WHERE created_at < ?`).bind(before),
    ]);
  }
}

export class D1Sessions implements SessionStore {
  constructor(private db: D1Database) {}

  async create(idHash: string, userId: string, expiresAt: string, now: string) {
    await this.db
      .prepare(`INSERT INTO sessions (id_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`)
      .bind(idHash, userId, expiresAt, now)
      .run();
  }

  async userFor(idHash: string, now: string) {
    const row = await this.db
      .prepare(`SELECT ${COLUMNS} FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ? AND s.expires_at > ?`)
      .bind(idHash, now)
      .first<UserRow>();
    return row ? toUser(row) : null;
  }

  async destroy(idHash: string) {
    await this.db.prepare(`DELETE FROM sessions WHERE id_hash = ?`).bind(idHash).run();
  }
}

export class D1FetchLog implements FetchLog {
  constructor(private db: D1Database) {}

  async record(f: Fetched, keep: number) {
    await this.db.batch([
      this.db.prepare(`INSERT INTO fetched (path, size, seconds, sender, at) VALUES (?, ?, ?, ?, ?)`).bind(f.path, f.size, f.seconds, f.sender, f.at),
      this.db.prepare(`DELETE FROM fetched WHERE id NOT IN (SELECT id FROM fetched ORDER BY at DESC, id DESC LIMIT ?)`).bind(keep),
    ]);
  }

  async recent(limit: number) {
    const { results } = await this.db
      .prepare(`SELECT path, size, seconds, sender, at FROM fetched ORDER BY at DESC, id DESC LIMIT ?`)
      .bind(limit)
      .all<Fetched>();
    return results;
  }
}
