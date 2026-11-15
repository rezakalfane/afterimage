// Config used ONLY by `npm run auth:generate` (Better Auth CLI) to emit src/server/db/auth-schema.ts.
import { createClient } from "@libsql/client";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/libsql";
import { authOptions } from "../src/server/auth/options";

const db = drizzle(createClient({ url: ":memory:" }));
export const auth = betterAuth(
  authOptions({ database: drizzleAdapter(db, { provider: "sqlite" }), baseURL: "http://localhost:3000", secret: "x".repeat(32), production: false }),
);
