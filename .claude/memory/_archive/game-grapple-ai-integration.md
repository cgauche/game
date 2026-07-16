---
name: game-grapple-ai-integration
description: "Empoignade côté IA complète (LOTs A-E) — data-driven, vocabulaire général, réutilise grapplingWith"
metadata: 
  node_type: memory
  type: project
  originSessionId: 595d00e2-e728-4472-a745-cee05f908fbc
---

Le versant **IA de l'Empoignade** (LDB 14) était absent (le joueur l'avait). Construit en 5 lots, tout data-driven :

- **A** — op `condition {grapple:true}` → `setGrapple(ctx.caster,target)` (ops.ts case 'condition'). `grapple.json` = `GRAPPLE.init`/`GRAPPLE.win.{damage,entangle,free}` (GameOp). `applyGrapple` joueur + IA partagent l'application. `clearGrappleOf` supprimé (redondant : `clearEngagementOf` purge déjà `grapplingWith`, engagement.ts:81/84).
- **B** — IA agit quand empoignée : garde PURE dans `chooseEnemyAction` (après `isShooterOrCaster`) → `{kind:'grapple',targetId,resolution:'break'|'test'}` (préempte le scoring, RAW l.161). Break = re-décision (comme `spendResource`, boucle runEnemyAI). `case 'grapple'` instantané. **break ssi Avantage strict sup. ET `isShooterOrCaster`** (un mêleeur reste en lutte). Résolveurs partagés `resolveGrappleWin`/`resolveGrappleOpposed` (combatFlow).
- **C** — Constricteur : `grapple:true` sur son op condition (traits.json). NB **Toile ≠ Empoignade** (n'a PAS le flag). Init = sur la TOUCHE (RAW « toucher »).
- **D** — Tentacules (`grapple:true`) : résout la prise en **Attaque GRATUITE, NON verrouillée** (`holdsViaLimb` saute le verrou B — RAW p.343 « au lieu de l'Action »). Langue (`grapple:true` + pull si Taille≤ via `pullToward`) : **VERROUILLÉE** (p.340 « voir page 163 » = règle générale ; un Langue tireur « lâche prise » via le Break de B). Gate « si Dégâts » des Tentacules : déjà assuré par `applyFreeAttackEffects` (`if (!res.woundsLost) return`, combatFlow:2156) — pas le faux bug onHit/onDamage.
- **E** — Absorption (EDO p.147) : victime absorbée = foe `grapplingWith` (se débat via B). Vocabulaire GÉNÉRAL (zéro chemin « absorption » en code) : `EffectTargeting 'grappled'` + `{pick:'engaged',sizeAtMost:'self',max}` (capacity-aware) ; Condition **`engagedAdvantageLead`** (signé = selfAdv − maxFoeAdv ; ≠ `engagedAdvantageGap` qui est CLAMPÉ et mesure l'excès ENNEMI — l'INVERSE) ; Formula `{woundsDealt:true}`. Digestion+soin sur le trait (`bonusOf F`+`healCaster` réfèrent le porteur). Garde `isOutOfAction` (triggeredEffects:326) épargne le cadavre.

Commits : 7daa7270→9e6e5f91. ⚠ **Hazard arbre partagé** : la session // committe combatFlow/path/ops PAR CHEMIN → emporte mes hunks non commités de ces fichiers dans SES commits (08e2c982…). Mes data/ai/test survivent → isoler mes hunks par patch filtré ([[git-commits-propres-wip-parallele]], [[game-agents-worktree-isolation-shared-branch]]). Worktree exclu (pas de node_modules → pas de tests).
