import type { ReactNode } from "react";

/**
 * Classes for a sidebar item, for TanStack Router's `Link`. The router marks
 * the current page's link with `data-status="active"`.
 */
export const sidebarItemClass =
  "flex h-7 min-w-0 items-center gap-2 rounded-md px-2 text-sidebar-foreground outline-none hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[status=active]:bg-sidebar-accent data-[status=active]:font-medium data-[status=active]:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";

/** A titled group of sidebar items. */
export function SidebarSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-px">
      {title && <h2 className="px-2 pb-1 text-xs font-medium text-muted-foreground">{title}</h2>}
      <ul className="flex flex-col gap-px">{children}</ul>
    </section>
  );
}
