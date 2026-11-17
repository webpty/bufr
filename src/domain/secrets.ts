// The six digits sent by mail, and the HMACs kept in their place. Only the
// HMAC of a code or of a session id is ever written down, so a copy of the
// database signs nobody in.

const encoder = new TextEncoder();

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

export function toBase64Url(bytes: Uint8Array | ArrayBuffer): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return btoa(String.fromCharCode(...view)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hmac(secret: string, text: string): Promise<string> {
  return toBase64Url(await crypto.subtle.sign("HMAC", await key(secret), encoder.encode(text)));
}

export function mintCode(random: { bytes(n: number): Uint8Array }): string {
  const b = random.bytes(4);
  const n = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
  return String(n % 1_000_000).padStart(6, "0");
}

export const hashCode = (secret: string, email: string, code: string) => hmac(secret, `code:${email.toLowerCase()}:${code}`);

export const hashSession = (secret: string, id: string) => hmac(secret, `session:${id}`);
