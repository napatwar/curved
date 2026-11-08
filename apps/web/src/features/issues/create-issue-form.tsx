import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateIssueForm({
  disabled,
  onCreate,
}: {
  disabled: boolean;
  onCreate: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  const trimmedTitle = title.trim();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!trimmedTitle) {
      return;
    }
    onCreate(trimmedTitle);
    setTitle("");
  }

  return (
    <form className="flex gap-2" onSubmit={handleSubmit}>
      <Input
        aria-label="Issue title"
        disabled={disabled}
        maxLength={255}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="New issue"
        value={title}
      />
      <Button disabled={disabled || !trimmedTitle} type="submit">
        Add
      </Button>
    </form>
  );
}
