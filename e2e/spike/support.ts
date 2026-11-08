import { execFileSync } from "node:child_process";

import { expect, type Page } from "@playwright/test";
import { Client } from "pg";

export const WORKSPACE_ID = "00000000-0000-7000-8000-000000000001";
export const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:pass@localhost:5432/curved";
export const ZERO_CACHE_CONTAINER = "curved-zero-cache-1";

export { recordResult, summarize } from "./results";

export async function sql<T extends Record<string, unknown>>(text: string, params: unknown[] = []) {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    return (await client.query<T>(text, params)).rows;
  } finally {
    await client.end();
  }
}

/** zero-cache log lines written at or after `since`, without debug output. */
export function zeroCacheLogs(since: Date) {
  const lookback = new Date(since.getTime() - 2000).toISOString();
  return execFileSync(
    "docker",
    ["logs", "--timestamps", "--since", lookback, ZERO_CACHE_CONTAINER],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 256 * 1024 * 1024,
    },
  )
    .split("\n")
    .filter((line) => line && !line.includes('"level":"DEBUG"'))
    .map((line) => {
      const space = line.indexOf(" ");
      return { at: Date.parse(line.slice(0, space)), text: line.slice(space + 1) };
    })
    .filter((line) => line.at >= since.getTime());
}

type ResultType = "unknown" | "complete" | "error";

type View = {
  addListener(listener: (data: readonly unknown[], resultType: ResultType) => void): () => void;
  destroy(): void;
};

type MutationResult = { type: "success" } | { type: "error"; error: { message: string } };

/** The handle that `apps/web/src/hooks/use-expose-zero.ts` puts on `window`. */
type CurvedHandle = {
  zero: {
    materialize(query: unknown): View;
    mutate(request: unknown): { server: Promise<MutationResult> };
  };
  queries: {
    issues: {
      byFilter(args: Record<string, unknown>): unknown;
    };
  };
  mutators: {
    issues: {
      update(args: { id: string; stateId: string }): unknown;
    };
  };
};

/** Timings that `observePage` collects inside the page. */
type SpikeTimings = {
  firstRowMs: number | null;
  loadMarker?: boolean;
  alertAt?: number;
  connection: { name: string; at: number }[];
  rowChanges: { text: string; at: number }[];
  newest?: { id: string; stateId: string };
  newestChanges: { stateId: string; at: number }[];
};

declare global {
  interface Window {
    curvedZero?: CurvedHandle;
    spikeTimings: SpikeTimings;
  }
}

/**
 * Records, inside the page, when the first issue row is painted and when the
 * connection label changes. Call before `page.goto`.
 */
export async function observePage(page: Page) {
  await page.addInitScript(() => {
    window.spikeTimings = { firstRowMs: null, connection: [], rowChanges: [], newestChanges: [] };
    const observer = new MutationObserver(() => {
      const label = document.querySelector("header span")?.textContent;
      const last = window.spikeTimings.connection.at(-1);
      if (label && label !== last?.name) {
        window.spikeTimings.connection.push({ name: label, at: Date.now() });
      }
      if (window.spikeTimings.firstRowMs === null && document.querySelector("main ul > li")) {
        window.spikeTimings.firstRowMs = -1;
        requestAnimationFrame(() => {
          window.spikeTimings.firstRowMs = performance.now();
        });
      }
    });
    document.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    });
  });
}

export async function waitForRows(page: Page) {
  await page.waitForFunction(() => (window.spikeTimings.firstRowMs ?? -1) > 0, undefined, {
    timeout: 60_000,
  });
  await connectionLabel(page, "connected");
}

/**
 * Waits for the connection label in the header. Role and text locators scan
 * every element on the page's main thread, which with 20,000 rows can block
 * Zero for seconds, so the spike uses cheap CSS locators.
 */
export async function connectionLabel(page: Page, name: string, timeout = 30_000) {
  await expect(page.locator("header span")).toHaveText(name, { timeout });
}

/** Records every text change of the first issue row's button. */
export async function watchFirstRow(page: Page) {
  await page.evaluate(() => {
    const row = document.querySelector("main ul > li");
    if (!row) {
      throw new Error("No issue row");
    }
    window.spikeTimings.rowChanges = [];
    let last = row.querySelector("button")?.textContent ?? "";
    new MutationObserver(() => {
      const text = row.querySelector("button")?.textContent ?? "";
      if (text !== last) {
        last = text;
        window.spikeTimings.rowChanges.push({ text, at: Date.now() });
      }
    }).observe(row, { childList: true, subtree: true, characterData: true });
  });
}

/**
 * Watches the newest issue through Zero directly, without React, and records
 * each state change it sees.
 */
export async function watchNewestIssue(page: Page) {
  await page.evaluate((workspaceId) => {
    const handle = window.curvedZero;
    if (!handle) {
      throw new Error("The Zero test hook is missing");
    }
    const view = handle.zero.materialize(handle.queries.issues.byFilter({ workspaceId, limit: 1 }));
    view.addListener((data) => {
      const [first] = data;
      const row =
        typeof first === "object" && first && "id" in first && "stateId" in first
          ? { id: String(first.id), stateId: String(first.stateId) }
          : undefined;
      const previous = window.spikeTimings.newest;
      if (row && previous && row.stateId !== previous.stateId) {
        window.spikeTimings.newestChanges.push({ stateId: row.stateId, at: Date.now() });
      }
      window.spikeTimings.newest = row;
    });
  }, WORKSPACE_ID);
}
