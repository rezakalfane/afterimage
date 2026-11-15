# Composition du contexte, côté serveur exclusivement

1. Charger le prompt système du personnage ; il est immuable et partagé sans données joueur.
2. Ajouter les faits initiaux autorisés de ce personnage. `data/characters.json` est une bible serveur : ne pas injecter aveuglément `privateCanon`, `unknown`, `disclosures` ou l'objet entier dans le modèle.
3. Construire `characterView` depuis le snapshot serveur validé et ajouter les disclosures dont le flag est acquis. Jeanne reçoit le texte de la lettre après `letter_read` ; Malik seulement après `future_letter_read`. Jeanne ne reçoit pas les décisions finales de 2026.
4. Calculer les actions disponibles à partir du moteur. Un flag acquis ne suffit pas : vérifier l'époque, la phase, les prérequis et le canal autorisé.
5. Ajouter les faits réellement partagés à ce personnage, le dernier résultat d'action et le résumé de conversation de CETTE partie. Les souvenirs générés librement sont étiquetés comme déclarations, pas comme vérité du monde.
6. Encapsuler texte joueur et documents non fiables dans un champ données. Ne pas construire un nouveau rôle système à partir d'une transcription. Les preuves canoniques restent des champs séparés.
7. Limiter le contexte à quelques Ko, conserver les règles critiques et le dernier état. Ne pas tronquer au hasard le prompt en fin de chaîne. Mesurer la limite réelle du modèle/SDK sélectionné.
8. Injecter selon les mécanismes documentés et testés. `set_settings` peut remplacer l'instruction entière : reconstituer le prompt complet si cette méthode est utilisée. Ne jamais modifier le prompt GLOBAL d'un agent partagé pour une partie.

Pas d'API inventée de « préremplissage mémoire ». Les seeds sont des données de l'application ; la mémoire Napster éventuelle utilise les identités isolées et n'est pas la base autoritaire.

Le fichier `technical/world-engine.mjs` fournit une projection minimale des faits. Le contrôleur final doit ajouter les textes canoniques conditionnels, actions disponibles, résumés bornés et validation runtime, puis tester les projections par snapshots sans secret prématuré.

Après reconnexion : reconstruire depuis DB, même génération d'identité ; après nouvelle partie : nouvel ID. Ne pas rejouer tous les appels d'outils historiques comme s'ils étaient nouveaux. Après reset, ne pas réutiliser l'identité dont la mémoire fournisseur contient encore l'ancien récit.
