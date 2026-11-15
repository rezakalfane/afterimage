// Better Auth options shared by the runtime instance (./auth.ts) and the schema CLI (./auth.ts via
// `npm run auth:generate`). No "server-only" here so the CLI can load it; it has no secrets of its own.
import type { BetterAuthOptions } from "better-auth";
import { anonymous } from "better-auth/plugins";

export const GUEST_EMAIL_DOMAIN = "guest.afterimage.local";

export type AuthHooks = NonNullable<BetterAuthOptions["databaseHooks"]>;

export function authOptions(input: {
  database: BetterAuthOptions["database"];
  baseURL: string;
  secret: string;
  databaseHooks?: AuthHooks;
  production: boolean;
}): BetterAuthOptions {
  const https = input.baseURL.startsWith("https://");
  return {
    appName: "AFTERIMAGE",
    baseURL: input.baseURL,
    secret: input.secret,
    database: input.database,
    trustedOrigins: [new URL(input.baseURL).origin],
    emailAndPassword: {
      enabled: true,
      // Sign-up stays open at the endpoint level, but every sign-up must carry a valid
      // invitation: enforced server-side in databaseHooks.user.create.before (src/server/auth/auth.ts).
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    session: { expiresIn: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24 },
    rateLimit: {
      enabled: true,
      storage: "database", // shared across serverless instances, unlike the default memory store
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/anonymous": { window: 3600, max: 20 },
        "/sign-in/email": { window: 300, max: 10 },
        "/sign-up/email": { window: 3600, max: 10 },
      },
    },
    advanced: {
      useSecureCookies: https,
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure: https },
    },
    plugins: [anonymous({ emailDomainName: GUEST_EMAIL_DOMAIN, disableDeleteAnonymousUser: false })],
    databaseHooks: input.databaseHooks,
    telemetry: { enabled: false },
  };
}
