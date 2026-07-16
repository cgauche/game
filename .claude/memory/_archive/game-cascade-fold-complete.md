---
name: game-cascade-fold-complete
description: Plan « une situation = une modale » COMPLET (defense+maladresse+cleave/dual+doc) + correctifs critique défensif
metadata: 
  node_type: memory
  type: project
  originSessionId: ac3fb303-33fb-4bd5-999a-5b57154f44c2
---

Plan combat-defense-cascade (`scalable-shimmying-floyd.md`) **MENÉ À TERME** — toute situation de combat (jet + conséquences) vit dans UNE cascade `purpose:'combat'`, plus de modale d'arbitre qui court-circuite. Commits : balayage/dual `b28b224`, critique défensif `6645d3a`, dette tests `fb78901`, maladresse `511edf0`.

- **Lot 1 défense** (déjà livré) : `jet:'defense'` rendu par `useDefenseJetProps`.
- **Lot 2 maladresse** : `CascadeStep.jet+='fumble'`, `useFumbleJetProps` (props RollFlowShell, tirage de TABLE, ZÉRO influence — pas de cible/DR), les 3 sites (attackConfirm/defenseConfirm/resolveDeviation) **`pushCombatStep`** une étape `fumble` ; `fumbleConfirm`→`cascadeNext` (repli `resumeEnemyTurn` hors cascade) ; `pendingFumble.resumeAfter` SUPPRIMÉ ; `FumbleModal.tsx` supprimé + entrées modalArbiter/ActiveModal retirées.
- **Lots 3-4 balayage/dual** : la cascade reste OUVERTE tant qu'un enchaînement (`pendingCleave`/`pendingDualStrike`) → la frappe suivante (posée par cleaveAttack/dualStrikeAttack, qui ne touchent PAS la cascade) se rend dans la MÊME étape `attack`. Helper **`advanceCombatJet(get)`** (store.ts module-level) : n'avance/clôt qu'au bout (plus de pendingAttack NI d'enchaînement) — appelé par attackConfirm/cleaveEnd/dualStrikeSkip.

**Mécanique clé** : `pushCombatStep(set, step)` / `pushReveal` (combatEffects) APPENDENT à la cascade `combat` active (`cursor < participants.length`), sinon ouvrent une « Conséquences ». `advanceCombatJet` finalise. Le rendu inline d'un jet non-standard = un hook `useXJetProps` → props RollFlowShell (le `actor` n'injecte le portrait QUE dans une ligne de jet ; un tirage de table n'en a pas → nom dans le subtitle + `TableRollLine` en `outcome`).

**Correctifs critique DÉFENSIF** (retours playtest, `6645d3a`) — LDB 13 l.184 (« le défenseur sur un double inflige un Critique ») / LDB 14 l.7 : déjà implémenté `combatFlow.ts` bloc (b) `applyOpposedCritical(attacker,…)`, MAIS (1) ne distinguait pas Parade/Esquive → gardé sur **`res.parryWeapon`** (Esquive = Test d'Agilité, pas de Critique) ; (2) la déviation d'office sur armure ennemie n'écrivait qu'au feed → la fenêtre se fermait sans rien montrer → `applyOpposedCritical` **pushReveal** un `critical` « dévié » quand un héros est concerné. Le critique défenseur n'est PLUS auto-tiré silencieux : visible inline comme un Critique normal.

**Bug Charge trouvé + corrigé** (`a84f284`) en cherchant à retirer l'entrée `attack` : le chemin de CHARGE (`battleClickEntity`, `plan.kind==='charge'`) posait `pendingAttack` puis `return` SANS `startCascade` (contrairement à normale/gratuite) → l'attaque de Charge n'ouvrait pas la cascade, ses conséquences débordaient dans une popin séparée. Ajout du `startCascade` manquant. **Puis** entrée d'arbitre `attack` + `RollModal.tsx` (= `<RollFlowShell {...useAttackJetProps()}/>`, doublon de la branche cascade) RETIRÉS (`235de18`) — preuve : les 5 poseurs de `pendingAttack` en prod (charge/normale/gratuite/cleaveAttack/dualStrikeAttack) ouvrent ou réutilisent tous une cascade ; les tests posent `pendingAttack` en direct mais ne rendent pas l'arbitre. **Plus aucun jet/conséquence de combat hors cascade.** Prolonge [[game-modales-unification]] + [[game-panneau-de-jet-unique]].
