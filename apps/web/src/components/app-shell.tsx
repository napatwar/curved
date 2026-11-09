import { useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { createContext, type ReactNode, use, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

type Shell = { openSidebar: () => void };

const ShellContext = createContext<Shell | null>(null);

/**
 * The app's frame: a sidebar and the page. Below 768px the sidebar becomes a
 * drawer that `PageHeader`'s menu button opens, and that closes when the
 * page changes.
 */
export function AppShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // The drawer stays open only on the page where it was opened, so following
  // a link in it closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const shell = useMemo(() => ({ openSidebar: () => setOpenOn(pathname) }), [pathname]);

  return (
    <ShellContext value={shell}>
      <div className="flex h-svh overflow-hidden bg-sidebar">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border md:flex">
          {sidebar}
        </aside>
        <Sheet
          onOpenChange={(open) => setOpenOn(open ? pathname : null)}
          open={openOn === pathname}
        >
          <SheetContent className="w-72 gap-0 bg-sidebar p-0" showCloseButton={false} side="left">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            {sidebar}
          </SheetContent>
        </Sheet>
        <div className="flex min-w-0 flex-1 flex-col bg-background">{children}</div>
      </div>
    </ShellContext>
  );
}

/**
 * The 44px bar at the top of a page, with its title and actions. On narrow
 * windows it also has the button that opens the sidebar.
 */
export function PageHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  const shell = use(ShellContext);

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3 md:px-4">
      {shell && (
        <Button
          aria-label="Open sidebar"
          className="-ml-1 md:hidden"
          onClick={shell.openSidebar}
          size="icon-sm"
          variant="ghost"
        >
          <Menu />
        </Button>
      )}
      <h1 className="min-w-0 truncate font-medium">{title}</h1>
      {children && <div className="ml-auto flex shrink-0 items-center gap-1">{children}</div>}
    </header>
  );
}

/** The page's scrolling content under `PageHeader`. */
export function PageBody({ children }: { children: ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>;
}
