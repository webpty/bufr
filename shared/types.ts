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

/** The periods the overview can show. */
export type Period = "day" | "week" | "month" | "year" | "all";

export const PERIODS: Period[] = ["day", "week", "month", "year", "all"];

/** How long each bar or point on the charts covers. */
export type Unit = "hour" | "day" | "week" | "month";

export interface Amount {
  count: number;
  bytes: number;
}

/** One bar or point on the charts. Null where nothing was measured. */
export interface Point {
  /** When it starts. */
  at: string;
  copied: number;
  copiedBytes: number;
  /** Everything ever copied to the NAS by its end. */
  total: number;
  /** Photos waiting at its end; null before waiting photos were recorded. */
  waiting: number | null;
  /** Bytes a second. */
  upload: number | null;
  download: number | null;
  /** The average time a photo copied in it had waited at bufr.cc, seconds. */
  wait: number | null;
}

export interface Speed {
  /** The period's average, bytes a second; null when nothing was timed. */
  average: number | null;
  /** The best hour's in the last 30 days, for the dial's scale. */
  fastest: number | null;
}

export interface Overview {
  period: Period;
  unit: Unit;
  /** When the NAS last asked for the waiting list. */
  lastCheckIn: string | null;
  waiting: Amount;
  /** Waiting when the period began; null when that is not known. */
  waitingAtStart: number | null;
  /** Copied to the NAS in the period, and in the period before. */
  copied: Amount;
  copiedBefore: Amount | null;
  /** Everything ever copied to the NAS. */
  total: Amount;
  upload: Speed;
  download: Speed;
  /** How long the photos copied in the period waited at bufr.cc, seconds. */
  wait: { average: number; shortest: number; longest: number } | null;
  points: Point[];
  /** The Worker's clock, so "how long ago" is not at the mercy of the
      phone's. */
  now: string;
}
