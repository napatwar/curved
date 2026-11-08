import { DEV_WORKSPACE_ID } from "@curved/db/constants";
import { createFileRoute } from "@tanstack/react-router";

import { IssueList } from "@/features/issues";

export const Route = createFileRoute("/")({
  component: IssuesPage,
});

function IssuesPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <IssueList workspaceId={DEV_WORKSPACE_ID} />
    </main>
  );
}
