/**
 * Suggests a workspace slug from its name: lowercase ASCII letters, digits and
 * hyphens (decision record 0007). A name with no ASCII letters, such as a Thai
 * name, gives an empty slug for the user to fill in.
 */
export function slugify(name: string): string {
  return (
    name
      .normalize("NFKD")
      // Thai vowels and tone marks are combining marks too, so a Thai name
      // still ends up empty.
      .replaceAll(/\p{M}/gu, "")
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-")
      .replaceAll(/^-+|-+$/g, "")
      .slice(0, 48)
      .replace(/-+$/, "")
  );
}
