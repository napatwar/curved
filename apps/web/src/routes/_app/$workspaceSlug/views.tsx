import { createFileRoute } from "@tanstack/react-router";
import { Layers } from "lucide-react";

import { PageBody, PageHeader } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";

// Placeholder: a later task builds this page.
export const Route = createFileRoute("/_app/$workspaceSlug/views")({
  component: ViewsPage,
});

function ViewsPage() {
  return (
    <>
      <PageHeader title="Views" />
      <PageBody>
        <EmptyState icon={Layers} title="No views yet">
          Saved views come in a later release. Filter, sort and group any issue list for now.
        </EmptyState>
      </PageBody>
    </>
  );
}
