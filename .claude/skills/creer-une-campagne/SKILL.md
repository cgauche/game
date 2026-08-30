---
name: creer-une-campagne
description: À utiliser quand on crée ou modifie une CAMPAGNE — un projet de plusieurs scènes reliées par une carte du monde (`WorldMap`), du contenu narratif jouable hors scénarios de test (dialogues, rencontres, voyage). Aussi quand on cherche « le pipeline d'authoring de scène » et qu'on ne sait pas par où commencer — c'est le chemin canonique, jamais posé à la main.
---

# Créer une campagne

Le pipeline d'authoring de campagne EXISTE, testé et éprouvé (Arène, « Le Loup et la Saumure »). La lib
partagée vit en `scripts/campagne/lib.mjs` (promue depuis `scripts/arene/`, #218). Ne JAMAIS écrire un
`*-projet.json` à la main (tableaux de tuiles comptés un par un — fastidieux et silencieusement invalide) :
tout passe par `scene()`/`buildScene`, le MÊME compilateur que l'éditeur.

## Le chemin canonique en 6 étapes

**1. `scripts/<campagne>/generate.mjs`, modelé sur `scripts/barge-du-sel/generate.mjs` ou
`scripts/loup-et-saumure/generate.mjs`.**
Importer les helpers de `scripts/campagne/lib.mjs` (`scene`, `hero`, `NPC`, `P`, `poste`, `flowOf`,
`flagWhen`, `testNode`, `fightTrigger`, `resetIds`, `projectDoc`…) — **par IMPORT, jamais par copie**.
`projectDoc()` est la fabrique UNIQUE du document de sortie (schema courant) : aucun générateur n'écrit
un littéral `{ schema: … }` à la main. `scripts/arene/generate.mjs` n'est PAS encore migré sur
`projectDoc()` (littéral `{ schema: 2, scenes, worldMap }` — volet ouvert de #809) : ne pas s'en modeler
sur ce point. `scripts/campagne/lib.mjs` est la lib GÉNÉRIQUE de TOUTE campagne : ne pas la dupliquer —
l'étendre sur place si un helper manque à toutes les campagnes (pas seulement la tienne).

**2. Cartes en ASCII via `scene({ rows, legend, base, entities, buildings, encounters, triggers, dialogues })`.**
`rows` = grille de caractères (`parseAsciiRows`), `legend` mappe un caractère → un id de terrain, `buildings`
compose toit + murs + porte + sol via `addBuilding` (même primitive que l'éditeur — jamais poser une tuile
à la main, cf. `docs/map-authoring.md`). Pour une scène MER (deux empreintes de navire sur de l'eau), générer
les rangées PAR CODE (motif `seaRows` de `scripts/loup-et-saumure/generate.mjs`) — jamais comptées à la main :
`parseAsciiRows` lève une erreur EXPLICITE si une ligne n'a pas la largeur attendue.

**3. Écrire des IDS stables ; les résolveurs de `lib.mjs` les VALIDENT (fail-fast), ils ne normalisent plus.**
`ref` de créature, `skill`, `spell`, `species`, `weapon` (trappingId), `appearance.tenue` (id de tenue/
carrière), trait `arg` (source FERMÉE : id en minuscule, ex. `Taille (petite)`) — chaque validateur laisse
passer un id valide et `throw` sur TOUT le reste, en pointant où trouver l'id (Compendium/catalogue). Les
labels ne servent qu'à l'AFFICHAGE et à la SAISIE (pickers de l'éditeur/Compendium qui aident à trouver l'id) ;
au final ce qu'on manipule c'est des ids (CLAUDE.md, encadré « id STABLE », en bas de fichier).

**4. Sortie = `src/scenes/<campagne>/<campagne>-projet.json`.**
Format de paquet courant `{ schema: 5, <identité>?, scenes, worldMap, narratif }` (`ProjectDoc`,
`src/state/worldMap.ts`), COMMITÉ, source canonique, 100 % rééditable dans l'éditeur en jeu ensuite —
détail des blocs `narratif`/identité : § « Bloc narratif + identité » ci-dessous. `worldMap.places[].scene`
doit pointer vers un id de scène du tableau `scenes` (garde-fou explicite dans `generate.mjs`, cf.
`arene/generate.mjs` l.111-119) ; `worldMap.routes` accepte DEUX routes entre les mêmes lieux (seul `id`
est une clé) — utile pour un aller/retour asymétrique (embuscades différentes), mais le moteur ne force
PAS le sens : nommer clairement (`-aller`/`-retour`), le joueur peut en théorie retomber sur la route
« retour » à l'aller.

**5. Un test `.test.ts` sur le modèle de `src/scenes/arene/arene-projet.test.ts` / `loup-et-saumure-projet.test.ts`.**
Charge le JSON généré, `parseProject`, vérifie que toutes les refs (créature/compétence/sort/scène/lieu)
résolvent et que les transitions/triggers pointent vers des scènes/entrées existantes. Verrouille contre
toute régénération qui casserait silencieusement une ref.

**6. Recette navigateur.**
`loadProject(doc.scenes, startId, doc.worldMap)` — dérouler le flux complet (voir
`docs/recette-navigateur.md` + `docs/test-scenarios.md`). Piège closure-sync Playwright : ne jamais lire
le DOM dans le même `evaluate` que l'action qui le change.

## Bloc narratif + identité

Un paquet de campagne porte, au NIVEAU PROJET (jamais per-scène), le bloc `narratif` (`NarratifBlock`,
`src/state/campaignNarratif.ts`) frère de `scenes`/`worldMap`, ET son IDENTITÉ à PLAT à la racine du
document (`ProjectIdentite`, `src/state/worldMap.ts` — `id`/`label`/`versionContenu` tout-ou-rien,
`icon`/`desc`/`auteur` optionnels ; plus de poche `meta` depuis #1467 L1b). Détail complet des champs,
de la migration, du bridge `presetId`/`resolvePresetCreature` et de
l'éditeur (`NarratifEditor`) : **`docs/campagne-authoring.md` §10ter** (référence vivante, source de vérité —
ne pas dupliquer ici).

- **Frontière RÉFÉRENCE vs NARRATIF** (à respecter sur TOUTE campagne, générée ou éditée à la main dans
  l'éditeur). Le contenu de RÉFÉRENCE — règle globale feuilletable au Compendium (créature, possession,
  compétence, sort…) — vit dans `src/data` et s'y ajoute par le pipeline habituel (`docs/donnees.md`). Le
  contenu NARRATIF de campagne — affaires, indices à stades, méchants nommés, objets d'intrigue — est
  EMBARQUÉ dans le `narratif` du JSON de campagne, jamais versé dans `src/data` global ni au Compendium :
  il se RÉFÉRENCE PAR ID à la règle globale (`PresetPnj.base` → `findCreatureById`) sans jamais la copier.
  `validateNarratif` (`src/state/campaignNarratif.ts`) garde cet invariant fail-fast à `parseProject`.
- Les générateurs navals (`scripts/barge-du-sel/generate.mjs`, `scripts/loup-et-saumure/generate.mjs`)
  passent déjà `meta` à `projectDoc()` (id/label/icône/version de bibliothèque, #766) ; `narratif` reste
  vide (`emptyNarratif()`, valeur par défaut de `projectDoc()`) faute d'helper de `lib.mjs` pour le
  peupler à la génération — à compléter ensuite dans l'éditeur (bouton « Narratif » de
  `EditorToolbar.tsx` → `NarratifEditor.tsx`). `meta` est optionnel (`ProjectDoc.meta?`) : absent, il
  n'est pas validé. `narratif` ne l'est PAS : `parseProject` (`src/state/worldMap.ts:491`) rejette via
  `validateNarratif` (`src/state/campaignNarratif.ts:79`) tout paquet où le bloc est absent ou mal
  formé — un `narratif` VIDE (`emptyNarratif()`) reste en revanche un paquet valide.
- **Hors périmètre de ce skill** : les éditeurs de formulaires des registres narratif (affaires/indices/
  presets/objets) relèvent de #670/#671, pas de ce pas-à-pas de génération de campagne.

## Pièges connus (2 lignes max chacun)

- **Coques de navire en `enemies[]` terse — OK (#218)** : `creatureId()` accepte créature ∪ véhicule
  (`findVehicleById`) ; un `ref` vers `vehicles.json` (`cogue`/`langskip`/`loup-imperial`) passe. Pour une
  coque RICHE (équipage exposé `crewIds`, artillerie `postes`, améliorations `upgrades`), la poser en
  `entities` BRUTE + l'enrôler via `encounters[].members` reste préférable (plus expressif que le terse).
- **Postes d'artillerie : `poste(trappingId, side, crewIds?)` (#222)** — helper de `scripts/campagne/lib.mjs`.
  Émet la forme de référence `{ trappingId, uid, side, crewIds }` : la base (Dégâts/Qualités/Portée) N'est
  PAS matérialisée, elle est HYDRATÉE au spawn depuis `trappingId` (`hydratePoste`, `src/engine/items.ts`).
  `trappingId` doit désigner une pièce POSABLE (art d'affût `siegeRig`) sinon `throw`. `crewIds` vide =
  poste servable en jeu (aucun id de héros connu à l'authoring).
- **`saboteurDR`/sabotage de coque s'authore SUR l'entité-coque**, effet de COMBAT seulement (le pipeline
  de voyage `seaVoyageFlow`/Test d'équipage est un chemin séparé qui ne lit aucun `GameOp`) — ne pas
  attendre qu'un Effect d'auteur module un Test d'équipage, cette couture n'existe pas.
- **Le navire de campagne se câble par l'Effect `setVessel`** (`vehicleId`, PV, moral) — et le bridge
  campagne⇄combat EXISTE : toute coque spawnée dont `creatureId === vessel.vehicleId` est réconciliée
  aux PV du navire de campagne au DÉBUT du combat (`combatSlice.ts:2476`) et réécrit ses dégâts dans
  `vessel.wounds` à la FIN (`combatFlow.ts:4629`). Sans `setVessel` (ou avec un autre `vehicleId`),
  pas de persistance : chaque combat spawn une coque fraîche.
- **Un `ambush` de route MER ne se déclenche que sur poursuite RNG perdue** — poser un `ambush` sur une
  route n'est pas une garantie de rencontre scénarisée à coup sûr (issue #212).
- **Deux routes entre les mêmes lieux, c'est OK** — le « sens » n'est qu'un nommage d'auteur, pas une
  contrainte mécanique (cf. étape 4 ci-dessus).
- **`appearance.species` = id STABLE, jamais un libellé** — vocabulaire = ids de `species.json` (espèces
  jouables : `humains-reiklander`, `nains`…) ∪ ids de def rig (monstres/races non-jouables). `species`
  absent = défaut Humain (documenté). Un libellé vit d'un défaut silencieux → poison.
- **Validateurs de `scripts/campagne/lib.mjs`** (`creatureId`/`skillId`/`spellId`/`speciesId`/`tenueId`/
  `weaponId`, branchés dans `NPC`/`normalizeEnemy`/`scene`) : un id valide passe, TOUT le reste → throw. Ils ne convertissent PLUS
  aucun libellé — l'auteur écrit `species: 'humains-reiklander'`, `weapon: 'arc'`, `appearance.tenue: 'mendiant'`
  (ids), jamais les libellés. Les pickers de l'éditeur/Compendium aident à trouver l'id à la saisie.
- **JAMAIS de note technique dans un texte joueur.** Un `node.text`/dialogue est rendu VERBATIM
  (`DialogueBox.tsx`) : ni identifiant de code (`` `state.vessel.manann` ``), ni tag d'auteur
  (`[INEXPRIMABLE]`/`[CONTOURNÉ]`), ni citation RAW brute (`MDG 14 l.45-47`) ne doivent s'y glisser — les
  constats d'authoring vont dans un journal `docs/plans/`, jamais dans un dialogue ou un journal en jeu.

## Renvois

- `docs/campagne-authoring.md` — la carte des coutures d'auteur TOUS SYSTÈMES (pipeline, bloc narratif/meta
  §10ter, navire de campagne, routes, catalogues navals, postes, VictoryConditions — six formes dont
  `firstBlood`, règles d'or). Référence vivante.
- `docs/campagne-effects.md` — carte GÉNÉRÉE du vocabulaire des Effects de scène (`setFlag`, `giveTrapping`, `givePossession` #615, `startCombat`, `delayedEffect`…), régénérée par `npm run docs:effects`, gatée `docs:check`.
- Gardes de la campagne : `src/scenes/arene/lib-validators.test.ts` (validateurs id-only : un id valide passe, tout libellé throw) et `src/scenes/arene/arene-flow.test.ts` (garde de FLUX — la campagne, données pures, tourne sur le moteur existant : Trigger→Effect→transition).
- Issue #218 — chantier « expérience auteur » : lib promue en `scripts/campagne/`, `creatureId()` accepte
  les coques, helper `poste()` de référence — livrés.
- Issue #219 — ce skill.
- Issue #222 — `poste()` par référence catalogue plutôt que par copie de stats — livré.
- Issue #765 — introduction du paquet schema 3 (`meta`/`narratif`) ; #670/#671 — éditeurs de registres
  narratif (hors périmètre de ce skill).
- `docs/map-authoring.md` — détail de MapSpec/`buildScene`/l'ASCII.
- `docs/test-scenarios.md` — pendant « scénario de test » (groupe fixe, un seul combat) ; une CAMPAGNE
  (ce skill) est un projet à plusieurs scènes reliées par une carte du monde, pas un scénario de test.
