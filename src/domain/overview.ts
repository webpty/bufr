import type { Amount, Overview, Period, Point, Unit } from "../../shared/types";
import { addDays, dayKey, moment, wall, weekday } from "./calendar";
import type { Clock, Ledger, PhotoStore } from "./ports";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** How long a bar covers, for each period. */
const UNITS: Record<Period, Unit> = { day: "hour", week: "day", month: "day", year: "week", all: "month" };

/** Where a period starts, as the reader's clock has it. "all" starts with
    the first thing ever recorded, known only once the records are read. */
function start(period: Exclude<Period, "all">, now: Date, zone: string): Date {
  if (period === "day") return new Date(Math.floor(now.getTime() / HOUR) * HOUR - 23 * HOUR);
  const today = wall(now, zone);
  if (period === "year") return moment(today.y, 1, 1, 0, zone);
  const first = addDays(today, period === "week" ? -6 : -29);
  return moment(first.y, first.m, first.d, 0, zone);
}

/** When each bar begins, from `begin` to now. */
function starts(unit: Unit, begin: Date, now: Date, zone: string): Date[] {
  const out: Date[] = [];
  const w = wall(begin, zone);
  if (unit === "hour") {
    for (let t = begin.getTime(); t <= now.getTime(); t += HOUR) out.push(new Date(t));
  } else if (unit === "day") {
    for (let i = 0; ; i++) {
      const d = addDays(w, i);
      const s = moment(d.y, d.m, d.d, 0, zone);
      if (s > now) break;
      out.push(s);
    }
  } else if (unit === "week") {
    // The first week starts with the period, the others on a Monday.
    out.push(begin);
    for (let i = 7 - weekday(w); ; i += 7) {
      const d = addDays(w, i);
      const s = moment(d.y, d.m, d.d, 0, zone);
      if (s > now) break;
      out.push(s);
    }
  } else {
    for (let i = 0; ; i++) {
      const s = moment(w.y, w.m + i, 1, 0, zone);
      if (s > now) break;
      out.push(s);
    }
  }
  return out;
}

/** Which bar a moment falls in, by a name both sides agree on. */
function keyer(unit: Unit, begin: Date, zone: string): (at: Date) => string {
  if (unit === "hour") return (at) => at.toISOString().slice(0, 13);
  if (unit === "day") return (at) => dayKey(wall(at, zone));
  if (unit === "month") {
    return (at) => {
      const w = wall(at, zone);
      return `${w.y}-${String(w.m).padStart(2, "0")}`;
    };
  }
  const first = dayKey(wall(begin, zone));
  return (at) => {
    const w = wall(at, zone);
    const monday = dayKey(addDays(w, -weekday(w)));
    return monday < first ? first : monday;
  };
}

const earliest = (dates: (string | null | undefined)[]) =>
  dates
    .filter((d): d is string => !!d && !Number.isNaN(Date.parse(d)))
    .map((d) => new Date(d))
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

/** Figures and charts for the page: no photo's name, path or sender, and
    never the home's address. */
