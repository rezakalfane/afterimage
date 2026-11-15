import "server-only";
// Rehearsal mode (no network, no Napster): deterministic in-character replies computed on the
// server from the SAME character projection the live agent receives. It never mutates state:
// it may only SUGGEST an action that the player confirms with a button (UI channel).
// Always labelled "Mode répétition" in the interface.
import { CHARACTERS, EPISODE, characterForEra } from "./content";
import { availableActions, type Action, type WorldState } from "./engine";

export interface RehearsalReply {
  character: "jeanne" | "malik";
  text: string;
  suggestion: { action: Action; args?: Record<string, unknown>; label: string } | null;
  openComposer?: boolean;
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

type Intent = { re: RegExp; action?: Action; args?: Record<string, unknown>; label?: string; text: string; unavailable?: string; composer?: boolean };

const JEANNE: Intent[] = [
  { re: /\bg\s?7\b|g sept|siege/, action: "relay_key_location", label: "Transmettre l’indice G7 à Jeanne", text: "Sous G7 ? Attendez… c’est précis, au moins. Je peux aller voir.", unavailable: "Vous me demandez de croire à trente ans d’avance. Donnez-moi au moins quelque chose de précis." },
  { re: /cherch.*cle|cle.*cherch|va voir|aller voir/, action: "retrieve_key", label: "Demander à Jeanne de chercher la clé", text: "Je descends voir. Ne bougez pas.", unavailable: "Chercher où ? La salle est grande. Il me faudrait un indice précis." },
  { re: /ouvr.*armoire|armoire.*ouvr/, action: "open_cabinet", label: "Demander à Jeanne d’ouvrir l’armoire", text: "Bon. Voyons ce que cette armoire a gardé.", unavailable: "Il me manque la clé. Je l’avais pendant mon dernier tour de salle." },
  { re: /programme|seance|affiche/, action: "inspect_programme", label: "Regarder le programme", text: "Le programme de ce soir. Je l’ai encore sous les yeux." },
  { re: /lettre|alice/, action: "read_letter", label: "Lire la lettre d’Alice avec Jeanne", text: "Lisez-la. Vous comprendrez pourquoi la salle est restée éteinte.", unavailable: "La lettre est dans l’armoire, avec le film." },
  { re: /je comprends|promesse|condition|d.?accord avec alice|respect/, action: "acknowledge_permission", label: "Reconnaître la condition d’Alice", text: "Alors vous comprenez ce que je protège. Ce n’est pas rien.", unavailable: "Lisez d’abord ce qu’Alice a écrit." },
  { re: /eau|humid|fuite|inond|2008/, action: "relay_flood_warning", label: "Avertir Jeanne du risque d’eau", text: "De l’eau, jusqu’au bureau ? Alors rien ne restera en bas.", unavailable: "Vous parlez d’eau… mais qu’avez-vous vu, exactement ?" },
  { re: /message|mots|ecri|laisse/, text: "Dites-moi les mots. Je les laisserai avec le film.", composer: true },
  { re: /etagere|haut|ranger|cache|conserv|proteg/, action: "preserve_cache", args: { location: "upper_cabinet" }, label: "Ranger la bobine, la lettre et vos mots sur l’étagère haute", text: "En haut, alors. Au sec.", unavailable: "Pas encore. Il manque quelque chose avant de tout ranger." },
];

const MALIK: Intent[] = [
  { re: /photo|verso|dos/, action: "inspect_photo", label: "Examiner la photo et son verso", text: "La photo… il y a quelque chose écrit au dos." },
  { re: /eau|humid|trace|bois|rapport/, action: "inspect_waterline", label: "Examiner la trace d’eau", text: "Cette marque sur le bois… il y a un rapport de 2008 quelque part." },
  { re: /projecteur|cle|cherch|armoire|ouvr/, action: "recover_cache", label: "Demander à Malik de chercher derrière le projecteur", text: "Je regarde. Si quelqu’un a laissé quelque chose, ce serait là.", unavailable: "Je ne peux pas vous dire ce qu’il y a dedans avant de l’avoir ouvert." },
  { re: /message|mots/, action: "read_message", label: "Lire le message retrouvé", text: "Ces mots ont votre âge et trente ans de poussière." },
  { re: /lettre|alice/, action: "read_future_letter", label: "Lire la lettre retrouvée", text: "Une lettre d’Alice… Sauver un film ne nous autorise peut-être pas à tout montrer." },
];

/** Deterministic reply to a typed player message. */
export function rehearsalReply(state: WorldState, text: string | null): RehearsalReply {
  const character = characterForEra(state.activeEra);
  const c = CHARACTERS[character];
  if (text === null) return { character, text: c.opening, suggestion: null };
  const t = norm(text);
  const available = new Set(availableActions(state, { channel: "ui" }));
  if (/aide|indice|bloque|perdu/.test(t)) return { character, text: "Si vous êtes perdu, demandez une aide : le bouton « Aide » vous mettra sur la piste.", suggestion: { action: "request_hint", label: "Demander une aide" } };
  for (const i of character === "jeanne" ? JEANNE : MALIK) {
    if (!i.re.test(t)) continue;
    if (i.composer) return { character, text: available.has("write_message") ? i.text : "Avant de laisser des mots avec le film, lisez ce qu’Alice a écrit.", suggestion: null, openComposer: available.has("write_message") };
    if (i.action && available.has(i.action)) return { character, text: i.text, suggestion: { action: i.action, args: i.args, label: i.label! } };
    if (i.action && state.flags.includes(flagOf(i.action))) return { character, text: "C’est déjà fait. Regardez votre carnet.", suggestion: null };
    return { character, text: i.unavailable ?? "Pas maintenant.", suggestion: null };
  }
  const offTopic = character === "jeanne" ? "Je n’ai pas vraiment le temps pour ça ce soir. Revenons à la cabine." : "Je préfère qu’on reste concentrés sur la cabine. Qu’est-ce qu’on regarde ?";
  return { character, text: offTopic, suggestion: null };
}

/** Short in-character comment after a validated action. */
export function rehearsalReaction(action: Action): string | null {
  const lines: Partial<Record<Action, string>> = {
    inspect_photo: `« ${EPISODE.documents.photoBack} » G7… un siège de la salle ?`,
    inspect_waterline: "Le rapport parle d’une infiltration jusqu’au niveau du bureau. Le haut de l’armoire est resté sec.",
    relay_key_location: "Sous G7 ? Attendez… je peux aller voir.",
    retrieve_key: "Sous G7… Vous aviez raison. La voilà.",
    open_cabinet: "Le film est là. Et la lettre d’Alice.",
    inspect_programme: "Annulée. Oui. C’est moi qui l’ai décidé.",
    read_letter: "Elle me fait confiance. Je ne pouvais pas couper le film ce soir, dans la précipitation.",
    acknowledge_permission: "Alors on sauve le film, et la promesse avec.",
    relay_flood_warning: "Rien ne restera en bas, alors. L’étagère haute.",
    write_message: "Je relis vos mots. Confirmez-les quand ils sont justes.",
    confirm_message: "Je les laisserai avec le film. Mot pour mot.",
    preserve_cache: "C’est rangé, en haut. J’ai remis la clé derrière le projecteur.",
    recover_cache: "La clé était derrière le projecteur ! L’armoire… il y a une bobine, une enveloppe, et un papier.",
    read_message: "Ces mots ont votre âge et trente ans de poussière.",
    read_future_letter: "« L’épilogue appartient à ma famille. » On peut rallumer la salle sans trahir celle qui l’a filmée.",
  };
  return lines[action] ?? null;
}

function flagOf(action: Action): string {
  const m: Partial<Record<Action, string>> = {
    relay_key_location: "key_location_shared", retrieve_key: "key_found", open_cabinet: "cabinet_open", inspect_programme: "programme_seen", read_letter: "letter_read",
    acknowledge_permission: "permission_acknowledged", relay_flood_warning: "flood_warning_shared", preserve_cache: "cache_preserved", inspect_photo: "photo_seen",
    inspect_waterline: "waterline_seen", recover_cache: "cache_recovered", read_message: "message_read", read_future_letter: "future_letter_read",
  };
  return m[action] ?? "";
}
