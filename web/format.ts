// Dates, times, sizes and durations, written the way the reader asked.
//
// The date order is taken apart and put back rather than left to a locale: a
// locale decides the order as a side effect of the language, and here the two
// are separate choices.

import type { DateOrder, Me } from "../shared/types";

export interface Preferences {
  dateOrder: DateOrder;
  clock24h: boolean;
  timeZone: string;
  /** The page's language, for month names and numbers. */
  language: string;
}

export function here(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

export function preferences(me: Me | null, language: string): Preferences {
  return {
    dateOrder: me?.dateOrder ?? "dmmmy",
    clock24h: me?.clock24h ?? true,
    timeZone: me?.timeZone || here(),
    language,
  };
}

function pieces(at: Date, how: Preferences) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: how.timeZone, day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(at);
  const find = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const named = new Intl.DateTimeFormat(how.language, { timeZone: how.timeZone, month: "short" }).format(at).replace(/\.$/, "");
  return { day: find("day"), month: find("month"), year: find("year"), named };
}

export function formatDate(at: string | Date, how: Preferences): string {
  const { day, month, year, named } = pieces(new Date(at), how);
  if (how.dateOrder === "dmmmy") return `${day} ${named} ${year}`;
  if (how.dateOrder === "mdy") return `${month}/${day}/${year}`;
  if (how.dateOrder === "ymd") return `${year}-${month}-${day}`;
  return `${day}/${month}/${year}`;
}

export function formatTime(at: string | Date, how: Preferences): string {
  return new Intl.DateTimeFormat(how.clock24h ? "en-GB" : "en-US", {
    timeZone: how.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: !how.clock24h,
  }).format(new Date(at));
}

/** The time alone when it is today where the reader is, else the date too. */
export function formatWhen(at: string | Date, how: Preferences, now: Date): string {
  return formatDate(at, how) === formatDate(now, how) ? formatTime(at, how) : `${formatDate(at, how)} ${formatTime(at, how)}`;
}

/** A sample of what an order looks like, for choosing between them. */
export function sample(order: DateOrder, how: Preferences): string {
  return formatDate(new Date(Date.UTC(2026, 11, 31, 12)), { ...how, dateOrder: order, timeZone: "UTC" });
}

/** Every zone the browser knows, or at least the one it is in. */
export function zones(): string[] {
  try {
    const list = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone");
    if (list?.length) return list;
  } catch {
    // Older browsers will not say.
  }
  return [here()];
}

const unit = (language: string, n: number, which: string, digits = 0) =>
  new Intl.NumberFormat(language, { style: "unit", unit: which, unitDisplay: "short", maximumFractionDigits: digits }).format(n);

/** 24.3 MB, or 812 kB below a megabyte. Decimal, as the Finder counts. */
export function formatSize(bytes: number, language: string): string {
  if (bytes >= 1e9) return unit(language, bytes / 1e9, "gigabyte", 2);
  if (bytes >= 1e6) return unit(language, bytes / 1e6, "megabyte", 1);
  return unit(language, Math.max(1, Math.round(bytes / 1e3)), "kilobyte");
}

export function formatSpeed(bytesPerSecond: number, language: string): string {
  return unit(language, bytesPerSecond / 1e6, "megabyte-per-second", bytesPerSecond >= 1e7 ? 0 : 2);
}

/** How long something took or has lasted: "8.4 s", "12 min", "2 hr 5 min",
    "3 days". */
export function formatDuration(seconds: number, language: string): string {
  if (seconds < 1) return unit(language, Math.max(0.01, seconds), "second", 2);
  if (seconds < 10) return unit(language, seconds, "second", 1);
  if (seconds < 60) return unit(language, Math.round(seconds), "second");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return unit(language, minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest ? `${unit(language, hours, "hour")} ${unit(language, rest, "minute")}` : unit(language, hours, "hour");
  }
  return new Intl.NumberFormat(language, { style: "unit", unit: "day", unitDisplay: "long" }).format(Math.floor(hours / 24));
}
