// Seeds the development workspace, by default, with the dataset for the Zero spike in
// decision record 0004: 20,000 issues and 60,000 comments. It replaces every
// issue and comment in that workspace, so do not run it against real data.
import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

import type { IssueStatus } from "./constants";
import { DEV_WORKSPACE_ID } from "./dev";
import { createDb } from "./index";
import { comment, issue } from "./schema";

// SPIKE_WORKSPACE_ID seeds another workspace, such as for a larger replica.
const WORKSPACE_ID = process.env.SPIKE_WORKSPACE_ID ?? DEV_WORKSPACE_ID;
const ISSUE_COUNT = Number(process.env.SPIKE_ISSUES ?? 20_000);
const COMMENT_COUNT = Number(process.env.SPIKE_COMMENTS ?? 60_000);
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

function issueStatus(): IssueStatus {
  const roll = random();
  if (roll < 0.3) {
    return "todo";
  }
  return roll < 0.45 ? "in_progress" : "done";
}

const db = createDb(connectionString);
const now = Date.now();
const startedAt = performance.now();

// Comments are removed with their issues through the foreign key cascade.
await db.delete(issue).where(eq(issue.workspaceId, WORKSPACE_ID));

const issues = Array.from({ length: ISSUE_COUNT }, () => {
  const createdAt = now - Math.floor(random() * 730 * DAY_MS);
  const updatedAt = Math.min(now, createdAt + Math.floor(random() * 60 * DAY_MS));
  return {
    id: uuidv7({ msecs: createdAt }),
    workspaceId: WORKSPACE_ID,
    title: issueTitle(),
    status: issueStatus(),
    createdAt: new Date(createdAt),
    updatedAt: new Date(updatedAt),
  };
});

for (let start = 0; start < issues.length; start += BATCH_SIZE) {
  await db.insert(issue).values(issues.slice(start, start + BATCH_SIZE));
}

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
console.log(`Seeded ${ISSUE_COUNT} issues and ${COMMENT_COUNT} comments in ${seconds}s`);

await db.$client.end();
