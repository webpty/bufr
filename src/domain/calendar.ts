// Wall-clock dates in a time zone, so a day on the charts starts at the
// reader's midnight rather than at UTC's.

export interface Wall {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-GB", {
        timeZone: zone,
        hourCycle: "h23",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
      });
    } catch {
      return formatter("UTC");
    }
    formatters.set(zone, f);
  }
  return f;
}

/** What the clock on the wall says at this moment. */
export function wall(at: Date, zone: string): Wall {
  const out: Record<string, number> = {};
  for (const p of formatter(zone).formatToParts(at)) if (p.type !== "literal") out[p.type] = Number(p.value);
  return { y: out.year, m: out.month, d: out.day, h: out.hour % 24, mi: out.minute };
}

/** Minutes the zone is ahead of UTC at this moment. */
function offset(at: Date, zone: string): number {
  const w = wall(at, zone);
  return Math.round((Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi) - Math.floor(at.getTime() / 60_000) * 60_000) / 60_000);
}

/** The moment the wall clock shows this date and hour. Out-of-range days and
    months roll over, as Date.UTC does. */
export function moment(y: number, m: number, d: number, h: number, zone: string): Date {
  const guess = Date.UTC(y, m - 1, d, h);
  const first = offset(new Date(guess), zone);
  const second = offset(new Date(guess - first * 60_000), zone);
  return new Date(guess - second * 60_000);
}

/** The wall date `days` after this one. */
export function addDays(w: Wall, days: number): Wall {
  const t = new Date(Date.UTC(w.y, w.m - 1, w.d + days));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), h: 0, mi: 0 };
}

/** Monday 0 to Sunday 6. */
export function weekday(w: Wall): number {
  return (new Date(Date.UTC(w.y, w.m - 1, w.d)).getUTCDay() + 6) % 7;
}

export const dayKey = (w: Wall) => `${w.y}-${String(w.m).padStart(2, "0")}-${String(w.d).padStart(2, "0")}`;
