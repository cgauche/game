---
name: game-101-amputation-weapon-context-design
metadata: 
  node_type: memory
  type: project
  originSessionId: 748d9d74-6f65-4c5e-b1fd-ac5188f455e0
---

> **FAIT — `d0c7746a`** (suite 8218 verte). `weaponUsesHand` + `amputationCombatPenalty` (`trauma.ts`), charMod
> retiré de `permanentAmputations`/`consolidateAmputations`, câblé `attack/defenseModifiers`, tests réécrits +
> `amputation-combat.test.ts`. Follow-up **#144** = escalade de Maladresse par doigt (l.251). Note conservée pour
> le RATIONALE (pourquoi contextuel-à-l'arme ≠ le charMod naïf de l'issue).

**#101 (dernier ticket ouvert de #101-112, fichiers NON contendus par la session //).** Bug : la pénalité
d'amputation (doigts −5/doigt, main −20) est gatée sur `dominant` (`loc==='brasD'`) → une amputation au bras
GAUCHE ne coûte rien. `critical.ts:34/37` (`permanentAmputations`) + `trauma.ts:258/262` (`consolidateAmputations`).

**Design VERROUILLÉ avec l'user** (≠ le « fix proposé » NAÏF de l'issue) :
- L'issue propose un charMod CC/CT INCONDITIONNEL → **rejeté** : ça sur-pénalise une arme à 1 main tenue dans la
  main SAINE quand l'autre est blessée. Le RAW dit « −5 à tous les Tests qui **impliquent cette main** » (LDB 18
  l.251 doigts) / « −20 aux Tests qui **utilisent cette main** » (l.263 main).
- Modèle RAW-précis : pénalité = **modificateur contextuel au jet d'ARME**, appliqué ssi l'arme IMPLIQUE la main
  blessée. `weaponUsesHand(weapon, side)` : 2 mains → les DEUX ; 1 main → la main de tenue (`weapon.hand==='off'`
  = gauche, sinon droite/dominante). Côté blessé = `loc` de la Trauma (brasD=droite, brasG=gauche).
- Clause secondaire (l.263) : si la MAIN PRINCIPALE (brasD) est PERDUE (`main-bras-ampute`@brasD), −20 additionnel
  aux jets utilisant la main SECONDAIRE (on se bat de la main gauche maladroite). `maxWeaponHands:1` force déjà
  l'arme dans la main restante → pas de double-comptage.

**Plan** : (1) retirer les `charMod` de `permanentAmputations` (garder `maxWeaponHands`) + de `consolidateAmputations`
(les Traumas gardent `location`+`count` → source de la donnée par-main). (2) `weaponUsesHand` + `amputationCombatPenalty(c, weapon)`
dans `trauma.ts` (lit les Traumas consolidées). (3) câbler dans `combat.ts` `attackModifiers` (l.352) + `defenseModifiers`
(l.457, motif `parryPenalty`→« Main secondaire » l.468). (4) recréer `src/engine/amputation-combat.test.ts` (SUPPRIMÉ)
en TDD : gauche doigts + arme 2 mains = −5/doigt ; + arme 1 main droite = **0** ; droite = comme avant ; main
principale perdue → −20 sur l'arme de la main gauche. (5) MAJ commentaire d'en-tête `trauma.ts:8` (« latéralité non
modélisée » périmé). (6) `npm test` + typecheck complets + recette navigateur (effet combat visible).

Voir aussi [[game-trauma-ops-passive-collector]] (collecteur passif), [[feedback-effet-existant-general-parametrable]].
