import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";

import { PageBody, PageHeader } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";

// Placeholder: a later task builds this page.
export const Route = createFileRoute("/_app/$workspaceSlug/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <PageBody>
        <EmptyState icon={Settings} title="Workspace settings">
          Settings for members, teams and labels are coming soon.
        </EmptyState>
      </PageBody>
    </>
  );
}
