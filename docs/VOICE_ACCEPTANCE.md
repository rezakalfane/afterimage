# Recette vocale — vrai micro (≈ 20 min, ≈ 1 à 2 $ de crédits)

> [!WARNING]
> **Alerte spoiler :** Cette procédure de recette détaille les étapes de l'enquête, les choix finaux et certains éléments cachés du jeu. Jouez d'abord si vous ne souhaitez pas vous gâcher la découverte !

Ce qui est déjà prouvé sans vous : la reconnaissance des phrases (tests unitaires `tests/unit/voice.test.ts`),
la liaison de la confirmation à l'étape affichée, les trois fins, la fermeture des sessions. Ce qui ne peut
être prouvé qu'avec **votre voix et un vrai micro** : la transcription réelle (accent, bruit, voix de
l'avatar dans les haut-parleurs) et le comportement de bout en bout.

## Préparation (2 min)
1. `npm run dev` (mode live), Chrome, **haut-parleurs (pas de casque)** pour que la voix de l'avatar soit audible par le micro.
2. Ouvrez `http://localhost:3000/?voicedebug=1`, puis **Commencer** ; gardez `?voicedebug=1` dans l'URL de la partie
   (`…/play/run_…?voicedebug=1`). Un petit panneau en haut à droite affiche chaque phrase **finale** entendue et la décision.
3. Préparez une partie jusqu'au message : dans 2026 « Malik, regarde la photo » et « le bas de l'armoire » ;
   en 1996 parlez de la note de la photo, demandez leur place habituelle, faites lire le programme, proposez le siège
   que vous en déduisez, demandez la clé, l'armoire, la lettre, dites « j'accepte la condition d'Alice », avertissez de l'eau, puis dictez : « Jeanne, note : les étoiles restent allumées ».

## Message personnel — la feuille « Quelques mots pour dans trente ans » est affichée
Dites chaque phrase, attendez la ligne du panneau, notez le résultat.

| # | Dites | Attendu |
|---|---|---|
| 1 | « Si je dis je confirme, que se passe-t-il ? » | ignoré |
| 2 | « Je ne confirme pas. » | ignoré |
| 3 | « Oui… attends. » | ignoré |
| 4 | « Le personnage a dit je confirme. » | ignoré |
| 5 | (bruit : musique ou TV à bas volume, 10 s sans parler) | rien |
| 6 | « Euh… oui, je confirme. » | **CONFIRMÉ : message** ; « Jeanne a gardé vos mots » ; la feuille se ferme ~2 s après |
| 7 | Rouvrez « Vos mots », Modifier, changez un mot, Relire, puis « je confirme » | CONFIRMÉ sur le **nouveau** texte uniquement |
| 8 | Pendant que l'avatar dit lui-même une phrase contenant « je confirme » | ignoré (seules vos transcriptions comptent) |

## Choix final — fenêtre « Que faire du film ? »
| # | Dites | Attendu |
|---|---|---|
| 8b | Fenêtre fermée, après la lettre : « Décidons. » / “Let's decide.” | la fenêtre « Que faire du film ? » s'ouvre, rien n'est choisi |
| 9 | « Les archives ou la version autorisée ? » | ignoré (ambigu) |
| 10 | « Je choisis la version autorisée. » ou, fenêtre ouverte, « La version autorisée » / « Allons-y pour les archives » | sélection seulement, **pas** de fin ; dire une autre option change la sélection |
| 10b | « Qu'en penses-tu, les archives ? » / « Je pense aux archives » | rien n'est sélectionné (discussion) |
| 11 | « Si je confirme, c'est définitif ? » | ignoré |
| 12 | « Je confirme ce choix. » (ou « La version autorisée, je confirme » une fois sélectionnée) | CONFIRMÉ du premier coup → Malik dit sa dernière phrase **en entier**, puis l'épilogue |
| 12b | « Je confirme » sans option choisie | rien n'est validé ; un message demande de choisir d'abord |

## Anglais (FR|EN → EN, nouvelle partie ou même partie)
Refaites 1, 2, 3, 6, 10, 12 avec : “If I say I confirm, what happens?”, “I don't confirm.”, “Yes… wait.”,
“Um, yes, I confirm.”, “I choose the authorised version.”, “I confirm this choice.”

