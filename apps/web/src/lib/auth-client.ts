import { adminClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Better Auth's client. It calls /api/auth on the web app's origin, and the
 * session lives in an HttpOnly cookie that page scripts cannot read.
 */
export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [organizationClient(), adminClient()],
});

export type Session = typeof authClient.$Infer.Session;
