---
name: game-topo-minimap-stations
description: "Chantier minimap/TopoScene — plan top-down réutilisable, index de « stations », PosteSheet unifié navire+siège"
metadata: 
  node_type: memory
  type: project
  originSessionId: e416e0e1-cd6b-424e-9f7f-769fed50cae3
---

Chantier « minimap » (branche `feat/wfrp4-rpg-foundation`, 2026-07) : un **composant top-down réutilisable** (`src/gameIso/TopoScene.tsx`) qui indexe des « stations » (postes servis) sur une scène, pour gérer navire / siège / (futur) bataille de masse depuis un plan.

Livré et vérifié (P1-P4, commits `feat(topo)`/`refactor(topo)`) :
- **`src/state/stations.ts`** : `Station`/`StationRef` + `postesToStations` — DÉRIVATION pure (pas de stockage), kind-agnostique (coque navale = emplacement de siège). `posteAnchor` (`shipPostes.ts`) : ancre RAW-safe (placement libre, pas de slot fixe).
- **`TopoScene`** : PUR, **réutilise le pipeline du jeu** (`buildFloors`/`buildWalls` + `floorLayerObjs`/`wallLayerObjs` + `sortByDepth` + backends affines en `view:'top'`) — PAS de 2ᵉ moteur d'affichage. Seul le neuf = couche de marqueurs (`topoMarkers.ts` : disque faction/`teamColors` + icône/`IconG` + wedge d'arc + badge + `colocationOffsets` pour éventer les pièces d'un même bord). Voir [[game-refonte-rendu-builders-backends.md]].
- **`PosteSheet`** (`src/ui/ShipSheet.tsx`) : maître-détail façon FTL/RTS (plan master + puces + détail d'UN poste ; onglet Manœuvre navire-only). UNIFIÉ navire+siège via un ENSEMBLE de coques (`combatantIds`) : la coque ACTIVE suit la sélection (constante navire, variable siège). `isEngin` (`engine/structures.ts`, `bodyShape:'engin'` ≠ `isStructure` mur/porte). `ShipSheet` wrapper SUPPRIMÉ. CampaignView route navire→[lui], affût→toute la batterie amie.

Reste (moitié masse) : `Scene.stations` (anchors authorés) + `battleScenesToStations` + `TopoScene` dans `MassBattleView` + **affectation explicite** héros→scène (remplace `bestForSkills` auto-pick) + liste plate → plan. ⚠ NE PAS fondre les modèles d'activité : [[game-massbattle-activities-distinct]].

Vérif navigateur : scénarios `combat-naval` (navire) et `siege-enceinte` (batterie). Piège preview : viewport se ré-réduit ; `preview_click` ne déclenche pas React → utiliser `b.click()` via eval, en 2 appels séparés (closure-sync, cf. [[game-browser-verif-tempo]]).
