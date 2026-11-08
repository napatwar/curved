import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Fills a screen or a list that has nothing to show yet, such as a team
 * without issues, and says what to do next.
 */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {Icon && <Icon aria-hidden className="size-8 text-muted-foreground/70" strokeWidth={1.5} />}
      <h2 className="text-base font-semibold">{title}</h2>
      {children && <div className="max-w-sm text-muted-foreground">{children}</div>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
