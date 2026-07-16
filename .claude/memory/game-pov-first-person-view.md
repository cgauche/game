---
name: game-pov-first-person-view
description: Vue subjective (première personne) en exploration — renderer perspective SVG src/gameIso/pov
metadata: 
  node_type: memory
  type: project
  originSessionId: d10576e3-ad46-4ab0-aad1-e2c2f0028da3
---

Vue **première personne** (POV) en mode exploration, à côté de l'iso. Commit `a5c31dbd`
(branche feat/wfrp4-rpg-foundation), 2026-07-01.

- **Renderer** `src/gameIso/pov/` : `camera.ts` (maths pures : projection perspective, clipNear,
  world quads — testé), `geometry.ts` (heightfield SOLIDE : sols par colonne visible + FACES VERTICALES
  de relief `riser` aux marches → plus de « voir à travers » ; murs depuis la def partagée), `PovStage.tsx`
  (React, lit le store), `billboards.tsx` (PNJ = sprites rig via `povView`, `personnage` seulement — pas
  encore les `prop` ni les gabarits non-bipèdes). Ciel dégradé dehors / plafond+brume dedans.
- **État/déplacement** : `store.povActive` + `togglePov`/`pivotParty(±1=45°)`/`stepPartyRelative` ;
  réutilise `moveParty`/`setFacing`. **Contrôles AZEQSD** (Z/Q/S/D avance/strafe, A/E pivot ; `event.code`)
  dans `keybindings.ts` (garde `exploringPov`, ombrage par ordre) + manette (`useGamepad`) + `PovControls.tsx`
  (croix tactile). Bascule 👁 dans `ViewControls`. L'explo ISO est passée des flèches → ZQSD.
- **Pathfinding** `path.ts` désormais **8-connexe** partout (explo+combat+IA), diagonale = 1 pas
  (Chebyshev, RAW LDB 15), garde anti coupe-de-coin ; `surfaceLink` en adjacence Chebyshev.
- **Apparence murs = def PARTAGÉE** `src/gameIso/catalog/structures/` (registre defs/, `structureAppearance(id)`)
  consommée par le POV (couleurs/parapet/créneaux/herse). Reste à faire : **Phase 3** = y déplacer le SVG
  iso de `walls.ts` (`renderIso` dans la def, walls.ts = dispatcher) — cf. [[feedback-appearance-svg-in-defs]].
  Iso non touché pour l'instant. Vérif navigateur : scénario `siege-explore` (rempart crénelé + chemin de
  ronde + porte-de-ville/herse), `arene` (murs bois), `opera` (multi-niveaux).
