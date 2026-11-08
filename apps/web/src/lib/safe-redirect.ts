/**
 * Returns `target` when it is a path on this site, and `/` otherwise, so a
 * crafted sign-in link cannot send the user to another site.
 */
export function safeRedirect(target: string | undefined): string {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) {
    return "/";
  }
  return target;
}
