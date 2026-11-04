import {issueStatuses} from '@curved/db/constants'
import {defineMutator, defineMutators} from '@rocicorp/zero'
import {z} from 'zod'

export const mutators = defineMutators({
  issues: {
    create: defineMutator(
      z.object({
        id: z.uuid(),
        workspaceId: z.uuid(),
        title: z.string().trim().min(1).max(255),
      }),
      async ({args: {id, workspaceId, title}, tx}) => {
        const now = Date.now()
        await tx.mutate.issue.insert({
          id,
          workspaceId,
          title,
          status: 'todo',
          createdAt: now,
          updatedAt: now,
        })
      },
    ),
    setStatus: defineMutator(
      z.object({
        id: z.uuid(),
        status: z.enum(issueStatuses),
      }),
      async ({args: {id, status}, tx}) => {
        await tx.mutate.issue.update({id, status, updatedAt: Date.now()})
      },
    ),
  },
})
