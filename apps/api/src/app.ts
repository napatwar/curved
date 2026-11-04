import {mutators, queries, schema} from '@curved/zero'
import {createRoute, OpenAPIHono, z} from '@hono/zod-openapi'
import {mustGetMutator, mustGetQuery} from '@rocicorp/zero'
import {handleMutateRequest, handleQueryRequest} from '@rocicorp/zero/server'
import {dbProvider} from './db-provider'

export const app = new OpenAPIHono()

app.openapi(
  createRoute({
    method: 'get',
    path: '/health',
    responses: {
      200: {
        description: 'The API is running',
        content: {
          'application/json': {
            schema: z.object({status: z.literal('ok')}),
          },
        },
      },
    },
  }),
  c => c.json({status: 'ok' as const}),
)

app.doc31('/openapi.json', {
  openapi: '3.1.0',
  info: {title: 'Curved API', version: '0.0.0'},
})

// zero-cache calls these endpoints. Authentication is not implemented yet, so
// every request runs without a user and the API must stay on a trusted network.
app.post('/api/zero/query', async c => {
  const result = await handleQueryRequest({
    handler: (name, args) => mustGetQuery(queries, name).fn({args}),
    schema,
    request: c.req.raw,
    userID: null,
  })
  return c.json(result)
})

app.post('/api/zero/mutate', async c => {
  const result = await handleMutateRequest({
    dbProvider,
    handler: transact =>
      transact((tx, name, args) => mustGetMutator(mutators, name).fn({args, tx})),
    request: c.req.raw,
    userID: null,
  })
  return c.json(result)
})
