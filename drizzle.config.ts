import { defineConfig } from "drizzle-kit";

// Migrations are generated from both schemas and applied by `npm run db:migrate` (local)
// or `npm run release:migrate` (staging/production release job) — never during `next build`.
export default defineConfig({
  dialect: "sqlite",
  schema: ["./src/server/db/schema.ts", "./src/server/db/auth-schema.ts"],
  out: "./drizzle",
  strict: true,
});
