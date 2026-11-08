import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

import { slugify } from "./slugify";

/** Creates a workspace through Better Auth. Only an instance admin can. */
export function CreateWorkspaceForm() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const effectiveSlug = slug ?? slugify(name);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await authClient.organization.create({ name, slug: effectiveSlug });
    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "Could not create the workspace. Try again.");
      return;
    }
    await navigate({ to: "/$workspaceSlug", params: { workspaceSlug: result.data.slug } });
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => void handleSubmit(event)}>
      <FormField
        label="Workspace name"
        maxLength={100}
        onChange={(event) => setName(event.target.value)}
        required
        value={name}
      />
      <FormField
        label="URL"
        maxLength={48}
        onChange={(event) => setSlug(event.target.value)}
        pattern="[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?"
        required
        title="Lowercase letters, digits and hyphens"
        value={effectiveSlug}
      />
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button disabled={pending} type="submit">
        Create workspace
      </Button>
    </form>
  );
}
