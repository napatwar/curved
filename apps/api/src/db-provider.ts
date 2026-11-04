import {createDb} from '@curved/db'
import {schema} from '@curved/zero'
import {zeroDrizzle} from '@rocicorp/zero/server/adapters/drizzle'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

export const db = createDb(connectionString)
export const dbProvider = zeroDrizzle(schema, db)

declare module '@rocicorp/zero' {
  interface DefaultTypes {
    dbProvider: typeof dbProvider
  }
}
