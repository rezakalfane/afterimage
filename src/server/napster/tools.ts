import "server-only";
// Closed list of Napster tools (implicit flow) and their mapping to bounded engine commands.
// A tool call is a PROPOSAL from an untrusted model: the server re-validates everything.
// No tool can confirm the message, switch era or choose an ending (UI only).
import { z } from "zod";
import type { CharacterId } from "@/server/world/content";
import type { Action, Command } from "@/server/world/engine";

export const TOOL_NAMES = [
  "jeanne_examine",
  "jeanne_use_clue",
  "jeanne_act",
  "jeanne_draft_message",
  "malik_examine",
  "malik_act",
  "world_request_hint",
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];
export type ToolLocale = "fr" | "en";

/** Per-locale tool sets: each locale has its OWN functions (descriptions, prompts, enum values in that language). */
export const TOOLS_BY_CHARACTER: Record<CharacterId, ToolName[]> = {
  jeanne: ["jeanne_examine", "jeanne_use_clue", "jeanne_act", "jeanne_draft_message", "world_request_hint"],
  malik: ["malik_examine", "malik_act", "world_request_hint"],
};
export function toolsFor(character: CharacterId, locale: ToolLocale): string[] {
  return TOOLS_BY_CHARACTER[character].map((t) => (locale === "en" ? `en_${t}` : t));
}

/** English tool call → equivalent French-tool call (same bounded command). Unknown values stay invalid. */
const EN_VALUES: Record<string, Record<string, string>> = {
  object: { programme: "programme", letter: "lettre", photo: "photo", waterline: "trace_eau", message: "message" },
  clue: { seat_g7: "siege_g7", water_risk: "risque_eau" },
  gesture: { look_for_key: "chercher_cle", open_cabinet: "ouvrir_armoire", close_cabinet: "fermer_armoire", acknowledge: "noter_accord", store: "conserver" },
  location: { upper_shelf: "etagere_haute", lower_cabinet: "bas_armoire", desk: "bureau", floor: "sol" },
};
const EN_KEYS: Record<string, string> = { object: "objet", clue: "indice", gesture: "geste", location: "emplacement", text: "texte" };
function fromEnglish(name: string, rawArgs: unknown): { name: string; args: unknown } | null {
  if (!name.startsWith("en_")) return { name, args: rawArgs };
  if (!rawArgs || typeof rawArgs !== "object" || Array.isArray(rawArgs)) return rawArgs === undefined ? { name: name.slice(3), args: {} } : null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawArgs as Record<string, unknown>)) {
    const fk = EN_KEYS[k];
    if (!fk) return null; // unexpected argument
    out[fk] = k === "text" ? v : (EN_VALUES[k]?.[String(v)] ?? `__invalid__${String(v)}`);
  }
  return { name: name.slice(3), args: out };
}

const LOCATIONS = { etagere_haute: "upper_cabinet", bas_armoire: "lower_cabinet", bureau: "desk", sol: "floor" } as const;

const argSchemas = {
  jeanne_examine: z.strictObject({ objet: z.enum(["programme", "lettre"]) }),
  jeanne_use_clue: z.strictObject({ indice: z.enum(["siege_g7", "risque_eau"]) }),
  jeanne_act: z.strictObject({
    geste: z.enum(["chercher_cle", "ouvrir_armoire", "fermer_armoire", "noter_accord", "conserver"]),
    // Only meaningful for "conserver" (checked there); a location given with another gesture
    // (e.g. "look for the key under seat G7") is ignored instead of rejecting the whole call.
    emplacement: z.string().max(40).optional(),
  }),
  jeanne_draft_message: z.strictObject({ texte: z.string().max(1000) }),
  malik_examine: z.strictObject({ objet: z.enum(["photo", "trace_eau", "message", "lettre"]) }),
  malik_act: z.strictObject({ geste: z.enum(["chercher_cle", "ouvrir_armoire", "fermer_armoire"]) }),
  world_request_hint: z.strictObject({}),
} satisfies Record<ToolName, z.ZodType>;

export type ToolMapping = { ok: true; command: Command } | { ok: false };

