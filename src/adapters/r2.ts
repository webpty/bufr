import { Refused, type Waiting } from "../domain/model";
import type { PhotoStore } from "../domain/ports";

const WAITING = "waiting/";
const HOME = "state/home.json";

function fromObject(id: string, size: number, meta: Record<string, string> | undefined): Waiting | null {
  if (!meta?.path || !meta.sha256) return null;
  return {
    id,
    path: meta.path,
    sha256: meta.sha256,
    size,
    modified: meta.modified || undefined,
    update: meta.update === "1",
    sender: meta.sender ?? "",
    added: meta.added ?? "",
  };
}

export class R2PhotoStore implements PhotoStore {
  constructor(private bucket: R2Bucket) {}

  async put(photo: Omit<Waiting, "size">, body: ReadableStream, size: number): Promise<Waiting> {
    const meta: Record<string, string> = {
      path: photo.path,
      sha256: photo.sha256,
      update: photo.update ? "1" : "0",
      sender: photo.sender,
      added: photo.added,
    };
    if (photo.modified) meta.modified = photo.modified;
    let stored: R2Object | null;
    try {
      // R2 checks the contents against the fingerprint and keeps nothing on a mismatch.
      stored = await this.bucket.put(WAITING + photo.id, body.pipeThrough(new FixedLengthStream(size)), {
        sha256: photo.sha256,
        customMetadata: meta,
      });
    } catch (error) {
      const text = String(error);
      if (/sha-?256|checksum|digest|BadDigest/i.test(text)) throw new Refused(422, "It arrived different from what was sent.");
      throw new Refused(502, "It could not be kept: " + text);
    }
    if (!stored) throw new Refused(502, "It could not be kept.");
    return { ...photo, size: stored.size };
  }

  async list(): Promise<Waiting[]> {
    const out: Waiting[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.bucket.list({ prefix: WAITING, cursor, include: ["customMetadata"] });
      for (const o of page.objects) {
        const w = fromObject(o.key.slice(WAITING.length), o.size, o.customMetadata);
        if (w) out.push(w);
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return out.sort((a, b) => a.added.localeCompare(b.added));
  }

  async get(id: string) {
    const o = await this.bucket.get(WAITING + id);
    if (!o) return null;
    const photo = fromObject(id, o.size, o.customMetadata);
    return photo ? { photo, body: o.body } : null;
  }

  async remove(id: string): Promise<boolean> {
    const there = await this.bucket.head(WAITING + id);
    if (!there) return false;
    await this.bucket.delete(WAITING + id);
    return true;
  }

  async home() {
    const o = await this.bucket.get(HOME);
    if (!o) return null;
    try {
      return (await o.json()) as { ip: string; seen: string };
    } catch {
      return null;
    }
  }

  async sawHome(ip: string, at: Date) {
    await this.bucket.put(HOME, JSON.stringify({ ip, seen: at.toISOString() }), {
      httpMetadata: { contentType: "application/json" },
    });
  }
}
