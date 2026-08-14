---
name: project-audit-conformite-2026-06
description: "Audit de conformité (2026-06-27) → 62 issues GitHub sur cgauche/game (#8-#69), backlog SOLDÉ ; la méthode et la leçon « un titre d'issue ≠ l'état du moteur » restent."
metadata: 
  node_type: memory
  type: project
  originSessionId: 00336363-0f77-4c1d-8153-f37d57b697b2
---

Audit multi-agents du 2026-06-27 (3 livrables : violations de grands principes / contenu RAW manquant des 14 livres hors-scénario / code non branché), vérifié adversarialement **contre le code réel**. Résultat = **62 issues GitHub** sur **cgauche/game (#8 à #69)** — c'est le backlog de référence.

**Labels** : `audit:principe` (17) · `audit:contenu-manquant` (41) · `audit:non-branché` (4) ; croisés avec `livre:*` (LDB/MDG/AA/ADE/EDO-EDOC/T2C/Middenheim/NADJ/ZI/Altdorf/T3), `type:système|règle-optionnelle|donnée`, `sev:majeur|mineur|smell`, `domaine:*`, et `policy-à-trancher` (2 issues hors règle 1 : Activités d'Altdorf = scénario, panthéon de dieux de saveur).

**Pépites prioritaires** : 2 majeurs A — trait **Taille** résolu par libellé dans `spawn.ts:59` (cf. [[game-ids-internes-libelles-display-multilangue]]) et trait **Dressé** mal sourcé (LDB→AA) + desc paraphrasée (R5) ; 1 **bug RAW** — `reduceToZero` (ops.ts:983) ajoute toujours `Inconscient` → « Tonnerre et foudre » non-RAW. Le **naval MDG** (~13 issues `domaine:naval`) = chantier en cours connu, à traiter en lot ([[game-naval-tactical-chantier]]).

**Plan d'attaque `audit:principe` (#8–24) par LOTS groupés** (bilan avant chaque commit) :
- **LOT 1 ✅ FAIT** (commit `acc010f9`, 2026-06-27, branche feat/wfrp4-rpg-foundation) — #9 (majeur, traits par id stable : `ResolvedTrait.id` + helper `findResolvedTrait`), #11 (crinière `mane` source unique), #15 (dédup `actorIn`), #18 (commentaires menteurs loadouts), #22 (`depth()` dims obligatoire), #23 (breakpoint 760→700). typecheck + 6079 tests verts. **Pas encore poussé.**
- **LOT 2 ✅ FAIT** (commit `ba9a139e`, poussé) — #14 (op `corruption`+`align` ; Effet `ops` câble la cascade ; `giveCorruption` supprimé), #13 (`afterCast`→op `grantTrait`+`durationRounds` ; `castBonus`=capability), #17 (reduceToZero=PB→0 seul ; Châtiment Inconscient explicite ; Fauche-démon→op `banish` ; **bug latent** « Enflammé »→id `en-flammes` corrigé). suite verte (hors #70).
- **LOT 3** (id gros) : #10 (`SlotOption`/talents + outil de Test `tool`→`trappingId`), #8 (reloger `Flow`/`TriggeredEffect` en engine).
- **LOT 4 ✅ FAIT** — #16 (`RestModal`→`OptionChooser`) + #19 (Psycho IA→`psychResolution`) commit `cf303f38` ; #20 chirurgie→flux `pendingSurgery`/`FLOWS.surgery` (commit `9a8a739c`) + Fuir→mini-flux `flee` Calme influençable (+1 DR sans flip, RAW) + nettoyage whitelist (commit `12039362`). suite verte (6133).
- **#21 ✅ FAIT** (commit `99f18d0f`) — trait Dressé (Cavalerie de choc) re-sourcé `book=AA` p.107 (vérifiée PDF VF via pymupdf, ch.IX) + desc verbatim ; SEULE cette entrée (7 autres « Dressé » = LDB p.339 intacts). **2e majeur soldé.**
- **#10 ✅ FAIT** (commit `7142b393`) — `SlotOption.optionId` + appariement talents/compétences possédés par id+spec ; outil de Test `tool`→`trappingId` (picker FlowEditor + dual-match combatEffects). careerTalentAdditions laissé par libellé (refLabel symétrique, signalé).
- **#8 restant** (moteur pur) : ⚠️ le fix littéral du ticket est INFAISABLE (`Flow` dépend de `Effect` state). Vraie solution = extraire `src/engine/flowCore.ts` avec `Flow<E=EffectOp>`/`TriggeredEffect<E>` GÉNÉRIQUES + `Condition`/`evalCondition`/`FlowTest`/`TemporalCondition` + helpers ; `state/flow.ts` ré-exporte et instancie `Flow<Effect>`. Périmètre élargi : aussi types.ts(×2), magic.ts(×2) ; corruption.ts(EntityAppearance)=inversion SÉPARÉE hors-scope. Bonus : ajouter un garde de pureté `engine-purity.test.ts` (inexistant). ⚠️ collision types.ts avec WIP armes autre session → faire quand l'arbre se calme.
- **#24 ✅ FAIT** (commit `bbc16267`) — `onVictory: Effect[]`→`Flow` ; `finishVictory` aplatit via `flattenFlow` (hunk combatFlow déjà en HEAD via leur commit #76) ; garde validateScene (pas de Test/Choix dans onVictory) ; éditeur FlowEditor ; arène convertie chirurgicalement (PAS de regen — il reformate tout + dérive créatures). 81 tests verts.
- **#8 ✅ FAIT** (commit `0191e479`) — extraction `src/engine/flowCore.ts` (`Flow<E=EffectOp>`/`TriggeredEffect<E>` génériques) ; `state/flow.ts` ré-exporte + instancie `Flow<Effect>` (+ wrappers builders fixés-Effect) ; scene `ops`→`EffectOp` ; engine importe flowCore. **+ garde `engine-purity.test.ts`** (échoue sur import engine→state ; allowliste corruption.ts→EntityAppearance = inversion séparée hors-scope). 264 tests verts.

- **#12 ✅ FAIT** (commit `af8f230f`) — push/teleport/chainOnKill → 3 ops IMPURS (`push`/`teleport`/`chain`) inertes dans applyOps, résolus par combatFlow via `spellOps(effects,'caster')` (chain en branche missile, teleport différé inchangé, ordre push→zoneCrossings) ; 5 sorts migrés ; targeting/spellspec/GameOpEditor ; 4 champs retirés de SpellData. 149 tests verts. combatFlow committé en BUNDLE (embarque le WIP IA offensiveSpell d'une autre session — assumé).

## ✅ audit:principe (#8-24) = 17/17 TERMINÉ
12 commits (`acc010f9`→`af8f230f`), 2 majeurs (#9, #21) soldés, garde de pureté engine ajoutée (#8). Méthode : agents codeurs → vérif adversariale → typecheck+tests par moi → commits par chemins explicites (bundle assumé sur fichiers cœur cohabités combatFlow/types/index).

**Familles de l'audit hors #8-24** : `audit:contenu-manquant` (~41, dont naval #25-36, LDB #37-59…), `audit:non-branché` (#65-68), policy-à-trancher (#54, #63). **Backlog SOLDÉ** : les 62 issues #8-#69 sont toutes closes sur `cgauche/game` (mesuré 2026-07-26).

## ⚠️ Re-vérif 2026-06-28 — l'audit avait des FAUX POSITIFS (issues créées AVANT l'implémentation)
Plusieurs `contenu-manquant` étaient déjà codées (l'audit du 26-27/06 a précédé les commits #40/#42/#60/#61/#64…). Re-vérifié contre le **code réel** (7 agents Explore, pas sur la foi des commits) puis tracker nettoyé via `gh` :
- **FERMÉES (FAIT vérifié)** : **#40** (armes AA + gantelet `preventForcedDrop`), **#42** (7 sous-parties combat : Empoignade/Retenir/dispersion/tir-mêlée/Au Contact/Initiative), **#60** (4 créatures Middenheim), **#64** (talent Sang Neuf), **#80** (`woundsAtCritLocation` + déviation sur loc fraîche + `critWoundLocation` source unique, `engine/combat.ts:984`/`critical.ts:85`).
- **Le statut d'un ticket se lit sur le TRACKER** (`gh issue view <N>`), jamais d'après un rendu d'audit ni un titre d'issue : les 45 issues #25-#69 sont CLOSES (mesuré 2026-07-26) — y compris celles re-vérifiées partielles à l'époque (#25 bordée, #29 maladies marines, #41 Brisé, #46, #50, #51, #52, #57, #61, #62), la famille `non-branché` (#65-68) et les 2 `policy-à-trancher` (#54, #63).

Leçon : un titre d'issue d'audit ≠ état du moteur ; toujours re-vérifier au code avant de planifier (CLAUDE.md règle 6).

⚠️ Arbre EXTRÊMEMENT partagé (autre session : armes #76, IA-sorts offensiveSpell/aiSpellValue, créatures, maladies/symptoms, magic.ts). Ils committent `combatFlow.ts`/`combatSlice.ts` en embarquant parfois MES hunks non commités (cf. #24 finishVictory embarqué par #76). Toujours committer mes SEULS fichiers par chemin ; vérifier `git diff --cached` pour contamination.

⚠️ Arbre TRÈS partagé (autre session committe en // : #70-fix, #73 Codex, #60/#64 créatures, WIP weapons). Toujours committer mes SEULS fichiers par chemin explicite (jamais `git add src/`).

Méthode imposée par l'user : [[credo-exemples-calibrants]], CLAUDE.md règle 6, [[feedback-workflow-concurrence-rate-limit]]. Plan détaillé : `~/.claude/plans/rosy-moseying-music.md`.
