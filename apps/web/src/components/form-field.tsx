import { type ComponentProps, useId } from "react";

import { Input } from "@/components/ui/input";

/** A labelled text input for simple forms. */
export function FormField({ label, ...props }: { label: string } & ComponentProps<typeof Input>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <Input id={id} {...props} />
    </div>
  );
}
