import {defineQueries, defineQuery} from '@rocicorp/zero'
import {z} from 'zod'
import {zql} from './schema.gen'

export const queries = defineQueries({
  issues: {
    byWorkspace: defineQuery(
      z.object({workspaceId: z.uuid()}),
      ({args: {workspaceId}}) =>
        zql.issue
          .where('workspaceId', workspaceId)
          .orderBy('createdAt', 'desc')
          .orderBy('id', 'desc'),
    ),
  },
})
