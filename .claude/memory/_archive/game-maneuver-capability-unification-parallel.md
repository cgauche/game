---
name: game-maneuver-capability-unification-parallel
description: "L'unification armes/attaques → modèle Capacité est faite par une session // ; attendre puis réviser/compléter (NE PAS ré-implémenter)"
metadata: 
  node_type: memory
  type: project
  originSessionId: ac3fb303-33fb-4bd5-999a-5b57154f44c2
---

2026-06-16. On a conçu+planifié (plan `scalable-shimmying-floyd.md`, approuvé) l'unification
**armes / attaques / effets onHit → modèle « Capacité »** — PUIS découvert qu'une **session // la fait
déjà**, en plus large. Décision user : **attendre que leur travail atterrisse, puis réviser/compléter**.
NE PAS ré-implémenter (double travail + conflits cœur combat).

**Ce que la // construit** (vu en working-tree non committé) : registre de manœuvres éditable
(`src/data/maneuvers.json` + `scripts/maneuvers/generate.mjs` + `findManeuverById`), `TraitData.grantsManeuvers`
(traits octroient des manœuvres par id), **refs par id** (`SkillInstance.name→skillId`,
`TalentInstance.name→talentId`), `spells.json` +255 l., `combatFlow`/`triggeredEffects`/`domainAttributes`/
`types` modifiés, + cults→gods (`gods.json`), `RefField`, `slug.ts`, exploreNav.

**Check-list de revue quand ça atterrit** (cf. notre plan) : (1) onHit unifié — enchant
(`onHitConditions`/`onHitTest`) + **Venin** + `domainOnHitRiders` passent-ils par `fireTriggers`/
`TriggeredEffect` (plus de `addCondition` en dur combatFlow:1322/1329, 2861) ? (2) **portée** éditable
des enchants (`requiresWeapon`→scope arme/famille/toutes) ? (3) **builder d'arme partagé** (conjure/
grantNatural/unarmed/tentacule items.ts:237) ? (4) `grantNaturalWeapon` fondu en capacité ? (5) noms
d'ops souhaités : `grantWeapon`/`augmentWeapon`/`grantManeuver` ? (6) **golden combat byte-identique** ?
(7) éditabilité Codex (ManeuverField + champ portée).

**Mon lot Codex enrichi NON-committé** (describe.ts, WeaponField, PsychTraitsField + registry/CodexEdit/
CodexEntry — cf. [[game-mutation-appearance-data-driven]]) tombe dans la zone qu'ils refactorent
(`RefField`/`registry`/`CodexEdit`) → décider de son sort avec leur sweep, ne pas y toucher d'ici là.