/** Map a tool call to an engine command. Unknown tools or arguments → { ok: false }. */
export function toolToCommand(character: CharacterId, toolName: string, toolArgs: unknown): ToolMapping {
  // Some transports hand the arguments over as a JSON string: parse it, then validate as usual.
  if (typeof toolArgs === "string") {
    try {
      toolArgs = toolArgs.trim() ? JSON.parse(toolArgs) : {};
    } catch {
      return { ok: false };
    }
  }
  const normalized = fromEnglish(toolName, toolArgs);
  if (!normalized) return { ok: false };
  const { name, args: rawArgs } = normalized;
  if (!(TOOL_NAMES as readonly string[]).includes(name)) return { ok: false };
  const tool = name as ToolName;
  if (!TOOLS_BY_CHARACTER[character].includes(tool)) return { ok: false };
  const parsed = argSchemas[tool].safeParse(rawArgs ?? {});
  if (!parsed.success) return { ok: false };
  const a = parsed.data as Record<string, string>;
  const cmd = (action: Action, args: Record<string, unknown> = {}): ToolMapping => ({ ok: true, command: { action, args } });
  switch (tool) {
    case "jeanne_examine":
      return cmd(a.objet === "programme" ? "inspect_programme" : "read_letter");
    case "jeanne_use_clue":
      return cmd(a.indice === "siege_g7" ? "relay_key_location" : "relay_flood_warning");
    case "jeanne_act":
      if (a.geste === "chercher_cle") return cmd("retrieve_key");
      if (a.geste === "ouvrir_armoire") return cmd("open_cabinet");
      if (a.geste === "fermer_armoire") return cmd("close_cabinet");
      if (a.geste === "noter_accord") return cmd("acknowledge_permission");
      if (!a.emplacement || !(a.emplacement in LOCATIONS)) return { ok: false };
      return cmd("preserve_cache", { location: LOCATIONS[a.emplacement as keyof typeof LOCATIONS] });
    case "jeanne_draft_message":
      return cmd("write_message", { text: a.texte });
    case "malik_examine":
      return cmd(
        a.objet === "photo" ? "inspect_photo" : a.objet === "trace_eau" ? "inspect_waterline" : a.objet === "message" ? "read_message" : "read_future_letter",
      );
    case "malik_act":
      return cmd(a.geste === "chercher_cle" ? "find_future_key" : a.geste === "fermer_armoire" ? "close_cabinet" : "recover_cache");
    case "world_request_hint":
      return cmd("request_hint");
  }
}

/** Tool names an action is reachable through, used to tell the character what it can do now. */
export function toolsForActions(character: CharacterId, actions: Action[], locale: ToolLocale = "fr"): string[] {
  if (locale === "en") return toolsForActionsEn(character, actions);
  const map: Partial<Record<Action, string>> =
    character === "jeanne"
      ? {
          inspect_programme: "jeanne_examine(objet=programme)",
          read_letter: "jeanne_examine(objet=lettre)",
          relay_key_location: "jeanne_use_clue(indice=siege_g7) — seulement si le joueur vient de donner cet indice",
          relay_flood_warning: "jeanne_use_clue(indice=risque_eau) — seulement si le joueur vient de signaler ce risque",
          retrieve_key: "jeanne_act(geste=chercher_cle)",
          open_cabinet: "jeanne_act(geste=ouvrir_armoire)",
          close_cabinet: "jeanne_act(geste=fermer_armoire)",
          acknowledge_permission: "jeanne_act(geste=noter_accord) — seulement si le joueur reconnaît explicitement la condition d’Alice",
          preserve_cache: "jeanne_act(geste=conserver, emplacement=…)",
          write_message: "jeanne_draft_message(texte=mots exacts du joueur)",
          request_hint: "world_request_hint()",
        }
      : {
          inspect_photo: "malik_examine(objet=photo)",
          inspect_waterline: "malik_examine(objet=trace_eau)",
          find_future_key: "malik_act(geste=chercher_cle)",
          recover_cache: "malik_act(geste=ouvrir_armoire)",
          close_cabinet: "malik_act(geste=fermer_armoire)",
          read_message: "malik_examine(objet=message)",
          read_future_letter: "malik_examine(objet=lettre)",
          request_hint: "world_request_hint()",
        };
  return actions.map((a) => map[a]).filter((x): x is string => Boolean(x));
}

