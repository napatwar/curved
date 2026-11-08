import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";

import { PageBody, PageHeader } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";

// Placeholder: the issue page task replaces it.
export const Route = createFileRoute("/_app/$workspaceSlug/issue/$issueKey")({
  component: IssuePage,
});

function IssuePage() {
  const { issueKey } = Route.useParams();
  return (
    <>
      <PageHeader title={issueKey} />
      <PageBody>
        <EmptyState icon={FileText} title={issueKey}>
          The issue page is coming soon.
        </EmptyState>
      </PageBody>
    </>
  );
}
