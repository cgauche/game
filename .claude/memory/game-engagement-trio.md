---
name: game-engagement-trio
description: Couche tactique combat — état Engagé + Charge + Désengagement (src/engine/engagement.ts + store)
metadata: 
  node_type: memory
  type: project
  originSessionId: 853bfff1-3d45-4fd3-b48b-d55440789864
---

Couche tactique du combat (LDB 13-Combat / 15-Déplacement), 100 % Source, testée sans navigateur.

**État Engagé** (`src/engine/engagement.ts`) : relationnel symétrique `Combatant.engagedWith[]`,
posé par `engage()` dans `applyAttackResult` sur **toute** attaque de mêlée (touche ou non) ;
levé par `decayEngagement()` en fin de Round (dans `advanceTurn`) si aucun coup échangé ce Round
(`meleeThisRound[]`, parallèle à `gainedAdvThisRound`). Un Engagé ne se déplace plus librement :
`battleSelectAction('move')` le route vers `startDisengage`.

**Charge** : action explicite `'charge'` (pas une détection implicite). Portée = Course = 2×Mvt
cases ; l'attaque est **obligatoire** (`pendingAttack.fromCharge` → `attackCancel` no-op).
`chargeAdvantage(M, distFrom)` = +1 base, +1 si `distFrom ≥ ceil(M/2)` cases (seuil en MÈTRES,
1 case = 2 m) ; borne haute **2M+1** (la case d'arrivée est adjacente à la cible = 1 de moins).

**Désengagement** (`pendingDisengage`, `phase: 'choice'→'esquive'`) = un **MENU** : *Sacrifier
l'Avantage* (si Av>adversaires → 0, libère tous, Action **non** consommée) / *Esquiver* (Test opposé
vs CC du foe le + dangereux, modale + Chance, Action consommée ; succès = +1 Av + libère tous, échec =
foe +1, **tie = statu quo**) / **Fuir** (`disengageFlee` : foe +1 Av + **attaque dans le dos** +20 via
`resolveBackstabAttack`, si touché +1 Av + Test de Calme ou **Brisé**, puis libéré + Mouvement de
Course 2×Mvt) / *Renoncer*. **Piège** : « Déplacer » en Engagé route vers le menu, mais doit vérifier
`battle.acted` (l'Esquive ratée consomme l'Action → sinon boucle infinie). `disengageOutcome(winner)` mappe le tie.

**Simplifications IA assumées** (revue de fidélité, mineures) : l'IA ne fait pas de Désengagement
et charge en portée de **Marche** (pas Course). Documentées dans `runEnemyAI case 'move'`.
Reste de la couche tactique : **ramasser**. Voir [[game-roll-modal-pattern]].
