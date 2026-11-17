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
