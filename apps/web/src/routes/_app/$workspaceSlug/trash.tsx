import { createFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";

import { PageBody, PageHeader } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";

// Placeholder: a later task builds this page.
export const Route = createFileRoute("/_app/$workspaceSlug/trash")({
  component: TrashPage,
});

function TrashPage() {
  return (
    <>
      <PageHeader title="Trash" />
      <PageBody>
        <EmptyState icon={Trash2} title="Trash is empty">
          Issues you delete will appear here.
        </EmptyState>
      </PageBody>
    </>
  );
}
