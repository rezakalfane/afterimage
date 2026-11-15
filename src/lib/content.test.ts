import { describe, expect, it } from "vitest";
import localesJson from "../../content/locales.json";
import worldJson from "../../content/world.json";
import jeanneJson from "../../content/characters/jeanne.json";
import malikJson from "../../content/characters/malik.json";
import { CHARACTERS, LOCALE_CODES, WORLD, missingTranslations } from "./content";
import { UI } from "@/i18n/ui";
import { pickLocale } from "./locale";
import { toolDefinitions } from "./tools";

describe("multilingual content", () => {
  it.each([
    ["world.json", worldJson],
    ["jeanne.json", jeanneJson],
    ["malik.json", malikJson],
  ])("%s has every user-facing string in every active locale", (_name, json) => {
    expect(missingTranslations(json)).toEqual([]);
  });

  it("every locale has a complete UI dictionary", () => {
    const keys = Object.keys(UI.fr).sort();
    for (const l of LOCALE_CODES) {
      expect(UI[l], `missing UI dictionary for ${l} in src/i18n/ui.ts`).toBeDefined();
      expect(Object.keys(UI[l]).sort()).toEqual(keys);
    }
  });

  it("the default locale is active", () => {
    expect(LOCALE_CODES).toContain(localesJson.default);
  });

  it("every VHS template keeps {message} and reaches Napster's 84-character minimum on its own", () => {
    for (const l of LOCALE_CODES) {
      const t = WORLD.vhs.template[l];
      expect(t).toContain("{message}");
      expect(t.replace("{message}", "").length).toBeGreaterThanOrEqual(84);
    }
  });

  it("characters reference existing tools, and items used by the world exist", () => {
    const tools = Object.keys(toolDefinitions());
    for (const c of Object.values(CHARACTERS)) for (const t of c.tools) expect(tools).toContain(t);
    for (const id of [...WORLD.startingInventory, "bobine", "message", "cassette"]) expect(WORLD.items[id]).toBeDefined();
  });

  it("location ids are tool-safe", () => {
    for (const l of WORLD.locations) expect(l.id).toMatch(/^[a-z0-9_]+$/);
  });
});

describe("pickLocale", () => {
  it("picks the first supported browser language", () => {
    expect(pickLocale("de-DE,en-US;q=0.8,fr;q=0.5")).toBe("en");
    expect(pickLocale(null)).toBe(localesJson.default);
  });
});
