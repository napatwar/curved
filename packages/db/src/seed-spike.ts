// Seeds the development workspace, by default, with the dataset for the Zero spike in
// decision record 0004: 20,000 issues and 60,000 comments, plus a Markdown
// description of about 2KB per issue for decision record 0006. It replaces
// every issue and comment in that workspace, so do not run it against real
// data. The workspace keeps its first team, or gets one.
import { and, asc, eq, isNull } from "drizzle-orm";
import { generateNKeysBetween } from "fractional-indexing";
import { v7 as uuidv7 } from "uuid";

import { teamKeyFromSlug } from "./constants";
import { DEV_USER_ID, DEV_WORKSPACE_ID } from "./dev";
import { createDb } from "./index";
import {
  comment,
  issue,
  issueDescription,
  issueLabel,
  label,
  team,
  workflowState,
  workspace,
} from "./schema";
import { createTeam } from "./teams";

// SPIKE_WORKSPACE_ID seeds another workspace, such as for a larger replica.
const WORKSPACE_ID = process.env.SPIKE_WORKSPACE_ID ?? DEV_WORKSPACE_ID;
const ISSUE_COUNT = Number(process.env.SPIKE_ISSUES ?? 20_000);
const COMMENT_COUNT = Number(process.env.SPIKE_COMMENTS ?? 60_000);
// Bytes of Markdown per issue description, in UTF-8. 0 seeds no descriptions.
const DESCRIPTION_BYTES = Number(process.env.SPIKE_DESCRIPTION_BYTES ?? 2048);
// Comments need an author who exists. SPIKE_AUTHOR_ID picks another one.
const AUTHOR_ID = process.env.SPIKE_AUTHOR_ID ?? DEV_USER_ID;
const BATCH_SIZE = 1000;
const DAY_MS = 86_400_000;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// A fixed seed keeps the dataset the same between runs.
let state = 0x5eed;
function random() {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
}

function pick(items: readonly string[]) {
  return items[Math.floor(random() * items.length)] ?? "";
}

const verbs = ["Fix", "Add", "Improve", "Remove", "Refactor", "Investigate", "Support", "Update"];
const subjects = [
  "login redirect",
  "issue list scrolling",
  "keyboard shortcuts",
  "notification emails",
  "board drag and drop",
  "search results",
  "webhook retries",
  "dark mode colors",
  "CSV export",
  "project roadmap view",
  "cycle burndown chart",
  "label picker",
];
const contexts = ["on Safari", "for large teams", "after reconnect", "in the API", "on mobile", ""];
const thaiTitles = [
  "แก้ปัญหาหน้ารายการงานโหลดช้า",
  "เพิ่มการแจ้งเตือนเมื่อมีคนกล่าวถึง",
  "ปรับสีปุ่มในโหมดมืด",
  "ตรวจสอบการซิงก์ข้อมูลหลังออฟไลน์",
  "รองรับการค้นหาภาษาไทย",
];
const sentences = [
  "I can reproduce this on the latest build.",
  "This started after the last deploy, so it may be related to the cache change.",
  "Steps: open the list, switch the filter twice, then press the back button.",
  "The API returns 200 but the UI still shows the old value for a few seconds.",
  "We should add a regression test before closing this.",
  "Customer reports that the problem only happens with more than 500 items.",
  "I pushed a fix to a branch, could someone review it?",
  "Closing this as a duplicate of the older issue.",
  "Logs attached below. The error appears right after the websocket reconnects.",
  "Let's discuss this in the planning meeting on Monday.",
];
const thaiSentences = [
  "ลองแล้วเกิดปัญหาเดียวกันบนเครื่องของผมครับ",
  "น่าจะเกี่ยวกับการเปลี่ยนแปลงแคชรอบที่แล้ว",
  "ฝากช่วยรีวิวโค้ดที่แก้ไขด้วยนะคะ",
  "ลูกค้าแจ้งว่าเจอปัญหานี้เฉพาะตอนที่มีงานจำนวนมาก",
];

