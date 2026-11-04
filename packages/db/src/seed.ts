import {DEV_WORKSPACE_ID} from './constants'
import {createDb} from './index'
import {issue} from './schema'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

const db = createDb(connectionString)
const now = new Date()

await db
  .insert(issue)
  .values({
    id: '00000000-0000-7000-8000-000000000101',
    workspaceId: DEV_WORKSPACE_ID,
    title: 'Welcome to Curved',
    status: 'todo',
    createdAt: now,
    updatedAt: now,
  })
  .onConflictDoNothing()

await db.$client.end()
