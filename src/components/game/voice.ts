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
const ACCEPT = (kind: "message" | "ending", l: VoiceLocale) => new RegExp(`^${FILLERS[l]}${PHRASES[kind][l]}${POLITE[l]}$`);

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
    ["broken_promise", /\b(tout projeter|tout montrer|en entier|intégral|intégrale|version complète|avec l'épilogue)\b/],
    ["sealed_archive", /\b(archives?|sous scellés?|conserver le film)\b/],
    ["public_cut", /\b(version autorisée|sans l'épilogue|sans épilogue)\b/],
  ],
  en: [
    ["broken_promise", /\b(screen everything|show everything|in full|full version|with the epilogue|whole film)\b/],
    ["sealed_archive", /\b(archives?|under seal|keep the film)\b/],
    ["public_cut", /\b(authori[sz]ed version|without the epilogue)\b/],
  ],
};
const CHOOSE: Record<VoiceLocale, RegExp> = {
  fr: /^(?:(?:euh|bon|alors|ok|oui)\s+)*(?:je (?:choisis|prends|veux|préfère)|on (?:choisit|prend)|choisissons|ce sera)\b/,
  en: /^(?:(?:uh|um|well|ok|yes)\s+)*(?:i (?:choose|pick|take|want|prefer)|we (?:choose|take)|let's (?:go with|choose)|i'll (?:go with|take))\b/,
};

/** An explicit choice of exactly one ending ("je choisis les archives"). It only SELECTS: the
 *  confirmation is a separate, explicit step. Questions, negations and ambiguity select nothing. */
export function endingFromSpeech(text: string, locale: VoiceLocale): string | null {
  if (/[?¿]/.test(text)) return null;
  const t = normalizeSpeech(text);
  if (BLOCK[locale].test(t) || !CHOOSE[locale].test(t)) return null;
  const hits = ENDINGS[locale].filter(([, re]) => re.test(t)).map(([id]) => id);
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
