import type { Fetched, Upload, User, Waiting } from "./model";

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

/** Geotag's sync lists, by the id of their path. */
export interface ListStore {
  get(id: string): Promise<string | null>;
  put(id: string, text: string, path: string): Promise<void>;
}

/** Every upload and every fetch, kept for good, and summed by the hour for
    the overview. */
export interface Ledger {
  fetched(fetched: Fetched): Promise<void>;
  uploaded(upload: Upload): Promise<void>;
  history(query: HistoryQuery): Promise<History>;
}

/** All times ISO 8601 in UTC; "0000" for "since the start". */
export interface HistoryQuery {
  from: string;
  /** The start of the period before, for comparing; null when there is none. */
  previousFrom: string | null;
  /** How far back to look for the fastest hour. */
  fastestFrom: string;
}

/** Sums over one UTC hour, "2026-11-18T14". Timed sums cover only the
    transfers that said how long they took. */
export interface HourSums {
  hour: string;
  n: number;
  bytes: number;
  timedBytes: number;
  timedSeconds: number;
}

export interface FetchedHour extends HourSums {
  /** Of those, the ones that know when they arrived, and how long they
      waited at bufr.cc in all, the shortest and the longest. */
  waits: number;
  waitSum: number;
  waitMin: number | null;
  waitMax: number | null;
}

export interface Sum {
  n: number;
  bytes: number;
}

export interface History {
  fetched: FetchedHour[];
  uploads: HourSums[];
  /** Fetched photos by the hour they arrived at bufr.cc. */
  arrivals: { hour: string; n: number }[];
  /** Everything fetched before `from`. */
  fetchedBefore: Sum;
  fetchedPrevious: Sum | null;
  uploadsPrevious: Sum | null;
  /** The best hour's speed since `fastestFrom`, bytes a second. */
  fastestDownload: number | null;
  fastestUpload: number | null;
  /** The first fetch ever, and the first that knew when it arrived or the
      first upload timed, whichever came first: when the record of waiting
      photos begins. */
  firstFetch: string | null;
  firstTracked: string | null;
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
