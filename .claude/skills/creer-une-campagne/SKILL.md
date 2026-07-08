---
name: creer-une-campagne
description: À utiliser quand on crée ou modifie une CAMPAGNE — un projet de plusieurs scènes reliées par une carte du monde (`WorldMap`), du contenu narratif jouable hors scénarios de test (dialogues, rencontres, voyage). Aussi quand on cherche « le pipeline d'authoring de scène » et qu'on ne sait pas par où commencer — c'est le chemin canonique, jamais posé à la main.
---

# Créer une campagne

Le pipeline d'authoring de campagne EXISTE, testé et éprouvé (Arène, « Le Loup et la Saumure ») — mais
il vit sous un nom trompeur (`scripts/arene/`, namespacé « arène » de bout en bout). Ne JAMAIS écrire un
`*-projet.json` à la main (tableaux de tuiles comptés un par un — fastidieux et silencieusement invalide) :
tout passe par `scene()`/`buildScene`, le MÊME compilateur que l'éditeur.

## Le chemin canonique en 6 étapes

**1. `scripts/<campagne>/generate.mjs`, modelé sur `scripts/arene/generate.mjs`.**
Importer les helpers de `scripts/arene/lib.mjs` (`scene`, `hero`, `NPC`, `P`, `flowOf`, `flagWhen`,
`testNode`, `fightTrigger`, `resetIds`…) — **par IMPORT, jamais par copie** (`scripts/loup-et-saumure/generate.mjs`
est le précédent à suivre). `lib.mjs` reste un outil GÉNÉRIQUE malgré son namespace : ne pas le renommer,
ne pas le dupliquer — l'étendre sur place si un helper manque à toute campagne (pas seulement la tienne).

