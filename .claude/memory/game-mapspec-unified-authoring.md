---
name: game-mapspec-unified-authoring
description: Authoring de map = UNIQUEMENT MapSpec/buildScene (compilateur headless-editor). Les 3 anciens systèmes divergents sont supprimés.
metadata: 
  node_type: memory
  type: project
  originSessionId: c104c1bc-08ae-405c-8b02-96deb8a53b4c
---

**Toute carte se construit via `MapSpec` → `buildScene(spec)` (`src/state/mapSpec.ts`).** C'est le SEUL
chemin d'authoring. Doc de référence : `docs/map-authoring.md` (champs, `bind`, `encounters`, pièges,
« où voir quoi »). Golden = spec exécutable : `src/state/mapSpec.test.ts`.

`buildScene` est PUR et **Node-safe** (zéro import `ui/`/`gameIso/`) — il rejoue les primitives PURES de
`src/state/sceneEdit.ts` (extraites de `ui/editor/editorState.ts`, qui les ré-exporte) dans un ORDRE FIXE :
base+scalaires → terrain(`levels` plat ou `walled` box-drawing + scan marqueurs) → relief(mètres) → murs →
rooms(`addBuilding`) → entités+heroStart+`bind` → zones → encounters. **Règle d'or** : si le format n'exprime
pas un besoin, on ÉTEND une primitive avec un golden — jamais de plomberie impérative dans le scénario.

**Intérieurs = TOUT-EN-SCÈNE** (cutaway `roofHidden`, déjà branché IsoStage) : un bâtiment CONTIENT son
intérieur dans son empreinte (grand bâtiment 15×10 → footprint 15×10 DANS la scène) ; **JAMAIS de
scène-intérieur séparée + transition** (ancien modèle, `interiors.ts` supprimé). Le Bourg y a été recorrigé
(2026-07). **Ne PAS rationaliser une demi-migration en « légitime »** — le modèle de la refonte s'applique
partout (cf. [[feedback-affordance-morte-signaler]]).

`arena()` = preset de `buildScene`. Le générateur d'arène (`scripts/arene`, Node/tsx) importe
`buildScene` et régénère `arene-projet.json`. Les primitives ASCII `parseWalledAscii`/`scanMarkers`/
`parseAsciiRows` (`asciiMap.ts`) sont celles que consomment `buildScene`/`shipDeck` — un scénario ne
lit JAMAIS l'ASCII lui-même. Cf. [[game-murs-aretes-systeme]], [[game-siege-rampart-z-aware-interaction]].

**L'interdit qui en découle** : aucun second parseur de carte ne s'ouvre. Un scénario ne parse JAMAIS l'ASCII lui-même — `parseWalledAscii`/`scanMarkers`/`parseAsciiRows` (`src/state/asciiMap.ts`) sont les SEULES primitives, consommées par `buildScene`/`shipDeck` ; un scénario qui a besoin d'une grille passe par `MapSpec` (patron : `src/scenes/opera/floorplan.ts`, dont l'ASCII vit en donnée dans `floorplan.ascii.ts`). La HAUTEUR ne se DSL-ise pas en local : elle se dit en MÈTRES dans `MapSpec.relief`, jamais par une notation de niveau inventée dans un scénario ou un générateur. Aucune chaîne de terrain ne devient un langage de pose parallèle, aucun générateur (`scripts/arene`) ne se dote de sa propre bibliothèque de construction — il importe `buildScene`. Et aucune scène-intérieur séparée + transition ne se recrée.
