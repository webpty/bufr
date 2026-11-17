import { Refused, type Caller, type Waiting } from "./model";
import type { PhotoStore } from "./ports";

/** The home counts as seen while the NAS has fetched within this time. */
const HOME_FRESH_MS = 10 * 60 * 1000;

/** A path on the NAS: plain folder names, never "..", never absolute. */
export function cleanPath(raw: string): string {
  const parts = raw.split("/").filter((p) => p.length > 0);
  if (parts.length < 2) throw new Refused(400, "The path needs a folder and a name.");
  for (const p of parts) {
    if (p === "." || p === ".." || p.includes("\\") || p.includes("\0")) throw new Refused(400, "The path is not allowed.");
  }
  return parts.join("/");
}

/** One id per destination: the same photo sent again replaces the waiting copy. */
export async function idFor(path: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(path));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class Buffer {
  constructor(private store: PhotoStore) {}

  private need(caller: Caller, role: Caller["role"]) {
    if (caller.role !== role) throw new Refused(403, "This key can't do that.");
  }

  async status(caller: Caller, ip: string | null) {
    const waiting = await this.store.list();
    const home = await this.store.home();
    const fresh = home !== null && Date.now() - Date.parse(home.seen) < HOME_FRESH_MS;
    return {
      role: caller.role,
      name: caller.name,
      waiting: waiting.length,
      waitingBytes: waiting.reduce((sum, w) => sum + w.size, 0),
      // At home when this call comes from the address the NAS fetches from.
      atHome: fresh && ip !== null && home!.ip === ip,
      homeSeen: home?.seen ?? null,
    };
  }

  async receive(
    caller: Caller,
    input: { path: string; sha256: string; modified?: string; update: boolean; size: number },
    body: ReadableStream,
  ): Promise<Waiting> {
    this.need(caller, "sender");
    const path = cleanPath(input.path);
    const sha256 = input.sha256.toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Refused(400, "The fingerprint is missing.");
    if (!Number.isFinite(input.size) || input.size <= 0) throw new Refused(411, "The size is missing.");
    if (input.modified !== undefined && Number.isNaN(Date.parse(input.modified))) throw new Refused(400, "The date is not readable.");
    return this.store.put(
      { id: await idFor(path), path, sha256, modified: input.modified, update: input.update, sender: caller.name, added: new Date().toISOString() },
      body,
      input.size,
    );
  }

  async waiting(caller: Caller, ip: string | null): Promise<Waiting[]> {
    this.need(caller, "fetcher");
    if (ip) await this.store.sawHome(ip, new Date());
    return this.store.list();
  }

  async fetch(caller: Caller, id: string) {
    this.need(caller, "fetcher");
    const found = await this.store.get(id);
    if (!found) throw new Refused(404, "Not waiting here.");
    return found;
  }

  async done(caller: Caller, id: string) {
    this.need(caller, "fetcher");
    if (!(await this.store.remove(id))) throw new Refused(404, "Not waiting here.");
  }
}
