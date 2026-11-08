import { describe, expect, it } from "vitest";

import { createIssueArgs } from "./issues";

const validArgs = {
  id: "01a1a796-94af-7420-9b34-229390fd4fc9",
  workspaceId: "00000000-0000-7000-8000-000000000001",
};

describe("createIssueArgs", () => {
  it("trims the title", () => {
    expect(createIssueArgs.parse({ ...validArgs, title: "  Fix login  " }).title).toBe("Fix login");
  });

  it("rejects a blank title", () => {
    expect(createIssueArgs.safeParse({ ...validArgs, title: "   " }).success).toBe(false);
  });
});
