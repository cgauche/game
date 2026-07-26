---
name: game-split-movement-decision
description: "LIVRÉ : Mouvement DÉCOMPOSABLE mais NON entrelacé avec l'Action (M*A | A-M*, jamais M-A-M) ; battle.moved→movementUsed+movedPreAction ; + option de tir « Je ne bouge pas » (heldGround)"
metadata:
  node_type: memory
  type: project
  originSessionId: e8da4937-e7c9-443e-bf71-432062e78922
---

**Règle finale (corrigée par l'utilisateur 2026-06-09)** : le Mouvement du Tour est **DÉCOMPOSABLE** (fractionnable en plusieurs segments, total ≤ Marche) **MAIS PAS entrelacé avec l'Action**. Séquences permises : `Mouvement* puis Action` OU `Action puis Mouvement*`. **INTERDIT : `Mouvement → Action → Mouvement`** (« on ne peut pas faire mouvement action mouvement, mais on peut décomposer son mouvement tant qu'on ne fait pas d'action [entre] »). Cas d'usage cité : bouger pour repérer les ennemis (système de vision futur) puis faire demi-tour, tant qu'aucune Action n'a lieu entre les 2 segments. ⚠️ La 1re itération autorisait à tort « Mvt → Soigner → Mvt » — RÉVERSÉE.

**LIVRÉ** (commit `75d35b7`, suite verte) :
- `BattleState.moved:boolean` → **`movementUsed:number`** (cases parcourues) + **`movedPreAction:boolean`** (du Mvt a-t-il eu lieu AVANT l'Action ?).
- Helpers dans `src/state/mount.ts` : `movementRemaining(battle,c)` (= budget monture/Marche − movementUsed) et **`canMove(battle,c)`** (= `!(acted && movedPreAction) && remaining>0`). Réexportés par `store.ts`.
- `battleClickTile` cumule le coût du segment (`reachable.get(k)`) ; marque `movedPreAction` si le segment précède l'Action ; reach = Mouvement restant. **Charge/Course/Monter/Descendre/Se relever** exigent `movementUsed===0` et le consomment en entier. Resets de Tour/Round → `movementUsed:0, movedPreAction:false`.
- `ActionBar` : bouton Déplacer + indicateur affichent les cases restantes ; gating via `canMove`.
- Tests : `src/state/split-movement.test.ts` (6 cas). `moved:false/true` → `movementUsed:0/99` dans ~12 fichiers de test.

**+ Option de tir « Je ne bouge pas » (heldGround)** (commit `af93eb7`) : puisqu'on peut bouger APRÈS le tir, un tir mobile garde le **−10 « Tir en bougeant »** (LDB 14 l.101) par défaut ; le héros peut choisir de tirer IMMOBILE (comme « Tirer dans le tas ») → annule le −10 mais **consomme son Mouvement**. Proposé seulement si Mouvement non entamé. `PendingAttack.heldGround` + `attackSetHeldGround` ; règle −10 = `héros ? !heldGround : movementUsed>0` ; `attackConfirm` pose `movementUsed=plein` si heldGround ; toggle RollModal. Tests : `stationary-fire.test.ts` + `combatFlow-los.test.ts`.

Charge reste l'action COMBINÉE non décomposable (rush Course + attaque obligatoire). Prolonge [[game-engagement-trio]], [[game-difficultes-combat-table]].
