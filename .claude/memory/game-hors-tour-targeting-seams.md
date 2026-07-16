---
name: game-hors-tour-targeting-seams
description: Cibler HORS du tour actif (interruption type Tir rapide) = router le TIREUR par 4 coutures qui présument toutes le combattant ACTIF
metadata: 
  node_type: memory
  type: project
  originSessionId: 748d9d74-6f65-4c5e-b1fd-ac5188f455e0
---

Tout le système de ciblage combat présume UN combattant ACTIF (`battle.order[battle.turn]`) + « Mon Tour ».
Une feature qui vise HORS du tour actif — pause de début de Round (`turn: -1`), interruption Tir rapide —
doit router **le TIREUR** (pas l'actif) par CES 4 coutures (toutes ont fallu, cf. `b4bd3a1d`/#106) :

1. **`combatantClickActs`** (`combatOrParty.ts`) — « cliquer ce combattant agit-il ? ». Cherche l'actif via
   `order[turn]` → `undefined` pendant la pause → false. Ajouter une branche « visée armée → adversaire valide ».
2. **`battleClickEntity`** (`combatSlice.ts`) — `return` tôt si aucun actif. Router le tir AVANT ce garde.
   **C'est le choke UNIQUE carte ⇄ frise** (le token de carte via `useStagePointer:194` ET `onStripPortrait`
   y passent) → le brancher ICI fait marcher les DEUX surfaces d'un coup, pas de chemin parallèle.
3. **`hoverTargeting`/`hoverAim`** (`useHoverTargeting.ts`) — réticule + trait + infobulle, keyés sur l'actif +
   `myTurn`. Réutiliser le MÊME `hoverTargeting(get, TIREUR, cible)` (il délègue à `currentTargetingMode().affordance`,
   qui vaut `ATTACK_MODE` en neutre → OK pour le tireur). Pas de duplication.
4. **`hoverTracking`** (`IsoStage.tsx`) — le suivi du survol SOURIS exige `activeC?.kind === 'hero'` → OFF pendant
   la pause → `hover` (tuile) jamais posé → aucun réticule à la souris. L'activer quand la visée est armée.
   (Piège : un `__wfrp.hover()` programmatique pose `hoverCombatantId` et MASQUE ce trou — seule la vraie souris le révèle.)

Deux extras hors-couture : la **modale** de jet n'existe que portée par une **cascade `jet:'attack'`** (pas
`pendingAttack` seul, cf. `active-modal.test.ts`) → l'ouvrir aussi ; `heldGround` forcé sur l'interruption
(tir immobile d'office) sinon pénalité « Tir en bougeant » (−10) absurde hors tour.

**5. CLAVIER (`0a2736ed`)** — 5e couche, MÊME présomption : le curseur de combat + `validTargets` (Tab) keyent
sur l'ACTIF. Fix = **`cursorActor(get)`** (source unique dans `targeting.ts` : actif contrôlé, sinon tireur
`preemptAiming`) consommé par `validTargets` + `moveCursor` ; gardes clavier `curOrPreempt` ; `round-start`
(Entrée) OFF si armé → Entrée COMMET le tir ; touche `T` = `armPreempt` cyclé + `snapCursorToTarget`. Le
COMMIT converge déjà par `battleClickEntity` armé (couture 2). `preemptShooterIds` = éligibilité UNIQUE
frise⇄clavier. **Leçon** : « ça marche à la souris » ≠ « ça marche » — un jeu clavier a une 5e surface à router.

**Méta-leçon (répétée)** : unit-tests + tracing paraissaient airtight ; seul le NAVIGATEUR a révélé les 4 trous
(modale muette, −10, clic-carte inerte, survol-souris mort), CHACUN une présomption « actif » distincte. Idem
[[game-zone-maneuver-defender-silent-jet]]. Réutilisable pour la future UI de tour-action ENNEMI ([[game-gm-seat-controller-axis-vision]]).
