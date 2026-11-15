# Contenu narratif (à remplir par l'équipe scénario)

Tout ce qui est raconté ou montré vit ici et dans `public/`. Le code lit ces fichiers ; il n'y a pas de texte d'histoire en dur dans `src/`.

| Fichier | Contenu | Après modification |
|---|---|---|
| `characters/<id>.json` | Identité du personnage : nom, voix, avatar, phrase d'ouverture, outils | `npm run provision` |
| `characters/<id>.prompt.md` | La personnalité et les règles du personnage (son « script ») | `npm run provision` |
| `world.json` | Les époques, les lieux où l'on peut cacher ou fouiller, l'inventaire de départ, le texte de la cassette VHS | redémarrer `npm run dev` |
| `../public/scenes/*.jpg` | Décors (1996, 2026), format 16:9 | rien |
| `../public/items/*.jpg` | Objets de l'inventaire | rien |
| `../public/characters/<id>.png` | Portrait de référence pour créer l'avatar (16:9, face caméra, cadré à la taille, bien éclairé) | `npm run provision` (crée l'avatar) |

## Multilingue

Le jeu est entièrement multilingue. Les langues actives sont dans `locales.json`.

- **Tout texte visible** (titres, lieux, objets, phrases d'ouverture, cassette VHS) s'écrit sous forme `{ "fr": "…", "en": "…" }`, avec **une entrée par langue active**. `npm test` échoue s'il en manque une.
- **Les prompts** (`*.prompt.md`) s'écrivent une seule fois, dans n'importe quelle langue. Ne pas y fixer de langue : le script de provisionnement crée un agent par personnage et par langue, avec une consigne et un verrou de langue.
- **Ajouter une langue** : l'ajouter à `locales.json`, traduire toutes les chaînes (contenu + `src/i18n/`), puis `npm run provision`.
- Langues possibles : voir la liste « Supported languages » de la doc Napster (environ 50).

## Règles à respecter

- **Lieux** : chaque lieu de `world.json` a un `id` (sans espace ni accent), un `label` (comment les personnages le nomment), et une description en 1996 et en 2026. Les personnages ne peuvent cacher ou fouiller que ces lieux.
- **Prompts** : garder la section « Règles » de chaque prompt. Elle dit au personnage quand appeler ses outils ; sans elle, la cohérence entre les deux époques casse.
- **Ce que Jeanne ignore** : elle ne connaît rien après 1996. Ce que Malik « sait » de 1996 lui est donné par le serveur (`faits_etablis`), jamais par son prompt.
- **Cassette VHS** : `vhs.template` doit garder `{message}`. Le texte final doit faire au moins 84 caractères (limite Napster). Le modèle d'exemple y arrive seul.
- **Visages** : uniquement des personnages fictifs générés, jamais le visage ou la voix d'une vraie personne.
- **Portraits** : tant que `companion.picture` vaut `null`, le personnage utilise un avatar du catalogue Napster (`stockId`) comme doublure.
