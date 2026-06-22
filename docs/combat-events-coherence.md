# Cohérence du système d'événements de combat — constat & cible (à traiter)

> Note de session (2026-06-22). **Aucune correction faite ici** — c'est un état des lieux + la cible
> décidée + des bugs concrets relevés en exemple, à corriger dans un chantier dédié plus tard.
> Boussole : data-driven (GameOp/Trigger) · zéro doublon/legacy/dette · respect du RAW.

## 1. Constat : trois strates d'une migration jamais finie

Le « système » de réactions/événements de combat est en réalité **trois mécanismes parallèles** qui se
chevauchent sémantiquement sans s'aligner :

1. **Phase 1 — `GameOp` `test`/`opposedTest`** (pré-juin) : jets/effets en ops inline, résolus en
   silence dans `applyOps`. Supprimée (`c1380b8f`) ; `GameOp[]` survit comme vocabulaire-feuille.
2. **Phase 2 — `Flow` + `TriggeredEffect`** (`flow.ts`, `triggeredEffects.ts`) : modèle data-driven,
   arborescent, éditable au Codex. **La bonne direction.** Mais jets de héros restés silencieux.
3. **Phase 3 — `CombatHooks` + cascade** (`combatHooks.ts`, `combat/triggeredTest.ts`) : registre de
   cycle de vie + exécuteur cadence-aware. Branché sur **un seul cas réel** (Mâchoires d'acier,
   `onGainCondition`) ; tout le reste retombe sur le chemin silencieux.

