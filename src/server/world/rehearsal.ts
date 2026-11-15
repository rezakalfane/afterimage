import "server-only";
// Rehearsal mode (no network, no Napster): deterministic in-character replies computed on the
// server from the run state. It never mutates state: it may only SUGGEST an action that the
// player confirms with a button (UI channel). Always labelled "Mode répétition" in the interface.
// Keywords are recognised in French and English; replies are in the player's locale.
import { characterFacts, characterForEra, docs } from "./content";
import { availableActions, type Action, type WorldState } from "./engine";
import type { Locale } from "./texts";

export interface RehearsalReply {
  character: "jeanne" | "malik";
  text: string;
  suggestion: { action: Action; args?: Record<string, unknown>; label: string } | null;
  openComposer?: boolean;
}

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
type L10n = { fr: string; en: string };
type Intent = { re: RegExp; action?: Action; args?: Record<string, unknown>; label?: L10n; text: L10n; unavailable?: L10n; composer?: boolean };

const JEANNE: Intent[] = [
  { re: /\bg\s?7\b|g sept|siege|seat/, action: "relay_key_location", label: { fr: "Transmettre l’indice G7 à Jeanne", en: "Pass the G7 clue on to Jeanne" }, text: { fr: "Sous G7 ? Attendez… c’est précis, au moins. Je peux aller voir.", en: "Under G7? Wait… at least that's precise. I can go and look." }, unavailable: { fr: "Vous me demandez de croire à trente ans d’avance. Donnez-moi au moins quelque chose de précis.", en: "You're asking me to believe in thirty years ahead. At least give me something precise." } },
  { re: /cherch.*cle|cle.*cherch|va voir|aller voir|look for|find the key|search/, action: "retrieve_key", label: { fr: "Demander à Jeanne de chercher la clé", en: "Ask Jeanne to look for the key" }, text: { fr: "Je descends voir. Ne bougez pas.", en: "I'll go down and look. Don't move." }, unavailable: { fr: "Chercher où ? La salle est grande. Il me faudrait un indice précis.", en: "Look where? The hall is big. I'd need a precise clue." } },
  { re: /ouvr.*armoire|armoire.*ouvr|open.*cabinet|cabinet.*open/, action: "open_cabinet", label: { fr: "Demander à Jeanne d’ouvrir l’armoire", en: "Ask Jeanne to open the cabinet" }, text: { fr: "Bon. Voyons ce que cette armoire a gardé.", en: "Right. Let's see what this cabinet has kept." }, unavailable: { fr: "Il me manque la clé. Je l’avais pendant mon dernier tour de salle.", en: "I'm missing the key. I had it during my last round of the hall." } },
  { re: /programme|program|seance|screening|affiche/, action: "inspect_programme", label: { fr: "Regarder le programme", en: "Look at the programme" }, text: { fr: "Le programme de ce soir. Je l’ai encore sous les yeux.", en: "Tonight's programme. I still have it in front of me." } },
  { re: /lettre|letter|alice/, action: "read_letter", label: { fr: "Lire la lettre d’Alice avec Jeanne", en: "Read Alice's letter with Jeanne" }, text: { fr: "Lisez-la. Vous comprendrez pourquoi la salle est restée éteinte.", en: "Read it. You'll understand why the hall stayed dark." }, unavailable: { fr: "La lettre est dans l’armoire, avec le film.", en: "The letter is in the cabinet, with the film." } },
  { re: /je comprends|promesse|condition|d.?accord avec alice|respect|i understand|promise|agree/, action: "acknowledge_permission", label: { fr: "Reconnaître la condition d’Alice", en: "Acknowledge Alice's condition" }, text: { fr: "Alors vous comprenez ce que je protège. Ce n’est pas rien.", en: "Then you understand what I'm protecting. It's not nothing." }, unavailable: { fr: "Lisez d’abord ce qu’Alice a écrit.", en: "Read what Alice wrote first." } },
  { re: /eau|humid|fuite|inond|2008|water|damp|flood|leak/, action: "relay_flood_warning", label: { fr: "Avertir Jeanne du risque d’eau", en: "Warn Jeanne about the water risk" }, text: { fr: "De l’eau, jusqu’au bureau ? Alors rien ne restera en bas.", en: "Water, up to the desk? Then nothing will stay down low." }, unavailable: { fr: "Vous parlez d’eau… mais qu’avez-vous vu, exactement ?", en: "You're talking about water… but what exactly have you seen?" } },
  { re: /message|mots|ecri|laisse|words|write|leave/, text: { fr: "Dites-moi les mots. Je les laisserai avec le film.", en: "Tell me the words. I'll leave them with the film." }, composer: true },
  { re: /etagere|haut|ranger|cache|conserv|proteg|shelf|store|keep|safe/, action: "preserve_cache", args: { location: "upper_cabinet" }, label: { fr: "Ranger la bobine, la lettre et vos mots sur l’étagère haute", en: "Put the reel, the letter and your words on the upper shelf" }, text: { fr: "En haut, alors. Au sec.", en: "Up high, then. Dry." }, unavailable: { fr: "Pas encore. Il manque quelque chose avant de tout ranger.", en: "Not yet. Something is missing before putting everything away." } },
];

