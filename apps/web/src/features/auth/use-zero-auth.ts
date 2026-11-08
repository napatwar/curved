import { useConnectionState, useZero } from "@rocicorp/zero/react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";

/**
 * Zero moves to `needs-auth` when the API answers 401, such as after the
 * session expires or is revoked. If the session is gone, this sends the user
 * to sign in. If the session is still valid, it reconnects once, and reports
 * a problem when that fails too, such as when zero-cache does not forward
 * cookies.
 *
 * Returns true when Zero cannot authenticate although the user is signed in.
 */
export function useZeroAuth(): boolean {
  const zero = useZero();
  const connection = useConnectionState();
  const navigate = useNavigate();
  const retried = useRef(false);
  const [failed, setFailed] = useState(false);
  const needsAuth = connection.name === "needs-auth";

  useEffect(() => {
    if (!needsAuth) {
      return undefined;
    }
    let cancelled = false;
    async function recover() {
      const { data } = await authClient.getSession();
      if (cancelled) {
        return;
      }
      if (!data) {
        await navigate({
          to: "/sign-in",
          search: { redirect: window.location.pathname + window.location.search },
        });
      } else if (retried.current) {
        setFailed(true);
      } else {
        retried.current = true;
        await zero.connection.connect();
      }
    }
    void recover();
    return () => {
      cancelled = true;
    };
  }, [needsAuth, navigate, zero]);

  return failed && needsAuth;
}
