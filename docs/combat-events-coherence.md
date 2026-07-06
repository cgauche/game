# Cohérence du système d'événements de combat — doctrine & état

> Référence vivante : doctrine de frontière donnée/machinerie (§3/§3bis, socle du dispatcher unique
> `fireTriggers`) + état d'avancement de l'unification des événements de combat. Boussole :
> data-driven (GameOp/Trigger) · zéro doublon/legacy/dette · respect du RAW.

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
  couvre tout le monde ; garde-fou `humanControlled` (prédicat de contrôleur unique, `netOwnership.ts`)
  qui n'existe **que** pour empêcher la double-exécution hooks↔cascade.

## 2. Cible décidée (« comment ça aurait dû être »)

**Une colonne d'événements, deux rôles d'abonné, un exécuteur, le contenu en données — États compris.**

1. **Un seul bus** : `emitCombatEvent(event, ctx)` à chaque moment canonique. **`EffectTrigger` devient
   la taxonomie unique** ; `CombatPhase` est replié dedans (on active enfin `attackResolved`/etc.).
2. **Deux rôles derrière le bus, pas deux bus** : (a) **contenu** = `TriggeredEffect[]` sur
   traits/atouts/talents/manœuvres/**États** ; (b) **machinerie moteur** = le registre de hooks actuel,
   repointé sur les mêmes noms d'événements, réservé aux règles du monde. Le bus lance d'abord la
   machinerie ordonnée, puis diffuse aux triggers de données.
3. **Un seul exécuteur de Flow, toujours cadence-aware** : supprimer `runSpellFlowLines`. Le « aucun jet
   de héros en silence » est FAIT via le prédicat de contrôleur unique `humanControlled`/`pilotedByHuman`
   (`netOwnership.ts`) — reste à éliminer le besoin du garde de double-exécution avec l'exécuteur unique.
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

## 3bis. FAIT — Le **dispatcher unique** (orchestrateur · machinerie · data-driven)

> Avancement 2026-06-22. C'est **le socle** réclamé : « peu importe le KIND (maladie, talent, trait,
> sort, état, mutation…), un Trigger doit fonctionner sans code spécifique à chacun. »

Trois rôles, séparés nettement :

| Rôle | Qui | Responsabilité |
|---|---|---|
| **Orchestrateur** | les points d'émission (`emitCombatEvent` + sites `fireTriggers` de cycle) | *QUAND* un événement canonique se produit |
| **Dispatcher unique** | **`fireTriggers(get, actor, trigger, ctx)`** | *À QUI* : réunit TOUTES les sources d'effets du combattant et joue celles qui matchent — **sans brancher par kind** |
| **Machinerie** | les hooks (`registerCombatHook`, `order`) | Règles universelles de l'arène qui ne nomment AUCUNE entité |

**Le dispatcher (`fireTriggers`) réunit désormais toutes les sources** : `effectsOf` (Traits + Talents +
Atouts d'arme) **ET** `fireConditionEffects` (États, avec leurs pions). Conséquence : un **État**
authoré avec `effects:[{trigger:'onHit'|'onKill'|'onTurnStart'|'onWoundLoss'|'onRoundStart'|…}]` réagit
**partout** où le trigger est émis, **exactement comme un Trait** — plus aucun câblage par-trigger à se
rappeler. **Maladies/Mutations** réagissent par **composition** (elles octroient un Trait/État, déjà
couvert). Ajouter une source = l'ajouter **dans `fireTriggers`**, jamais un nouveau chemin de dispatch.

Avant : `fireConditionEffects` n'était appelé qu'à 2 endroits (`onRoundEnd` + upkeep hors-combat) → un
État ne pouvait réagir qu'à `onRoundEnd`, alors qu'un Trait réagissait à ~9 triggers. Cette **asymétrie
= le câblage caché** est supprimée. Preuve : `state/unified-dispatch.test.ts` (un Trait et un État au
MÊME `onRoundEnd`, MÊME appel) ; Bestial « peur du feu → Brisé » migré du hook `bestial-fire-fear` en
donnée (trait `bestial` `effects: onRoundEnd`).

**Attaques gratuites — kind-agnostique (FAIT).** `resolveTalentFreeAttacks` (talent-only) → **`resolveFreeAttacks`**
qui itère `freeAttackSourcesOf` (Talents + Traits + Atouts + États, chacun tagué `key`/`cap`) et ne joue que
les Flows à `grantFreeAttack` (`flowHasFreeAttack`) — les autres effets de ces triggers passent par le
dispatcher générique. Un **Trait/État** de créature qui riposte `onCharged`/`onHit` fonctionne désormais
comme le talent, sans chemin spécifique. Golden de charge byte-identiques (clé d'imputation des talents
inchangée) ; `talent-free-attack.test` + `unified-dispatch.test` verts.

**Reste à faire pour « un seul bus » complet** (ne bloque PAS l'authoring data, mais centralise) :
- Émission encore **dispersée** : round/tour/touche appellent `fireTriggers`/`resolveFreeAttacks`
  directement plutôt que via `emitCombatEvent` (corrects, mais le bus n'est pas l'unique porte). Lot 1/2.
- **3 moments non émis** : `onAttackResolved`/`onCastResolved`/`onMiscast` (orphelins) — à brancher (inerte
  tant qu'aucune donnée/​hook ne s'y abonne ; cibles : crit opposé/déviation en **machinerie**, Lot 7bis).

## 4. BUG concret relevé (exemple) — « punching-ball à 0 PB » + intégrité hors-combat

> **À CORRIGER PLUS TARD.** Sert d'illustration de l'incohérence : l'état « à terre / mourant /
> hors-combat » est éclaté, et l'IA lit un demi-état.

### 4a. Confirmé : acharnement sur un héros à 0 PB pendant plusieurs rounds
Modèle de mort (RAW LDB 18, `engine/conditions.ts`) :
- 0 PB → À Terre, **conscient**, `isOutOfAction` FAUX.
- Passage Inconscient seulement quand `roundsAtZero > BE`, compteur avancé **1×/round** dans `tickDeath`.
- Mort finalisée seulement si **Inconscient + 0 PB + `criticalWounds > BE`** (`inDeathCondition`),
  vérifiée au franchissement de round (`resolveRoundBoundary`, `state/combatFlow.ts`).

Côté IA (`state/ai.ts`, `state/combatFlow.ts`) :
- Le filtre `heroes` (plusieurs sites de `combatFlow.ts`) n'exclut que `!isOutOfAction` → un héros à
  0 PB **conscient y reste** une cible valide.
- L'IA cible par **menace composite** (`targetThreat`, `state/ai.ts` : atteignabilité × fragilité ×
  danger — PAS un tri simple par PB). La fragilité (`1 + (PBmax−PBcourant)/PBmax`) double le score
  d'un héros déjà entamé, ce qui le remet en tête de cible **sans mécanisme de répartition explicite**
  entre ennemis.

⇒ Un héros tombé à 0 reste conscient ~**BE rounds** (3-4), focalisé par **tous** les ennemis, chacun
incrémentant `target.criticalWounds` (`state/combatFlow.ts`), **sans mourir** tant que la porte
(Inconscient ET `crit > BE`) n'est pas franchie. = « 3 IA, 3 rounds, enchaînement de critiques, on se
demande s'il va mourir un jour ».

**Correctifs visés** : politique de ciblage IA (ne pas focaliser une cible à 0 PB / À Terre ; répartir) ;
prédicat unique « neutralisé » lu par l'IA.

### 4b. Suspecté (non clos par lecture statique) : « X est hors combat » puis ils continuent
- La ligne de journal `cf.outOfAction` n'est émise que si `isOutOfAction(target)` est vrai (plusieurs
  sites de `state/combatFlow.ts`).
- Un héros à Destin : `finalizeHeroDeath` pose `pendingFateSave` et **suspend** sans tuer.
- Or Inconscient ⇒ `isOutOfAction` ⇒ devrait être filtré du ciblage. **S'ils continuent**, un invariant
  casse (gate IA vs `pendingFateSave` vs désync d'objet combattant).
- **À pin par repro déterministe** (`__wfrp.scenario`/`fight` seedé + `__wfrp.battle()`/`log()` round par
  round) avant tout correctif — ne pas deviner la ligne.

## 5. Liens
- Voir aussi : `docs/plans/audit-systemes.md` (archivé), `docs/systeme-passifs.md`, `docs/i18n-seam.md`.

## 6. Recensement Lot 0 (la liste « tout migrer » — baseline gelée)

> Garde-fou cliquet : `src/state/combat-hardcode-guard.test.ts` (report-only ; baselines 30/11/14 ;
> abaissées à chaque lot, → 0 au Lot 8). Baseline mesurée sur `chore/audit-cleanup` après suite verte
> (typecheck + 5352 tests). Chaque entrée = une branche réactive codée par-nom à porter en données.

### Lot 4 — `engine/conditions.ts` — FAIT (baseline 0, garde `combat-hardcode-guard.test.ts`)
- **Pénalités de Test** : `combatTestPenalty` (aveugle/brisé/empoisonné/sonné −10 ; exténué −10/stack)
  et `testStatePenalty` (empoisonné/sonné/exténué/brisé ; à terre −20 / empêtré −10 mouvement) →
  MIGRÉES en `passive: [{op:'testMod'|'skillMod'}]` sur les États (`etats.json`).
- **Bonus à l'attaquant** (à terre +20 / surpris +20 / aveugle +10) → MIGRÉ en `incomingAttackMod` sur
  le `passive` de l'État victime.
- **Par-round** `endOfRound` (empoisonné/hémorragique `wounds 1`×stacks ; en-flammes `1d10+…` ; sonné
  récupère ; auto-dissipation aveugle/assourdi/surpris) + jet de mort hémorragique (`bleedDeathRoll`)
  → MIGRÉS en `effects:[{trigger:'onRoundEnd', …}]` sur les États.
- **Restent machinerie** (prédicats génériques de mort/gating, hors compte — cf. garde) :
  `isOutOfAction`, `inDeathCondition`, `applyZeroWounds`, `tickDeath`.

### Lot 4bis — `state/combat/roundHooks.ts` — FAIT (baseline 0, garde `combat-hardcode-guard.test.ts`)
- `unstable` → MIGRÉ : trait `instable` `effects:onRoundEnd` (perte de la différence d'Avantage puis
  `banish` si vidé) — plus de hook dédié (roundHooks.ts l.80-82).
- `bestial-fire-fear` → MIGRÉ : trait `bestial` `effects:onRoundEnd` (En Flammes ∧ pas déjà Brisé →
  condition Brisé), dispatché par le dispatcher unique (roundHooks.ts l.83-84).
- `perturbing-aura` → MIGRÉ : passif du trait `Perturbant` projeté par la machinerie GÉNÉRIQUE
  `recompute-auras` (aucun trait nommé en dur, roundHooks.ts l.85-108).
- `determination-*` → MIGRÉ sur le système de Durée UNIFIÉ (`ActiveEffect` `psychImmune`/
  `ignoreCritMods` à `duration` Rounds, décrémentés par `tickDurations`) — plus de compteur/hook dédié
  (roundHooks.ts l.131-134).
- `suffocation-tick` → RECLASSÉ machinerie légitime (pas un candidat data-driven) : règle
  environnementale UNIVERSELLE gatée par le drapeau d'effet `suffocates`/`noBreath` (la donnée
  éditable), ne nomme aucune entité (trait/talent/État) — comme `tick-death`/`tick-durations`
  (roundHooks.ts l.215-224).
- **Restent machinerie** : `refresh-wounds`, `outnumbered` (règle), `tick-death`, `bleed-death`,
  `aa-bleed-unconscious`, `zones-round-tick`, `clear-psych-of-dead`, `purge-expired-summons`,
  dispatchers `fire-round-start/end-triggers`.
- NB `broken-recovery`/`poison-resist` (Brisé/Empoisonné) = États → relevaient déjà du Lot 4 (fait).

### Lot 6 — `state/combatFlow.ts` — FAIT (baseline 0, garde `combat-hardcode-guard.test.ts`)
- MIGRÉS : `applySonneMeleeAdvantage`, `banishedAtZero` (`banish` en DONNÉE du trait, déclenché par
  `onWoundLoss`+`if woundsCurrent<=0`), Riposte/Défense du champion (capacité `canCounterOnDefenseWin`,
  `engine/combatFeatures/dispatch.ts`), Nerveux (`isSkittishMount`) — plus de prédicat par-nom.
- **Restent machinerie légitime** (hors compte du garde, ne nomment aucune entité) :
  `autoCleave`/`maybeHeroCleave` (balayage géométrique des surdimensionnés/Nuées) et les qualités lues
  PAR ID (`QUALITY_IDS.Bacle`/`QUALITY_IDS.Salve` — bris d'armure Bâclée, suivi de tirs Salve).
  L'exposition aux Maladies (Infecté/Rongeur) est déjà en données (op `exposeDisease`).

### Bug différé (cf. §4) — bénéficiaire du Lot 1+IA
- Acharnement IA sur héros à 0 PB + intégrité hors-combat : à traiter une fois l'état « neutralisé »
  unifié (prédicat générique) + politique de ciblage IA. Hors chemin critique.
