import { useZero } from "@rocicorp/zero/react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

/**
 * Deletes the synced data from this device before ending the session
 * (decision record 0005), so the next person on the device sees nothing.
 */
export function useSignOut() {
  const zero = useZero();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await zero.delete();
    await authClient.signOut();
    await navigate({ to: "/sign-in", search: {} });
  }

  return { signOut, pending };
}
