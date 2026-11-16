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
  "jeanne_look",
  "malik_look",
  "jeanne_recall",
  "jeanne_check_seat",
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];
export type ToolLocale = "fr" | "en";

/** Per-locale tool sets: each locale has its OWN functions (descriptions, prompts, enum values in that language). */
export const TOOLS_BY_CHARACTER: Record<CharacterId, ToolName[]> = {
  jeanne: ["jeanne_examine", "jeanne_use_clue", "jeanne_recall", "jeanne_check_seat", "jeanne_act", "jeanne_draft_message", "jeanne_look", "world_request_hint"],
  malik: ["malik_examine", "malik_act", "malik_look", "world_request_hint"],
};
export function toolsFor(character: CharacterId, locale: ToolLocale): string[] {
  return TOOLS_BY_CHARACTER[character].map((t) => (locale === "en" ? `en_${t}` : t));
}

/** English tool call → equivalent French-tool call (same bounded command). Unknown values stay invalid. */
const EN_VALUES: Record<string, Record<string, string>> = {
  object: { programme: "programme", letter: "lettre", photo: "photo", waterline: "trace_eau", message: "message", hall: "salle", cabinet: "armoire", desk: "bureau", projector: "projecteur", reels: "bobines", lamp: "lampe", splicer: "colleuse", seats: "fauteuils" },
  clue: { photo_note: "note_photo", water_risk: "risque_eau", report: "rapport", from_the_future: "venir_du_futur" },
  topic: { usual_place: "place_habituelle" },
  gesture: { look_for_key: "chercher_cle", open_cabinet: "ouvrir_armoire", close_cabinet: "fermer_armoire", acknowledge: "noter_accord", store: "conserver" },
};
/** Free-text arguments (copied as given; validated by the engine/parsers). */
const FREE_TEXT = new Set(["text", "seat", "location"]);
const EN_KEYS: Record<string, string> = { object: "objet", clue: "indice", topic: "sujet", gesture: "geste", location: "emplacement", text: "texte", seat: "siege" };
function fromEnglish(name: string, rawArgs: unknown): { name: string; args: unknown } | null {
  if (!name.startsWith("en_")) return { name, args: rawArgs };
  if (!rawArgs || typeof rawArgs !== "object" || Array.isArray(rawArgs)) return rawArgs === undefined ? { name: name.slice(3), args: {} } : null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawArgs as Record<string, unknown>)) {
    const fk = EN_KEYS[k];
    if (!fk) return null; // unexpected argument
    out[fk] = FREE_TEXT.has(k) ? v : (EN_VALUES[k]?.[String(v)] ?? `__invalid__${String(v)}`);
  }
  return { name: name.slice(3), args: out };
}

/** "Look at" targets (French tool values → engine look_at targets). */
const LOOK = { salle: "hall", armoire: "cabinet", bureau: "desk", programme: "programme", lettre: "letter", projecteur: "projector", photo: "photo", trace_eau: "waterline", message: "message", bobines: "reels", lampe: "lamp", colleuse: "splicer", fauteuils: "seats" } as const;

/** Where the PLAYER said to put things (free text, fr/en) → a storage location, or null. */
export function parseLocation(text: unknown): "upper_cabinet" | "lower_cabinet" | "desk" | "drawer" | "floor" | null {
  if (typeof text !== "string" || text.length > 200) return null;
  const t = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/tiroir|drawer/.test(t)) return "drawer";
  if (/\b(sol|par terre|plancher|floor|ground)\b/.test(t)) return "floor";
  if (/(bas|fond|dessous|lower|bottom)/.test(t) && /(armoire|cabinet|placard)/.test(t)) return "lower_cabinet";
  if (/(haut|etagere|en hauteur|au-dessus|tout en haut|upper|top|high|shelf|above)/.test(t)) return "upper_cabinet";
  if (/(bureau|table|desk)/.test(t)) return "desk";
  return null;
}

