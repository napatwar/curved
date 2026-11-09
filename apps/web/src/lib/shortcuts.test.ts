import { describe, expect, it, vi } from "vitest";

import { createShortcutRegistry, eventKey, isApple, shortcutLabels } from "./shortcuts";

function press(
  registry: ReturnType<typeof createShortcutRegistry>,
  init: KeyboardEventInit,
  target: EventTarget = document.body,
) {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  Object.defineProperty(event, "target", { value: target });
  return registry.handleKeyDown(event);
}

function setup(keys: string, options: { allowInInputs?: boolean } = {}) {
  const registry = createShortcutRegistry();
  const run = vi.fn<() => void>();
  registry.register({ id: "test", keys, title: "Test", group: "Test", run, ...options });
  return { registry, run };
}

describe("eventKey", () => {
  it("uses the physical key when the layout gives a Thai character", () => {
    expect(eventKey({ key: "แ", code: "KeyC" })).toBe("c");
    expect(eventKey({ key: "ๅ", code: "Digit1" })).toBe("1");
    expect(eventKey({ key: "ฝ", code: "Slash" })).toBe("/");
  });

  it("keeps ASCII and named keys", () => {
    expect(eventKey({ key: "C", code: "KeyC" })).toBe("c");
    expect(eventKey({ key: "Escape", code: "Escape" })).toBe("escape");
  });
});

describe("shortcut registry", () => {
  it("runs a single-key shortcut", () => {
    const { registry, run } = setup("c");

    expect(press(registry, { key: "c", code: "KeyC" })).toBe(true);
    expect(run).toHaveBeenCalledOnce();
  });

  it("runs under a Thai keyboard layout", () => {
    const { registry, run } = setup("c");

    press(registry, { key: "แ", code: "KeyC" });

    expect(run).toHaveBeenCalledOnce();
  });

  it("runs a sequence when the second key follows", () => {
    const { registry, run } = setup("g i");

    expect(press(registry, { key: "g", code: "KeyG" })).toBe(false);
    press(registry, { key: "i", code: "KeyI" });

    expect(run).toHaveBeenCalledOnce();
  });

  it("does not run a sequence after another key", () => {
    const { registry, run } = setup("g i");

    press(registry, { key: "g", code: "KeyG" });
    press(registry, { key: "x", code: "KeyX" });
    press(registry, { key: "i", code: "KeyI" });

    expect(run).not.toHaveBeenCalled();
  });

  it("needs the platform's modifier for mod", () => {
    const { registry, run } = setup("mod+k");
    const mod = isApple ? { metaKey: true } : { ctrlKey: true };

    press(registry, { key: "k", code: "KeyK" });
    expect(run).not.toHaveBeenCalled();

    press(registry, { key: "k", code: "KeyK", ...mod });
    expect(run).toHaveBeenCalledOnce();
  });

  it("matches a letter's Shift exactly, but not a symbol's", () => {
    const letter = setup("c");
    press(letter.registry, { key: "C", code: "KeyC", shiftKey: true });
    expect(letter.run).not.toHaveBeenCalled();

    const symbol = setup("?");
    press(symbol.registry, { key: "?", code: "Slash", shiftKey: true });
    expect(symbol.run).toHaveBeenCalledOnce();
  });

  it("ignores key presses in text fields unless allowed", () => {
    const input = document.createElement("input");
    const plain = setup("c");
    press(plain.registry, { key: "c", code: "KeyC" }, input);
    expect(plain.run).not.toHaveBeenCalled();

    const allowed = setup("mod+k", { allowInInputs: true });
    press(allowed.registry, { key: "k", code: "KeyK", metaKey: isApple, ctrlKey: !isApple }, input);
    expect(allowed.run).toHaveBeenCalledOnce();
  });

  it("lets the newest registration win and restores the older one", () => {
    const registry = createShortcutRegistry();
    const older = vi.fn<() => void>();
    const newer = vi.fn<() => void>();
    registry.register({ id: "a", keys: "escape", title: "A", group: "Test", run: older });
    const unregister = registry.register({
      id: "b",
      keys: "escape",
      title: "B",
      group: "Test",
      run: newer,
    });

    press(registry, { key: "Escape", code: "Escape" });
    unregister();
    press(registry, { key: "Escape", code: "Escape" });

    expect(newer).toHaveBeenCalledOnce();
    expect(older).toHaveBeenCalledOnce();
  });

  it("lists shortcuts and runs one by ID, for the command palette", () => {
    const { registry, run } = setup("g m");

    expect(registry.list().map((shortcut) => shortcut.title)).toEqual(["Test"]);
    expect(registry.run("test")).toBe(true);
    expect(run).toHaveBeenCalledOnce();
  });
});

describe("shortcutLabels", () => {
  it("splits a sequence into steps", () => {
    expect(shortcutLabels("g i")).toEqual([["G"], ["I"]]);
    expect(shortcutLabels("mod+k")).toEqual([[isApple ? "⌘" : "Ctrl", "K"]]);
  });
});
