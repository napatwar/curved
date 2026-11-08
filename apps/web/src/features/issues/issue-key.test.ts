import { describe, expect, it } from "vitest";

import { issueKey } from "./issue-key";

describe("issueKey", () => {
  it("joins the team key and the number", () => {
    expect(issueKey("ENG", 123)).toBe("ENG-123");
  });

  it("shows an ellipsis while the number is pending", () => {
    expect(issueKey("ENG", 0)).toBe("ENG-…");
  });
});
