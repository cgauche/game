---
name: game-roll-modal-pattern
description: "Jets (attaque + hors combat) résolus par modale différée Lancer→résultat→Chance, via state pendingAttack/pendingTest"
metadata: 
  node_type: memory
  type: project
  originSessionId: 853bfff1-3d45-4fd3-b48b-d55440789864
---

Les jets passent par une **modale à jet différé**, pas une résolution instantanée.

**Attaque** (`src/ui/RollModal.tsx` + store `pendingAttack`) : `battleClickEntity` sur
une cible ouvre la modale au lieu de résoudre. L'utilisateur choisit une **localisation**
(Complexe -10, `combat.ts` applyHit `forcedLoc`), clique « Lancer » (`attackRoll`), voit le
résultat, peut dépenser une **Chance** (`attackReroll`, -1 `fortune`), puis `attackConfirm`
applique. `doAttack` (IA) reste instantané : il appelle `resolveAttack` + `applyAttackResult`
(les deux moitiés du split). `attackCancel` ferme sans agir.

**Hors combat** (`src/ui/TestModal.tsx` + store `pendingTest`) : la brique d'effet `test`
ne roule plus tout de suite — elle stocke les params (`skillValue`/`difficulty`/`requireSL`,
`roll:null`). `testRoll` lance, `testReroll` dépense une Chance du testeur, `resolveTest`
refuse d'acquitter avant le jet puis applique la branche `onSuccess`/`onFailure`.

**Défense réactive** (`src/ui/DefenseModal.tsx` + store `pendingDefense`) FAITE : quand un
ennemi (IA) attaque un héros en mêlée, le tour de l'IA est **suspendu** et le joueur choisit
Parade/Esquive → « Défendre » (roule la défense) → Chance (relance la **défense** seule, atk
figé) → « Appliquer » → reprise IA. `combat.ts` scindé en `rollMeleeAttacker`/`rollMeleeDefender`/
`finishMelee`/`resolveMeleePassive` (resolveMelee délègue, ordre RNG préservé). Suspension :
`doAttack` retourne un booléen ; `attackThenAdvance` n'arme `advanceTurn` que si `!suspended` ;
`resumeEnemyTurn` reprend après confirm (pendingDefense null AVANT → pas de double-advance).
**Piège tests** : les `setTimeout` d'IA fuient entre tests sous fake-timers → `vi.clearAllTimers()`
en before/afterEach + `reset()` qui nulle les `pending*` (sinon flaky, mord sous `--no-isolate`).

**Déviation Critique côté joueur** (`src/ui/DeviationModal.tsx` + store `pendingDeviation`, Phase C1b)
FAITE : un HÉROS qui encaisse un Coup Critique à une localisation armurée choisit Dévier (−1 PA,
ignore le Critique) / Subir (LDB 63 l.63-66 ; l'ennemi dévie en auto, lui). La suspension naît
**à l'intérieur de `applyAttackResult`** (signature `(…, deviated?: boolean): boolean`) : early-return
au tout début si `deviated===undefined && res.hit && res.woundsLost && res.critical && héros && PA>0`
→ set `pendingDeviation` + `return true` (AUCUN effet de bord). `deviationApply(deviate)` rappelle
`applyAttackResult(…, deviate)` (early-return sauté → application UNE fois) puis REJOUE le tail du
caller (autoCleave→aiMaybeTrample→Maladresse défenseur auto-gated par `defenderFumbled`→reprise).
**Piège vécu (re-entrance imbriquée)** : `applyAttackResult` est aussi appelé par les SOUS-attaques
`autoCleave` (balayage) et `applyTrample` (Piétinement) ciblant des héros → elles DOIVENT passer
`deviated=false` sinon la modale se pose en plein milieu d'une boucle (corruption + double-apply au
rejeu). Les **callers** (`doAttack`, `defenseConfirm`, `defenseCancel`) captent le booléen `suspended`
et `return` AVANT leurs post-étapes. Les sorts (`applyCast`) gèrent leurs Critiques à part (inline
`applyCriticalToTarget`) → n'atteignent jamais `applyAttackResult`, donc déviation-sort gated OFF (suite
différée). `deviationApply` ∈ whitelist `EXTRA_OK` du garde-fou `roll-modal-invariant` (résolveur de modale,
pas un jet offert au joueur). Lié à [[game-qualities-registry]] (Jalon 1.6 Phase C1b) et [[game-death-critical-model]].

Discriminant des `Effect` = `type` (PAS `kind`). RNG hors combat = défaut (non seedable) →
tester les jets hors combat par assertions structurelles, pas sur le résultat du dé.
Voir [[game-visual-direction]] (la hotbar suit le combattant actif).