const MALIK: Intent[] = [
  { re: /photo|verso|dos|back/, action: "inspect_photo", label: { fr: "Examiner la photo et son verso", en: "Examine the photo and its back" }, text: { fr: "La photo… il y a quelque chose écrit au dos.", en: "The photo… there's something written on the back." } },
  { re: /eau|humid|trace|bois|rapport|water|damp|mark|wood|report/, action: "inspect_waterline", label: { fr: "Examiner la trace d’eau", en: "Examine the water mark" }, text: { fr: "Cette marque sur le bois… il y a un rapport de 2008 quelque part.", en: "This mark on the wood… there's a 2008 report somewhere." } },
  { re: /ouvr|open|armoire|cabinet/, action: "recover_cache", label: { fr: "Demander à Malik d’ouvrir l’armoire", en: "Ask Malik to open the cabinet" }, text: { fr: "Avec cette clé… voyons.", en: "With this key… let's see." }, unavailable: { fr: "Elle est fermée à clé. Je ne peux pas vous dire ce qu’il y a dedans avant de l’avoir ouverte.", en: "It's locked. I can't tell you what's inside before I've opened it." } },
  { re: /projecteur|projector|cle|key|cherch|search|look/, action: "find_future_key", label: { fr: "Demander à Malik de chercher derrière le projecteur", en: "Ask Malik to look behind the projector" }, text: { fr: "Je regarde. Si quelqu’un a laissé quelque chose, ce serait là.", en: "I'm looking. If someone left something, it would be there." }, unavailable: { fr: "Rien de particulier par ici, pour l’instant.", en: "Nothing special around here, for now." } },
  { re: /message|mots|words/, action: "read_message", label: { fr: "Lire le message retrouvé", en: "Read the recovered message" }, text: { fr: "Ces mots ont votre âge et trente ans de poussière.", en: "These words are your age, with thirty years of dust." } },
  { re: /lettre|letter|alice/, action: "read_future_letter", label: { fr: "Lire la lettre retrouvée", en: "Read the recovered letter" }, text: { fr: "Une lettre d’Alice… Sauver un film ne nous autorise peut-être pas à tout montrer.", en: "A letter from Alice… Saving a film may not entitle us to show everything." } },
];

const COMMON = {
  help: { fr: "Si vous êtes perdu, demandez une aide : le bouton « Aide » vous mettra sur la piste.", en: "If you're lost, ask for a hint: the “Hint” button will put you on the track." },
  helpLabel: { fr: "Demander une aide", en: "Ask for a hint" },
  needLetter: { fr: "Avant de laisser des mots avec le film, lisez ce qu’Alice a écrit.", en: "Before leaving words with the film, read what Alice wrote." },
  done: { fr: "C’est déjà fait. Regardez votre carnet.", en: "That's already done. Look at your notebook." },
  notNow: { fr: "Pas maintenant.", en: "Not now." },
  offTopicJeanne: { fr: "Je n’ai pas vraiment le temps pour ça ce soir. Revenons à la cabine.", en: "I don't really have time for that tonight. Let's get back to the booth." },
  offTopicMalik: { fr: "Je préfère qu’on reste concentrés sur la cabine. Qu’est-ce qu’on regarde ?", en: "I'd rather we stay focused on the booth. What do we look at?" },
};

const FLAG_OF: Partial<Record<Action, string>> = {
  relay_key_location: "key_location_shared", retrieve_key: "key_found", open_cabinet: "cabinet_open", inspect_programme: "programme_seen", read_letter: "letter_read",
  acknowledge_permission: "permission_acknowledged", relay_flood_warning: "flood_warning_shared", preserve_cache: "cache_preserved", inspect_photo: "photo_seen",
  inspect_waterline: "waterline_seen", find_future_key: "future_key_found", recover_cache: "cache_recovered", read_message: "message_read", read_future_letter: "future_letter_read",
};

