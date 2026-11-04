import {DEV_WORKSPACE_ID} from '@curved/db/constants'
import {mutators, queries} from '@curved/zero'
import type {Issue} from '@curved/zero'
import {useConnectionState, useQuery, useZero} from '@rocicorp/zero/react'
import {createFileRoute} from '@tanstack/react-router'
import {type FormEvent, useState} from 'react'
import {v7 as uuidv7} from 'uuid'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'

export const Route = createFileRoute('/')({
  component: IssuesPage,
})

function IssuesPage() {
  const zero = useZero()
  const connection = useConnectionState()
  const [issues] = useQuery(queries.issues.byWorkspace({workspaceId: DEV_WORKSPACE_ID}))
  const [title, setTitle] = useState('')
  const canWrite = connection.name === 'connected' || connection.name === 'connecting'

  function createIssue(event: FormEvent) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      return
    }
    zero.mutate(
      mutators.issues.create({
        id: uuidv7(),
        workspaceId: DEV_WORKSPACE_ID,
        title: trimmedTitle,
      }),
    )
    setTitle('')
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Curved</h1>
        <span className="text-sm text-muted-foreground">{connection.name}</span>
      </header>

      <form className="flex gap-2" onSubmit={createIssue}>
        <Input
          aria-label="Issue title"
          disabled={!canWrite}
          maxLength={255}
          onChange={event => setTitle(event.target.value)}
          placeholder="New issue"
          value={title}
        />
        <Button disabled={!canWrite || !title.trim()} type="submit">
          Add
        </Button>
      </form>

      <ul className="divide-y rounded-lg border">
        {issues.map(issue => (
          <IssueRow canWrite={canWrite} issue={issue} key={issue.id} />
        ))}
      </ul>
    </main>
  )
}

function IssueRow({canWrite, issue}: {canWrite: boolean; issue: Issue}) {
  const zero = useZero()
  const isDone = issue.status === 'done'

  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <span className={isDone ? 'text-muted-foreground line-through' : undefined}>
        {issue.title}
      </span>
      <Button
        disabled={!canWrite}
        onClick={() =>
          zero.mutate(
            mutators.issues.setStatus({id: issue.id, status: isDone ? 'todo' : 'done'}),
          )
        }
        size="sm"
        variant="outline"
      >
        {isDone ? 'Reopen' : 'Done'}
      </Button>
    </li>
  )
}
