import { createFileRoute } from "@tanstack/react-router";
import { Archive } from "lucide-react";

import { PageBody, PageHeader } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";

// Placeholder: a later task builds this page.
export const Route = createFileRoute("/_app/$workspaceSlug/archive")({
  component: ArchivePage,
});

function ArchivePage() {
  return (
    <>
      <PageHeader title="Archive" />
      <PageBody>
        <EmptyState icon={Archive} title="Nothing archived">
          Archived issues will appear here.
        </EmptyState>
      </PageBody>
    </>
  );
}
