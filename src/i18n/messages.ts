// Interface strings by locale. French is the complete reference (P0). Other locales are deep-merged
// over French: a missing key falls back to French until translated and reviewed (P1).
// No undiscovered canon here (this ships to the browser): documents come from the server.
export type Locale = "fr" | "en";
export const DEFAULT_LOCALE: Locale = "fr";
/** Locales offered to players. English joins once its content and e2e pass (agents are ready). */
export const ACTIVE_LOCALES: Locale[] = ["fr"];
export const LOCALE_COOKIE = "afterimage_locale";

const fr = {
  common: { close: "Fermer", cancel: "Annuler", back: "Retour", home: "Accueil", loading: "Chargement…", serverDown: "Connexion au serveur impossible. Rien n’a été perdu ; réessayez." },
  home: {
    subtitle: "La dernière séance",
    pitch: "Deux personnes. Le même cinéma. Trente ans d’écart. Parlez-leur, gagnez leur confiance et faites traverser le temps à ce qui mérite d’être sauvé.",
    start: "Commencer", opening: "Ouverture…", resume: "Reprendre", settings: "Réglages",
    largeText: "Texte plus grand", reduceMotion: "Réduire les animations", settingsNote: "Les sous-titres sont toujours affichés. Tout se joue aussi au clavier.",
    noticeRehearsal: "Mode répétition : personnages simulés, sans connexion Napster.",
    noticeLive: "Conversations vidéo en direct avec des personnages fictifs animés par IA (Napster).",
    noticeMic: "Le micro n’est demandé qu’au moment de parler ; toutes les actions se font aussi à l’écran.",
    signIn: "Se connecter", admin: "Administration", privacy: "Confidentialité",
    marquee: "Le Régina", marqueeSub: "Dernière séance · 21 h 30",
    facadeAlt: "La façade art déco du Régina, la nuit, sous la pluie",
    tooManyGuests: "Trop de nouvelles parties depuis cette connexion. Réessayez plus tard.", guestFailed: "Impossible de créer une session invitée.",
  },
  game: {
    episodeLabel: "Chapitre premier", episode: "La dernière séance", era: "Époque",
    rehearsalBanner: "Mode répétition — aucun appel Napster : les personnages sont simulés et les réponses sont écrites à l’avance.",
    objective: "Objectif", hint: "Aide", words: "Vos mots", decide: "Décider du sort du film", quit: "Quitter",
    deleteRun: "Supprimer ma partie", deleteConfirm: "Effacer définitivement cette partie ?", deleteYes: "Supprimer", deleteFailed: "Suppression impossible pour l’instant ; réessayez.",
    conflict: "La partie a changé entre-temps (autre onglet ?). L’état a été rechargé : vérifiez avant de recommencer.",
    actionImpossible: "Action impossible.", switching: "Passage vers {era}…",
    epilogue: "Épilogue", facadeAlt: "La façade du Régina, la nuit, sous la pluie", anotherStory: "Une autre histoire",
    wordsCrossed: "Vos mots ont traversé trente ans : « {message} »", hintsUsed: "Aides demandées : {n}. Cette partie est terminée et reste consultable.",
    marquee: { public_cut: ["Les lumières du Régina", "Un film d’Alice Mercier"], sealed_archive: ["Archives du Régina", "Conservé sous scellés"], broken_promise: ["Les lumières du Régina", "Version intégrale"] } as Record<string, [string, string]>,
    notFoundTitle: "Partie introuvable", notFoundText: "Cette partie n’existe pas ou ne vous appartient pas.", expiredTitle: "Votre session a expiré", expiredText: "Reprenez depuis l’accueil.", backHome: "Retour à l’accueil",
  },
  scene: {
    region: "Décor interactif, cabine de projection, {era}", list: "Éléments à examiner",
    alt1996: "Cabine de projection en 1996, lumière chaude, projecteur à gauche, bureau au centre, armoire au croissant à droite",
    alt2026: "La même cabine en 2026, froide et poussiéreuse, projecteur à gauche, bureau, armoire au croissant à droite",
    hotspots: {
      photo: "Photographie sur le bureau", waterline: "Trace d’humidité au bas de l’armoire", projector: "Derrière le projecteur", cabinet: "Armoire au croissant",
      cache: "Étagère haute de l’armoire", programme: "Programme de la séance sur le bureau", hall: "La salle, par la vitre de projection", letter: "La lettre dans l’armoire", shelf: "Étagère haute de l’armoire",
    } as Record<string, string>,
    place: "Le Régina · cabine de projection", date1996: "15 novembre 1996 · 21 h 10", date2026: "15 novembre 2026 · 21 h 10",
  },
  character: {
    jeanne: { name: "Jeanne", role: "Projectionniste — 1996" }, malik: { name: "Malik", role: "Archiviste — 2026" },
    portraitAlt: "Portrait de référence de {name}, personnage fictif",
    badgeRehearsal: "Mode répétition · personnage simulé, sans connexion Napster", badgeLive: "En direct", badgeLiveAudio: "En direct · audio", badgeConnecting: "Connexion…", badgeClosing: "Fermeture…", badgeOffline: "Portrait de référence · hors ligne",
    subtitles: "Sous-titres", emptyLive: "Parlez au personnage ou écrivez-lui.", emptyRehearsal: "Écrivez au personnage, ou examinez le décor.",
    suggestion: "Proposition (mode répétition) :", talk: "Parler à {name}", micOn: "Micro ouvert", micOff: "Micro coupé", hangUp: "Raccrocher",
    prepLabel: "Parler avec le micro",
    prepOnce: "Cette question n’est posée qu’une fois : ensuite, « Parler à… » et les changements d’époque relancent directement la conversation.", prepStrong: "Le micro sert uniquement à parler à {name}.",
    prepText: "Le jeu n’enregistre ni votre voix ni votre caméra. La conversation passe par Napster, en direct ; une fois connecté, vous pourrez aussi écrire. Sans micro, toutes les actions restent possibles à l’écran.",
    prepAllow: "Autoriser le micro et parler", prepNoMic: "Continuer sans micro",
    writeTo: "Écrire à {name}", writeToEllipsis: "Écrire à {name}…", writeWhenLive: "Lancez la conversation pour écrire à {name}", send: "Envoyer",
    lastExchanges: "Derniers échanges", you: "Vous", disclosure: "Personnages fictifs animés par IA.",
    micDenied: "Micro refusé : la conversation en direct demande le micro. Vous pouvez continuer avec les actions à l’écran (décor, carnet, boutons).",
    liveInterrupted: "La conversation en direct s’est interrompue. Vous pouvez continuer avec les actions à l’écran.",
    connectFailed: "Connexion impossible.", sdkFailed: "Impossible d’initialiser la conversation.",
  },
  notebook: { label: "Le carnet", region: "Carnet", empty: "Encore vide", emptyHint: "Examinez le décor : ce que vous découvrez s’inscrit ici.", count: "{n} trace", countPlural: "{n} traces" },
  inspector: {
    photoTitle: "Photographie du Régina", photoDesc: "Une vieille photographie de la façade, posée sur le bureau.", photoTurn: "Retourner la photo", photoBackLabel: "Au verso, à la main :",
    photoRelay: "Transmettre cet indice à Jeanne", photoNot1996: "Jeanne, en 1996, ne connaît pas encore cette inscription. Passez en 1996 pour la lui transmettre.", photoOtherEra: "La photo se trouve dans la cabine de 2026.",
    waterTitle: "Trace d’humidité", waterDesc: "Le bois de l’armoire est marqué d’une ligne claire. Un dossier traîne à côté.", waterRead: "Lire le rapport de conservation",
    waterRelay: "Avertir Jeanne du risque d’eau", waterNot1996: "En 1996, personne ne sait encore ce que l’eau fera ici.",
    programmeTitle: "Programme de la séance", programmeDesc: "Un programme plié sur le bureau.", programmeRead: "Lire le programme",
    letterTitle: "Lettre d’Alice Mercier", letterDesc: "Une enveloppe ouverte, une lettre pliée en deux.", letterRead: "Lire la lettre", letterNeedProgramme: "Il faudrait d’abord savoir de quelle séance il s’agit.",
    acknowledge: "Je reconnais la condition d’Alice", acknowledged: "Vous avez reconnu la condition d’Alice.",
    hallTitle: "La salle", hallDesc: "Par la vitre, les fauteuils rouges dans la pénombre. Quelque part, la clé du dernier tour de salle.", hallSearch: "Demander à Jeanne d’aller chercher la clé à l’endroit indiqué", hallNeedClue: "Chercher où ? Il faudrait un indice précis.",
    cabinetTitle: "Armoire au croissant", cabinet1996: "Fermée à clé. La poignée en laiton a la forme d’un croissant de lune.", cabinetOpen: "Ouvrir l’armoire", cabinetNoKey: "« Il me manque la clé. Je l’avais pendant mon dernier tour de salle. »",
    cabinet2026: "Fermée depuis longtemps. Le bas du bois a souffert de l’eau.", cabinetSearch2026: "Chercher si quelque chose a changé",
    projectorTitle: "Le projecteur", projectorDesc: "Le vieux projecteur 35 mm, couvert de poussière.", projectorSearch: "Chercher derrière le projecteur", projectorNothing: "Rien de particulier derrière le projecteur, pour l’instant.",
    shelfTitle: "Mettre à l’abri", shelfSealed: "La bobine, la lettre et vos mots sont rangés. Voyez votre carnet.", shelfAsk: "Jeanne peut ranger la bobine, la lettre et votre message pour trente ans. Où ?",
    shelfLocation: "Emplacement", shelfStore: "Demander à Jeanne de tout ranger ici", shelfMissing: "Il manque encore quelque chose avant de tout ranger. L’aide peut vous orienter.", shelfWrite: "Écrire vos mots",
    locations: { upper_cabinet: "Étagère haute de l’armoire", lower_cabinet: "Bas de l’armoire", desk: "Sur le bureau", floor: "Au sol, sous le bureau" } as Record<string, string>,
    cacheTitle: "Ce que Jeanne a laissé", cacheReel: "La bobine « Les lumières du Régina »", cacheEnvelope: "Une enveloppe scellée", cachePaper: "Un papier plié",
    cacheMessageCaption: "Votre message, trente ans plus tard", cacheUnfold: "Déplier le papier", cacheReadLetter: "Lire la lettre de l’enveloppe",
    messageTitle: "Votre message", keyTitle: "Clé au croissant", keyDesc: "Une petite clé en laiton. Elle ouvre l’armoire au croissant.",
    reelTitle: "La bobine", reelDesc: "« Les lumières du Régina », un film d’Alice Mercier. Trente ans au sec.", envelopeTitle: "Enveloppe scellée", envelopeDesc: "Elle contenait la lettre d’Alice.",
  },
  composer: {
    title: "Vos mots, pour dans trente ans", sealed: "Le message est scellé avec le film. Pour d’autres mots, commencez une nouvelle partie.", needLetter: "Avant de laisser des mots avec le film, lisez ce qu’Alice a écrit.",
    label: "Écrivez ou dictez à Jeanne une phrase de 1 à {max} caractères.", save: "Enregistrer ce brouillon", draftCaption: "Brouillon conservé par le jeu (exactement ces mots)",
    confirmed: "Confirmé, mot pour mot. Vous pouvez demander à Jeanne de tout ranger.", confirm: "Je confirme ces mots exacts", note: "Toute modification annule la confirmation, tant que le film n’est pas rangé.",
    defaultText: "Les étoiles restent allumées.",
  },
  ending: { title: "Que faire du film ?", intro: "Le film est sauvé. Il reste à décider comment le rendre au monde. Ce choix est définitif pour cette partie.", back: "Revenir aux choix", failed: "Choix impossible." },
  auth: {
    signInTitle: "Se connecter", email: "Email", password: "Mot de passe", submit: "Se connecter", tooMany: "Trop de tentatives. Réessayez dans quelques minutes.", badCredentials: "Email ou mot de passe incorrect.",
    signInNote: "Les comptes sont créés sur invitation. Pour jouer sans compte :", signInNoteLink: "accueil → Commencer",
    inviteTitle: "Invitation", inviteEmail: "Email (celui de l’invitation)", inviteName: "Nom affiché", invitePassword: "Mot de passe (12 caractères minimum)", invitePassword2: "Confirmer le mot de passe",
    inviteSubmit: "Créer mon compte", inviteMismatch: "Les deux mots de passe diffèrent.", inviteInvalid: "Invitation invalide, expirée ou déjà utilisée (vérifiez l’email).", inviteTooMany: "Trop de tentatives.", inviteFailed: "Création du compte impossible (mot de passe de 12 caractères minimum).",
  },
};

