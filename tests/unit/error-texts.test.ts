// Every French public error message thrown in src/ has an English version.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ERROR_TEXTS_EN, localizeError } from "@/server/security/error-texts";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}

describe("server error texts", () => {
  it("each HttpError message literal has an English entry", () => {
    const missing: string[] = [];
    for (const f of files("src")) {
      for (const m of readFileSync(f, "utf8").matchAll(/HttpError\("[A-Z_]+",\s*"([^"]+)"/g)) if (!ERROR_TEXTS_EN[m[1]]) missing.push(`${f}: ${m[1]}`);
    }
    expect(missing).toEqual([]);
  });
  it("translates for en, keeps fr, passes unknown texts through", () => {
    expect(localizeError("Commande invalide.", "en")).toBe("Invalid command.");
    expect(localizeError("Commande invalide.", "fr")).toBe("Commande invalide.");
    expect(localizeError("Already English.", "en")).toBe("Already English.");
    expect(localizeError(null, "en")).toBeNull();
  });
});

describe("default error messages", () => {
  it("never returns an empty message for a code thrown without text", async () => {
    const { publicErrorMessage } = await import("@/server/security/error-texts");
    expect(publicErrorMessage("BAD_ORIGIN", undefined, "fr")).toMatch(/adresse/);
    expect(publicErrorMessage("NOT_FOUND", undefined, "en")).toBe("Not found.");
    expect(publicErrorMessage("QUOTA_EXCEEDED", "Commande invalide.", "en")).toBe("Invalid command.");
  });
});
