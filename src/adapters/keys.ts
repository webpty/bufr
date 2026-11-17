import type { KeyBook } from "../domain/ports";

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The KEYS secret: {"<sha256 of key>": {"name": "...", "role": "sender" | "fetcher"}}. */
export class SecretKeyBook implements KeyBook {
  private book: Record<string, { name: string; role: "sender" | "fetcher" }>;

  constructor(json: string | undefined) {
    try {
      this.book = json ? JSON.parse(json) : {};
    } catch {
      this.book = {};
    }
  }

  async find(key: string) {
    if (key.length < 20) return null;
    return this.book[await sha256(key)] ?? null;
  }
}
