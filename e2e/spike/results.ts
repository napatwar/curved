import { mkdirSync, writeFileSync } from "node:fs";

/** Saves one measurement to `spike-results/<name>.json` and prints it. */
export function recordResult(name: string, data: unknown) {
  mkdirSync("spike-results", { recursive: true });
  writeFileSync(`spike-results/${name}.json`, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`[spike] ${name}: ${JSON.stringify(data)}`);
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

export function summarize(values: number[]) {
  const sorted = values.toSorted((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  return {
    n: sorted.length,
    min: round(sorted[0] ?? 0),
    p50: round(at(0.5)),
    p95: round(at(0.95)),
    p99: round(at(0.99)),
    max: round(sorted.at(-1) ?? 0),
  };
}
