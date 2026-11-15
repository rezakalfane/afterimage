# Recette vocale — vrai micro (≈ 20 min, ≈ 1 à 2 $ de crédits)

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
| 9 | « Les archives ou la version autorisée ? » | ignoré (ambigu) |
| 10 | « Je choisis la version autorisée. » | sélection seulement, **pas** de fin |
| 11 | « Si je confirme, c'est définitif ? » | ignoré |
| 12 | « Je confirme ce choix. » | CONFIRMÉ : fin public_cut → épilogue ; la conversation se ferme |

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

## Contrôles finaux
- Après l'épilogue, `npm run ops:napster-usage` : aucune session `afterimage` ouverte.
- Focus : fermez une fenêtre à la souris → pas d'anneau doré sur l'objet ; avec Échap → anneau visible.
- Une lettre ouverte par la voix reste ouverte tant que vous la lisez.

## À me renvoyer
Une capture du panneau `voicedebug` après chaque bloc, et pour chaque ligne : OK / KO (+ ce qui a été transcrit
si KO). Si une transcription est systématiquement fausse (accent, bruit), je l'ajusterai ; je ne valide rien sur
une simple ressemblance.
