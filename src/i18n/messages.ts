// Interface strings by locale. French is the complete reference (P0). Other locales are deep-merged
// over French: a missing key falls back to French until translated and reviewed (P1).
// No undiscovered canon here (this ships to the browser): documents come from the server.
export type Locale = "fr" | "en";
export const DEFAULT_LOCALE: Locale = "fr";
/** Locales offered to players. English joins once its content and e2e pass (agents are ready). */
export const ACTIVE_LOCALES: Locale[] = ["fr", "en"];
export const LOCALE_COOKIE = "afterimage_locale";

const fr = {
  common: { close: "Fermer", cancel: "Annuler", back: "Retour", home: "Accueil", loading: "Chargement…", serverDown: "Connexion au serveur impossible. Rien n’a été perdu ; réessayez." },
  home: {
    subtitle: "La dernière séance",
    pitch: "Deux personnes. Le même cinéma. Trente ans d’écart. Parlez-leur, gagnez leur confiance et faites traverser le temps à ce qui mérite d’être sauvé.",
    start: "Commencer", opening: "Ouverture…", resume: "Reprendre", settings: "Réglages", display: "Affichage",
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
    suggestion: "Proposition (mode répétition) :", talk: "Parler à {name}", micOn: "Micro ouvert", micOff: "Micro coupé", hangUp: "Terminer la conversation",
    micMute: "Couper le micro", micUnmute: "Activer le micro",
    stateRehearsal: "Répétition · simulé", stateIdle: "Hors conversation", stateConnecting: "Connexion…", stateListening: "À l’écoute", stateMuted: "Micro coupé", stateSpeaking: "{name} répond", stateClosing: "Fermeture…", stateError: "Conversation interrompue", stateAudio: "audio seul",
    history: "Historique", historyCount: "Historique ({n})", historyClose: "Fermer l’historique", historyLatest: "Revenir au dernier échange", historyEmpty: "Aucun échange pour l’instant.",
    toolNoServer: "Le serveur ne répond pas ; reste en personnage et propose de réessayer.", toolUnverified: "Je n’ai pas pu vérifier. Laisse-moi un instant.",
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
    reading: "Lecture…",
    photoTitle: "Photographie du Régina", photoDesc: "Une vieille photographie de la façade, posée sur le bureau.", photoTurn: "Retourner la photo", photoBackLabel: "Au verso, à la main :",
    photoRelay: "Transmettre cet indice à Jeanne", photoNot1996: "Jeanne, en 1996, ne connaît pas encore cette inscription. Passez en 1996 pour la lui transmettre.", photoOtherEra: "La photo se trouve dans la cabine de 2026.",
    waterTitle: "Trace d’humidité", waterDesc: "Le bois de l’armoire est marqué d’une ligne claire. Un dossier traîne à côté.", waterRead: "Lire le rapport de conservation",
    waterRelay: "Avertir Jeanne du risque d’eau", waterNot1996: "En 1996, personne ne sait encore ce que l’eau fera ici.",
    programmeTitle: "Programme de la séance", programmeDesc: "Un programme plié sur le bureau.", programmeRead: "Lire le programme",
    letterTitle: "Lettre d’Alice Mercier", letterDesc: "Une enveloppe ouverte, une lettre pliée en deux.", letterRead: "Lire la lettre", letterNeedProgramme: "Il faudrait d’abord savoir de quelle séance il s’agit.",
    acknowledge: "Je reconnais la condition d’Alice", acknowledged: "Vous avez reconnu la condition d’Alice.",
    hallTitle: "La salle", hallDesc: "Par la vitre, les fauteuils rouges dans la pénombre. Quelque part, la clé du dernier tour de salle.", hallSearch: "Demander à Jeanne d’aller chercher la clé à l’endroit indiqué", hallNeedClue: "Chercher où ? Il faudrait un indice précis.",
    cabinetTitle: "Armoire au croissant", cabinet1996: "Fermée à clé. La poignée en laiton a la forme d’un croissant de lune.", cabinetOpen: "Ouvrir l’armoire", cabinetNoKey: "« Il me manque la clé. Je l’avais pendant mon dernier tour de salle. »",
    cabinet2026: "Fermée depuis longtemps. Le bas du bois a souffert de l’eau.", cabinetLocked2026: "Fermée à clé. Il faudrait d’abord trouver la clé.",
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
    title: "Quelques mots pour dans trente ans", sealed: "Vos mots sont rangés avec le film. Pour d’autres mots, commencez une nouvelle partie.", needLetter: "Avant de laisser des mots avec le film, lisez ce qu’Alice a écrit.",
    label: "Écrivez ou dictez à Jeanne une phrase de 1 à {max} caractères.", save: "Relire mon message", draftCaption: "Vos mots, tels que Jeanne les gardera",
    confirmed: "Jeanne a gardé vos mots. Vous pouvez lui demander de tout ranger.", confirm: "Confier ces mots à Jeanne", note: "Toute modification annule l’accord, tant que le film n’est pas rangé.",
    edit: "Modifier", review: "Relisez : ce sont exactement les mots qui traverseront le temps.", saveFailed: "Vos mots n’ont pas pu être enregistrés. Votre texte est conservé ; réessayez.",
    defaultText: "Les étoiles restent allumées.",
  },
  ending: { title: "Que faire du film ?", intro: "Le film est sauvé. Il reste à décider comment le rendre au monde. Ce choix est définitif pour cette partie.", back: "Revenir aux choix", failed: "Choix impossible." },
  language: { label: "Langue" },
  auth: {
    signInTitle: "Se connecter", email: "Email", password: "Mot de passe", submit: "Se connecter", tooMany: "Trop de tentatives. Réessayez dans quelques minutes.", badCredentials: "Email ou mot de passe incorrect.",
    signInNote: "Les comptes sont créés sur invitation. Pour jouer sans compte :", signInNoteLink: "accueil → Commencer",
    inviteTitle: "Invitation", inviteEmail: "Email (celui de l’invitation)", inviteName: "Nom affiché", invitePassword: "Mot de passe (12 caractères minimum)", invitePassword2: "Confirmer le mot de passe",
    inviteSubmit: "Créer mon compte", inviteMismatch: "Les deux mots de passe diffèrent.", inviteInvalid: "Invitation invalide, expirée ou déjà utilisée (vérifiez l’email).", inviteTooMany: "Trop de tentatives.", inviteFailed: "Création du compte impossible (mot de passe de 12 caractères minimum).",
  },
};

