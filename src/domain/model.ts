// What bufr.cc holds: photos on their way from Geotag to the NAS at home.

export type Role = "sender" | "fetcher";

export interface Caller {
  name: string;
  role: Role;
  /** The NAS user whose home "home/..." means, for this key ("david"). */
  home?: string;
}

/** A photo waiting at Cloudflare for the NAS to fetch it. */
export interface Waiting {
  id: string;
  /** Where it goes on the NAS, under the volume: "homes/david/Geotag/2026.11.17 Ronda/DAVL3394.CR3". */
  path: string;
  sha256: string;
  size: number;
  /** The photo's own file date, ISO 8601, given to the copy on the NAS. */
  modified?: string;
  /** Geotag's earlier copy of the same photo may be replaced (a location added later). */
  update: boolean;
  /** Which key sent it. */
  sender: string;
  added: string;
}

export class Refused extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** A photo the NAS fetched and cleared, kept for good for the overview. */
export interface Fetched {
  path: string;
  size: number;
  /** How long the NAS took to fetch it; null when it did not say. */
  seconds: number | null;
  sender: string;
  /** When it arrived at bufr.cc; null for the fetches recorded before 0.3.0. */
  added: string | null;
  at: string;
}

/** A photo received from Geotag, kept for good for the overview. */
export interface Upload {
  size: number;
  /** How long the upload took, timed at bufr.cc from the request arriving
      to the photo being stored. */
  seconds: number | null;
  sender: string;
  at: string;
}

/** Somebody on the allow-list for the page. */
export interface User {
  id: string;
  email: string;
  name: string;
  role: "owner" | "member";
  photoKey: string | null;
  country: string | null;
  language: string | null;
  languageChosen: boolean;
  dateOrder: "dmmmy" | "dmy" | "mdy" | "ymd";
  clock24h: boolean;
  timeZone: string;
  createdAt: string;
}