function issueTitle() {
  if (random() < 0.2) {
    return pick(thaiTitles);
  }
  return [pick(verbs), pick(subjects), pick(contexts)].filter(Boolean).join(" ");
}

function commentBody() {
  const pool = random() < 0.15 ? thaiSentences : sentences;
  const count = 1 + Math.floor(random() ** 2 * 8);
  return Array.from({ length: count }, () => pick(pool)).join(" ");
}

const markdownCode = [
  "```ts",
  "const result = await zero.mutate(mutators.issues.update({ id, stateId })).server;",
  'if (result.type === "error") {',
  "  console.error(result.error.message);",
  "}",
  "```",
].join("\n");

/** Markdown with headings, lists and code, about `bytes` long in UTF-8. */
function description(bytes: number) {
  const encoder = new TextEncoder();
  const parts = ["## Summary", "", Array.from({ length: 3 }, () => pick(sentences)).join(" ")];
  let size = encoder.encode(parts.join("\n")).length;
  const sections = [
    () => [
      "",
      "## Steps to reproduce",
      "",
      ...Array.from({ length: 3 }, (_, n) => `${n + 1}. ${pick(sentences)}`),
    ],
    () => [
      "",
      "## Notes",
      "",
      ...Array.from({ length: 3 }, () => `- ${pick(random() < 0.3 ? thaiSentences : sentences)}`),
    ],
    () => ["", markdownCode],
    () => [
      "",
      Array.from({ length: 4 }, () => pick(random() < 0.15 ? thaiSentences : sentences)).join(" "),
    ],
  ];
  for (let n = 0; size < bytes; n++) {
    const section = sections[n % sections.length]?.() ?? [];
    parts.push(...section);
    size += encoder.encode(section.join("\n")).length + 1;
  }
  return parts.join("\n");
}

const db = createDb(connectionString);
const now = Date.now();
const startedAt = performance.now();

// Comments, descriptions and labels on issues go with their issues through
// foreign key cascades.
await db.delete(issue).where(eq(issue.workspaceId, WORKSPACE_ID));

const [space] = await db.select().from(workspace).where(eq(workspace.id, WORKSPACE_ID));
if (!space) {
  throw new Error(`Workspace ${WORKSPACE_ID} does not exist. Run pnpm db:seed first.`);
}
const [existingTeam] = await db
  .select()
  .from(team)
  .where(eq(team.workspaceId, WORKSPACE_ID))
  .orderBy(asc(team.createdAt))
  .limit(1);
const teamId =
  existingTeam?.id ??
  (
    await createTeam(db, {
      workspaceId: WORKSPACE_ID,
      key: teamKeyFromSlug(space.slug),
      name: space.name,
    })
  ).teamId;
const states = await db
  .select()
  .from(workflowState)
  .where(eq(workflowState.teamId, teamId))
  .orderBy(asc(workflowState.position));

function stateFor(category: string) {
  const found = states.find((candidate) => candidate.category === category);
  if (!found) {
    throw new Error(`The team has no ${category} state`);
  }
  return found.id;
}

// About the same mix as the spike's statuses, spread over every category.
function issueState() {
  const roll = random();
  if (roll < 0.1) {
    return stateFor("backlog");
  }
  if (roll < 0.3) {
    return stateFor("unstarted");
  }
  if (roll < 0.45) {
    return stateFor("started");
  }
  return stateFor(roll < 0.95 ? "completed" : "canceled");
}

const labelNames = ["Bug", "Feature", "Improvement", "Design", "Performance"];
const existingLabels = await db
  .select()
  .from(label)
  .where(and(eq(label.workspaceId, WORKSPACE_ID), isNull(label.teamId)));
for (const name of labelNames) {
  if (!existingLabels.some((existing) => existing.name.toLowerCase() === name.toLowerCase())) {
    const [created] = await db
      .insert(label)
      .values({
        id: uuidv7(),
        workspaceId: WORKSPACE_ID,
        teamId: null,
        name,
        color: "#5e6ad2",
        createdAt: new Date(now),
        updatedAt: new Date(now),
      })
      .returning();
    if (created) {
      existingLabels.push(created);
    }
  }
}

