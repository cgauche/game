---
name: game-combat-hud-refonte
description: "Refonte du combat HUD demandée par l'utilisateur — tuile-portrait unifiée (vie horizontale, fond d'équipe, actif agrandi) + inversion initiative↔groupe"
metadata: 
  node_type: memory
  type: project
  originSessionId: df22e358-4438-4cca-b8e3-ad83ea327a2e
---

Refonte majeure du combat HUD demandée 2026-06-11, livrée en 2 volets (commits `dca84ca` + `742f6bd`, poussés, suite 2900 verte, 0 erreur console, mesures de non-recouvrement OK).

**Volet 1 — tuile-portrait UNIFIÉE** (`PortraitTile` = la SEULE façon d'afficher « portrait + vie », réutilisée par dock + frise d'initiative + `ActiveFrame`) :
- **vie HORIZONTALE** en bas du portrait (`.ptile-gauge` largeur=ratio, fini la barre verticale interne) — « comme tous les autres écrans » ;
- **fond d'équipe** derrière le portrait (`team='ally'|'enemy'` → `.ptile.team-ally`/`team-enemy`, vert/rouge translucide) EN PLUS du cadre `ring` ;
- **actif agrandi** (`active` → `size×1.28`) + liseré or + caret ;
- `ActiveFrame` abandonne sa barre `.af-hp` dédiée → utilise la jauge de `PortraitTile` (garde les crans Action/Mouvement/Avantage, qui ne sont PAS dans le portrait). Tests `PortraitTile.test`/`ActiveFrame.test` mis à jour au nouveau design (width% au lieu de height%, ptile-gauge au lieu de af-hp).

**Volet 2 — inversion + anti-chevauchement** : `.initiative-strip` → COLONNE À GAUCHE (`top:50% left:10`, `.is-tiles` flex-column + `overflow-y` + `max-height:84vh` → R4 plus de débordement) ; `.party-dock` → RANGÉE EN HAUT (`top:10 left:50%` flex-row). Conséquences anti-recouvrement : `.combat-feed` descend (84→108px desktop, 78→96 mobile) sous le dock ; la frise quittant le haut libère `.view-controls` (top-right, z-5) — c'était la cause du chevauchement « zoom/vue/rotation ».

**Positions HUD de référence** (pour ne pas recréer de recouvrement) : `.game-menu` ☰ top-left (10,10 z-60) ; `.worldmap-btn` top-left (10,58 expl. only) ; `.view-controls` top-right (16,16 z-5, **inline-styled** dans ViewControls.tsx) ; `.combat-feed` top-center ; `.target-prompt`/`.action-bar` bas ; `.log-drawer` bas-droite. Vérif = mesurer les bounding-boxes via `browser_evaluate` (overlap = `a.x<b.right && b.x<a.right && a.y<b.bottom && b.y<a.bottom`).

Prolonge [[game-hud-mobile-actionbar]] et [[game-vue-du-dessus]]. Recette combat rapide via [[game-browser-verif-tempo]] (`__wfrp` : startCombat sur `scene.encounters[0].id` + `confirmRoundStart`).