export type Messages = typeof fr;
type DeepPartial<T> = { [K in keyof T]?: T[K] extends Record<string, unknown> ? DeepPartial<T[K]> : T[K] };

// English: interface strings translated; to be reviewed with the English content pass.
const en: DeepPartial<Messages> = {
  common: { close: "Close", cancel: "Cancel", back: "Back", home: "Home", loading: "Loading…", serverDown: "Cannot reach the server. Nothing was lost; please try again." },
  home: { start: "Start", resume: "Resume", settings: "Settings", signIn: "Sign in", privacy: "Privacy" },
  game: { objective: "Objective", hint: "Hint", words: "Your words", quit: "Leave", deleteRun: "Delete my game" },
};

function merge<T extends Record<string, unknown>>(base: T, over: DeepPartial<T> | undefined): T {
  if (!over) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = base[k as keyof T];
    out[k] = v && typeof v === "object" && !Array.isArray(v) && b && typeof b === "object" ? merge(b as Record<string, unknown>, v as never) : v;
  }
  return out as T;
}

export function messagesFor(locale: Locale): Messages {
  return locale === "fr" ? fr : merge(fr, en);
}

/** "{name}" placeholders. Values are plain text (React escapes them). */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

export function pickLocale(cookie: string | undefined | null): Locale {
  return ACTIVE_LOCALES.includes(cookie as Locale) ? (cookie as Locale) : DEFAULT_LOCALE;
}
