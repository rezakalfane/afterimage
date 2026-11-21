import "server-only";
// Server environment, validated once. Never import from client components.
// Errors name the variable, never its value.
import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z
  .object({
    APP_ENV: z.enum(["local", "test", "staging", "production"]).default("local"),
    APP_URL: z.url(),
    BETTER_AUTH_URL: z.url().optional(),
    BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
    DATABASE_URL: z.string().min(1),
    DATABASE_AUTH_TOKEN: z.string().optional(),
    MEMORY_ID_SECRET: z.string().min(32, "must be at least 32 characters"),
    CRON_SECRET: z.string().min(24, "must be at least 24 characters"),
    CONVERSATION_MODE: z.enum(["rehearsal", "live"]).default("rehearsal"),
    NAPSTER_API_KEY: z.string().optional(),
    NAPSTER_JEANNE_AGENT_ID: z.string().optional(),
    NAPSTER_MALIK_AGENT_ID: z.string().optional(),
    NAPSTER_PIXO_AGENT_ID: z.string().optional(),
    NAPSTER_PIXO_AGENT_ID_EN: z.string().optional(),
    NAPSTER_MAX_ACTIVE: z.coerce.number().int().min(0).max(20).default(4),
    NAPSTER_RECORDINGS_ENABLED: bool,
    NAPSTER_PHONE_ENABLED: bool,
    PUBLIC_TENANT_SLUG: z.string().regex(/^[a-z0-9-]{2,40}$/).default("demo"),
  })
  .superRefine((env, ctx) => {
    const remote = !env.DATABASE_URL.startsWith("file:");
    if ((env.APP_ENV === "staging" || env.APP_ENV === "production") && !remote) {
      ctx.addIssue({ code: "custom", path: ["DATABASE_URL"], message: "a local SQLite file is not allowed on staging/production (serverless)" });
    }
    if (remote && !env.DATABASE_AUTH_TOKEN && !env.DATABASE_URL.startsWith("http://127.0.0.1")) {
      ctx.addIssue({ code: "custom", path: ["DATABASE_AUTH_TOKEN"], message: "required for a remote libSQL database" });
    }
    if (env.CONVERSATION_MODE === "live") {
      for (const k of ["NAPSTER_API_KEY", "NAPSTER_JEANNE_AGENT_ID", "NAPSTER_MALIK_AGENT_ID"] as const) {
        if (!env[k]) ctx.addIssue({ code: "custom", path: [k], message: "required when CONVERSATION_MODE=live" });
      }
    }
    if (env.APP_ENV === "production" && !env.APP_URL.startsWith("https://")) {
      ctx.addIssue({ code: "custom", path: ["APP_URL"], message: "must be https in production" });
    }
  });

export type Env = z.infer<typeof schema>;

/** The Vercel Turso integration injects TURSO_DATABASE_URL / TURSO_AUTH_TOKEN: accept them when the
 *  app's own DATABASE_URL / DATABASE_AUTH_TOKEN are not set. */
function withTursoNames(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...source, DATABASE_URL: source.DATABASE_URL || source.TURSO_DATABASE_URL, DATABASE_AUTH_TOKEN: source.DATABASE_AUTH_TOKEN || source.TURSO_AUTH_TOKEN };
}

let cached: Env | null = null;

/** Parse process.env. Throws a message listing invalid variable NAMES only. */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(withTursoNames(process.env));
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid server configuration:\n  - ${names.join("\n  - ")}\nRun \`npm run doctor\`.`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvForTests() {
  cached = null;
}

export function checkEnv(source: NodeJS.ProcessEnv): string[] {
  const parsed = schema.safeParse(withTursoNames(source));
  return parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}
