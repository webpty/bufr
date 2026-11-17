import type { Fetched, User, Waiting } from "./model";

/** Where waiting photos are kept. */
export interface PhotoStore {
  /** Keeps the photo; refuses it when its contents do not match `sha256`. */
  put(photo: Omit<Waiting, "size">, body: ReadableStream, size: number): Promise<Waiting>;
  list(): Promise<Waiting[]>;
  get(id: string): Promise<{ photo: Waiting; body: ReadableStream } | null>;
  /** Takes it off, and says what it was; null when it was not there. */
  remove(id: string): Promise<Waiting | null>;
  /** The home's internet address, as last seen when the NAS fetched. */
  home(): Promise<{ ip: string; seen: string } | null>;
  sawHome(ip: string, at: Date): Promise<void>;
}

/** The photos the NAS has fetched, newest first. */
export interface FetchLog {
  /** Records one and keeps only the newest `keep`. */
  record(fetched: Fetched, keep: number): Promise<void>;
  recent(limit: number): Promise<Fetched[]>;
}

/** The keys allowed in, by the SHA-256 of each. */
export interface KeyBook {
  find(key: string): Promise<{ name: string; role: "sender" | "fetcher"; home?: string } | null>;
}

/** The allow-list for the page, and each person's settings. */
export interface UserStore {
  byId(id: string): Promise<User | null>;
  byEmail(email: string): Promise<User | null>;
  update(id: string, patch: Partial<User>): Promise<void>;
}

export interface CodeStore {
  /** How many codes went to this address since the given moment. */
  recentCount(email: string, since: string): Promise<number>;
  put(email: string, codeHash: string, expiresAt: string, now: string): Promise<void>;
  /** Finds an unused, unexpired code and marks it used, in one statement. */
  claim(email: string, codeHash: string, now: string): Promise<boolean>;
  /** Spends every code outstanding for this address, so only one is alive. */
  expireAll(email: string, now: string): Promise<void>;
  addTry(email: string, now: string): Promise<void>;
  triesSince(email: string, since: string): Promise<number>;
  pruneTries(before: string): Promise<void>;
}

export interface SessionStore {
  create(idHash: string, userId: string, expiresAt: string, now: string): Promise<void>;
  userFor(idHash: string, now: string): Promise<User | null>;
  destroy(idHash: string): Promise<void>;
}

/** Profile photos, apart from the waiting photos. */
export interface AvatarStore {
  put(key: string, bytes: ArrayBuffer, type: string): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream; type: string } | null>;
  remove(key: string): Promise<void>;
}

export interface OutgoingMail {
  to: string;
  from: string;
  fromName?: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: OutgoingMail): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export interface Random {
  bytes(n: number): Uint8Array;
}
