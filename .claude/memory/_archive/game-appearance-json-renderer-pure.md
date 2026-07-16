---
name: game-appearance-json-renderer-pure
description: "Apparence d'environnement = JSON data ; renderers purs (shade.ts) ; garde-fou anti-hex"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3c607334-9cb9-4345-b0af-44a71a2cc58a
---

Migration 2026-07-01 (branche feat/wfrp4-rpg-foundation) : sortir TOUTE l'apparence d'environnement
du code de rendu vers de la **donnée JSON**, renderers rendus **purs** (géométrie + occlusion +
ombrage seulement). But : découpler modèle/vue pour que les bugs de rendu (iso/POV multi-niveaux,
occlusion) deviennent isolables. Iso et POV consomment la MÊME donnée.

**Brique centrale** : `src/gameIso/shade.ts` — `shade(hex,k)` (luminance ×k, clampé ; `var(--x)`
passe tel quel), `mix`, facteurs de LUMIÈRE (`SIDE_N=0.86`, `POST_CAP/BASE`), voiles `ao/spec/warm`.
Avec la donnée JSON, c'est la SEULE source de couleur autorisée dans un renderer. Calibré pour
reproduire l'existant (bois iso ±3/canal). Voir [[feedback-appearance-svg-in-defs]].

**Garde-fou** : `src/gameIso/renderer-no-hardcoded-color.test.ts` — liste `COVERED` (croît par phase)
de fichiers de rendu ; échoue sur tout `#hex`/`rgb()`/`rgba(` (capture aussi les tables `Record<>` de
couleurs). Couvre : `walls.ts`, `ground.ts`, `RoofSprite.tsx`, `catalog/buildings/render-helpers.ts`.

**Données** (dans `src/data/*.json`, éditables Compendium, round-trip `serialize.test.ts` byte-fidèle
= `JSON.stringify(x,null,2)` sans newline final) : `structureAppearance.json` (murs/portes : `face`+
`wood{inset,frame,cap,skirt,rubble,rubbleHi}`+`post`+`parapet`+`door`+stone `band/cap/rubble/recess`),
`reliefMaterials.json` (terre/pierre/pilier/riser/plafond/sol-inconnu : face/foot/slopeTop/shadeDark),
`roofMaterials.json` (tuile/chaume/ardoise slopes N/E/S/O+line+course + `plan`). Résolveurs
`catalog/{structures,relief,roofs}/index.ts`. `wallApp(seg,baseH)` mutualisé iso↔POV (structures).
Gradients de terrain : stops sur `TerrainDef` (25 defs), `sprites.ts DEFS` assemblé depuis le registre.
Thème UI combat : tokens `:root --combat-*` (base.css).

**Suppression majeure (Phase 3b)** : le sous-système de rendu de bâtiment (`colombage`/`hipRoof`/
`openings`/`timber`/`wallFaces`/`BUILDINGS`/`buildingLayers`) était MORT (bâtiments = toit-seul en jeu :
`roofFromCells` ; murs = `WallSeg` ; sol = terrain). Supprimé (~200 l). `render-helpers.ts` = juste
`roofFromCells`. Bâtiments = méta pure ({id,label,defaultFoot,roofMaterial}). `RoofParams` réduit à
`{roofMaterial?}` (floors/wallColor/timberColor retirés — boutons d'éditeur morts).

**Hors scope (noté)** : gradients rig/FX + `wallBlock`/`tree` de `sprites.ts` ; brouillard +
`STRUCT_FALLBACK` du POV ; hex UI hors overlay combat d'`IsoStage`. **En attente** : parité navigateur
(remparts pierre siège iso+POV, relief multi-niveaux, toits) — Playwright gelé par l'user.
Prolonge [[game-pov-first-person-view]] (Phase 3 « SVG iso→defs » = faite).