export async function overview(store: PhotoStore, ledger: Ledger, clock: Clock, period: Period, zone: string): Promise<Overview> {
  const now = clock.now();
  const unit = UNITS[period];
  const from = period === "all" ? null : start(period, now, zone);
  const previousFrom = from ? new Date(from.getTime() - (now.getTime() - from.getTime())) : null;
  const [home, waiting, h] = await Promise.all([
    store.home(),
    store.list(),
    ledger.history({
      from: from?.toISOString() ?? "0000",
      previousFrom: previousFrom?.toISOString() ?? null,
      fastestFrom: new Date(now.getTime() - 30 * DAY).toISOString(),
    }),
  ]);

  // Everything starts with the month the first photo came through.
  let begin = from;
  if (!begin) {
    const first = wall(earliest([h.firstFetch, h.firstTracked, ...waiting.map((w) => w.added)]) ?? now, zone);
    begin = moment(first.y, first.m, 1, 0, zone);
  }
  const bars = starts(unit, begin, now, zone);
  const keyOf = keyer(unit, begin, zone);
  const index = new Map(bars.map((s, i) => [keyOf(s), i]));
  const slot = (at: Date) => index.get(keyOf(at < begin ? begin : at > now ? now : at));
  const ofHour = (hour: string) => slot(new Date(hour + ":00:00Z"));

  const n = bars.length;
  const zeros = () => new Array<number>(n).fill(0);
  const copied = zeros(), copiedBytes = zeros(), down = zeros(), downSeconds = zeros(), up = zeros(), upSeconds = zeros();
  const waits = zeros(), waitSum = zeros(), arrived = zeros(), left = zeros();
  let shortest = Infinity;
  let longest = 0;

  for (const r of h.fetched) {
    const i = ofHour(r.hour);
    if (i === undefined) continue;
    copied[i] += r.n;
    copiedBytes[i] += r.bytes;
    down[i] += r.timedBytes;
    downSeconds[i] += r.timedSeconds;
    waits[i] += r.waits;
    waitSum[i] += r.waitSum;
    left[i] += r.waits;
    if (r.waitMin !== null) shortest = Math.min(shortest, r.waitMin);
    if (r.waitMax !== null) longest = Math.max(longest, r.waitMax);
  }
  for (const r of h.uploads) {
    const i = ofHour(r.hour);
    if (i === undefined) continue;
    up[i] += r.timedBytes;
    upSeconds[i] += r.timedSeconds;
  }
  for (const r of h.arrivals) {
    const i = ofHour(r.hour);
    if (i !== undefined) arrived[i] += r.n;
  }
  for (const w of waiting) {
    const at = new Date(w.added);
    if (Number.isNaN(at.getTime()) || at < begin) continue;
    const i = slot(at);
    if (i !== undefined) arrived[i]++;
  }

  // How many were waiting at the end of each bar, worked back from now:
  // those waiting then are those waiting now, less the ones that arrived
  // since, plus the ones fetched since. It holds only from when arrivals
  // began to be recorded.
  const tracked = h.firstTracked ? new Date(h.firstTracked) : now;
  const ends = bars.map((_, i) => (i + 1 < n ? bars[i + 1] : now));
  const atEnd = new Array<number>(n);
  let count = waiting.length;
  for (let i = n - 1; i >= 0; i--) {
    atEnd[i] = count;
    count = count - arrived[i] + left[i];
  }
  const waitingAtStart = begin >= tracked && n > 0 ? Math.max(0, count) : null;

  let running = h.fetchedBefore.n;
  const points: Point[] = bars.map((s, i) => {
    running += copied[i];
    return {
      at: s.toISOString(),
      copied: copied[i],
      copiedBytes: copiedBytes[i],
      total: running,
      waiting: ends[i] >= tracked || i === n - 1 ? Math.max(0, atEnd[i]) : null,
      upload: upSeconds[i] > 0 ? up[i] / upSeconds[i] : null,
      download: downSeconds[i] > 0 ? down[i] / downSeconds[i] : null,
      wait: waits[i] > 0 ? waitSum[i] / waits[i] : null,
    };
  });

  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const period_: Amount = { count: sum(copied), bytes: sum(copiedBytes) };
  const allWaits = sum(waits);
  return {
    period,
    unit,
    lastCheckIn: home?.seen ?? null,
    waiting: { count: waiting.length, bytes: waiting.reduce((total, w) => total + w.size, 0) },
    waitingAtStart,
    copied: period_,
    copiedBefore: h.fetchedPrevious ? { count: h.fetchedPrevious.n, bytes: h.fetchedPrevious.bytes } : null,
    total: { count: h.fetchedBefore.n + period_.count, bytes: h.fetchedBefore.bytes + period_.bytes },
    upload: { average: sum(upSeconds) > 0 ? sum(up) / sum(upSeconds) : null, fastest: h.fastestUpload },
    download: { average: sum(downSeconds) > 0 ? sum(down) / sum(downSeconds) : null, fastest: h.fastestDownload },
    wait: allWaits > 0 ? { average: sum(waitSum) / allWaits, shortest, longest } : null,
    points,
    now: now.toISOString(),
  };
}
