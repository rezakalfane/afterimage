import "server-only";
// Rehearsal mode (no network, no Napster): deterministic in-character replies computed on the
// server from the run state. It never mutates state: it may only SUGGEST an action that the
// player confirms with a button (UI channel). Always labelled "Mode répétition" in the interface.
// Keywords are recognised in French and English; replies are in the player's locale.
import { characterFacts, characterForEra, docs } from "./content";
import { availableActions, transition, type Action, type WorldState } from "./engine";
import { parseSeat } from "./seat";
import { parseLocation } from "@/server/napster/tools";
import { refusalText } from "./texts";
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
  { re: /2026|futur|avenir|trente ans|30 ans|future|thirty years/, action: "claim_future", label: { fr: "Dire à Jeanne d’où vous venez", en: "Tell Jeanne where you come from" }, text: { fr: "Vous venez… de 2026 ? Je ne sais pas quoi en penser. Mais continuez.", en: "You come… from 2026? I don't know what to make of that. But go on." } },
  { re: /rapport|2016|report/, action: "share_report", label: { fr: "Montrer le rapport à Jeanne", en: "Show Jeanne the report" }, text: { fr: "Un rapport ? Une infiltration… les papiers du bureau abîmés. Je ne sais pas d’où vous tenez ça.", en: "A report? An infiltration… the papers on the desk damaged. I don't know where you got that." }, unavailable: { fr: "Quel rapport ? Je ne vois pas de quoi vous parlez.", en: "What report? I don't know what you mean." } },
  { re: /eau|humid|fuite|inond|infiltr|water|damp|flood|leak/, action: "relay_flood_warning", label: { fr: "Avertir Jeanne du risque d’eau", en: "Warn Jeanne about the water risk" }, text: { fr: "Vous craignez une infiltration ? Alors il vaut mieux éviter le bureau.", en: "You fear water getting in? Then we'd better avoid the desk." }, unavailable: { fr: "De l’eau ? Qu’est-ce qui vous fait dire ça ?", en: "Water? What makes you say that?" } },
  { re: /notre place|place habituelle|habitude|usual place|habit|ou s.?asseyait|where .*sat/, action: "ask_usual_place", label: { fr: "Demander à Jeanne leur place habituelle", en: "Ask Jeanne about their usual place" }, text: { fr: "Notre place… Alice choisissait toujours la rangée G. Vous avez quelque chose qui indique le siège ?", en: "Our place… Alice always chose row G. Do you have anything that tells the seat?" }, unavailable: { fr: "Notre place ? De quoi parlez-vous ?", en: "Our place? What do you mean?" } },
  { re: /note|photo|verso|back of/, action: "share_photo_note", label: { fr: "Parler à Jeanne de la note de la photo", en: "Tell Jeanne about the note on the photo" }, text: { fr: "« La clé est à notre place habituelle »… C’est mon écriture. Comment l’avez-vous ?", en: "“The key is at our usual place”… That's my handwriting. How do you have it?" }, unavailable: { fr: "Quelle note ? Je n’ai rien vu de tel.", en: "What note? I haven't seen anything like that." } },
  { re: /cherch.*cle|cle.*cherch|va voir|aller voir|look for|find the key|search/, action: "retrieve_key", label: { fr: "Demander à Jeanne de chercher la clé", en: "Ask Jeanne to look for the key" }, text: { fr: "Je descends voir. Ne bougez pas.", en: "I'll go down and look. Don't move." }, unavailable: { fr: "Chercher où ? La salle est grande. Il me faudrait un siège précis.", en: "Look where? The hall is big. I'd need a precise seat." } },
  { re: /ouvr.*armoire|armoire.*ouvr|open.*cabinet|cabinet.*open/, action: "open_cabinet", label: { fr: "Demander à Jeanne d’ouvrir l’armoire", en: "Ask Jeanne to open the cabinet" }, text: { fr: "Bon. Voyons ce que cette armoire a gardé.", en: "Right. Let's see what this cabinet has kept." }, unavailable: { fr: "Il me manque la clé. Je l’avais pendant mon dernier tour de salle.", en: "I'm missing the key. I had it during my last round of the hall." } },
  { re: /programme|program|seance|screening|affiche/, action: "inspect_programme", label: { fr: "Regarder le programme", en: "Look at the programme" }, text: { fr: "Le programme de ce soir. Je l’ai encore sous les yeux.", en: "Tonight's programme. I still have it in front of me." } },
  { re: /lettre|letter/, action: "read_letter", label: { fr: "Lire la lettre d’Alice avec Jeanne", en: "Read Alice's letter with Jeanne" }, text: { fr: "Lisez-la. Vous comprendrez pourquoi la salle est restée éteinte.", en: "Read it. You'll understand why the hall stayed dark." }, unavailable: { fr: "La lettre est dans l’armoire, avec le film.", en: "The letter is in the cabinet, with the film." } },
  { re: /je comprends|promesse|condition|j.?accepte|respect|i understand|promise|agree|accept/, action: "acknowledge_permission", label: { fr: "Reconnaître la condition d’Alice", en: "Acknowledge Alice's condition" }, text: { fr: "Alors vous comprenez ce que je protège. Ce n’est pas rien.", en: "Then you understand what I'm protecting. It's not nothing." }, unavailable: { fr: "Lisez d’abord ce qu’Alice a écrit.", en: "Read what Alice wrote first." } },
  { re: /message|mots|ecri|laisse|words|write|leave/, text: { fr: "Dites-moi les mots. Je les laisserai avec le film.", en: "Tell me the words. I'll leave them with the film." }, composer: true },
  { re: /ou (ranger|mettre|cacher)|where .*(put|store|hide)|ranger|cacher|conserver|store|hide|keep/, text: { fr: "Le tiroir le cacherait. Qu’est-ce qui vous inquiète ?", en: "The drawer would hide it. What worries you?" } },
  { re: /colleuse|splicer|coll(er|e) .*bande/, text: { fr: "Ma colleuse. Quand une copie casse, je recolle les bandes à la main.", en: "My splicer. When a print breaks, I join the strips by hand." } },
];

