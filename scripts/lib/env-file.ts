// Minimal .env reader/writer for scripts (no dependency). Never prints values.
import { existsSync, readFileSync } from "node:fs";

export function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

/** Load .env then .env.local into process.env (like Next.js: existing process.env wins, .env.local overrides .env). */
export function loadEnv() {
  const merged = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
  for (const [k, v] of Object.entries(merged)) if (process.env[k] === undefined) process.env[k] = v;
}