/** Napster function definitions (POST /public/functions). Global and immutable: no player data. */
export function functionDefinitions(): Record<ToolName, { data: { name: ToolName; description: string; parameters: unknown }; flow: "implicit"; prompt: string }> {
  const def = (name: ToolName, description: string, properties: Record<string, unknown>, required: string[], prompt: string) => ({
    data: { name, description, parameters: { type: "object", properties, required, additionalProperties: false } },
    flow: "implicit" as const,
    prompt,
  });
  return {
    jeanne_examine: def("jeanne_examine", "Jeanne (1996) examine un document de la cabine.", { objet: { type: "string", enum: ["programme", "lettre"] } }, ["objet"],
      "Utilise quand le joueur demande de lire le programme de la séance ou la lettre dans l’armoire. Dis d’abord ce que tu fais. N’invente pas le contenu : lis seulement ce que le résultat renvoie."),
    jeanne_use_clue: def("jeanne_use_clue", "Jeanne (1996) prend en compte un indice que le joueur vient de lui donner.", { indice: { type: "string", enum: ["siege_g7", "risque_eau"] } }, ["indice"],
      "Utilise UNIQUEMENT quand le joueur te dit lui-même où chercher la clé (siege_g7) ou t’avertit d’un risque d’eau (risque_eau). Ne devine jamais un indice. Si le résultat refuse, demande un détail précis. Si le résultat est positif, propose d’y aller tout de suite et, si le joueur est d’accord, fais-le toi-même avec jeanne_act."),
    jeanne_act: def("jeanne_act", "Jeanne (1996) fait un geste dans la cabine.", {
      geste: { type: "string", enum: ["chercher_cle", "ouvrir_armoire", "fermer_armoire", "noter_accord", "conserver"] },
      emplacement: { type: "string", enum: ["etagere_haute", "bas_armoire", "bureau", "sol"], description: "Seulement pour conserver." },
    }, ["geste"],
      "Tu fais ces gestes toi-même : ne demande jamais au joueur de cliquer ou d’utiliser l’écran pour eux. Quand tu dis que tu le fais, appelle l’outil dans la même réponse. chercher_cle : dès qu’un indice sur la clé a été accepté et que le joueur te demande de chercher ou approuve. ouvrir_armoire : quand tu as la clé et que le joueur le demande. fermer_armoire : quand le joueur demande de refermer l’armoire (elle se rouvre ensuite avec ouvrir_armoire). Exprime ton intention avant d’agir et n’annonce la réussite qu’après un résultat positif. noter_accord : seulement si le joueur reconnaît explicitement la condition d’Alice. conserver : seulement quand le joueur te demande de ranger la bobine, la lettre et son message ; donne l’emplacement choisi."),
    jeanne_draft_message: def("jeanne_draft_message", "Jeanne (1996) note le brouillon du message que le joueur veut laisser avec le film.", { texte: { type: "string", maxLength: 240 } }, ["texte"],
      "Utilise quand le joueur te dicte les mots à laisser. Recopie ses mots exacts, sans les reformuler. Le joueur les confirme lui-même, à voix haute ou à l’écran : ne dis jamais que le message est confirmé tant que le contexte ne l’indique pas."),
    malik_examine: def("malik_examine", "Malik (2026) examine un objet de la cabine.", { objet: { type: "string", enum: ["photo", "trace_eau", "message", "lettre"] } }, ["objet"],
      "Utilise quand le joueur demande de regarder la photo et son verso, la trace d’eau, ou de lire un message ou une lettre retrouvés. N’annonce que ce que le résultat renvoie."),
    malik_act: def("malik_act", "Malik (2026) cherche la clé, ouvre ou referme l’armoire.", { geste: { type: "string", enum: ["chercher_cle", "ouvrir_armoire", "fermer_armoire"] } }, ["geste"],
      "chercher_cle : quand le joueur demande de chercher la clé ou ce que Jeanne a pu laisser (derrière le projecteur). ouvrir_armoire : seulement après avoir trouvé la clé. fermer_armoire : si le joueur demande de la refermer. Si le résultat est négatif, dis simplement qu’il n’y a rien de nouveau ou que l’armoire reste fermée."),
    world_request_hint: def("world_request_hint", "Demande une aide progressive pour le joueur.", {}, [],
      "Utilise seulement si le joueur demande explicitement de l’aide. Formule l’aide renvoyée avec tes mots, sans en dire davantage."),
  };
}

