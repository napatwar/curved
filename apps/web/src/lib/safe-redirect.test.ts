import { describe, expect, it } from "vitest";

import { safeRedirect } from "./safe-redirect";

describe("safeRedirect", () => {
  it("keeps a path on this site", () => {
    expect(safeRedirect("/curved?tab=1")).toBe("/curved?tab=1");
  });

  it.each([undefined, "", "https://evil.example", "//evil.example", "/\\evil.example"])(
    "falls back to / for %s",
    (target) => {
      expect(safeRedirect(target)).toBe("/");
    },
  );
});