const createdTimes = Array.from(
  { length: ISSUE_COUNT },
  () => now - Math.floor(random() * 730 * DAY_MS),
).toSorted((a, b) => a - b);
// Numbers follow creation order. The newest issue gets the first sort key.
const sortKeys = generateNKeysBetween(null, null, ISSUE_COUNT).toReversed();
const today = Math.floor(now / DAY_MS) * DAY_MS;

const issues = createdTimes.map((createdAt, index) => {
  const updatedAt = Math.min(now, createdAt + Math.floor(random() * 60 * DAY_MS));
  const dueDate =
    random() < 0.2 ? new Date(today + Math.floor(random() * 120 - 60) * DAY_MS) : null;
  return {
    id: uuidv7({ msecs: createdAt }),
    workspaceId: WORKSPACE_ID,
    teamId,
    number: index + 1,
    title: issueTitle(),
    stateId: issueState(),
    priority: Math.floor(random() * 5),
    assigneeId: random() < 0.4 ? AUTHOR_ID : null,
    creatorId: AUTHOR_ID,
    dueDate: dueDate?.toISOString().slice(0, 10) ?? null,
    sortOrder: sortKeys[index] ?? "",
    createdAt: new Date(createdAt),
    updatedAt: new Date(updatedAt),
  };
});

for (let start = 0; start < issues.length; start += BATCH_SIZE) {
  const rows = issues.slice(start, start + BATCH_SIZE);
  await db.insert(issue).values(rows);
  if (DESCRIPTION_BYTES > 0) {
    await db.insert(issueDescription).values(
      rows.map((row) => ({
        issueId: row.id,
        workspaceId: WORKSPACE_ID,
        body: description(DESCRIPTION_BYTES),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    );
  }
  const labelRows = rows.flatMap((row) =>
    existingLabels
      .filter(() => random() < 0.15)
      .map((picked) => ({
        workspaceId: WORKSPACE_ID,
        issueId: row.id,
        labelId: picked.id,
        createdAt: row.createdAt,
      })),
  );
  if (labelRows.length > 0) {
    await db.insert(issueLabel).values(labelRows);
  }
}
await db
  .update(team)
  .set({ nextIssueNumber: ISSUE_COUNT + 1 })
  .where(eq(team.id, teamId));

// A long tail: most issues get a few comments, and some get many.
const weights = issues.map(() => (-Math.log(1 - random())) ** 1.5);
const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
const counts = weights.map((weight) => Math.floor((COMMENT_COUNT * weight) / totalWeight));
for (let left = COMMENT_COUNT - counts.reduce((a, b) => a + b, 0); left > 0; left--) {
  const index = Math.floor(random() * counts.length);
  counts[index] = (counts[index] ?? 0) + 1;
}

let batch: (typeof comment.$inferInsert)[] = [];
for (const [index, parent] of issues.entries()) {
  for (let n = 0; n < (counts[index] ?? 0); n++) {
    const createdAt =
      parent.createdAt.getTime() + Math.floor(random() * (now - parent.createdAt.getTime()));
    batch.push({
      id: uuidv7({ msecs: createdAt }),
      workspaceId: WORKSPACE_ID,
      issueId: parent.id,
      authorId: AUTHOR_ID,
      body: commentBody(),
      createdAt: new Date(createdAt),
      updatedAt: new Date(createdAt),
    });
    if (batch.length === BATCH_SIZE) {
      await db.insert(comment).values(batch);
      batch = [];
    }
  }
}
if (batch.length > 0) {
  await db.insert(comment).values(batch);
}

const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
console.log(
  `Seeded ${ISSUE_COUNT} issues with ${DESCRIPTION_BYTES}-byte descriptions and ${COMMENT_COUNT} comments in ${seconds}s`,
);

await db.$client.end();
