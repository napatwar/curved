const storageKey = "curved:last-workspace";

// Storage can be unavailable, such as in a private window, so failures only
// mean the app opens the first workspace instead.

export function readLastWorkspace(): string | null {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

export function writeLastWorkspace(slug: string) {
  try {
    localStorage.setItem(storageKey, slug);
  } catch {
    // Remembering the workspace is a convenience.
  }
}
