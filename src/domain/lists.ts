import { idFor } from "./buffer";
import { Refused, type Caller } from "./model";
import type { ListStore } from "./ports";

/** The largest list kept: a person's every photo saved is a few MB at most. */
export const LIST_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Geotag's sync lists (Geotag 0.31.8, David, 18 November 2026): each
 * person's list of photos copied and their cameras' offsets, kept here as
 * well as in "~Geotag" on the NAS, so a phone away from home knows what the
 * other devices copied. Only Geotag's own two lists, under a "~Geotag" folder
 * in someone's home; never seen by the NAS fetcher.
 */
export class Lists {
  constructor(private store: ListStore) {}

  /** "home/Geotag/~Geotag/saved.json" from a phone, made "homes/<home>/...". */
  private where(caller: Caller, raw: string): string {
    if (caller.role !== "sender") throw new Refused(403, "This key can't do that.");
    const parts = raw.split("/").filter((p) => p.length > 0);
    for (const p of parts) {
      if (p === "." || p === ".." || p.includes("\\") || p.includes("\0")) throw new Refused(400, "The path is not allowed.");
    }
    let path = parts.join("/");
    if (path.startsWith("home/")) {
      if (!caller.home) throw new Refused(400, "This key has no home folder.");
      path = `homes/${caller.home}/${path.slice("home/".length)}`;
    }
    if (!/^homes\/[^/]+\/(.+\/)?~Geotag\/(saved|cameras)\.json$/.test(path)) throw new Refused(400, "Only Geotag's sync lists are kept.");
    return path;
  }

  async read(caller: Caller, path: string): Promise<string | null> {
    return this.store.get(await idFor(this.where(caller, path)));
  }

  async write(caller: Caller, path: string, text: string): Promise<void> {
    const where = this.where(caller, path);
    if (text.length > LIST_MAX_BYTES) throw new Refused(413, "The list is too large.");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Refused(400, "The list is not readable.");
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Refused(400, "The list is not readable.");
    await this.store.put(await idFor(where), text, where);
  }
}