export type Messages = typeof fr;
type DeepPartial<T> = { [K in keyof T]?: T[K] extends Record<string, unknown> ? DeepPartial<T[K]> : T[K] };

// English: complete interface translation (to be reviewed with a native speaker).
const en: DeepPartial<Messages> = {
  common: { close: "Close", cancel: "Cancel", back: "Back", home: "Home", loading: "Loading…", serverDown: "Cannot reach the server. Nothing was lost; please try again." },
  home: {
    subtitle: "The Last Screening",
    pitch: "Two people. The same cinema. Thirty years apart. Talk to them, earn their trust and carry across time what deserves to be saved.",
    start: "Start", opening: "Opening…", resume: "Resume", settings: "Settings", display: "Display",
    largeText: "Larger text", reduceMotion: "Reduce motion", settingsNote: "Subtitles are always shown. Everything can also be played with the keyboard.",
    noticeRehearsal: "Rehearsal mode: simulated characters, no Napster connection.",
    noticeLive: "Live video conversations with fictional AI-animated characters (Napster).",
    noticeMic: "The microphone is only requested when you talk; every action can also be done on screen.",
    signIn: "Sign in", admin: "Administration", privacy: "Privacy",
    marquee: "Le Régina", marqueeSub: "Last screening · 9:30 pm",
    facadeAlt: "The art deco façade of Le Régina, at night, in the rain",
    tooManyGuests: "Too many new games from this connection. Please try again later.", guestFailed: "Could not create a guest session.",
  },
  game: {
    episodeLabel: "Chapter one", episode: "The Last Screening", era: "Era",
    rehearsalBanner: "Rehearsal mode — no Napster call: the characters are simulated and their replies are written in advance.",
    objective: "Objective", hint: "Hint", words: "Your words", decide: "Decide the film's fate", quit: "Leave",
    deleteRun: "Delete my game", deleteConfirm: "Permanently erase this game?", deleteYes: "Delete", deleteFailed: "Deletion is not possible right now; please try again.",
    conflict: "The game changed in the meantime (another tab?). The state was reloaded: check before trying again.",
    actionImpossible: "Action not possible.", switching: "Moving to {era}…",
    epilogue: "Epilogue", facadeAlt: "The façade of Le Régina, at night, in the rain", anotherStory: "Another story",
    wordsCrossed: "Your words crossed thirty years: “{message}”", hintsUsed: "Hints requested: {n}. This game is over and remains viewable.",
    marquee: { public_cut: ["Les lumières du Régina", "A film by Alice Mercier"], sealed_archive: ["Régina Archives", "Kept under seal"], broken_promise: ["Les lumières du Régina", "Full version"] },
    notFoundTitle: "Game not found", notFoundText: "This game does not exist or does not belong to you.", expiredTitle: "Your session has expired", expiredText: "Start again from the home page.", backHome: "Back to home",
  },
  scene: {
    region: "Interactive set, projection booth, {era}", list: "Things to examine",
    alt1996: "Projection booth in 1996, warm light, projector on the left, desk in the middle, crescent cabinet on the right",
    alt2026: "The same booth in 2026, cold and dusty, projector on the left, desk, crescent cabinet on the right",
    hotspots: {
      photo: "Photograph on the desk", waterline: "Damp mark at the bottom of the cabinet", projector: "Behind the projector", cabinet: "Crescent cabinet",
      cache: "Cabinet's upper shelf", programme: "Screening programme on the desk", hall: "The hall, through the projection window", letter: "The letter in the cabinet", shelf: "Cabinet's upper shelf",
    },
    place: "Le Régina · projection booth", date1996: "15 November 1996 · 9:10 pm", date2026: "15 November 2026 · 9:10 pm",
  },
  character: {
    jeanne: { name: "Jeanne", role: "Projectionist — 1996" }, malik: { name: "Malik", role: "Archivist — 2026" },
    portraitAlt: "Reference portrait of {name}, a fictional character",
    badgeRehearsal: "Rehearsal mode · simulated character, no Napster connection", badgeLive: "Live", badgeLiveAudio: "Live · audio", badgeConnecting: "Connecting…", badgeClosing: "Closing…", badgeOffline: "Reference portrait · offline",
    subtitles: "Subtitles", emptyLive: "Talk to the character or write to them.", emptyRehearsal: "Write to the character, or examine the set.",
    suggestion: "Suggestion (rehearsal mode):", talk: "Talk to {name}", micOn: "Mic on", micOff: "Mic muted", hangUp: "End the conversation",
    micMute: "Mute the microphone", micUnmute: "Turn the microphone on",
    stateRehearsal: "Rehearsal · simulated", stateIdle: "Not in conversation", stateConnecting: "Connecting…", stateListening: "Listening", stateMuted: "Microphone muted", stateSpeaking: "{name} is answering", stateClosing: "Closing…", stateError: "Conversation interrupted", stateAudio: "audio only",
    history: "History", historyCount: "History ({n})", historyClose: "Close the history", historyLatest: "Back to the latest exchange", historyEmpty: "No exchange yet.",
    toolNoServer: "The server is not answering; stay in character and offer to try again.", toolUnverified: "I could not check. Give me a moment.",
    prepLabel: "Talk with the microphone", prepStrong: "The microphone is only used to talk to {name}.",
    prepText: "The game records neither your voice nor your camera. The conversation goes through Napster, live; once connected, you can also type. Without a microphone, every action remains possible on screen.",
    prepOnce: "You are only asked once: afterwards, “Talk to…” and era changes reconnect directly.",
    prepAllow: "Allow the microphone and talk", prepNoMic: "Continue without microphone",
    writeTo: "Write to {name}", writeToEllipsis: "Write to {name}…", writeWhenLive: "Start the conversation to write to {name}", send: "Send",
    lastExchanges: "Latest exchanges", you: "You", disclosure: "Fictional characters animated by AI.",
    micDenied: "Microphone denied: the live conversation needs the microphone. You can continue with the on-screen actions (set, notebook, buttons).",
    liveInterrupted: "The live conversation was interrupted. You can continue with the on-screen actions.",
    connectFailed: "Could not connect.", sdkFailed: "Could not start the conversation.",
  },
  notebook: { label: "The notebook", region: "Notebook", empty: "Still empty", emptyHint: "Examine the set: what you discover is written here.", count: "{n} clue", countPlural: "{n} clues" },
  inspector: {
    reading: "Reading…",
    photoTitle: "Photograph of Le Régina", photoDesc: "An old photograph of the façade, lying on the desk.", photoTurn: "Turn the photo over", photoBackLabel: "On the back, handwritten:",
    photoRelay: "Pass this clue on to Jeanne", photoNot1996: "Jeanne, in 1996, does not know this inscription yet. Go to 1996 to pass it on to her.", photoOtherEra: "The photo is in the 2026 booth.",
    waterTitle: "Damp mark", waterDesc: "The cabinet's wood bears a pale line. A file lies next to it.", waterRead: "Read the conservation report",
    waterRelay: "Warn Jeanne about the water risk", waterNot1996: "In 1996, nobody knows yet what the water will do here.",
    programmeTitle: "Screening programme", programmeDesc: "A folded programme on the desk.", programmeRead: "Read the programme",
    letterTitle: "Letter from Alice Mercier", letterDesc: "An open envelope, a letter folded in two.", letterRead: "Read the letter", letterNeedProgramme: "First we'd need to know which screening this is about.",
    acknowledge: "I acknowledge Alice's condition", acknowledged: "You acknowledged Alice's condition.",
    hallTitle: "The hall", hallDesc: "Through the window, the red seats in the half-light. Somewhere, the key from the last round of the hall.", hallSearch: "Ask Jeanne to look for the key at the place you gave", hallNeedClue: "Look where? A precise clue is needed.",
    cabinetTitle: "Crescent cabinet", cabinet1996: "Locked. The brass handle is shaped like a crescent moon.", cabinetOpen: "Open the cabinet", cabinetNoKey: "“I'm missing the key. I had it during my last round of the hall.”",
    cabinet2026: "Locked for a long time. The bottom of the wood has suffered from water.", cabinetLocked2026: "Locked. The key must be found first.",
    projectorTitle: "The projector", projectorDesc: "The old 35 mm projector, covered in dust.", projectorSearch: "Look behind the projector", projectorNothing: "Nothing special behind the projector, for now.",
    shelfTitle: "Put it safely away", shelfSealed: "The reel, the letter and your words are put away. See your notebook.", shelfAsk: "Jeanne can put the reel, the letter and your message away for thirty years. Where?",
    shelfLocation: "Location", shelfStore: "Ask Jeanne to put everything here", shelfMissing: "Something is still missing before putting everything away. The hint can guide you.", shelfWrite: "Write your words",
    locations: { upper_cabinet: "Cabinet's upper shelf", lower_cabinet: "Bottom of the cabinet", desk: "On the desk", floor: "On the floor, under the desk" },
    cacheTitle: "What Jeanne left", cacheReel: "The reel “Les lumières du Régina”", cacheEnvelope: "A sealed envelope", cachePaper: "A folded piece of paper",
    cacheMessageCaption: "Your message, thirty years later", cacheUnfold: "Unfold the paper", cacheReadLetter: "Read the letter in the envelope",
    messageTitle: "Your message", keyTitle: "Crescent key", keyDesc: "A small brass key. It opens the crescent cabinet.",
    reelTitle: "The reel", reelDesc: "“Les lumières du Régina”, a film by Alice Mercier. Thirty years kept dry.", envelopeTitle: "Sealed envelope", envelopeDesc: "It held Alice's letter.",
  },
  composer: {
    title: "A few words for thirty years from now", sealed: "Your words are stored with the film. For other words, start a new game.", needLetter: "Before leaving words with the film, read what Alice wrote.",
    label: "Write or dictate to Jeanne a sentence of 1 to {max} characters.", save: "Review my message", draftCaption: "Your words, as Jeanne will keep them",
    confirmed: "Jeanne kept your words. You can ask her to put everything away.", confirm: "Leave these words with Jeanne", note: "Any change cancels the agreement, until the film is put away.",
    edit: "Edit", review: "Read it again: these are exactly the words that will cross time.", saveFailed: "Your words could not be saved. Your text is kept; try again.",
    defaultText: "The stars stay lit.",
  },
  ending: { title: "What to do with the film?", intro: "The film is saved. It remains to decide how to give it back to the world. This choice is final for this game.", back: "Back to the choices", failed: "Choice not possible." },
  auth: {
    signInTitle: "Sign in", email: "Email", password: "Password", submit: "Sign in", tooMany: "Too many attempts. Please try again in a few minutes.", badCredentials: "Incorrect email or password.",
    signInNote: "Accounts are created by invitation. To play without an account:", signInNoteLink: "home → Start",
    inviteTitle: "Invitation", inviteEmail: "Email (the invited one)", inviteName: "Display name", invitePassword: "Password (12 characters minimum)", invitePassword2: "Confirm the password",
    inviteSubmit: "Create my account", inviteMismatch: "The two passwords differ.", inviteInvalid: "Invalid, expired or already used invitation (check the email).", inviteTooMany: "Too many attempts.", inviteFailed: "Could not create the account (12-character minimum password).",
  },
  language: { label: "Language" },
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
