import type { Workspace } from "@curved/zero";
import { useNavigate } from "@tanstack/react-router";
import { useId } from "react";

/** Switches between the workspaces the user belongs to. */
export function WorkspacePicker({
  current,
  workspaces,
}: {
  current: Workspace;
  workspaces: readonly Workspace[];
}) {
  const id = useId();
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor={id}>
        Workspace
      </label>
      <select
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm font-semibold"
        id={id}
        onChange={(event) =>
          void navigate({ to: "/$workspaceSlug", params: { workspaceSlug: event.target.value } })
        }
        value={current.slug}
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.slug}>
            {workspace.name}
          </option>
        ))}
      </select>
    </div>
  );
}