/** English function definitions (for the `en` agents): descriptions, prompts and enum values in English. */
export function englishFunctionDefinitions(): Record<string, { data: { name: string; description: string; parameters: unknown }; flow: "implicit"; prompt: string }> {
  const def = (name: string, description: string, properties: Record<string, unknown>, required: string[], prompt: string) => ({
    data: { name: `en_${name}`, description, parameters: { type: "object", properties, required, additionalProperties: false } },
    flow: "implicit" as const,
    prompt,
  });
  const list = [
    def("jeanne_examine", "Jeanne (1996) examines a document in the booth.", { object: { type: "string", enum: ["programme", "letter"] } }, ["object"],
      "Use when the player asks to read the screening programme or the letter in the cabinet. Say what you are doing first. Never invent the content: read only what the result returns."),
    def("jeanne_use_clue", "Jeanne (1996) takes into account a clue the player has just given her.", { clue: { type: "string", enum: ["seat_g7", "water_risk"] } }, ["clue"],
      "Use ONLY when the player tells you themselves where to look for the key (seat_g7) or warns you about a water risk (water_risk). Never guess a clue. If the result refuses, ask for a precise detail. If the result is positive, offer to go right away and, if the player agrees, do it yourself with en_jeanne_act."),
    def("jeanne_act", "Jeanne (1996) makes a gesture in the booth.", {
      gesture: { type: "string", enum: ["look_for_key", "open_cabinet", "close_cabinet", "acknowledge", "store"] },
      location: { type: "string", enum: ["upper_shelf", "lower_cabinet", "desk", "floor"], description: "Only for store." },
    }, ["gesture"],
      "You make these gestures yourself: never ask the player to click or use the screen for them. When you say you are doing it, call the tool in the same reply. look_for_key: as soon as a clue about the key has been accepted and the player asks you to look or agrees. open_cabinet: when you have the key and the player asks. close_cabinet: when the player asks you to close the cabinet again (it reopens with open_cabinet). State your intention before acting and only announce success after a positive result. acknowledge: only if the player explicitly acknowledges Alice's condition. store: only when the player asks you to put away the reel, the letter and their message; give the chosen location."),
    def("jeanne_draft_message", "Jeanne (1996) notes the draft of the message the player wants to leave with the film.", { text: { type: "string", maxLength: 240 } }, ["text"],
      "Use when the player dictates the words to leave. Copy their exact words, without rephrasing. The player confirms them themselves, out loud or on screen: never say the message is confirmed until the context says so."),
    def("malik_examine", "Malik (2026) examines an object in the booth.", { object: { type: "string", enum: ["photo", "waterline", "message", "letter"] } }, ["object"],
      "Use when the player asks to look at the photo and its back, the water mark, or to read a recovered message or letter. Announce only what the result returns."),
    def("malik_act", "Malik (2026) looks for the key, opens or closes the cabinet.", { gesture: { type: "string", enum: ["look_for_key", "open_cabinet", "close_cabinet"] } }, ["gesture"],
      "look_for_key: when the player asks you to look for the key or for what Jeanne may have left (behind the projector). open_cabinet: only after finding the key. close_cabinet: if the player asks to close it again. If the result is negative, simply say there is nothing new or that the cabinet stays locked."),
    def("world_request_hint", "Requests a progressive hint for the player.", {}, [],
      "Use only if the player explicitly asks for help. Put the returned hint in your own words, without saying more."),
  ];
  return Object.fromEntries(list.map((d) => [d.data.name, d]));
}

function toolsForActionsEn(character: CharacterId, actions: Action[]): string[] {
  const map: Partial<Record<Action, string>> =
    character === "jeanne"
      ? {
          inspect_programme: "en_jeanne_examine(object=programme)",
          read_letter: "en_jeanne_examine(object=letter)",
          relay_key_location: "en_jeanne_use_clue(clue=seat_g7) — only if the player has just given this clue",
          relay_flood_warning: "en_jeanne_use_clue(clue=water_risk) — only if the player has just reported this risk",
          retrieve_key: "en_jeanne_act(gesture=look_for_key)",
          open_cabinet: "en_jeanne_act(gesture=open_cabinet)",
          close_cabinet: "en_jeanne_act(gesture=close_cabinet)",
          acknowledge_permission: "en_jeanne_act(gesture=acknowledge) — only if the player explicitly acknowledges Alice's condition",
          preserve_cache: "en_jeanne_act(gesture=store, location=…)",
          write_message: "en_jeanne_draft_message(text=the player's exact words)",
          request_hint: "en_world_request_hint()",
        }
      : {
          inspect_photo: "en_malik_examine(object=photo)",
          inspect_waterline: "en_malik_examine(object=waterline)",
          find_future_key: "en_malik_act(gesture=look_for_key)",
          recover_cache: "en_malik_act(gesture=open_cabinet)",
          close_cabinet: "en_malik_act(gesture=close_cabinet)",
          read_message: "en_malik_examine(object=message)",
          read_future_letter: "en_malik_examine(object=letter)",
          request_hint: "en_world_request_hint()",
        };
  return actions.map((a) => map[a]).filter((x): x is string => Boolean(x));
}