/** Deterministic reply to a typed player message (null = opening line). */
export function rehearsalReply(state: WorldState, text: string | null, locale: Locale = "fr"): RehearsalReply {
  const L = locale === "en" ? "en" : "fr";
  const character = characterForEra(state.activeEra);
  if (text === null) return { character, text: characterFacts(character, L).opening, suggestion: null };
  const t = norm(text);
  const available = new Set(availableActions(state, { channel: "ui" }));
  if (/aide|indice|bloque|perdu|help|hint|stuck|lost/.test(t)) return { character, text: COMMON.help[L], suggestion: { action: "request_hint", label: COMMON.helpLabel[L] } };
  for (const i of character === "jeanne" ? JEANNE : MALIK) {
    if (!i.re.test(t)) continue;
    if (i.composer) return { character, text: available.has("write_message") ? i.text[L] : COMMON.needLetter[L], suggestion: null, openComposer: available.has("write_message") };
    if (i.action && available.has(i.action)) return { character, text: i.text[L], suggestion: { action: i.action, args: i.args, label: i.label![L] } };
    if (i.action && state.flags.includes(FLAG_OF[i.action] as never)) return { character, text: COMMON.done[L], suggestion: null };
    return { character, text: i.unavailable?.[L] ?? COMMON.notNow[L], suggestion: null };
  }
  return { character, text: character === "jeanne" ? COMMON.offTopicJeanne[L] : COMMON.offTopicMalik[L], suggestion: null };
}

/** Short in-character comment after a validated action. */
export function rehearsalReaction(action: Action, locale: Locale = "fr"): string | null {
  const L = locale === "en" ? "en" : "fr";
  const d = docs(L);
  const lines: Partial<Record<Action, L10n>> = {
    inspect_photo: { fr: `« ${d.photoBack} » G7… un siège de la salle ?`, en: `“${d.photoBack}” G7… a seat in the hall?` },
    inspect_waterline: { fr: "Le rapport parle d’une infiltration jusqu’au niveau du bureau. Le haut de l’armoire est resté sec.", en: "The report mentions water up to desk level. The top of the cabinet stayed dry." },
    relay_key_location: { fr: "Sous G7 ? Attendez… je peux aller voir.", en: "Under G7? Wait… I can go and look." },
    retrieve_key: { fr: "Sous G7… Vous aviez raison. La voilà.", en: "Under G7… You were right. Here it is." },
    open_cabinet: { fr: "Le film est là. Et la lettre d’Alice.", en: "The film is here. And Alice's letter." },
    inspect_programme: { fr: "Annulée. Oui. C’est moi qui l’ai décidé.", en: "Cancelled. Yes. I'm the one who decided it." },
    read_letter: { fr: "Elle me fait confiance. Je ne pouvais pas couper le film ce soir, dans la précipitation.", en: "She trusts me. I couldn't cut the film tonight, in a rush." },
    acknowledge_permission: { fr: "Alors on sauve le film, et la promesse avec.", en: "Then we save the film, and the promise with it." },
    relay_flood_warning: { fr: "Rien ne restera en bas, alors. L’étagère haute.", en: "Nothing will stay down low, then. The upper shelf." },
    write_message: { fr: "Je relis vos mots. Confirmez-les quand ils sont justes.", en: "I'm reading your words again. Confirm them when they're right." },
    confirm_message: { fr: "Je les laisserai avec le film. Mot pour mot.", en: "I'll leave them with the film. Word for word." },
    preserve_cache: { fr: "C’est rangé, en haut. J’ai remis la clé derrière le projecteur.", en: "It's put away, up high. I put the key back behind the projector." },
    find_future_key: { fr: "Une clé, derrière le projecteur ! Avec un croissant… comme la poignée de l’armoire.", en: "A key, behind the projector! With a crescent… like the cabinet handle." },
    recover_cache: { fr: "L’armoire s’ouvre… il y a une bobine, une enveloppe, et un papier.", en: "The cabinet opens… there's a reel, an envelope, and a piece of paper." },
    read_message: { fr: "Ces mots ont votre âge et trente ans de poussière.", en: "These words are your age, with thirty years of dust." },
    read_future_letter: { fr: "« L’épilogue appartient à ma famille. » On peut rallumer la salle sans trahir celle qui l’a filmée.", en: "“The epilogue belongs to my family.” We can light the hall again without betraying the woman who filmed it." },
  };
  return lines[action]?.[L] ?? null;
}
