import { describe, expect, it } from "vitest";

import {
  formatCalendarDate,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
} from "./format";

const now = Date.UTC(2026, 10, 9, 12);

describe("formatDate", () => {
  it("leaves out the year for this year", () => {
    expect(formatDate(Date.UTC(2026, 10, 8, 12), now)).toBe("Nov 8");
  });

  it("adds the year for another year, with a month name", () => {
    expect(formatDate(Date.UTC(2025, 2, 3, 12), now)).toBe("Mar 3, 2025");
  });
});

describe("formatCalendarDate", () => {
  it("shows the same day in every time zone", () => {
    // A due date of November 8 arrives as UTC midnight.
    expect(formatCalendarDate(Date.UTC(2026, 10, 8), now)).toBe("Nov 8");
  });
});

describe("formatDateTime", () => {
  it("includes the time", () => {
    expect(formatDateTime(Date.UTC(2026, 10, 8, 12))).toMatch(/^Nov 8, 2026, \d{1,2}:00\s?[AP]M$/);
  });
});

describe("formatRelativeTime", () => {
  it("names recent moments", () => {
    expect(formatRelativeTime(now - 20_000, now)).toBe("just now");
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe("5 minutes ago");
    expect(formatRelativeTime(now - 24 * 60 * 60_000, now)).toBe("yesterday");
    expect(formatRelativeTime(now + 2 * 24 * 60 * 60_000, now)).toBe("in 2 days");
  });
});

describe("formatNumber", () => {
  it("groups thousands", () => {
    expect(formatNumber(20_000)).toBe("20,000");
  });
});
