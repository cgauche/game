---
name: game-flow-choice-frappe-reactive
description: "Exécuteur du nœud Flow `choice` + Frappe réactive migrée en effet data-driven onCharged cadence-aware (hook freeAttack). Pilote du système de réaction opt-in."
metadata: 
  node_type: memory
  type: project
  originSessionId: 2bd0b898-fab8-47a8-b273-3403aa017410
---

**LIVRÉ (2026-06-20, commits 7a25f823 / 598cc74d / 41a9bd58 / f6c28d60, branche feat/wfrp4-rpg-foundation)** — exécuteur du 5e nœud Flow `choice` (décision joueur opt-in) + pilote **Frappe réactive** (LDB 10 l.429-432) en effet `TalentData.effects` `onCharged` cadence-aware. Suite 417 fichiers / 0 échec, typecheck 0, golden byte-identique (aucun re-baseline : le changement RNG de Frappe réactive est isolé à onCharged, hors golden round/hitSaves). Prolonge [[game-trigger-cadence-aware-no-silent]] + [[game-talents-editable-data]].

**Exécuteur `choice` (calque `resolveFlowTest`)** dans `src/state/combat/triggeredTest.ts` :
- `runCombatFlow` gère `case 'choice'` (continuation `after = stack.splice(0)`).
- `resolveFlowChoice(ctx,node,after)` : décideur = `ctx.caster`. Héros manuel (`roundTestInteractive`) → étape de cascade `triggeredChoice` (calque l'étape-choix `knockdown` : `options` yes/no + `defaultChoice:'no'` + `interactive`) — RENDUE par le chemin CHOIX GÉNÉRIQUE de CascadeModal (`stepInteraction='choix'` infère de `options` ; zéro UI nouvelle). Ennemi/auto → décision inline (oui si coût d'Avantage payable).
- Applier UNIQUE `registerCascadeApplier('triggeredChoice')` : reconstruit le décideur depuis get()/hero, dépense le coût, joue `choiceYes`/`choiceNo` via `runCombatFlow` (peut empiler un `triggeredTest` cadence-aware), puis `after`. Zéro applier par mécanique.
- `CascadeStepMeta` += `choiceYes`/`choiceNo`/`choiceCost`/`freeAttack` (+ type `FreeAttackFreeze` dans pendings.ts) — sérialisable (coop). Réutilise `cascadeChoose` (intent déjà en COMBAT_INTENTS) — pas de nouvel intent.

**POINT DUR `grantFreeAttack` (op IMPURE, inerte dans applyOps) résolu par HOOK injecté** (motif `setTriggeredTestRouter`/`setConditionGainedHook`) :
- `setFreeAttackHook` (leaf triggeredTest) ← `freeAttackHookImpl` (combatFlow) câblé dans `createCombatSlice`. `runCombatFlow`, sur un `do`/`ops` portant `grantFreeAttack`, appelle le hook → `applyTalentFreeAttack(actor, op, fa)`.
- La frappe vise un **TIERS** (le chargeur `onCharged` / la victime `onHit`), threadé via `ExecCtx.freeAttack:{targetId,cap,key}` (live) ET mirroir `meta.freeAttack` (cascade, sérialisable). `applyTalentFreeAttack` résout `target` depuis `get().battle` par `fa.targetId`.
- **Branche IMPURE** : `applyTriggeredTestBranch` route la branche `success` (qui porte `grantFreeAttack`) via `runCombatFlow` (hook) au lieu de `runSpellFlowLines` (pur) quand `exec.freeAttack` fourni → la frappe se résout après le Test influencé. Mâchoires/Venin restent sur le chemin PUR (byte-identique).
- **RETIRÉ** : le Test inline `applyTalentFreeAttack` l.1840 + le champ `test` de l'op `grantFreeAttack` (ops.ts) — le Test est désormais un nœud Flow `test` EN AMONT. `freeAttackOpsOf` (collecteur) supprimé (mort). `resolveTalentFreeAttacks` route chaque talent par son Flow via `runCombatFlow`.

**Donnée** `talents.json` `frappe-reactive.effects` : `choice{prompt:'Frappe réactive',icon:⚔️} → yes:test{I,intermediaire} → success:grantFreeAttack{mainHand,immediate,perChargerOncePerRound} ; fail/no:seq[]`. Assaut féroce (`onHit`, Flow `do` pur) INCHANGÉ — passe par le même `runCombatFlow`, strike sans test, cost auto-spent.

**Recette navigateur PASSÉE** (port 5199 frais, scénario `engagement`, `__wfrp.talent`+nouveau `__wfrp.charge(enemyId[,heroId])`) : Gobelin charge Sigmund (Frappe réactive) → modale de CHOIX « Frappe réactive / Renoncer » → « Oui » → Test d'Initiative INFLUENÇABLE (Chance ×2 visible) → 41/80 DR4 succès → frappe gratuite résolue (Gobelin 11→8, `freeAttacksThisTurn` capé + per-charger marqué) ; « Renoncer » → aucune frappe ; 0 erreur console. Devtool `__wfrp.charge` = mime `resolveTalentFreeAttacks('onCharged')`.

**Reste du DESIGN VERROUILLÉ** (cf. [[game-trigger-cadence-aware-no-silent]]) : Déstabilisante (QUALITÉ AA, opt-in 2 Av + Test opposé) reste sur l'ancienne étape `knockdown` bespoke — PAS migrée (hors scope, Frappe réactive = pilote SEUL). Le nœud `choice` est prêt à la porter (coût d'Avantage géré).
