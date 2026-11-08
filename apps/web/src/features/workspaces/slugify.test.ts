import { describe, expect, it } from "vitest";

import { slugify } from "./slugify";

describe("slugify", () => {
  it("makes a lowercase ASCII slug", () => {
    expect(slugify("  Acme Design Team! ")).toBe("acme-design-team");
  });

  it("drops accents", () => {
    expect(slugify("Café Crème")).toBe("cafe-creme");
  });

  it("gives an empty slug for a Thai name", () => {
    expect(slugify("ทีมออกแบบ")).toBe("");
  });
});
