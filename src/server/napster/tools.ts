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

export const TOOLS_BY_CHARACTER: Record<CharacterId, ToolName[]> = {
  jeanne: ["jeanne_examine", "jeanne_use_clue", "jeanne_act", "jeanne_draft_message", "world_request_hint"],
  malik: ["malik_examine", "malik_act", "world_request_hint"],
};

const LOCATIONS = { etagere_haute: "upper_cabinet", bas_armoire: "lower_cabinet", bureau: "desk", sol: "floor" } as const;

const argSchemas = {
  jeanne_examine: z.strictObject({ objet: z.enum(["programme", "lettre"]) }),
  jeanne_use_clue: z.strictObject({ indice: z.enum(["siege_g7", "risque_eau"]) }),
  jeanne_act: z.strictObject({
    geste: z.enum(["chercher_cle", "ouvrir_armoire", "noter_accord", "conserver"]),
    emplacement: z.enum(["etagere_haute", "bas_armoire", "bureau", "sol"]).optional(),
  }),
  jeanne_draft_message: z.strictObject({ texte: z.string().max(1000) }),
  malik_examine: z.strictObject({ objet: z.enum(["photo", "trace_eau", "message", "lettre"]) }),
  malik_act: z.strictObject({ geste: z.enum(["recuperer_cache"]) }),
  world_request_hint: z.strictObject({}),
} satisfies Record<ToolName, z.ZodType>;

export type ToolMapping = { ok: true; command: Command } | { ok: false };

/** Map a tool call to an engine command. Unknown tools or arguments → { ok: false }. */
export function toolToCommand(character: CharacterId, name: string, rawArgs: unknown): ToolMapping {
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
      if (a.geste === "noter_accord") return cmd("acknowledge_permission");
      if (!a.emplacement) return { ok: false };
      return cmd("preserve_cache", { location: LOCATIONS[a.emplacement as keyof typeof LOCATIONS] });
    case "jeanne_draft_message":
      return cmd("write_message", { text: a.texte });
    case "malik_examine":
      return cmd(
        a.objet === "photo" ? "inspect_photo" : a.objet === "trace_eau" ? "inspect_waterline" : a.objet === "message" ? "read_message" : "read_future_letter",
      );
    case "malik_act":
      return cmd("recover_cache");
    case "world_request_hint":
      return cmd("request_hint");
  }
}

/** Tool names an action is reachable through, used to tell the character what it can do now. */
export function toolsForActions(character: CharacterId, actions: Action[]): string[] {
  const map: Partial<Record<Action, string>> =
    character === "jeanne"
      ? {
          inspect_programme: "jeanne_examine(objet=programme)",
          read_letter: "jeanne_examine(objet=lettre)",
          relay_key_location: "jeanne_use_clue(indice=siege_g7) — seulement si le joueur vient de donner cet indice",
          relay_flood_warning: "jeanne_use_clue(indice=risque_eau) — seulement si le joueur vient de signaler ce risque",
          retrieve_key: "jeanne_act(geste=chercher_cle)",
          open_cabinet: "jeanne_act(geste=ouvrir_armoire)",
          acknowledge_permission: "jeanne_act(geste=noter_accord) — seulement si le joueur reconnaît explicitement la condition d’Alice",
          preserve_cache: "jeanne_act(geste=conserver, emplacement=…)",
          write_message: "jeanne_draft_message(texte=mots exacts du joueur)",
          request_hint: "world_request_hint()",
        }
      : {
          inspect_photo: "malik_examine(objet=photo)",
          inspect_waterline: "malik_examine(objet=trace_eau)",
          recover_cache: "malik_act(geste=recuperer_cache)",
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
      "Utilise UNIQUEMENT quand le joueur te dit lui-même où chercher la clé (siege_g7) ou t’avertit d’un risque d’eau (risque_eau). Ne devine jamais un indice. Si le résultat refuse, demande un détail précis."),
    jeanne_act: def("jeanne_act", "Jeanne (1996) fait un geste dans la cabine.", {
      geste: { type: "string", enum: ["chercher_cle", "ouvrir_armoire", "noter_accord", "conserver"] },
      emplacement: { type: "string", enum: ["etagere_haute", "bas_armoire", "bureau", "sol"], description: "Seulement pour conserver." },
    }, ["geste"],
      "Exprime ton intention avant d’agir et n’annonce la réussite qu’après un résultat positif. noter_accord : seulement si le joueur reconnaît explicitement la condition d’Alice. conserver : seulement quand le joueur te demande de ranger la bobine, la lettre et son message ; donne l’emplacement choisi."),
    jeanne_draft_message: def("jeanne_draft_message", "Jeanne (1996) note le brouillon du message que le joueur veut laisser avec le film.", { texte: { type: "string", maxLength: 240 } }, ["texte"],
      "Utilise quand le joueur te dicte les mots à laisser. Recopie ses mots exacts, sans les reformuler. Le joueur devra les confirmer lui-même à l’écran ; ne dis jamais que le message est confirmé."),
    malik_examine: def("malik_examine", "Malik (2026) examine un objet de la cabine.", { objet: { type: "string", enum: ["photo", "trace_eau", "message", "lettre"] } }, ["objet"],
      "Utilise quand le joueur demande de regarder la photo et son verso, la trace d’eau, ou de lire un message ou une lettre retrouvés. N’annonce que ce que le résultat renvoie."),
    malik_act: def("malik_act", "Malik (2026) cherche ce qui aurait pu être laissé dans la cabine.", { geste: { type: "string", enum: ["recuperer_cache"] } }, ["geste"],
      "Utilise quand le joueur demande de chercher la clé ou ce que Jeanne a pu laisser. Si le résultat est négatif, dis simplement qu’il n’y a rien de nouveau."),
    world_request_hint: def("world_request_hint", "Demande une aide progressive pour le joueur.", {}, [],
      "Utilise seulement si le joueur demande explicitement de l’aide. Formule l’aide renvoyée avec tes mots, sans en dire davantage."),
  };
}
