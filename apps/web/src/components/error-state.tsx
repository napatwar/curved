import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

/**
 * Says that a screen could not load. It never shows an error's raw message,
 * which can hold internal details. `onRetry` adds a Try again button.
 */
export function ErrorState({
  title = "Something went wrong",
  children = "This page could not load. Try again, or reload the page.",
  onRetry,
}: {
  title?: string;
  children?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center"
      role="alert"
    >
      <CircleAlert aria-hidden className="size-8 text-destructive" strokeWidth={1.5} />
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="max-w-sm text-muted-foreground">{children}</div>
      {onRetry && (
        <Button className="mt-1" onClick={onRetry} variant="outline">
          Try again
        </Button>
      )}
    </div>
  );
}
