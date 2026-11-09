/**
 * Every date and number on screen goes through this module (decision record
 * 0007). Creating `Intl` formatters is slow, so each one is made once and
 * cached, which matters for lists with thousands of rows.
 */

/** The interface language. Change it here when translations arrive. */
export const locale = "en";

/** Weeks start on Monday, as in ISO 8601 (decision record 0007). */
export const weekStartsOn = 1;

const dateFormats = new Map<string, Intl.DateTimeFormat>();

function dateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, options);
    dateFormats.set(key, format);
  }
  return format;
}

function isSameYear(ms: number, now: number, timeZone?: string) {
  const year = dateFormat({ year: "numeric", timeZone });
  return year.format(ms) === year.format(now);
}

/**
 * A moment as a short date with a month name, such as "Nov 8", or
 * "Nov 8, 2025" when it is not this year. Never all digits, because readers
 * in Thailand read `11/8` as 11 August.
 */
export function formatDate(ms: number, now = Date.now()): string {
  return isSameYear(ms, now)
    ? dateFormat({ month: "short", day: "numeric" }).format(ms)
    : dateFormat({ month: "short", day: "numeric", year: "numeric" }).format(ms);
}

/** A moment with its time, such as "Nov 8, 2026, 3:04 PM". */
export function formatDateTime(ms: number): string {
  return dateFormat({ dateStyle: "medium", timeStyle: "short" }).format(ms);
}

/**
 * A calendar date, such as a due date. Zero gives it as milliseconds at UTC
 * midnight, so it is formatted in UTC to show the same day everywhere.
 */
export function formatCalendarDate(ms: number, now = Date.now()): string {
  const timeZone = "UTC";
  return isSameYear(ms, now, timeZone)
    ? dateFormat({ month: "short", day: "numeric", timeZone }).format(ms)
    : dateFormat({ month: "short", day: "numeric", year: "numeric", timeZone }).format(ms);
}

const relativeFormat = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

const relativeUnits: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["week", 7 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

/** Time from now, such as "5 minutes ago", "yesterday" or "in 2 days". */
export function formatRelativeTime(ms: number, now = Date.now()): string {
  const diff = ms - now;
  for (const [unit, size] of relativeUnits) {
    if (Math.abs(diff) >= size) {
      return relativeFormat.format(Math.round(diff / size), unit);
    }
  }
  return "just now";
}

const numberFormat = new Intl.NumberFormat(locale);

/** A count or other number, such as "1,234". */
export function formatNumber(value: number): string {
  return numberFormat.format(value);
}
