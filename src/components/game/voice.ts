// Voice confirmations — complement to the button, never a replacement of the server checks.
// Input: ONLY the player's own FINAL transcript (message_received, role user, action completed).
// An utterance confirms only if, AS A WHOLE, it is an explicit affirmative confirmation: a short,
// anchored phrase (with optional fillers and politeness), no question, no negation, no hesitation
// followed by a reversal, no reported speech. Anything ambiguous confirms nothing.

export type VoiceLocale = "fr" | "en";

/** Lowercase, NFC, unified apostrophes, punctuation → spaces (keeps "?" detectable before that). */
export function normalizeSpeech(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[’`´]/g, "'")
    .toLowerCase()
    .replace(/[.,;:!…«»"“”()-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const FILLERS: Record<VoiceLocale, string> = {
  fr: "(?:(?:euh|heu|bon|alors|ok|okay|d'accord|très bien|parfait|oui|ouais)\\s+)*",
  en: "(?:(?:uh|um|well|ok|okay|alright|right|yes|yeah|yep)\\s+)*",
};
const POLITE: Record<VoiceLocale, string> = {
  fr: "(?:\\s+(?:s'il (?:te|vous) pla[iî]t|merci|jeanne|malik))*",
  en: "(?:\\s+(?:please|thanks|thank you|jeanne|malik))*",
};
/** Explicit confirmations for each kind of confirmation. */
const PHRASES: Record<"message" | "ending", Record<VoiceLocale, string>> = {
  message: {
    fr: "(?:je (?:le |les )?confirme|c'est confirmé|confirmé|je (?:le |les )?valide|je (?:vous |te )?(?:les )?confie(?: ces mots)?(?: à jeanne)?|confiez les|gardez les|garde les|gardez ces mots|garde ces mots|c'est bon gardez les)",
    en: "(?:i confirm(?: it| them)?|confirmed|i validate(?: it| them)?|keep them|keep these words|leave them with (?:you|jeanne)|i leave them with (?:you|jeanne)|yes keep them)",
  },
  ending: {
    fr: "(?:je (?:le )?confirme(?: ce choix)?|c'est confirmé|confirmé|je (?:le )?valide(?: ce choix)?|c'est mon choix|je choisis ça)",
    en: "(?:i confirm(?: it| this choice)?|confirmed|i validate(?: it)?|that's my choice|this is my choice)",
  },
};
/** What may follow the confirmation itself: its object, then a short approval ("c'est parfait"). */
const OBJECT: Record<VoiceLocale, string> = {
  fr: "(?:\\s+(?:ces mots|ces mots-là|ces mots la|le message|mon message|ce message|cette phrase|les mots|mes mots|ce choix|mon choix|tout|tout ça|tout ca))?",
  en: "(?:\\s+(?:these words|the message|my message|this message|my words|that|this|it all|my choice|this choice))?",
};
const TAIL: Record<VoiceLocale, string> = {
  fr: "(?:\\s+(?:c'est parfait|c'est bon|c'est ça|c'est ca|c'est très bien|parfait|très bien|oui|allez y|vas y|merci))*",
  en: "(?:\\s+(?:that's perfect|that's good|perfect|great|yes|go ahead|thanks|thank you))*",
};
const ACCEPT = (kind: "message" | "ending", l: VoiceLocale) => new RegExp(`^${FILLERS[l]}${PHRASES[kind][l]}${OBJECT[l]}${POLITE[l]}${TAIL[l]}${POLITE[l]}$`);

/** Words that make any utterance ambiguous for a confirmation (negation, doubt, hypothesis, quote). */
const BLOCK: Record<VoiceLocale, RegExp> = {
  fr: /\b(ne|n'|pas|non|jamais|attends?|attendez|minute|plutôt|si|est-ce|quoi|comment|pourquoi|dit|dis|a dit|disait|peut-être|hésite)\b/,
  en: /\b(not|no|don't|never|wait|hold on|rather|if|what|how|why|said|says|say|maybe|perhaps)\b/,
};

export function isConfirmation(text: string, locale: VoiceLocale, kind: "message" | "ending" = "message"): boolean {
  if (/[?¿]/.test(text)) return false; // a question never confirms
  const t = normalizeSpeech(text);
  if (!t || t.length > 80) return false; // confirmations are short; long speech is something else
  if (BLOCK[locale].test(t)) return false;
  return ACCEPT(kind, locale).test(t);
}

const ENDINGS: Record<VoiceLocale, [string, RegExp][]> = {
  fr: [
    ["broken_promise", /(tout projeter|tout montrer|on montre tout|montrons tout|projetons tout|en entier|integral|integrale|version complete|avec l'epilogue|malgre la lettre)/],
    ["sealed_archive", /(archives?|sous scelles?|conserver le film|garder le film|ne pas le projeter|sans projection)/],
    ["public_cut", /(version autorisee|sans l'epilogue|sans epilogue|version sans|comme alice (le )?voulait|ce qu'alice (a )?autorise)/],
  ],
  en: [
    ["broken_promise", /(screen everything|show everything|show it all|screen it all|in full|full version|with the epilogue|whole film|despite the letter)/],
    ["sealed_archive", /(archives?|under seal|keep the film|not screen it|no screening)/],
    ["public_cut", /(authori[sz]ed version|without the epilogue|as alice wanted|what alice allowed)/],
  ],
};
/** Talking it over, not choosing ("qu'en penses-tu", "what do you think", "ou bien"). */
const DISCUSS: Record<VoiceLocale, RegExp> = {
  fr: /\b(penses|pense|penser|avis|qu'en|ou bien|hesite|hesiter|on verra|plutot que)\b/,
  en: /\b(think|opinion|or maybe|not sure|rather than|we'll see)\b/,
};
const CHOOSE: Record<VoiceLocale, RegExp> = {
  fr: /^(?:(?:euh|bon|alors|ok|oui)\s+)*(?:je (?:choisis|prends|veux|préfère)|on (?:choisit|prend)|choisissons|ce sera)\b/,
  en: /^(?:(?:uh|um|well|ok|yes)\s+)*(?:i (?:choose|pick|take|want|prefer)|we (?:choose|take)|let's (?:go with|choose)|i'll (?:go with|take))\b/,
};

/** An explicit choice of exactly one ending ("je choisis les archives"). It only SELECTS: the
 *  confirmation is a separate, explicit step. Questions, negations and ambiguity select nothing. */
export function endingFromSpeech(text: string, locale: VoiceLocale, opts: { choiceShown?: boolean } = {}): string | null {
  if (/[?¿]/.test(text)) return null;
  const t = normalizeSpeech(text);
  if (BLOCK[locale].test(t)) return null;
  const plain = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (DISCUSS[locale].test(plain)) return null;
  // While the choice is on screen, naming one option is enough to SELECT it ("la version
  // autorisée", "allons-y pour les archives"); otherwise an explicit "je choisis…" is needed.
  if (!opts.choiceShown && !CHOOSE[locale].test(t)) return null;
  const hits = ENDINGS[locale].filter(([, re]) => re.test(plain)).map(([id]) => id);
  return hits.length === 1 ? hits[0] : null;
}

/** A confirmation step currently on screen. Any change of one of its fields invalidates it. */
export interface VoiceTarget {
  kind: "message" | "ending";
  /** Exact text shown (message) or ending id (ending). */
  content: string;
  revision: number;
  /** Live session (lease) the step belongs to. */
  session: string | null;
  /** When the step was shown (ms): transcripts received before it are ignored. */
  since: number;
}

export function sameTarget(a: VoiceTarget | null, b: VoiceTarget | null): boolean {
  return Boolean(a && b && a.kind === b.kind && a.content === b.content && a.revision === b.revision && a.session === b.session);
}

/** An explicit request to change era: the other year said alone or as a short command
 *  ("2026", "en 2026", "passons en 1996", "retour en 2026", "go to 1996", "switch to 2026").
 *  A sentence that merely mentions a year ("je viens de 2026") changes nothing. */
const ERA_CMD = new RegExp(
  "^(?:(?:euh|bon|alors|ok|okay|oui|uh|um|well|yes)\\s+)*" +
    "(?:(?:on\\s+)?(?:passe|passer|passons|va|aller|allons|retourne|retourner|retournons|retour|revenir|revenons|bascule|basculer|basculons|direction|go|go back|switch|back|take me|let's go)(?:\\s+(?:en|à|a|vers|to|in))?\\s+|en\\s+|to\\s+)?" +
    "(1996|2026)" +
    "(?:\\s+(?:s'il (?:te|vous) pla[iî]t|please|merci|thanks))*$",
);

export function eraFromSpeech(text: string, current: 1996 | 2026): 1996 | 2026 | null {
  if (/[?¿]/.test(text)) return null;
  const t = normalizeSpeech(text).replace(/\b(?:(?:mille|dix[ -]neuf) )?(?:neuf )?cent quatre[ -]vingt[ -]seize\b|\bnineteen ninety[ -]six\b/g, "1996").replace(/\bdeux mille vingt[ -]six\b|\btwenty twenty[ -]six\b/g, "2026");
  const m = ERA_CMD.exec(t);
  if (!m) return null;
  const era = Number(m[1]) as 1996 | 2026;
  return era === current ? null : era;
}

/** The player asks to make the final decision ("let's decide", "on décide", "je suis prêt à
 *  décider", "décider du sort du film"). Only OPENS the choice: nothing is selected or confirmed. */
export function wantsToDecide(text: string): boolean {
  if (/[?¿]/.test(text)) return false;
  const t = normalizeSpeech(text);
  if (/\b(ne|n'|pas|jamais|not|don't|never|later|plus tard|attends?|wait)\b/.test(t)) return false;
  return /\b(let's decide|lets decide|time to decide|i'?m ready to decide|i want to decide|ready to choose|let's choose|decide the film'?s fate|make the decision|on (decide|décide)|décidons|décider du sort|je (suis prête? à|veux|vais) décider|prête? à décider|c'est l'heure de (décider|choisir)|faisons notre choix|on choisit|choisissons)\b/.test(t);
}

/** Short utterances that close a window: "ok", "d'accord", "merci", "c'est bon", "compris", "got it"
 *  (ack) and explicit "fermer", "close", "annuler", "cancel" (close). Anything longer is speech. */
export function closeIntent(text: string): "ack" | "close" | null {
  const t = normalizeSpeech(text).replace(/\s+(jeanne|malik|merci|thanks)$/g, "");
  if (/^(?:(?:bon|alors|oui|euh)\s+)*(?:ferme|fermer|fermez|fermons|referme|referme ça|ferme ça|fermez ça|ferme la fenêtre|annule|annuler|close|close it|close this|cancel)$/.test(t)) return "close";
  if (/^(?:(?:oui|bon|alors|euh|yes|well)\s+)*(?:ok|okay|ok ok|d'accord|merci|c'est bon|très bien|parfait|compris|vu|je vois|bien reçu|thanks|thank you|got it|i see|alright|all right|fine|good|perfect|noted)$/.test(t)) return "ack";
  return null;
}

/** The player says they have / show / want to see a document ("j'ai une photo à vous montrer",
 *  "regardez le rapport", "let me show you the letter"): which notebook document to open. Only
 *  opens what the player already has; sharing with the character stays a separate, backed step. */
export function showIntent(text: string): "photo" | "archiveReport" | "programme" | "letter" | "message" | null {
  const t = normalizeSpeech(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/\b(ne|n'|pas|jamais|not|don't|never)\b/.test(t)) return null;
  const verb = /\b(montre|montrer|montrez|montrons|voici|voila|regarde|regardez|regardons|vois|voyez|j'ai (une|un|la|le)|tenez|lis|lisez|relis|relisez|show|showing|look at|here is|here's|i have|i've got|see|read|let me show)\b/;
  if (!verb.test(t)) return null;
  if (/\b(photo|photographie|photograph|picture)\b/.test(t)) return "photo";
  if (/\b(rapport|report)\b/.test(t)) return "archiveReport";
  if (/\b(programme|program)\b/.test(t)) return "programme";
  if (/\b(lettre|letter)\b/.test(t)) return "letter";
  if (/\b(message|mots|words)\b/.test(t)) return "message";
  return null;
}

/** The player wants to leave words with the film ("je veux laisser un message", "laissons des
 *  mots", "oui, écrivons-lui", "I'd like to leave a message"). Opens the sheet only. */
export function wantsToWrite(text: string): boolean {
  if (/[?¿]/.test(text)) return false;
  const t = normalizeSpeech(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/\b(ne|n'|pas|jamais|not|don't|never|plus tard|later)\b/.test(t)) return false;
  return /\b(laisser|laissons|laisse|ecrire|ecrivons|ecris|rediger|dicter|dicte|leave|write|dictate)\b/.test(t) && /\b(message|mot|mots|quelques mots|lettre|phrase|words?|note|a few words)\b/.test(t);
}

/** "La version autorisée, je confirme": the sentence names the SELECTED ending and, once that name
 *  is removed, what remains is an explicit confirmation. Any other ending named → false. */
export function confirmsSelectedEnding(text: string, locale: VoiceLocale, selected: string): boolean {
  if (/[?¿]/.test(text)) return false;
  const plain = normalizeSpeech(text).normalize("NFD").replace(/[̀-ͯ]/g, "");
  const named = ENDINGS[locale].filter(([, re]) => re.test(plain));
  if (named.length !== 1 || named[0][0] !== selected) return false;
  const rest = plain
    .replace(named[0][1], " ")
    .replace(/\b(je choisis|on choisit|allons y pour|va pour|alors|donc|oui|c'est|ce sera|la|le|les|l'|i choose|we choose|let's go with|so|yes|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return isConfirmation(rest, locale, "ending");
}

/** The player asks to look at / examine a place of the booth ("regardons le bas de l'armoire",
 *  "montre-moi la lampe", "let's examine the projector"). Returns the scene hotspot id. Specific
 *  places are tested before generic ones ("bas de l'armoire" before "armoire"); a negation just
 *  before the place ("je ne veux pas voir l'intérieur") cancels that mention only. */
const LOOK_VERB = /\b(regarde|regarder|regardons|regardez|examine|examiner|examinons|examinez|inspecte|inspecter|inspectons|montre|montrer|montrez|montre moi|voir|voyons|observe|observons|jette un oeil|jetons un oeil|look|looking|examine|examining|inspect|show me|let's see|check|see)\b/;
const PLACES: [string, RegExp][] = [
  ["waterline", /(bas de l'armoire|bas abime|bas de l armoire|pied de l'armoire|trace d'humidite|trace d'eau|marque d'eau|tache|humidite|bottom of the cabinet|cabinet's bottom|water mark|damp mark|damp|watermark|the stain)/],
  ["photo", /(photo|photographie|photograph|picture)/],
  ["programme", /(programme|program)/],
  ["projector", /(projecteur|projector)/],
  ["lamp", /(lampe|lamp)/],
  ["chest", /(coffre|malle|green chest|green box|the chest|chest|trunk)/],
  ["reels", /(bobines|boites|reels|cans)/],
  ["splicer", /(colleuse|splicer)/],
  ["seats", /(fauteuils|sieges|seats)/],
  ["hall", /(la salle|salle de cinema|the hall|the auditorium)/],
  ["cabinet", /(armoire|cabinet)/],
];
export function lookIntent(text: string): string | null {
  const t = normalizeSpeech(text).normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!LOOK_VERB.test(t)) return null;
  for (const [id, re] of PLACES) {
    const m = re.exec(t);
    if (!m) continue;
    const before = t.slice(Math.max(0, m.index - 28), m.index);
    if (/\b(ne|n'|pas|not|don't|no)\b/.test(before) && !/\b(juste|seulement|just|only)\b/.test(before)) continue;
    return id;
  }
  return null;
}

/** The player asks the character to stop talking: "attends", "arrête", "ok stop", "stop please",
 *  "hold on a second". Only a short utterance made of nothing but such words (and fillers) counts:
 *  "attends, je regarde la photo" is a sentence for the character, not a stop. */
const STOP_WORD = "(?:attends?|attendez|arrete|arretez|arrete toi|stop|assez|pause|doucement|wait|hold on|hold up|hang on|enough)";
const STOP_EXTRA = "(?:ok|okay|oui|bon|euh|uh|um|alors|yes|hey|he|hum|jeanne|malik|please|s il (?:te|vous) plait|excuse moi|excusez moi|sorry|pardon|merci|thanks|un instant|un moment|une seconde|une minute|deux secondes|minute|moment|encore|a second|a moment|a sec|just a second|one second|one moment|for a (?:second|moment))";
const STOP_ALL = new RegExp(`^(?:(?:${STOP_WORD}|${STOP_EXTRA})(?:\\s+|$))+$`);
export function stopIntent(text: string): boolean {
  if (/[?¿]/.test(text)) return false;
  const t = normalizeSpeech(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/'/g, " ").replace(/\s+/g, " ").trim();
  if (!t || t.length > 48) return false;
  return STOP_ALL.test(t) && new RegExp(`\\b${STOP_WORD}`).test(t);
}
