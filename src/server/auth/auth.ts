import "server-only";
// Runtime Better Auth instance. Sign-up requires a valid invitation (checked here, server-side);
// guests use the anonymous plugin and get a "player" membership in the public tenant only.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { db, schema } from "@/server/db/client";
import { env } from "@/server/env";
import { consumeInvitationForUser, findValidInvitation } from "./invitations";
import { deleteAuthUser, onboardGuest } from "./onboarding";
import { authOptions } from "./options";

type GenericCtx = { path?: string; body?: Record<string, unknown> } | null;

function build() {
  const e = env();
  return betterAuth(
    authOptions({
      database: drizzleAdapter(db(), { provider: "sqlite", schema }),
      baseURL: e.BETTER_AUTH_URL ?? e.APP_URL,
      secret: e.BETTER_AUTH_SECRET,
      production: e.APP_ENV === "production",
      databaseHooks: {
        user: {
          create: {
            before: async (user, context) => {
              const ctx = context as GenericCtx;
              if (ctx?.path === "/sign-in/anonymous") return;
              if (ctx?.path === "/sign-up/email") {
                const token = typeof ctx.body?.invitationToken === "string" ? ctx.body.invitationToken : "";
                const inv = token ? await findValidInvitation(token, String(user.email ?? "")) : null;
                if (!inv) throw new APIError("FORBIDDEN", { message: "Une invitation valide est nécessaire pour créer un compte." });
                return;
              }
              // Any other creation path (internal, OAuth, unknown) is refused.
              throw new APIError("FORBIDDEN", { message: "Création de compte non autorisée." });
            },
            after: async (user, context) => {
              const ctx = context as GenericCtx;
              if (ctx?.path === "/sign-in/anonymous") {
                await onboardGuest(user.id);
                return;
              }
              const token = typeof ctx?.body?.invitationToken === "string" ? ctx.body.invitationToken : "";
              const ok = await consumeInvitationForUser(token, user.id, String(user.email ?? ""));
              if (!ok) {
                // Lost a race on a single-use invitation: remove the account that was just created.
                await deleteAuthUser(user.id);
                throw new APIError("FORBIDDEN", { message: "Invitation déjà utilisée ou expirée." });
              }
            },
          },
        },
      },
    }),
  );
}

type Auth = ReturnType<typeof build>;
const g = globalThis as unknown as { __afterimageAuth?: Auth };

export async function auth(): Promise<Auth> {
  g.__afterimageAuth ??= build();
  return g.__afterimageAuth;
}

/** Tests only. */
export function resetAuthForTests() {
  g.__afterimageAuth = undefined;
}
