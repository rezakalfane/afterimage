import "server-only";
// English versions of the server's public error messages. Server code throws HttpError with the
// French text (the reference locale); the route handler swaps it for the caller's locale here.
// tests/unit/error-texts.test.ts fails if a French message thrown in src/ has no entry.
import type { Locale } from "@/i18n/messages";
import type { ErrorCode } from "./http";

export const ERROR_TEXTS_EN: Record<string, string> = {
  "Aucun accès actif.": "No active access.",
  "Beaucoup de demandes en ce moment. Réessayez dans quelques secondes.": "Many requests right now. Try again in a few seconds.",
  "Cette commande a déjà été utilisée avec d’autres paramètres.": "This command was already used with other parameters.",
  "Cette conversation n’est plus active.": "This conversation is no longer active.",
  "Commande invalide.": "Invalid command.",
  "Confirmation expirée ou déjà utilisée. Recommencez le choix.": "Confirmation expired or already used. Make the choice again.",
  "Connexion nécessaire.": "Please sign in.",
  "Conversation en direct désactivée (mode répétition).": "Live conversation is off (rehearsal mode).",
  "Conversation en direct indisponible dans cette langue.": "Live conversation is not available in this language.",
  "Corps JSON invalide.": "Invalid JSON body.",
  "Email ou rôle invalide.": "Invalid email or role.",
  "expectedRevision manquant.": "Missing expectedRevision.",
  "La conversation a été annulée.": "The conversation was cancelled.",
  "La conversation en direct est indisponible. Vous pouvez continuer au clavier.": "Live conversation is unavailable. You can continue with the keyboard.",
  "La fin se confirme via /ending.": "The ending is confirmed through /ending.",
  "La partie a changé depuis votre choix.": "The game changed since your choice.",
  "La partie a changé entre-temps.": "The game changed in the meantime.",
  "Le fournisseur n’a plus de place de conversation. Réessayez bientôt.": "The provider has no conversation slot left. Try again soon.",
  "Lisez d’abord le message et la lettre retrouvés.": "First read the recovered message and letter.",
  "Seul l’owner peut inviter un admin.": "Only the owner can invite an admin.",
  "Terminez d’abord la conversation en cours.": "First end the current conversation.",
  "Toutes les places de conversation de cet espace sont occupées.": "All conversation slots of this space are taken.",
  "Toutes les places de conversation sont occupées. Réessayez dans un instant ; en attendant, toutes les actions restent possibles à l’écran.":
    "All conversation slots are taken. Try again in a moment; meanwhile every action remains available on screen.",
  "Un instant…": "One moment…",
  "Une conversation est déjà ouverte pour cette partie (autre onglet ?).": "A conversation is already open for this game (another tab?).",
  "Vous avez déjà plusieurs parties en cours. Reprenez-en une ou supprimez-la.": "You already have several games in progress. Resume or delete one.",
  "Vous ne pouvez pas vous retirer vous-même.": "You cannot remove yourself.",
  "Une erreur inattendue est survenue.": "An unexpected error occurred.",
  "Cette partie utilise une version précédente du chapitre. Elle reste consultable ; commencez une nouvelle partie pour jouer la version actuelle.": "This game uses a previous version of the chapter. It stays saved; start a new game to play the current version.",
};

/** The public message in the caller's locale (unknown or already-English texts pass through). */
export function localizeError(message: string | null | undefined, locale: Locale): string | null {
  if (message == null) return null;
  return locale === "en" ? (ERROR_TEXTS_EN[message] ?? message) : message;
}

// Fallback texts for codes thrown without their own message, so the player never sees a bare "Erreur".
const DEFAULT_FR: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Connexion nécessaire.",
  FORBIDDEN: "Action non autorisée.",
  NOT_FOUND: "Introuvable.",
  BAD_ORIGIN: "Requête refusée : ouvrez le jeu depuis son adresse habituelle, puis rechargez la page.",
  PAYLOAD_TOO_LARGE: "Message trop volumineux.",
  INVALID_ARGUMENT: "Commande invalide.",
  REVISION_CONFLICT: "La partie a changé entre-temps.",
  IDEMPOTENCY_MISMATCH: "Cette commande a déjà été utilisée avec d’autres paramètres.",
  LEASE_INVALID: "Cette conversation n’est plus active.",
  CONVERSATION_ACTIVE: "Une conversation est déjà ouverte pour cette partie (autre onglet ?).",
  CAPACITY_FULL: "Toutes les places de conversation sont occupées. Réessayez dans un instant.",
  RATE_LIMITED: "Beaucoup de demandes en ce moment. Réessayez dans quelques secondes.",
  PROVIDER_UNAVAILABLE: "Le service de conversation est indisponible. Réessayez bientôt.",
  LIVE_DISABLED: "Conversation en direct désactivée.",
  QUOTA_EXCEEDED: "Limite atteinte. Réessayez plus tard.",
  RUN_FINISHED: "Cette partie est terminée.",
  VERSION_RETIRED: "Cette partie utilise une version précédente du chapitre.",
  INTERNAL: "Une erreur inattendue est survenue.",
};
const DEFAULT_EN: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Please sign in.",
  FORBIDDEN: "Action not allowed.",
  NOT_FOUND: "Not found.",
  BAD_ORIGIN: "Request refused: open the game from its usual address, then reload the page.",
  PAYLOAD_TOO_LARGE: "Message too large.",
  INVALID_ARGUMENT: "Invalid command.",
  REVISION_CONFLICT: "The game changed in the meantime.",
  IDEMPOTENCY_MISMATCH: "This command was already used with other parameters.",
  LEASE_INVALID: "This conversation is no longer active.",
  CONVERSATION_ACTIVE: "A conversation is already open for this game (another tab?).",
  CAPACITY_FULL: "All conversation slots are taken. Try again in a moment.",
  RATE_LIMITED: "Many requests right now. Try again in a few seconds.",
  PROVIDER_UNAVAILABLE: "The conversation service is unavailable. Try again soon.",
  LIVE_DISABLED: "Live conversation is off.",
  QUOTA_EXCEEDED: "Limit reached. Try again later.",
  RUN_FINISHED: "This game is finished.",
  VERSION_RETIRED: "This game uses a previous version of the chapter.",
  INTERNAL: "An unexpected error occurred.",
};

/** The message to send: the thrown one in the caller's locale, else the default for the code. */
export function publicErrorMessage(code: ErrorCode, message: string | null | undefined, locale: Locale): string {
  return localizeError(message, locale) ?? (locale === "en" ? DEFAULT_EN[code] : DEFAULT_FR[code]);
}
