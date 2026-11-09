import { Button } from "@/components/ui/button";

import { useSignOut } from "./use-sign-out";

export function SignOutButton() {
  const { signOut, pending } = useSignOut();

  return (
    <Button disabled={pending} onClick={() => void signOut()} size="sm" variant="ghost">
      Sign out
    </Button>
  );
}
