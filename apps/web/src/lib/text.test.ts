import { describe, expect, it } from "vitest";

import { avatarInitial } from "./text";

describe("avatarInitial", () => {
  it("takes the first letter in uppercase", () => {
    expect(avatarInitial("  acme")).toBe("A");
  });

  it("keeps a Thai consonant with its marks", () => {
    expect(avatarInitial("ปู่ญี่ปุ่น")).toBe("ปู่");
  });

  it("skips a leading Thai vowel", () => {
    expect(avatarInitial("เกม")).toBe("ก");
  });

  it("falls back for an empty name", () => {
    expect(avatarInitial("")).toBe("?");
  });
});
