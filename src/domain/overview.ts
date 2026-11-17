import type { Overview } from "../../shared/types";
import type { Clock, FetchLog, PhotoStore } from "./ports";

/** How many recent fetches the overview lists and works the speed out from. */
export const RECENT = 20;

const lastPart = (path: string) => path.split("/").filter(Boolean).pop() ?? path;

/** What the page shows: when the NAS last checked in, what is waiting, what
    it fetched lately and how fast. Names only, never a full path or an
    address. */
export async function overview(store: PhotoStore, log: FetchLog, clock: Clock): Promise<Overview> {
  const [home, waiting, recent] = await Promise.all([store.home(), store.list(), log.recent(RECENT)]);
  return {
    lastCheckIn: home?.seen ?? null,
    waiting: waiting.map((w) => ({ name: lastPart(w.path), size: w.size, sender: w.sender, added: w.added })),
    fetched: recent.map((f) => ({ name: lastPart(f.path), size: f.size, seconds: f.seconds, sender: f.sender, at: f.at })),
    bytesPerSecond: speed(recent),
    now: clock.now().toISOString(),
  };
}

/** All the bytes over all the seconds, so one tiny file fetched in a blink
    does not swing it the way an average of rates would. */
export function speed(recent: { size: number; seconds: number | null }[]): number | null {
  let bytes = 0;
  let seconds = 0;
  for (const f of recent) {
    if (f.seconds === null || f.seconds <= 0) continue;
    bytes += f.size;
    seconds += f.seconds;
  }
  return seconds > 0 ? bytes / seconds : null;
}
