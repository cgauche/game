---
name: creer-une-campagne
description: À utiliser quand on crée ou modifie une CAMPAGNE — un projet de plusieurs scènes reliées par une carte du monde (`WorldMap`), du contenu narratif jouable hors scénarios de test (dialogues, rencontres, voyage). Aussi quand on cherche « le pipeline d'authoring de scène » et qu'on ne sait pas par où commencer — c'est le chemin canonique, jamais posé à la main.
---
<!-- GENERATED: agents:sync; source=.claude/skills/creer-une-campagne/SKILL.md -->

# Créer une campagne

Lib partagée : **`scripts/campagne/lib.mjs`**. Ne JAMAIS écrire un `*-projet.json` à la main — tout passe
par `scene()`/`buildScene`, le MÊME compilateur que l'éditeur. Modèles : `scripts/loup-et-saumure/`,
`scripts/barge-du-sel/`, `scripts/arene/`.

## Le chemin canonique en 6 étapes

1. **`scripts/<campagne>/generate.mjs`** : les helpers (`scene`, `hero`, `NPC`, `P`, `poste`, `flowOf`,
   `flagWhen`, `testNode`, `fightTrigger`, `resetIds`, `projectDoc`) s'IMPORTENT de `lib.mjs`, jamais ne
   se copient ; un helper qui manque à TOUTES les campagnes s'y ajoute sur place. `projectDoc()` est la
   fabrique UNIQUE du document et pose le schema courant (`CURRENT_PROJECT_SCHEMA`) : aucun générateur
   n'écrit un littéral `{ schema: … }`.
2. **Cartes en ASCII** : `rows` = grille de caractères (`parseAsciiRows`), `legend` mappe un caractère →
   un id de terrain ; architecture, murs, zones et rencontres sont des champs de `scene()` (signature à
   jour dans `lib.mjs`). Aucune tuile posée à la main (skill `creer-une-map`). Les rangées d'une scène MER
   se génèrent PAR CODE (motif `seaRows` de `loup-et-saumure/generate.mjs`).
3. **Écrire des IDS stables** — `ref` de créature, `skill`, `spell`, `species`, `weapon` (trappingId),
   `appearance.tenue`, trait `arg`. Les validateurs de `lib.mjs` (`creatureId`, `skillId`, `spellId`,
   `speciesId`, `tenueId`, `weaponId`) laissent passer un id valide et `throw` sur tout le reste : ils ne
   convertissent AUCUN libellé. `appearance.species` absent = Humain par défaut.
4. **Sortie = `src/scenes/<campagne>/<campagne>-projet.json`**, commitée, rééditable dans l'éditeur.
   L'identité (`id`, `label`, `versionContenu`) est PLATE à la racine — plus de poche d'enveloppe.
   `worldMap.places[].scene` doit pointer un id du tableau `scenes` ; deux routes entre les mêmes lieux
   sont permises (seul `id` est une clé) et le moteur ne force PAS le sens : nommer `-aller`/`-retour`.
5. **AUCUN test nominatif sur le paquet livré.** `src/scenes/bundled-projects.test.ts` prend tout
   `src/scenes/**/*-projet.json` au GLOB : `parseProject` sans lever, identité valide, apparence et nom
   résolus, aucune `error` de `validateScene`, prose sourcée confrontée au `Source/` à l'octet, refus du
   jargon technique dans un texte joueur. Une MÉCANIQUE à prouver se prouve sur une scène de FIXTURE
   (skill `creer-un-scenario-de-test`), jamais sur la carte livrée.
6. **Recette navigateur** — `loadProject(doc.scenes, startId, doc.worldMap, doc.narratif)` puis flux
   complet déroulé : skill `recette-navigateur`.

## Narratif — frontière référence ⟂ narratif

Le bloc `narratif` (`src/state/campaignNarratif.ts`) vit au NIVEAU PROJET, frère de `scenes`/`worldMap`
(champs, bridge `presetId`, éditeur : **`docs/campagne-authoring.md` §10ter**). Le contenu de RÉFÉRENCE
(créature, possession, compétence, sort…) vit dans `src/data` (`docs/donnees.md`) ; le contenu NARRATIF
(affaires, indices, méchants, objets d'intrigue) est EMBARQUÉ dans `narratif` et RÉFÉRENCE la règle
globale PAR ID (`PresetPnj.base`), jamais versé dans `src/data` ni au Compendium. `emptyNarratif()` est
valide ; un bloc mal formé fait échouer `parseProject`.

## Pièges

- **Coques de navire** : `creatureId()` accepte créature ∪ véhicule (`vehicles.json`) ; une coque RICHE
  (`crewIds`, `postes`, `upgrades`) se pose en `entities` et s'enrôle par `encounters[].members`.
  `poste(trappingId, side, crewIds?)` émet une RÉFÉRENCE hydratée au spawn (`hydratePoste`,
  `src/engine/items.ts`) ; `trappingId` doit désigner une pièce POSABLE sinon `throw`.
- **Navire de campagne = Effect `setVessel`** (`vehicleId`, PV, moral) : une coque spawnée dont
  `creatureId === vessel.vehicleId` est réconciliée aux PV du navire à l'ouverture du combat et réécrit
  ses dégâts dans `vessel.wounds` à la fin. Sans `setVessel`, chaque combat spawn une coque fraîche.
- **`saboteurDR`/sabotage s'authore SUR l'entité-coque**, effet de COMBAT seulement (`seaVoyageFlow` et
  le Test d'équipage ne lisent aucun `GameOp`) ; un `ambush` de route MER ne se déclenche que sur
  poursuite RNG perdue.
- **JAMAIS de note technique dans un texte joueur** : `node.text` et dialogues sont rendus VERBATIM — ni
  identifiant de code, ni tag d'auteur, ni citation RAW (garde de jargon de `bundled-projects.test.ts`).

Renvois : `docs/campagne-effects.md` (Effects de scène, `npm run docs:effects`) · `docs/map-authoring.md`
· `docs/test-scenarios.md` · gardes `src/scenes/arene/lib-validators.test.ts` (id-only) et
`src/scenes/arene/arene-flow.test.ts` (Trigger→Effect→transition).
