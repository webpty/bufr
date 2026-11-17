import type { Waiting } from "./model";

/** Where waiting photos are kept. */
export interface PhotoStore {
  /** Keeps the photo; refuses it when its contents do not match `sha256`. */
  put(photo: Omit<Waiting, "size">, body: ReadableStream, size: number): Promise<Waiting>;
  list(): Promise<Waiting[]>;
  get(id: string): Promise<{ photo: Waiting; body: ReadableStream } | null>;
  remove(id: string): Promise<boolean>;
  /** The home's internet address, as last seen when the NAS fetched. */
  home(): Promise<{ ip: string; seen: string } | null>;
  sawHome(ip: string, at: Date): Promise<void>;
}

/** The keys allowed in, by the SHA-256 of each. */
export interface KeyBook {
  find(key: string): Promise<{ name: string; role: "sender" | "fetcher" } | null>;
}
