import { createFileRoute } from "@tanstack/react-router";
import { CircleUser } from "lucide-react";

import { PageBody, PageHeader } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";

// Placeholder: a later task builds this page.
export const Route = createFileRoute("/_app/$workspaceSlug/my-issues")({
  component: MyIssuesPage,
});

function MyIssuesPage() {
  return (
    <>
      <PageHeader title="My issues" />
      <PageBody>
        <EmptyState icon={CircleUser} title="No issues assigned to you">
          Issues assigned to you will appear here.
        </EmptyState>
      </PageBody>
    </>
  );
}