const argSchemas = {
  jeanne_examine: z.strictObject({ objet: z.enum(["programme", "lettre"]) }),
  jeanne_use_clue: z.strictObject({ indice: z.enum(["note_photo", "risque_eau", "rapport", "venir_du_futur"]) }),
  jeanne_recall: z.strictObject({ sujet: z.enum(["place_habituelle"]) }),
  jeanne_check_seat: z.strictObject({ siege: z.string().min(1).max(80) }),
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
  jeanne_look: z.strictObject({ objet: z.enum(["salle", "armoire", "bureau", "programme", "lettre", "projecteur", "bobines", "lampe", "colleuse"]) }),
  malik_look: z.strictObject({ objet: z.enum(["armoire", "projecteur", "bureau", "photo", "trace_eau", "message", "lettre", "bobines", "lampe", "fauteuils"]) }),
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
      return cmd(({ note_photo: "share_photo_note", risque_eau: "relay_flood_warning", rapport: "share_report", venir_du_futur: "claim_future" } as const)[a.indice as "note_photo"]);
    case "jeanne_recall":
      return cmd("ask_usual_place");
    case "jeanne_check_seat":
      return cmd("propose_seat", { seat: a.siege });
    case "jeanne_act":
      if (a.geste === "chercher_cle") return cmd("retrieve_key");
      if (a.geste === "ouvrir_armoire") return cmd("open_cabinet");
      if (a.geste === "fermer_armoire") return cmd("close_cabinet");
      if (a.geste === "noter_accord") return cmd("acknowledge_permission");
      {
        const location = parseLocation(a.emplacement);
        if (!location) return { ok: false };
        return cmd("preserve_cache", { location });
      }
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
    case "jeanne_look":
    case "malik_look":
      return cmd("look_at", { target: LOOK[a.objet as keyof typeof LOOK] });
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
          share_photo_note: "jeanne_use_clue(indice=note_photo) — seulement si le joueur vient de t’en parler",
          ask_usual_place: "jeanne_recall(sujet=place_habituelle) — quand le joueur t’interroge sur votre place habituelle",
          propose_seat: "jeanne_check_seat(siege=…) — seulement le siège que le joueur propose lui-même",
          relay_flood_warning: "jeanne_use_clue(indice=risque_eau) — seulement si le joueur vient de signaler ce risque",
          share_report: "jeanne_use_clue(indice=rapport) — seulement si le joueur te parle lui-même de ce rapport",
          claim_future: "jeanne_use_clue(indice=venir_du_futur) — seulement si le joueur dit lui-même venir d’une autre époque",
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
  return [...actions.map((a) => map[a]).filter((x): x is string => Boolean(x)), `${character}_look(objet=…) — pour montrer un endroit au joueur`];
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
    jeanne_use_clue: def("jeanne_use_clue", "Jeanne (1996) prend en compte ce que le joueur vient de lui dire.", { indice: { type: "string", enum: ["note_photo", "risque_eau", "rapport", "venir_du_futur"] } }, ["indice"],
      "Utilise UNIQUEMENT quand le joueur te dit lui-même : la note d’une photo (note_photo), un risque d’eau dans la cabine (risque_eau), le contenu d’un rapport de conservation (rapport), ou qu’il vient d’une autre époque (venir_du_futur). Ne déduis jamais un de ces partages toi-même. Ce que dit le joueur reste une affirmation : tu peux être surprise ou sceptique. Si le résultat refuse, demande-lui de préciser."),
    jeanne_recall: def("jeanne_recall", "Jeanne (1996) se souvient d’une habitude liée à Alice.", { sujet: { type: "string", enum: ["place_habituelle"] } }, ["sujet"],
      "Utilise quand le joueur t’interroge sur votre place habituelle, après t’avoir parlé de la note. Dis ensuite, avec tes mots, seulement ce que ton contexte te fait te rappeler. Ne propose jamais toi-même un siège précis."),
    jeanne_check_seat: def("jeanne_check_seat", "Jeanne (1996) vérifie un siège que le joueur lui propose pour chercher la clé.", { siege: { type: "string", maxLength: 80, description: "Le siège tel que le joueur l’a dit." } }, ["siege"],
      "Utilise UNIQUEMENT quand le joueur te propose lui-même un siège précis (une rangée et un numéro). Recopie le siège tel qu’il l’a dit. Ne devine jamais et ne propose jamais toi-même un siège. Si le résultat demande pourquoi, demande au joueur ce qui l’y conduit."),
    jeanne_act: def("jeanne_act", "Jeanne (1996) fait un geste dans la cabine.", {
      geste: { type: "string", enum: ["chercher_cle", "ouvrir_armoire", "fermer_armoire", "noter_accord", "conserver"] },
      emplacement: { type: "string", maxLength: 80, description: "Seulement pour conserver : l’endroit que le joueur a indiqué, avec ses mots." },
    }, ["geste"],
      "Tu fais ces gestes toi-même : ne demande jamais au joueur de cliquer ou d’utiliser l’écran pour eux. Quand tu dis que tu le fais, appelle l’outil dans la même réponse. chercher_cle : dès qu’un indice sur la clé a été accepté et que le joueur te demande de chercher ou approuve. ouvrir_armoire : quand tu as la clé et que le joueur le demande. fermer_armoire : quand le joueur demande de refermer l’armoire (elle se rouvre ensuite avec ouvrir_armoire). Exprime ton intention avant d’agir et n’annonce la réussite qu’après un résultat positif. noter_accord : seulement si le joueur reconnaît explicitement la condition d’Alice. conserver : seulement quand le joueur te demande de ranger la bobine, la lettre et son message, à l’endroit qu’il indique lui-même ; recopie cet endroit. Ne choisis jamais toi-même l’endroit."),
    jeanne_draft_message: def("jeanne_draft_message", "Jeanne (1996) note le brouillon du message que le joueur veut laisser avec le film.", { texte: { type: "string", maxLength: 240 } }, ["texte"],
      "Utilise quand le joueur te dicte les mots à laisser. Recopie ses mots exacts, sans les reformuler. Le joueur les confirme lui-même, à voix haute ou à l’écran : ne dis jamais que le message est confirmé tant que le contexte ne l’indique pas."),
    malik_examine: def("malik_examine", "Malik (2026) examine un objet de la cabine.", { objet: { type: "string", enum: ["photo", "trace_eau", "message", "lettre"] } }, ["objet"],
      "Utilise quand le joueur demande de regarder la photo et son verso, la trace d’eau (« le bas de l’armoire », « la marque », « l’humidité » : c’est l’extérieur du meuble, pas l’ouvrir — utilise objet=trace_eau), ou de lire un message ou une lettre retrouvés. N’annonce que ce que le résultat renvoie."),
    malik_act: def("malik_act", "Malik (2026) cherche la clé, ouvre ou referme l’armoire.", { geste: { type: "string", enum: ["chercher_cle", "ouvrir_armoire", "fermer_armoire"] } }, ["geste"],
      "chercher_cle : quand le joueur demande de chercher la clé ou ce que Jeanne a pu laisser. ouvrir_armoire : seulement après avoir trouvé la clé. fermer_armoire : si le joueur demande de la refermer. Si le résultat est négatif, dis simplement qu’il n’y a rien de nouveau ou que l’armoire reste fermée."),
    jeanne_look: def("jeanne_look", "Jeanne (1996) montre au joueur un endroit ou un objet de la cabine.", { objet: { type: "string", enum: ["salle", "armoire", "bureau", "programme", "lettre", "projecteur", "bobines", "lampe", "colleuse"] } }, ["objet"],
      "Utilise quand le joueur te demande de regarder, de lui montrer ou de décrire un endroit ou un objet (la salle, l’armoire, le bureau, le projecteur, les bobines, la lampe, la colleuse) ou un document déjà vu : l’endroit s’affiche à l’écran pour le joueur. Ce n’est pas un geste : ne change rien et ne découvre rien de nouveau ; décris seulement ce que ton contexte autorise."),
    malik_look: def("malik_look", "Malik (2026) montre au joueur un endroit ou un objet de la cabine.", { objet: { type: "string", enum: ["armoire", "projecteur", "bureau", "photo", "trace_eau", "message", "lettre", "bobines", "lampe", "fauteuils"] } }, ["objet"],
      "Utilise quand le joueur te demande de regarder, de lui montrer ou de décrire un endroit ou un objet (l’armoire, son bas abîmé, le projecteur, le bureau, les bobines, la lampe, les fauteuils) ou un objet déjà vu : l’endroit s’affiche à l’écran pour le joueur. Ce n’est pas un geste : ne change rien et ne découvre rien de nouveau ; décris seulement ce que ton contexte autorise."),
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
    def("jeanne_use_clue", "Jeanne (1996) takes into account what the player has just told her.", { clue: { type: "string", enum: ["photo_note", "water_risk", "report", "from_the_future"] } }, ["clue"],
      "Use ONLY when the player tells you themselves: the note on a photo (photo_note), a risk of water in the booth (water_risk), the content of a conservation report (report), or that they come from another time (from_the_future). Never infer one of these yourself. What the player says stays a claim: you may be surprised or sceptical. If the result refuses, ask them to be more precise."),
    def("jeanne_recall", "Jeanne (1996) remembers a habit linked to Alice.", { topic: { type: "string", enum: ["usual_place"] } }, ["topic"],
      "Use when the player asks you about your usual place, after telling you about the note. Then say, in your own words, only what your context makes you remember. Never propose a precise seat yourself."),
    def("jeanne_check_seat", "Jeanne (1996) checks a seat the player proposes to look for the key.", { seat: { type: "string", maxLength: 80, description: "The seat as the player said it." } }, ["seat"],
      "Use ONLY when the player themselves proposes a precise seat (a row and a number). Copy the seat as they said it. Never guess and never propose a seat yourself. If the result asks why, ask the player what leads them there."),
    def("jeanne_act", "Jeanne (1996) makes a gesture in the booth.", {
      gesture: { type: "string", enum: ["look_for_key", "open_cabinet", "close_cabinet", "acknowledge", "store"] },
      location: { type: "string", maxLength: 80, description: "Only for store: the place the player gave, in their words." },
    }, ["gesture"],
      "You make these gestures yourself: never ask the player to click or use the screen for them. When you say you are doing it, call the tool in the same reply. look_for_key: as soon as a clue about the key has been accepted and the player asks you to look or agrees. open_cabinet: when you have the key and the player asks. close_cabinet: when the player asks you to close the cabinet again (it reopens with open_cabinet). State your intention before acting and only announce success after a positive result. acknowledge: only if the player explicitly acknowledges Alice's condition. store: only when the player asks you to put away the reel, the letter and their message, at the place they give themselves; copy that place. Never choose the place yourself."),
    def("jeanne_draft_message", "Jeanne (1996) notes the draft of the message the player wants to leave with the film.", { text: { type: "string", maxLength: 240 } }, ["text"],
      "Use when the player dictates the words to leave. Copy their exact words, without rephrasing. The player confirms them themselves, out loud or on screen: never say the message is confirmed until the context says so."),
    def("malik_examine", "Malik (2026) examines an object in the booth.", { object: { type: "string", enum: ["photo", "waterline", "message", "letter"] } }, ["object"],
      "Use when the player asks to look at the photo and its back, the water mark (“the bottom of the cabinet”, “the stain”, “the damp”: the outside of the cabinet, not opening it — use object=waterline), or to read a recovered message or letter. Announce only what the result returns."),
    def("malik_act", "Malik (2026) looks for the key, opens or closes the cabinet.", { gesture: { type: "string", enum: ["look_for_key", "open_cabinet", "close_cabinet"] } }, ["gesture"],
      "look_for_key: when the player asks you to look for the key or for what Jeanne may have left. open_cabinet: only after finding the key. close_cabinet: if the player asks to close it again. If the result is negative, simply say there is nothing new or that the cabinet stays locked."),
    def("jeanne_look", "Jeanne (1996) shows the player a place or an object in the booth.", { object: { type: "string", enum: ["hall", "cabinet", "desk", "programme", "letter", "projector", "reels", "lamp", "splicer"] } }, ["object"],
      "Use when the player asks you to look at, show or describe a place or an object (the hall, the cabinet, the desk, the projector, the reels, the lamp, the splicer) or a document already seen: the place is shown on screen to the player. It is not a gesture: it changes nothing and discovers nothing new; describe only what your context allows."),
    def("malik_look", "Malik (2026) shows the player a place or an object in the booth.", { object: { type: "string", enum: ["cabinet", "projector", "desk", "photo", "waterline", "message", "letter", "reels", "lamp", "seats"] } }, ["object"],
      "Use when the player asks you to look at, show or describe a place or an object (the cabinet, its damaged bottom, the projector, the desk, the reels, the lamp, the seats) or an object already seen: the place is shown on screen to the player. It is not a gesture: it changes nothing and discovers nothing new; describe only what your context allows."),
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
          share_photo_note: "en_jeanne_use_clue(clue=photo_note) — only if the player has just told you about it",
          ask_usual_place: "en_jeanne_recall(topic=usual_place) — when the player asks about your usual place",
          propose_seat: "en_jeanne_check_seat(seat=…) — only the seat the player proposes themselves",
          share_report: "en_jeanne_use_clue(clue=report) — only if the player tells you about that report themselves",
          claim_future: "en_jeanne_use_clue(clue=from_the_future) — only if the player says themselves they come from another time",
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
  return [...actions.map((a) => map[a]).filter((x): x is string => Boolean(x)), `en_${character}_look(object=…) — to show the player a place`];
}

/** Fields allowed in the log of a rejected tool call (explicit allow-list). Arguments are NEVER
 *  logged: they may carry the player's personal sentence. No transcript, prompt, token or secret. */
export function rejectedToolLog(f: { character: CharacterId; name: string; callId: string; revision: number; code: string }) {
  const known = (TOOL_NAMES as readonly string[]).includes(f.name.replace(/^en_/, ""));
  return {
    character: f.character,
    tool: known ? f.name : "unknown",
    code: /^[A-Z_]{1,40}$/.test(f.code) ? f.code : "INVALID",
    revision: Number.isInteger(f.revision) ? f.revision : null,
    callId: /^[A-Za-z0-9_.:-]{1,80}$/.test(f.callId) ? f.callId : null,
  };
}
