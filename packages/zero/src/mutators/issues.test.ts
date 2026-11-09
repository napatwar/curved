import { describe, expect, it } from "vitest";

import { createIssueArgs, updateIssueArgs } from "./issues";
import { createTeamArgs } from "./teams";

const validArgs = {
  id: "01a1a796-94af-7420-9b34-229390fd4fc9",
  workspaceId: "00000000-0000-7000-8000-000000000001",
  teamId: "00000000-0000-7000-8000-000000000021",
};

function parseDueDate(dueDate: number) {
  return createIssueArgs.safeParse({ ...validArgs, title: "Due", dueDate }).success;
}

describe("createIssueArgs", () => {
  it("trims the title", () => {
    expect(createIssueArgs.parse({ ...validArgs, title: "  Fix login  " }).title).toBe("Fix login");
  });

  it("rejects a blank title", () => {
    expect(createIssueArgs.safeParse({ ...validArgs, title: "   " }).success).toBe(false);
  });

  it("accepts a due date only at UTC midnight", () => {
    expect(parseDueDate(Date.UTC(2026, 10, 20))).toBe(true);
    expect(parseDueDate(Date.UTC(2026, 10, 20, 7))).toBe(false);
  });

  it("rejects a priority outside 0 to 4", () => {
    expect(createIssueArgs.safeParse({ ...validArgs, title: "P", priority: 5 }).success).toBe(
      false,
    );
  });
});

describe("updateIssueArgs", () => {
  it.each(["a0", "Zz", "a0V", "b00"])("accepts the sort key %s", (sortOrder) => {
    expect(updateIssueArgs.safeParse({ id: validArgs.id, sortOrder }).success).toBe(true);
  });

  it.each(["", "a", "a00", "a10", "!x"])("rejects the sort key %j", (sortOrder) => {
    expect(updateIssueArgs.safeParse({ id: validArgs.id, sortOrder }).success).toBe(false);
  });
});

describe("createTeamArgs", () => {
  const stateIds = Array.from({ length: 5 }, () => validArgs.id);

  it("uppercases the key", () => {
    expect(createTeamArgs.parse({ ...validArgs, key: " eng ", name: "Eng", stateIds }).key).toBe(
      "ENG",
    );
  });

  it.each(["", "1ABC", "ABCDEFGH", "EN-G", "ทีม"])("rejects the key %j", (key) => {
    expect(createTeamArgs.safeParse({ ...validArgs, key, name: "Eng", stateIds }).success).toBe(
      false,
    );
  });
});