**AVANCEMENT (2026-06-16, ma session)** — Phase 1 committée (48826dd : op `opposedTest`). **Phase 2
chemin ENCHANT onHit FAIT + vérifié** (working-tree, NON committé car entremêlé au // sur types.ts/
spells.json) : `weaponEnchant.onHitConditions`/`onHitTest` → **`onHitEffects: TriggeredEffect[]`** (forme
unifiée, même shape prouvée que les manœuvres `{trigger,on:'victim',flow:{do,effect:{type:'ops',on:'victim',
ops:[condition|test]}}}`). Ops `enchantWeapon`/`conjureWeapon` portent `onHitEffects` ; `effectsOf`
(triggeredEffects) agrège `activeEnchantsFor().onHitEffects` EN TÊTE (préserve l'ordre RNG) → dispatch
par `fireTriggers('onHit')` ; supprimés : `enchantOnHitConditions`/`enchantOnHitTests` + l'îlot bespoke
combatFlow. Op `test` reçoit `onlyGroups`/`exceptGroups` ; `groupGate(only,except)`. 5 sorts migrés
(script node jetable supprimé). Tests verts (golden-combat OK, 2834/2835 — le seul échec = `store.test
rotateCam`, WIP // caméra, hors périmètre). 11 erreurs tsc = bruit // (price/SpellSpec.ops), 0 dans mon
périmètre. **Arbre laissé NON committé** (subset-commit incohérent : ops.ts dépend de types.ts partagé).

**User a tranché « convergence TOTALE » + « fais Venin aussi (générique/paramétrable) ».** IMPLÉMENTÉ
(working-tree) : VOCABULAIRE generic ajouté — Conditions Flow `location`/`woundsDealt` (flow.ts +
ConditionCtx + threading OpsCtx/TriggerCtx→runSpellFlow `if`) ; op `test` `argDifficulty`(diff. de l'arg
d'instance, substituée à la collecte par `withArg` dans effectsOf) + `unlessImmune`(immunité de type) ;
`difficultyFromLabel` (engine/tests, généralise venomDiffKey). **Assommante** → `qualities.json effects`
(if location==tete → opposedTest F vs E/Résistance → Sonné), `QualityDef.onHit`+assommante.ts onHit +
boucle combatFlow SUPPRIMÉS, modale droppée (journal, ok user). **Venin** → `traits.json effects` (if
woundsDealt≥1 ET pas déjà Empoisonné → test E/Résistance argDifficulty unlessImmune:poison → Empoisonné),
`venomDifficulty`/`venomDiffKey`/bloc combatFlow SUPPRIMÉS ; dispatché par le `fireTriggers('onHit')` de
`applyAttackResult` (atteint AUSSI les attaques gratuites car `applyFreeAttack` appelle applyAttackResult).
`fireTriggers('onHit')` reçoit `woundsDealt`/`location`. Commentaires « tombstone » nettoyés (retour user).

**VÉRIF (la migration trait // a atterri → tout vert)** : weapon-enchant 5/5, conjure 7/7, golden 2/2,
creatureFreeAttacks 17/17 (inc. test Venin end-to-end), triggered-effects 11/11, maneuver-effects 7/7,
parity OK, creatureAttacks OK. Suite engine+state : 2839/2840 (seul échec = `store.test rotateCam`, WIP
// caméra, hors périmètre). tsc : périmètre PROPRE (les erreurs restantes = migration // grantTrait
`trait→traitId` / trait `string→TraitInstance` sur granted-traits.test/ops.test/GameOpEditor/summonFlow/
domainAttributes — PAS les miennes).

**woundsDealt rendu ÉDITABLE** (retour user « pourquoi forcer l'opérateur ») : `{kind:'woundsDealt'; op:CompareOp;
value}` (au lieu de `atLeast`) ; helper `applyCompareOp` (flow.ts) = source unique partagée par `compare` et
`woundsDealt` ; Venin data → `woundsDealt > 0`. ConditionEditor : `location` (select HitLocation) +
`woundsDealt` (select CompareOp + valeur) ajoutés (KIND_OPTIONS/condSummary/recast/UI) — tout éditable.

**DOMAINES = dataset éditable au Codex — LIVRÉ (user : « tous les attributs » + « créer de nouveau »).**
Méthode imposée par le user (mémoire [[feedback-effet-existant-general-parametrable]]) : pour chaque effet,
regarder l'existant → rendre GÉNÉRAL/paramétrable → faire. Bâti dans l'ordre :
1. **Primitives de gating générales** (réutilisables, éditables au ConditionEditor, vérifiées triggered-effects) :
   `engine/relations.ts` (campOf/relationOf, SOURCE UNIQUE du camp — `kind` hero/enemy/npc) + Condition Flow
   `relation` (relatif allié/adversaire/soi + camp absolu party/neutral/hostile) + `has` (Groupe via groupMatch /
   Talent+spec / Trait) ; `ActorView` enrichi (id/camp/groups/talents/traits). Remplacent le booléen `hostile`
   et les gates op `onlyGroups`/`unlessImmune`.
2. **`src/data/domains.json`** (8 Couleurs) : `effects` (TriggeredEffect onHit, gatés relation/has — Feu/Lumière/
   Mort/Vie), `missile` ({bypass metal/nonMagic, bonusFromBypass}), `afterCast` ({grantTrait, durationDice}).
   `DomainData` + `findDomain` (par label = subType) + `domains` dans overrides ARRAYS. `domainAttributes.ts` :
   `domainOnHitRiders` SUPPRIMÉ → `domainOnHitEffects` (lookup, appliqué par `applyTriggeredEffects` dans combatFlow) ;
   `domainMissileMods`/`ghurFearAfterCast`→`domainAfterCast` lisent le dataset. Tests réécrits data-driven (12/12).
3. **Catégorie Codex « Domaines »** (registry, group Magie) ; édition via `isTriggered` (effects→TriggeredEffectsField,
   missile/afterCast→repli) ; **bouton générique « ➕ Nouveau (DEV) »** (CompendiumScreen + CodexEdit `isNew` append).
VÉRIF : domainAttributes 12/12, cast/golden/triggered verts, suite 2909/2911 (2 échecs = WIP // camRot + spawn
weaponFromTrait `split`, hors périmètre). tsc périmètre PROPRE.

**Formulaire dédié op `test`/`opposedTest` au GameOpEditor — FAIT** (DEDICATED += test/opposedTest ; champs
compétence/carac/difficulté/argDifficulty/unlessImmune/onlyGroups/exceptGroups/onFailHard + sous-ops onFail/
onSuccess/onWin/onLose via GameOpEditor IMBRIQUÉ — fonction hoistée, récursion OK). GameOpEditor.test 9/9
(test réécrit : plus de repli JSON pour test → vérifie le formulaire + sous-op imbriquée). Reste : SMOKE-TEST
NAVIGATEUR des features DEV éditeur (formulaire test, bouton « ➕ Nouveau », édition domaine) — non vérifié à l'écran.

**Leçon** : avant un gros refactor moteur, `git status`/`git diff` les fichiers cibles — une session //
peut déjà être dessus. Prolonge [[git-commits-propres-wip-parallele]], [[feedback-no-commit-surgery-shared-tree]].
