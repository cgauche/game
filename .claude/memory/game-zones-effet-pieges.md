---
name: game-zones-effet-pieges
description: "Système générique de « zones d'effet » authorées (pièges/hasards + barrières) — donnée éditable, runtime partagé avec les zones de sort"
metadata: 
  node_type: memory
  type: project
  originSessionId: 95ed0488-96d5-4512-939e-3cf27b47cc12
---

Système de **zones d'effet** posables dans l'éditeur (demandé « super pour créer des pièges », 2026-06-15). 100 % donnée — `Scene.effectZones`, aucune zone codée en dur. Réutilise INTÉGRALEMENT le runtime des zones de Sort (zéro duplication). Commits : `bfe3689` (cœur), `9f3adfa` (éditeur), `2f7e7f3` (barrières).

**Modèle** (`SceneEffectZone` dans `src/state/scene.ts`) : `area` (`{kind:'rect'…}` ou `{kind:'disc'…}`, partagé `ZoneArea`) + payload `ZoneEffect` (dégâts/soin/États, partagé avec les sorts) sur deux déclencheurs : `onCross` (traversée — pic, flaque) / `perRound` (stationnement — brasier) ; `blocksLoS` (masque la vue) ; `barrier?: {blockGroups?}` (infranchissable).

**Runtime** : `sceneZonesToBattle(scene.effectZones)` → `BattleZone[]` PERMANENTES (`permanent:true`, `decayZones` les conserve) semées dans `battle.zones` au `startCombat` (`store.ts`). `crossZones`/`zonesRoundTick`/`losBlockingTiles` (déjà existants, `src/state/zones.ts`) les appliquent comme un Mur de feu. Combat-scoped (pas encore l'exploration).

**Barrières** = point d'injection UNIQUE : `barrierTilesFor(zones, moverGroups)` ajouté dans `occupied()` (`combatGeometry.ts`) — la SEULE source du set `blocked` que lisent `reachable` joueur, pathfinding IA, poussée, téléport → tout déplacement les respecte sans toucher au pathfinding. `blockGroups` vide = mur pour tous ; sinon `groupMatch` (Démon/Mort-vivant = cercle sacré).

**Éditeur** : outil Palette « ⚠️ Piège / hasard » (3ᵉ type de zone ⊥ Trigger/Repos) ; pose par glisser-rectangle (`addEffectZone`) ; Inspector édite nom/dims/déclenchement/Dégâts/ignore-armure/États/blocksLoS/barrière+filtre ; canvas = piège pointillés orange ⚠️ / barrière trait plein bleu 🧱 ; calque « Pièges ». `editorState` : Sel/Layers/Tool étendus, `effectZoneRect` (disque→boîte), mirroir de `restZone` partout. L'éditeur n'auteure que des **rect**.

Tests : `src/state/effect-zones.test.ts` (runtime + barrières via occupied) + `src/ui/editor/editorState.test.ts` (authoring). Typecheck 0, store.test.ts 160 verts (occupied non régressé).

**Reste** : (1) **recette navigateur** jamais faite (browser tenu par session // — `--isolated` indispo via MCP) ; (2) **Phase 2b auras « tant qu'on est dedans »** (Pouvoir du Chaos −½ NI, Bonne Volonté +10 Social) — DIFFÉRÉE : exige un hook dans le pipeline de Tests (ni `occupied` ni les zones n'y touchent) ; (3) câbler les SORTS barrière/zone (`SpellSpec.persistentZone.barrier`) pour rejouer Protection de Phâ/Octogramme via ce système. Prolonge [[feedback-contenu-donnee-editeur-pas-code]] + [[game-jet-modale-exhaustif]] (zones de sort).