Symptômes de l'incohérence :
- **Deux taxonomies d'événements** : `CombatPhase` (hooks : `battleStart/turnStart/turnEnd/
  roundBoundary/attackResolved/castResolved/miscast/battleEnd`) **vs** `EffectTrigger` (data :
  `onHit/onWoundLoss/onKill/onCharged/onGainCondition/onCombatStart|End/onRoundStart|End/onTurnStart|
  End/onStartled`). **5 phases de hook sont mortes** (déclarées, jamais dispatchées :
  `battleStart/turnEnd/attackResolved/castResolved/miscast/battleEnd`).
- **Deux exécuteurs de Flow** : `runSpellFlowLines` (silencieux) vs `runCombatFlow` (cadence-aware),
  routés par injection (`testRouter`) plutôt que par design.
- **Désalignements concrets** : `onRoundStart` est tiré **à la FIN** du round (order 25 dans le hook
  `roundBoundary`) ; le hook `turnStart` ne couvre **que les ennemis** alors que le trigger `onTurnStart`
  couvre tout le monde ; garde-fou `roundTestInteractive` qui n'existe **que** pour empêcher la
  double-exécution hooks↔cascade.

## 2. Cible décidée (« comment ça aurait dû être »)

**Une colonne d'événements, deux rôles d'abonné, un exécuteur, le contenu en données — États compris.**

1. **Un seul bus** : `emitCombatEvent(event, ctx)` à chaque moment canonique. **`EffectTrigger` devient
   la taxonomie unique** ; `CombatPhase` est replié dedans (on active enfin `attackResolved`/etc.).
2. **Deux rôles derrière le bus, pas deux bus** : (a) **contenu** = `TriggeredEffect[]` sur
   traits/atouts/talents/manœuvres/**États** ; (b) **machinerie moteur** = le registre de hooks actuel,
   repointé sur les mêmes noms d'événements, réservé aux règles du monde. Le bus lance d'abord la
   machinerie ordonnée, puis diffuse aux triggers de données.
3. **Un seul exécuteur de Flow, toujours cadence-aware** : supprimer `runSpellFlowLines`, finir le
   « aucun jet de héros en silence », retirer `roundTestInteractive`.
4. **Les États deviennent du contenu** : `etats.json` reçoit `passive: GameOp[]` (pénalités →
   `testMod`/`moveScale`, lues par le collecteur `passiveMods` existant) et `effects:
   TriggeredEffect[]` (dégâts par round → `onRoundEnd`, tests d'évasion/récupération → flows `test`).
   Supprime les branches par-nom de `combatTestPenalty`/`endOfRound`.
5. **Extensions minimales de vocabulaire**, sur le patron impure-op + hook déjà éprouvé
   (`grantFreeAttack`/`breakBlade`/`interruptFocus`) : trigger `onMissedAgainstMe` + identité de
   l'attaquant dans le contexte (Riposte), `Condition` lisant l'état de l'autre partie (Sonné→Avantage,
   exposition Infection), etc.

Décision utilisateur : **big-bang complet** (Lots 0→8, des 12 États aux réactions hardcodées) et
**on finit le cadence-aware** (golden réécrits, revue humaine du diff lot par lot).

## 3. Doctrine de frontière (anti-dette) — donnée vs machinerie

Le test qui tranche, **insensible à la paresse** :

> « Un designer pourrait-il vouloir une version DIFFÉRENTE de ça, attachée à un monstre/objet/sort/État
> précis, éditable au Codex ? » — **OUI → donnée** (obligatoire ; si pénible, on **étend le
> vocabulaire**, jamais on ne recule vers le code). **NON, même règle universelle pour tous →
> machinerie.**

**Engagement** : « difficile à exprimer » n'est JAMAIS une raison de mettre en machinerie.

L'axe correct n'est **pas** « est-ce dans la table LDB ? » mais « est-ce un état/effet POSSÉDÉ par une
entité, qui suit ses propres règles ? ». `etats.json` = foyer de **tout** état de combattant (LDB **ou**
interne moteur). Presque tout se **dédouble** : `(donnée = le flag/effet possédé)` + `(machinerie =
l'algorithme générique qui le lit)`.

**Reclassements (dette démasquée dans `roundHooks`)** — aujourd'hui en hook, devraient être en donnée :
- `suffocation-tick` → **donnée** (État suffocation interne + ses dégâts `onRoundEnd`).
- `end-of-round` (poison/feu/saignement) → **donnée** (États Empoisonné/En Flammes/Hémorragique).
- `unstable` → **donnée** (trait Instable).
- `bestial-fire-fear` → **donnée** (trait Bestial).
- `perturbing-aura` → **donnée** (passif du trait Perturbant).
- `determination-*` → **donnée** (talent Détermination).
- `broken-recovery` → **donnée** (État Brisé, récupération).

**Restent machinerie légitime** (ne nomment aucune entité, itèrent génériquement) : décrément des
durées, `refresh-wounds`, `tick-death` (règle de mort), `clear-psych-of-dead`, `purge-summons`,
ré-ordonnancement d'initiative, surnombre (la règle ; les exemptions sont des traits = donnée).

**Garde-fou (Lot 8, à durcir)** : un test Vitest scanne `engine/`+`state/` et **échoue si une branche
réactive nomme un État/trait/talent/atout précis** (`hasCondition('sonne')`, `traitId==='infecte'`…).
La dette devient un test qui rougit, pas un jugement.

## 4. BUG concret relevé (exemple) — « punching-ball à 0 PB » + intégrité hors-combat

> **À CORRIGER PLUS TARD.** Sert d'illustration de l'incohérence : l'état « à terre / mourant /
> hors-combat » est éclaté, et l'IA lit un demi-état.

### 4a. Confirmé : acharnement sur un héros à 0 PB pendant plusieurs rounds
Modèle de mort (RAW LDB 18, `engine/conditions.ts`) :
- 0 PB → À Terre, **conscient**, `isOutOfAction = FAUX` (`:376-377`).
- Passage Inconscient seulement quand `roundsAtZero > BE`, compteur avancé **1×/round** dans `tickDeath`
  (`:426-428`).
- Mort finalisée seulement si **Inconscient + 0 PB + `criticalWounds > BE`** (`inDeathCondition`
  `:384-388`), vérifiée au franchissement de round (`combatFlow.ts:resolveRoundBoundary:3548-3554`).

Côté IA (`state/ai.ts`, `state/combatFlow.ts`) :
- `heroes` n'exclut que `!isOutOfAction` (`combatFlow.ts:3915`) → un héros à 0 PB **conscient y reste**.
- L'IA **vise le plus faible** (`weakestNearest`, tri PB croissant, `ai.ts:62-67`) → à 0 PB il est
  **cible n°1 de chaque ennemi**, sans répartition.

⇒ Un héros tombé à 0 reste conscient ~**BE rounds** (3-4), focalisé par **tous** les ennemis, chacun
ajoutant `criticalWounds++` (`combatFlow.ts:937`), **sans mourir** tant que la porte (Inconscient ET
`crit > BE`) n'est pas franchie. = « 3 IA, 3 rounds, enchaînement de critiques, on se demande s'il va
mourir un jour ».

**Correctifs visés** : politique de ciblage IA (ne pas focaliser une cible à 0 PB / À Terre ; répartir) ;
prédicat unique « neutralisé » lu par l'IA.

### 4b. Suspecté (non clos par lecture statique) : « X est hors combat » puis ils continuent
- `cf.outOfAction` n'est émis que si `isOutOfAction(target)` est vrai (`combatFlow.ts:1115,2774`).
- Un héros à Destin : `finalizeHeroDeath` pose `pendingFateSave` et **suspend** sans tuer (`:904-908`).
- Or Inconscient ⇒ `isOutOfAction` ⇒ devrait être filtré du ciblage. **S'ils continuent**, un invariant
  casse (gate IA vs `pendingFateSave` vs désync d'objet combattant).
- **À pin par repro déterministe** (`__wfrp.scenario`/`fight` seedé + `__wfrp.battle()`/`log()` round par
  round) avant tout correctif — ne pas deviner la ligne.

## 5. Liens
- Plan de chantier (séquencé) : `~/.claude/plans/` (session) — à reporter ici si on le matérialise.
- Voir aussi : `docs/audit-systemes.md`, `docs/systeme-passifs.md`, `docs/i18n-seam.md`.
