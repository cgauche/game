---
name: game-siege-rampart-z-aware-interaction
description: "Combat interaction sur remparts/multi-niveaux — occ z-aware, murs = cible siège only, portée combat bornée"
metadata: 
  node_type: memory
  type: project
  originSessionId: 03105508-1981-4187-b39c-23c39463ada6
---

Bug « impossible d'aller/cibler sur le chemin de ronde en combat » (scénario siege-enceinte) = TROIS causes distinctes :

1. **`occ` z-aveugle.** En combat, chaque arête de mur intacte devient un *combattant structure* (`combatSlice.ts` ~1916 `structureCombatant`, `c.pos={x,y}` sans z = z0). Les lookups « quel combattant est sous cette case » (survol/clic/curseur/clic droit) utilisaient `occupiesTile()` (purement 2D) → survoler la case de rempart z1 matchait le mur z0 en dessous → « ⛔ hors de portée » fantôme + clic intercepté. **Fix = primitive UNIQUE z-aware `combatantAtTile(combatants,x,y,z)` dans `combatGeometry.ts`** (réexportée par combatFlow), remplace les 6+ `find(occupiesTile(...))` dispersés (IsoStage `hoverAim`/`hoveredId`/`hoverMove`/`covered`/`performClick`/clic droit + `combatCursor.cursorCommitIntent`). NE PAS réintroduire de lookup occ z-aveugle.

2. **Pas de gate arme→structure côté joueur.** Une structure est `kind:'npc'` → passait le filtre `target.kind===active.kind` de `attackAffordance` (targetingModes.ts) → une épée « ciblait » le mur. RAW : *Impénétrable* imparable sans l'Atout **Siège** (ADE II ch.08). **Fix = `if (isStructure(target) && active.weapons.every(w=>structureImmune(w,target))) return {kind:'none'}`** (même gate que l'IA `ai.ts`). `combatantClickActs` DÉRIVE de l'affordance → propage au clic/curseur/clic droit automatiquement.

3. **Portée combat bornée ≠ exploration libre.** Exploration : `exploreMoveDest`+`pathTo` (le groupe marche tout le trajet, sans budget). Combat : `battleClickTile`+`displayedReach` (BFS borné par la Marche, escaliers via `stairLinks`). Donc un escalier à 10-13 cases du groupe = injouable en combat (mais OK en explo). **Tout scénario multi-niveaux doit poser des escaliers À PORTÉE DE MARCHE du départ du groupe.** Corrigé siege-enceinte : ajout de 2 escaliers au corps de garde (x13/x16, flanquant la porte x14/15) en plus des 2 d'angle (markers `s` dans Z0_ASCII **et** Z1_ASCII).

LdV/portée cross-niveau marchent déjà : `combatDistance` z-aware (`footprint.ts` l.104), `lineOfSightCover` ignore les arêtes fines quand `from.z≠to.z` (`lineOfSight.ts` ~142, par-dessus le parapet). Climb confirmé navigateur : clic rempart → reachable via Course (4 cases + escalier > Marche) → roll Athlétisme → pos z=1. `combat-stairs.test.ts` couvre le `movePreviewAt` z-aware. Voir aussi [[game-murs-aretes-systeme]], [[game-opera-nadj-multiniveau-program]].

PIÈGE de debug : `Level.tiles` est un **tableau PLAT** `Terrain[]` (length w·h), indexé `tiles[y*w+x]` (cf. `parseAsciiRows`) — pas du `[y][x]`. Indexer `tiles[y][x]` lit les CHARS d'une string de terrain (« vide »[3]=« e ») → faux diagnostic de grille « malformée ».
