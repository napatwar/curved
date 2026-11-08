/**
 * The keyboard shortcut registry. Screens register shortcuts with
 * `useShortcut`, and one `keydown` listener runs them. Each shortcut has a
 * title, so the command palette can list and run the same commands.
 *
 * Keys are written as in "c", "shift+c", "mod+k" or "g i". "mod" is Command
 * on Apple devices and Control elsewhere. A space separates the keys of a
 * sequence, such as "g i": G, then I within a second.
 */

export type Shortcut = {
  /** Unique, such as "navigation.my-issues". A new registration replaces an old one. */
  id: string;
  keys: string;
  /** Says what it does, such as "Go to My issues". */
  title: string;
  /** Groups commands in lists, such as "Navigation". */
  group: string;
  run: () => void;
  /** Runs while a text field has focus. Only for shortcuts with "mod". */
  allowInInputs?: boolean;
};

type Combo = { key: string; mod: boolean; alt: boolean; shift: boolean };

const sequenceTimeout = 1000;

export const isApple =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

function parseCombo(text: string): Combo {
  const parts = text.toLowerCase().split("+");
  const key = parts.pop() ?? "";
  return {
    key,
    mod: parts.includes("mod"),
    alt: parts.includes("alt"),
    shift: parts.includes("shift"),
  };
}

function parseKeys(keys: string): Combo[] {
  return keys.trim().split(/\s+/).map(parseCombo);
}

// Physical keys for punctuation, used when the layout gives another character.
const codeKeys: Record<string, string> = {
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Space: " ",
};

const ascii = /^[ -~]$/;

/**
 * The key an event stands for, in lowercase. Under a Thai layout, the C key
 * gives `event.key` "แ", so a key that is not ASCII falls back to the
 * physical key in `event.code` (decision record 0007).
 */
export function eventKey(event: Pick<KeyboardEvent, "key" | "code">): string {
  const { key, code } = event;
  if (key.length > 1 && key !== "Unidentified" && key !== "Dead") {
    // A named key, such as "Escape" or "ArrowDown".
    return key.toLowerCase();
  }
  if (ascii.test(key)) {
    return key.toLowerCase();
  }
  if (code.startsWith("Key")) {
    return code.slice(3).toLowerCase();
  }
  if (code.startsWith("Digit")) {
    return code.slice(5);
  }
  return codeKeys[code] ?? key.toLowerCase();
}

function matches(combo: Combo, event: KeyboardEvent): boolean {
  const mod = isApple ? event.metaKey : event.ctrlKey;
  const otherMod = isApple ? event.ctrlKey : event.metaKey;
  if (combo.mod !== mod || otherMod || combo.alt !== event.altKey) {
    return false;
  }
  const key = eventKey(event);
  // Shift makes "?" from "/", so a symbol key ignores Shift unless the
  // shortcut names it. A letter must match Shift exactly.
  if (/^[a-z]$/.test(combo.key) || combo.shift) {
    if (combo.shift !== event.shiftKey) {
      return false;
    }
  }
  return key === combo.key;
}

function isTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLInputElement &&
      !["checkbox", "radio", "button", "submit", "reset"].includes(target.type))
  );
}

type Entry = Shortcut & { combos: Combo[] };

export function createShortcutRegistry() {
  const entries = new Map<string, Entry>();
  const listeners = new Set<() => void>();
  let list: readonly Shortcut[] = [];
  let pending: { combo: Combo; at: number } | null = null;

  function changed() {
    list = [...entries.values()];
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    /** Adds a shortcut and returns a function that removes it. */
    register: (shortcut: Shortcut): (() => void) => {
      const entry = { ...shortcut, combos: parseKeys(shortcut.keys) };
      entries.delete(shortcut.id);
      entries.set(shortcut.id, entry);
      changed();
      return () => {
        if (entries.get(shortcut.id) === entry) {
          entries.delete(shortcut.id);
          changed();
        }
      };
    },

    /** Every registered shortcut, in registration order. */
    list: (): readonly Shortcut[] => {
      return list;
    },

    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /** Runs a shortcut by ID, as the command palette does. */
    run: (id: string): boolean => {
      const entry = entries.get(id);
      entry?.run();
      return Boolean(entry);
    },

    /** Runs the shortcut that matches a key press. Returns true when one ran. */
    handleKeyDown: (event: KeyboardEvent): boolean => {
      if (event.defaultPrevented || event.isComposing || event.repeat) {
        return false;
      }
      // A modifier alone does not end a sequence.
      if (["Shift", "Control", "Alt", "Meta"].includes(event.key)) {
        return false;
      }
      const inInput = isTextInput(event.target);
      const now = event.timeStamp;
      const previous = pending && now - pending.at <= sequenceTimeout ? pending.combo : null;
      pending = null;
      // The newest registration wins, so an open dialog can take over a key.
      const candidates = [...entries.values()]
        .toReversed()
        .filter((entry) => !inInput || entry.allowInInputs);

      const run = (entry: Entry) => {
        event.preventDefault();
        entry.run();
        return true;
      };

      // The second key of a sequence.
      const second =
        previous &&
        candidates.find(
          ({ combos: [first, next] }) =>
            first && next && sameCombo(first, previous) && matches(next, event),
        );
      if (second) {
        return run(second);
      }

      const single = candidates.find(
        ({ combos: [first, next] }) => first && !next && matches(first, event),
      );
      if (single) {
        return run(single);
      }

      // The first key of a sequence waits for the next key.
      const first = candidates.find(
        ({ combos: [combo, next] }) => combo && next && matches(combo, event),
      )?.combos[0];
      if (first) {
        pending = { combo: first, at: now };
      }
      return false;
    },
  };
}

function sameCombo(a: Combo, b: Combo) {
  return a.key === b.key && a.mod === b.mod && a.alt === b.alt && a.shift === b.shift;
}

export type ShortcutRegistry = ReturnType<typeof createShortcutRegistry>;

/** The app's registry. One `keydown` listener on `window` feeds it. */
export const shortcuts = createShortcutRegistry();

if (typeof window !== "undefined") {
  window.addEventListener("keydown", (event) => shortcuts.handleKeyDown(event));
}

const keyLabels: Record<string, string> = {
  mod: isApple ? "⌘" : "Ctrl",
  alt: isApple ? "⌥" : "Alt",
  shift: isApple ? "⇧" : "Shift",
  escape: "Esc",
  enter: "Enter",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  " ": "Space",
};

/**
 * Key labels for display, one group per step of a sequence: "mod+k" gives
 * [["⌘", "K"]] on a Mac, and "g i" gives [["G"], ["I"]].
 */
export function shortcutLabels(keys: string): string[][] {
  return keys
    .trim()
    .split(/\s+/)
    .map((step) =>
      step.split("+").map((part) => keyLabels[part.toLowerCase()] ?? part.toUpperCase()),
    );
}
