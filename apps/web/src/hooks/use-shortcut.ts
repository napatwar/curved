import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";

import { type Shortcut, shortcuts } from "@/lib/shortcuts";

/**
 * Registers a keyboard shortcut while the component is mounted. `run` can
 * change on every render without registering again.
 */
export function useShortcut(shortcut: Shortcut & { enabled?: boolean }) {
  const { id, keys, title, group, allowInInputs, enabled = true } = shortcut;
  const run = useRef(shortcut.run);
  useLayoutEffect(() => {
    run.current = shortcut.run;
  });

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    return shortcuts.register({
      id,
      keys,
      title,
      group,
      allowInInputs,
      run: () => run.current(),
    });
  }, [id, keys, title, group, allowInInputs, enabled]);
}

/** Every registered shortcut, for lists such as the command palette. */
export function useShortcutList(): readonly Shortcut[] {
  return useSyncExternalStore(shortcuts.subscribe, shortcuts.list);
}
