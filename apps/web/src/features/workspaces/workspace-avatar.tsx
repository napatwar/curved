import { avatarInitial } from "@/lib/text";

/** A workspace's initial on a colored square. */
export function WorkspaceAvatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="flex size-5 shrink-0 items-center justify-center rounded-[5px] bg-primary text-[11px] leading-5 font-semibold text-primary-foreground"
    >
      {avatarInitial(name)}
    </span>
  );
}