**2. Cartes en ASCII via `scene({ rows, legend, base, entities, buildings, encounters, triggers, dialogues })`.**
`rows` = grille de caractères (`parseAsciiRows`), `legend` mappe un caractère → un id de terrain, `buildings`
compose toit + murs + porte + sol via `addBuilding` (même primitive que l'éditeur — jamais poser une tuile
à la main, cf. `docs/map-authoring.md`). Pour une scène MER (deux empreintes de navire sur de l'eau), générer
les rangées PAR CODE (motif `seaRows` de `scripts/loup-et-saumure/generate.mjs`) — jamais comptées à la main :
`parseAsciiRows` lève une erreur EXPLICITE si une ligne n'a pas la largeur attendue.

**3. Écrire des libellés lisibles ; les résolveurs de `lib.mjs` les normalisent en ids stables.**
`ref` de créature, `skill`, `spell`, trait `arg` (source FERMÉE : écrire l'id en minuscule, ex.
`Taille (petite)`, jamais le libellé du livre) — chaque résolveur est FAIL-FAST (libellé inconnu → `throw`,
jamais un id deviné) et IDEMPOTENT (un id déjà résolu passe tel quel). Toute logique du moteur est keyée par
id stable ; le libellé n'est que de l'affichage (CLAUDE.md règle stricte, en bas de fichier).

**4. Sortie = `src/scenes/<campagne>/<campagne>-projet.json`.**
Format projet v2 (`{ schema: 2, scenes, worldMap }`), COMMITÉ, source canonique, 100 % rééditable dans
l'éditeur en jeu ensuite. `worldMap.places[].scene` doit pointer vers un id de scène du tableau `scenes`
(garde-fou explicite dans `generate.mjs`, cf. `arene/generate.mjs` l.111-119) ; `worldMap.routes` accepte
DEUX routes entre les mêmes lieux (seul `id` est une clé) — utile pour un aller/retour asymétrique
(embuscades différentes), mais le moteur ne force PAS le sens : nommer clairement (`-aller`/`-retour`),
le joueur peut en théorie retomber sur la route « retour » à l'aller.

**5. Un test `.test.ts` sur le modèle de `src/scenes/arene/arene-projet.test.ts` / `loup-et-saumure-projet.test.ts`.**
Charge le JSON généré, `parseProject`, vérifie que toutes les refs (créature/compétence/sort/scène/lieu)
résolvent et que les transitions/triggers pointent vers des scènes/entrées existantes. Verrouille contre
toute régénération qui casserait silencieusement une ref.

**6. Recette navigateur.**
`loadProject(doc.scenes, startId, doc.worldMap)` — dérouler le flux complet (voir
`docs/recette-navigateur.md` + `docs/test-scenarios.md`). Piège closure-sync Playwright : ne jamais lire
le DOM dans le même `evaluate` que l'action qui le change.

## Pièges connus (2 lignes max chacun)

- **Coques de navire non résolues par `creatureId()`** : `lib.mjs::normalizeEnemy` ne connaît que le
  bestiaire (`findCreatureById`/`findCreature`), pas `findVehicleById` — un `ref` vers `vehicles.json`
  dans `encounters[].enemies[]` lève. Contournement PRÉVU par le schéma : poser l'entité-coque en
  `entities` BRUTE (jamais normalisée) et l'enrôler via `encounters[].members` (ids explicites). Chantier
  en cours pour fermer cette friction proprement : issue #218.
- **Postes d'artillerie (`ShipPoste.item`)** : aucun fabricant dans `lib.mjs` — `ShipPoste.item` matérialise
  aujourd'hui une `ItemInstance` complète à la main (patron `itemFromTrappingById`, helper local du
  générateur). Ce schéma est identifié comme un défaut de modélisation (référence par id attendue plutôt
  qu'une copie de stats) : issue #222 — écrire le helper local en attendant, ne pas le généraliser en dur.
- **`saboteurDR`/sabotage de coque s'authore SUR l'entité-coque**, effet de COMBAT seulement (le pipeline
  de voyage `seaVoyageFlow`/Test d'équipage est un chemin séparé qui ne lit aucun `GameOp`) — ne pas
  attendre qu'un Effect d'auteur module un Test d'équipage, cette couture n'existe pas.
- **Le navire de campagne se câble par l'Effect `setVessel`** (`vehicleId`, PV, moral) — et le bridge
  campagne⇄combat EXISTE : toute coque spawnée dont `creatureId === vessel.vehicleId` est réconciliée
  aux PV du navire de campagne au DÉBUT du combat (`combatSlice.ts` ~l.2292) et réécrit ses dégâts dans
  `vessel.wounds` à la FIN (`combatFlow.ts` ~l.4308). Sans `setVessel` (ou avec un autre `vehicleId`),
  pas de persistance : chaque combat spawn une coque fraîche.
- **Un `ambush` de route MER ne se déclenche que sur poursuite RNG perdue** — poser un `ambush` sur une
  route n'est pas une garantie de rencontre scénarisée à coup sûr (issue #212).
- **Deux routes entre les mêmes lieux, c'est OK** — le « sens » n'est qu'un nommage d'auteur, pas une
  contrainte mécanique (cf. étape 4 ci-dessus).
- **JAMAIS de note technique dans un texte joueur.** Un `node.text`/dialogue est rendu VERBATIM
  (`DialogueBox.tsx`) : ni identifiant de code (`` `state.vessel.manann` ``), ni tag d'auteur
  (`[INEXPRIMABLE]`/`[CONTOURNÉ]`), ni citation RAW brute (`MDG 14 l.45-47`) ne doivent s'y glisser — les
  constats d'authoring vont dans un journal `docs/plans/`, jamais dans un dialogue ou un journal en jeu.

## Renvois

- `docs/plans/2026-07-08-211-naval-authoring-journal.md` — le walkthrough complet dont ce skill est la
  distillation (frictions n°0 à n°8, verdicts EXPRIMABLE/CONTOURNÉ/INEXPRIMABLE beat par beat).
- Issue #218 — chantier « expérience auteur » en cours (coques terse, pipeline introuvable — ce skill
  répond à la moitié « pipeline introuvable » ; la résolution technique de #218 reste à faire).
- Issue #219 — ce skill.
- Issue #222 — `ShipPoste.item` par référence plutôt que par copie de stats.
- `docs/map-authoring.md` — détail de MapSpec/`buildScene`/l'ASCII.
- `docs/test-scenarios.md` — pendant « scénario de test » (groupe fixe, un seul combat) ; une CAMPAGNE
  (ce skill) est un projet à plusieurs scènes reliées par une carte du monde, pas un scénario de test.