const MALIK: Intent[] = [
  { re: /photo|verso|dos|back/, action: "inspect_photo", label: { fr: "Examiner la photo et son verso", en: "Examine the photo and its back" }, text: { fr: "La photo… il y a quelque chose écrit au dos.", en: "The photo… there's something written on the back." } },
  { re: /eau|humid|trace|bois|rapport|water|damp|mark|wood|report/, action: "inspect_waterline", label: { fr: "Examiner la trace d’eau", en: "Examine the water mark" }, text: { fr: "Cette marque sur le bois… il y a un rapport de 2016 quelque part.", en: "This mark on the wood… there's a 2016 report somewhere." } },
  { re: /ouvr|open|armoire|cabinet/, action: "recover_cache", label: { fr: "Demander à Malik d’ouvrir l’armoire", en: "Ask Malik to open the cabinet" }, text: { fr: "Avec cette clé… voyons.", en: "With this key… let's see." }, unavailable: { fr: "Elle est fermée à clé. Je ne peux pas vous dire ce qu’il y a dedans avant de l’avoir ouverte.", en: "It's locked. I can't tell you what's inside before I've opened it." } },
  { re: /projecteur|projector|cle|key|cherch|search|look|laiss|left/, action: "find_future_key", label: { fr: "Demander à Malik de chercher ce que Jeanne a pu laisser", en: "Ask Malik to look for what Jeanne may have left" }, text: { fr: "Je regarde. Si quelqu’un a laissé quelque chose ici, je le trouverai.", en: "I'm looking. If someone left something here, I'll find it." }, unavailable: { fr: "Rien de particulier par ici.", en: "Nothing special around here." } },
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
  share_photo_note: "note_shared", ask_usual_place: "row_learned", propose_seat: "seat_proposed", share_report: "report_shared", claim_future: "temporal_claim", retrieve_key: "key_found", open_cabinet: "cabinet_open", inspect_programme: "programme_seen", read_letter: "letter_read",
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
  if (character === "jeanne") {
    // A seat or a storage place in the player's words: the engine decides (no shortcut here).
    const seat = /(rang|row|siege|seat|place|fauteuil)/.test(t) || /\b[a-z]\s?\d{1,2}\b/.test(t) ? parseSeat(text) : null;
    if (seat && !state.flags.includes("seat_proposed")) {
      const r = transition(state, { action: "propose_seat", args: { seat } }, { channel: "ui" });
      if (r.ok) return { character, text: { fr: "Ce siège-là ? Je peux aller voir dessous.", en: "That seat? I can go and look under it." }[L], suggestion: { action: "propose_seat", args: { seat }, label: { fr: `Proposer le siège ${seat} à Jeanne`, en: `Propose seat ${seat} to Jeanne` }[L] } };
      return { character, text: refusalText("propose_seat", r.code, r.detail, L), suggestion: null };
    }
    const place = /(range|mets|met|cache|pose|conserv|put|store|hide|keep|place)/.test(t) ? parseLocation(text) : null;
    if (place) {
      const r = transition(state, { action: "preserve_cache", args: { location: place } }, { channel: "ui" });
      if (r.ok && r.changed) return { character, text: { fr: "Là ? D’accord. Je range tout.", en: "There? All right. I'll put everything away." }[L], suggestion: { action: "preserve_cache", args: { location: place }, label: { fr: "Demander à Jeanne de tout ranger à cet endroit", en: "Ask Jeanne to put everything there" }[L] } };
      if (!r.ok) return { character, text: refusalText("preserve_cache", r.code, r.detail, L), suggestion: null };
    }
  }
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
    inspect_photo: { fr: `« ${d.photoBack} » Notre place habituelle… mais laquelle ?`, en: `“${d.photoBack}” Our usual place… but which one?` },
    inspect_waterline: { fr: "Le rapport parle d’une infiltration : les documents laissés sur le bureau ont été abîmés.", en: "The report mentions an infiltration: the documents left on the desk were damaged." },
    share_photo_note: { fr: "« Notre place habituelle »… ça me dit quelque chose.", en: "“Our usual place”… that rings a bell." },
    ask_usual_place: { fr: "Alice choisissait toujours la rangée G. Le siège, en revanche…", en: "Alice always chose row G. The seat, though…" },
    propose_seat: { fr: "Ce siège-là… je vais voir dessous.", en: "That seat… I'll look under it." },
    retrieve_key: { fr: "Elle était là. Vous aviez vu juste.", en: "It was there. You were right." },
    open_cabinet: { fr: "Le film est là. Et la lettre d’Alice.", en: "The film is here. And Alice's letter." },
    inspect_programme: { fr: "Annulée. Oui. C’est moi qui l’ai décidé. Et ça… l’écriture d’Alice, dans la marge.", en: "Cancelled. Yes. I'm the one who decided it. And that… Alice's handwriting, in the margin." },
    read_letter: { fr: "Elle me fait confiance. Je ne pouvais pas couper le film ce soir, dans la précipitation.", en: "She trusts me. I couldn't cut the film tonight, in a rush." },
    acknowledge_permission: { fr: "Alors on sauve le film, et la promesse avec.", en: "Then we save the film, and the promise with it." },
    relay_flood_warning: { fr: "Une infiltration… alors pas sur le bureau.", en: "Water getting in… then not on the desk." },
    share_report: { fr: "Un rapport daté de 2016… je ne sais pas quoi en penser. Mais pas sur le bureau, alors.", en: "A report dated 2016… I don't know what to make of it. But not on the desk, then." },
    claim_future: { fr: "De 2026… Admettons. Qu’avez-vous vu ?", en: "From 2026… All right. What did you see?" },
    write_message: { fr: "Je relis vos mots. Confirmez-les quand ils sont justes.", en: "I'm reading your words again. Confirm them when they're right." },
    confirm_message: { fr: "Je les laisserai avec le film. Mot pour mot.", en: "I'll leave them with the film. Word for word." },
    preserve_cache: { fr: "C’est rangé, là où vous l’avez dit. J’ai remis la clé derrière le projecteur.", en: "It's put away, where you said. I put the key back behind the projector." },
    find_future_key: { fr: "Une clé, derrière le projecteur ! Avec un croissant… comme la poignée de l’armoire.", en: "A key, behind the projector! With a crescent… like the cabinet handle." },
    recover_cache: { fr: "Une bobine, une enveloppe, un papier… On pourrait enfin montrer ce que personne n’a vu.", en: "A reel, an envelope, a piece of paper… We could finally show what nobody has seen." },
    read_message: { fr: "Ces mots ont votre âge et trente ans de poussière.", en: "These words are your age, with thirty years of dust." },
    read_future_letter: { fr: "« L’épilogue appartient à ma famille. » Vous voulez qu’on montre le film en gardant ces dernières images privées ?", en: "“The epilogue belongs to my family.” Do you want to show the film while keeping those last images private?" },
  };
  return lines[action]?.[L] ?? null;
}
