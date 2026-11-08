import { db } from "../db";
import { env } from "../env";
import { createAuth } from "./create-auth";
import { createSmtpMailer } from "./mailer";

function oauth(clientId: string | undefined, clientSecret: string | undefined) {
  return clientId && clientSecret ? { clientId, clientSecret } : undefined;
}

export const auth = createAuth({
  db,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  openSignUp: env.AUTH_OPEN_SIGN_UP,
  cookieDomain: env.AUTH_COOKIE_DOMAIN,
  google: oauth(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET),
  github: oauth(env.GITHUB_CLIENT_ID, env.GITHUB_CLIENT_SECRET),
  mailer: env.SMTP_URL && env.SMTP_FROM ? createSmtpMailer(env.SMTP_URL, env.SMTP_FROM) : undefined,
});
