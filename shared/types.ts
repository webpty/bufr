// The shapes the page and the Worker both speak. Anything here crosses the
// wire, so it holds no secret, no key and no internet address.

export type Role = "owner" | "member";

/** "dmmmy" is 21 Sep 2026: the month in words, which cannot be misread the
    way 09/10 can. */
export type DateOrder = "dmmmy" | "dmy" | "mdy" | "ymd";

export const DATE_ORDERS: DateOrder[] = ["dmmmy", "dmy", "mdy", "ymd"];

/** Who is signed in, and how they want the page to read. */
export interface Me {
  id: string;
  /** Identity. Shown in settings, never editable. */
  email: string;
  name: string;
  role: Role;
  /** Set when they have a photo; it changes with every new one, so the page
      can ask for /api/me/photo?v=<this> and never see a stale copy. */
  photo: string | null;
  country: string | null;
  language: string | null;
  languageChosen: boolean;
  dateOrder: DateOrder;
  clock24h: boolean;
  timeZone: string;
}

/** What the settings page may change. */
export interface SettingsPatch {
  name?: string;
  country?: string | null;
  /** Sent only once chosen on the page, which also sets the flag. */
  language?: string;
  dateOrder?: DateOrder;
  clock24h?: boolean;
  timeZone?: string;
}

/** A photo still at Cloudflare. */
export interface WaitingRow {
  /** The last part of its path. */
  name: string;
  size: number;
  /** Which key sent it. */
  sender: string;
  added: string;
}

/** A photo the NAS fetched. */
export interface FetchedRow {
  name: string;
  size: number;
  /** How long the fetch took; null when the fetcher did not say. */
  seconds: number | null;
  sender: string;
  at: string;
}

export interface Overview {
  /** When the NAS last asked for the waiting list. */
  lastCheckIn: string | null;
  waiting: WaitingRow[];
  fetched: FetchedRow[];
  /** Bytes a second over the recent fetches that say how long they took. */
  bytesPerSecond: number | null;
  /** The Worker's clock, so "how long it has waited" is not at the mercy of
      the phone's. */
  now: string;
}