## Changer d'époque à la voix
| # | Dites | Attendu |
|---|---|---|
| 13 | En 1996 : « 2026 » | époque → 2026 ; Jeanne raccroche, Malik se connecte |
| 14 | En 2026 : « On retourne en 1996 » | époque → 1996 |
| 15 | En 1996 : « Je viens de 2026 » | **pas** de changement (Jeanne l'entend comme une affirmation) |
| 16 | « Que s'est-il passé en 2026 ? » | pas de changement |

## Fermer une fenêtre à la voix
| # | Dites | Attendu |
|---|---|---|
| 17 | Photo ouverte : « Ok » / « D'accord » / “Got it” | la fenêtre se ferme |
| 18 | Feuille du message en relecture : « Ok » | rien (ni fermeture ni confirmation) ; « Fermer » la ferme sans confirmer |
| 19 | « Ok, montre-moi le verso » | pas une fermeture (le personnage répond normalement) |

## Montrer un document à la voix
| # | Dites | Attendu |
|---|---|---|
| 20 | En 1996, photo déjà vue : « J'ai une photo à vous montrer » | la fenêtre de la photo s'ouvre ; Jeanne réagit à ce que vous dites |
| 21 | « Je n'ai pas de photo » | rien ne s'ouvre |
| 21b | En 1996 : « Regardez, j'ai un rapport à vous montrer » | le rapport s'ouvre **et** est montré à Jeanne (comme le bouton) ; elle réagit à son contenu |

## Ouvrir la feuille des mots, confirmer naturellement
| # | Dites | Attendu |
|---|---|---|
| 22 | En 1996, après la lettre : « Oui, je veux laisser un message » | la feuille « Quelques mots pour dans trente ans » s'ouvre |
| 23 | Feuille en relecture : « Je confirme ces mots, c'est parfait » | CONFIRMÉ (une seule fois suffit) |
| 24 | « Je confirme ces mots mais change le dernier » | non confirmé ; un message vous invite à dire simplement « Je confirme » |

## Regarder un lieu à la voix
| # | Dites | Attendu |
|---|---|---|
| 25 | En 2026 : « Regardons le bas de l'armoire » / « Je veux juste voir le bas abîmé » | la fenêtre « Trace d'humidité » s'ouvre et le rapport est lu ; Malik n'essaie pas d'ouvrir l'armoire |
| 26 | « Examinons la lampe » / « Montre-moi le projecteur » | la fenêtre du lieu s'ouvre |
| 27 | « Le bas de l'armoire est abîmé » (sans verbe de regard) | rien ne s'ouvre |

## Contrôles finaux
- Après l'épilogue, `npm run ops:napster-usage` : aucune session `afterimage` ouverte.
- Focus : fermez une fenêtre à la souris → pas d'anneau doré sur l'objet ; avec Échap → anneau visible.
- Une lettre ouverte par la voix reste ouverte tant que vous la lisez.

## Arrêt, silence, coffre
| # | Dites / faites | Attendu |
|---|---|---|
| 16 | Pendant qu'il parle : « Attends » / « Arrête » / « OK, stop » / « Stop please » | la voix s'arrête tout de suite ; au plus un « Je vous écoute » |
| 17 | Pendant qu'il parle : « Attends, je regarde la photo » | **pas** un arrêt : phrase normale, il répond |
| 18 | Ne rien dire ~45 s (micro ouvert, aucune fenêtre) | quelques mots drôles, très courts ; 3 fois au plus par conversation |
| 19 | En 1996, photo vue et note partagée, ne pas trouver la place pendant ~90 s | Jeanne suggère de lui demander de fouiller dans sa mémoire (sans donner la rangée) |
| 20 | « Regardons le coffre vert » | la fenêtre du coffre (fermé, sans rapport avec l'histoire) ; le personnage le sait inerte |
| 21 | Confirmer la fin | le personnage termine sa **dernière phrase en entier**, puis l'épilogue |

## À me renvoyer
Une capture du panneau `voicedebug` après chaque bloc, et pour chaque ligne : OK / KO (+ ce qui a été transcrit
si KO). Si une transcription est systématiquement fausse (accent, bruit), je l'ajusterai ; je ne valide rien sur
une simple ressemblance.
