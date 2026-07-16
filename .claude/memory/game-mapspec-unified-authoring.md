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

Supprimés (dette purgée) : les 4 parseurs concurrents (`parseLevels` retiré), la dup `scripts/arene/lib.mjs`
(`parseRows`/`buildingToComposite`), les 3 DSL de hauteur inline (siège `fillRact`/opéra `setH`/pont
`heights`), la chaîne `WALL` du siège, l'`opera/floorplan` en box-drawing direct. `arena()` = preset de
`buildScene`. Le générateur d'arène (`scripts/arene`, Node/tsx) importe `buildScene` et régénère
`arene-projet.json`. `parseWalledAscii`/`scanMarkers`/`parseAsciiRows` (asciiMap) restent (consommés par
`buildScene`/`shipDeck`). Cf. [[game-arene-editor-data-project]], [[game-murs-aretes-systeme]],
[[game-siege-rampart-z-aware-interaction]].
