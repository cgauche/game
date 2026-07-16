---
name: game-talent-test-recode
description: "Recode de TalentData.test (texte libre → {raw, matches[]}) + talentTestSLBonus unifié ; fondation faite (commit ae5aa72f), Phases 3-5 restantes."
metadata: 
  node_type: memory
  type: project
  originSessionId: 79086e8f-2b86-464f-8a9e-6f2bc67f4515
---

Chantier « recoder `.test` » (le champ « Tests : » des talents, ex-texte libre matché par substring/libellé). Plan approuvé : `C:\Users\gauch\.claude\plans\composed-drifting-narwhal.md`. Forks user : (1) **appliquer LDB 10 universellement** ; (2) **`.test = { raw, matches[] }`** (`raw` verbatim Codex/rule 5 ; `matches` structuré id-based, la logique ne lit jamais `raw`).

**FAIT — Phases 1-4 (commits ae5aa72f + d8450152 + 54cd65b9 ; après merge naval PR#6) :** structure `{raw,matches}` + `talentTestSLBonus` unifié + application UNIVERSELLE au nœud `test` (rollFlows, additif à talentTestDR, DISJOINT) + PendingTest porte skillId/spec/char (threadé de FlowTest via combatEffects) + **114 talents curés** (20 AUTO actifs, 67 manual, 13 display-only ; 10 talents combat.testDR/reverseFailed laissés sur leurs features) + `TestMatch.exceptSpec` (Linguistique « Langue (toutes) » SAUF Magick, desc le précise) + `talent-test-sl.test.ts` (toutes branches + garde d'intégrité matches). Suite 5984 verte.

**FAIT — Unification finale (commit e5bad4af) :** les 2 systèmes de Test de Talent par-LIBELLÉ supprimés — `combat.testDR` retiré (subsumé par `talentTestSLBonus` : menacant→{skill:'intimidation'} auto, bonnes-jambes/grand-orateur→{skill,manual}, `raw` reconstruit car `.test` était null) ; `combat.reverseFailed` passe à `{skill, spec?, capDR?}` id-based (7 talents), `talentReverseFailed(c,{skill,spec})` ; `talentTestDR` fonction supprimée ; éditeur Codex dédié pour reverseFailed. PLUS AUCUN match par libellé dans le système. Suite 5984.

**FAIT — Phase 5 (commit 3071cee9) — CHANTIER CLOS :** `TalentTestField` (StructFields) édite `raw` (texte) + liste `matches` (picker compétence/Caractéristique + spec / au-choix / sauf-spec + bascule manuel + ConditionEditor pour when) ; câblé dans CodexEdit + `'test'` dans dedicatedFieldKeys('talents') → no-json-fields OK. Vérifié au navigateur (Codex › Talent › Éditer = champ « Tests liés », 0 erreur console). **Les 5 phases sont livrées.**

**Détail Phases 1-3 (historique) :**

**Détail fondation (ae5aa72f) :**
- `src/data/index.ts` : `TestMatch { skill?|char?:CharKey, spec?, specFromInstance?, when?:Condition, manual? }` + `TalentTest { raw, matches }` ; `TalentData.test: TalentTest|null`.
- `talents.json` : 114 entrées migrées `"<txt>"` → `{raw, matches:[]}` ; 2 talents d'incantation curés (diction-instinctive `{skill:'langue',spec:'Magick'}`, harmonisation-aethyrique `{skill:'focalisation'}`).
- `src/engine/magic.ts` : NOUVEAU `talentTestSLBonus(c,{skill,char,spec}, whenHolds?)` = SOURCE UNIQUE du +DR de Talent (matching PUR moteur + `when` INJECTÉ par `whenHolds` → engine reste pur, règle 3 ; `Condition` en type-only). `castTestTalentDR` recâblé dessus → plus de `.includes`/libellé. `matches:[]` = display-only (= comportement actuel, zéro régression). Suite 5938 verte.

**RESTE (Phases 3-5) :**
- **Phase 3 (wiring universel)** : dans `rollFlows.ts` nœud `test` (resolve, ~l.870/886), AJOUTER `talentTestSLBonus(actor,{skill,char,spec}, cond=>evalCondition(cond, buildActorView(actor)))` en PLUS de `talentTestDR` (DISJOINT → pas de double-compte : les ~10 talents combat gardent `matches:[]` + leurs combat features). Threader `skillId`/`char`/`spec` de `FlowTest` (state/flow.ts:269-273) vers `PendingTest` (pendings.ts) à TOUS les builders de PendingTest.
- **Phase 4** : curer les ~104 `matches` restants (skill id/char/spec/specFromInstance/when/manual), fidèle au `raw` (rule 1). Ne PAS curer les talents à `combat.testDR`/`reverseFailed` (menacant/bonnes-jambes/grand-orateur + 7 reverseFailed) → restent sur combat features (sinon double-compte).
- **Phase 5** : Codex éditer `raw`+`matches` (RefField+spec+toggles+Condition) ; garde refs-migrated (match.skill∈skills.json, match.char∈CharKey) ; tests.
- **Unification finale différée** : supprimer `talentTestDR`+`combat.testDR` (subsumés) ⇒ besoin de SOURCER le `raw` (« Tests : ») de bonnes-jambes/grand-orateur (`.test=null` en base, gap d'extraction).

⚠️ **`rollFlows.ts` + `pendings.ts` sont EN PLEIN refacto naval** (multi-jets shipManeuver, autre session) → forte collision ; Phase 3 en commit partiel (cf. [[git-commits-propres-wip-parallele]]) OU attendre que le naval pose. Voir [[game-traits-trigger-aura-mechanisms]] (skillDRBonus spec-aware, aura), [[game-test-spine-id-migration]].
