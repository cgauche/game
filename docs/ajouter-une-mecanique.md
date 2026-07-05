# Ajouter une mécanique à une entité (trait, talent, qualité, mutation, maladie, atout…)

Toute mécanique — trait de créature, talent, atout d'arme/armure, mutation, symptôme de maladie,
État — s'exprime dans **UN des 3 canaux** ci-dessous, jamais un type ad hoc. Ce guide couvre le
choix du canal, l'édition au Codex, et le dispatcher unique des effets déclenchés.

## 0. Les 3 canaux — vue d'ensemble

| Canal | Porte | Édité par | Lu par |
|---|---|---|---|
| `passive: GameOp[]` | modificateur CONTINU (sans déclencheur) | `<GameOpEditor>` | `passiveMods(c)` (`src/engine/trauma.ts:454`) |
| `effects: TriggeredEffect[]` | effet sur ÉVÉNEMENT (onHit/onCrit/onRoundEnd…) | `<TriggeredEffectsField>` | `fireTriggers(get, actor, trigger, ctx)` (`src/state/triggeredEffects.ts:379`) |
| `capabilities: XCapabilities` | drapeau IRRÉDUCTIBLE, interrogé par le moteur (pas de valeur numérique/formule) | formulaire générique inféré (pas de widget dédié) | `traitCapability`/`hasCapability`/dispatch par domaine |

Chaque champ est du **`GameOp[]`** ou du **`TriggeredEffect[]`** — jamais un type propre à
l'entité. Si un besoin ne rentre dans aucune op existante, on **étend le vocabulaire**
(`GameOp` dans `src/engine/ops.ts`, `Formula`/`Condition` si besoin), on n'invente jamais un champ
parallèle ni un chemin de code par nom d'entité.

## 1. Choisir le canal — critère de décision

Le test qui tranche (doctrine `docs/combat-events-coherence.md` §3 et §3bis) :

> « Un designer pourrait-il vouloir une version DIFFÉRENTE de ça, attachée à un monstre/objet/sort/
> État précis, éditable au Codex ? » — OUI → donnée (`passive`/`effects`/`capabilities`). NON, même
> règle universelle pour tous → machinerie (hooks `registerCombatHook`, ne nomment AUCUNE entité).

Une fois qu'on sait que c'est de la donnée :

- **A un déclencheur nommé** (« à la touche », « en fin de Round », « quand elle tue ») →
  **`effects: TriggeredEffect[]`**.
- **Continu, sans déclencheur** (bonus permanent de Caractéristique, malus de Test, modif de
  Mouvement, PA) → **`passive: GameOp[]`**.
- **Un drapeau que le moteur doit pouvoir INTERROGER** (« cette créature est Bestiale »,
  « cette arme est Rapide », « cet objet est une ration ») **sans valeur numérique/formule** et
  qui pilote une branche de résolution/IA/build plutôt qu'un chiffre → **`capabilities`**.

« Difficile à exprimer en `GameOp`/`Condition` » n'autorise **jamais** un repli en machinerie ou
en champ ad hoc — c'est un signal pour étendre le vocabulaire (`docs/combat-events-coherence.md`
l.66 : « difficile à exprimer n'est JAMAIS une raison de mettre en machinerie »).

## 2. Canal `passive: GameOp[]` — le continu

Le **même vocabulaire d'ops que les sorts** (`src/engine/ops.ts`) sert les passifs — pas de type
« modificateur de profil » séparé. Ops passives usuelles (`docs/systeme-passifs.md` §1) :
`charMod{char,mod}`, `skillMod{skill,mod}`, `testMod{amount,char?}`, `moveMod{mod}`,
`moveScale{num,den}`, `maxWeaponHands{hands}`, `senseLoss{sense}`, `apAll{amount}` (PA
permanents — armure naturelle d'une mutation).

Champ donnée par entité (`src/data/index.ts`) :

| Entité | Champ | Fichier |
|---|---|---|
| Trait | `TraitData.passive: GameOp[]` (l.812) | `src/data/traits.json` |
| Qualité | `QualityData.passive: GameOp[]` (l.885) | `src/data/qualities.json` |
| Mutation | `Mutation.passive: GameOp[]` | `src/data/mutations.json` |
| Talent/État/Symptôme | `passive`/`severePassive: GameOp[]` | `talents.json`/`etats.json`/`symptoms.json` |

**Collecteur unique** : `passiveMods(c: Combatant): PassiveMod[]` (`src/engine/trauma.ts:454`)
concatène toutes les sources (traumatismes, `c.mutations[].passive`, traits de profil via
`traitPassiveMods(c.liveTraits)` — `src/engine/traits/dispatch.ts:176` —, qualités d'objet
équipées, maladies/faim, sorts actifs) et emballe chaque op en `PassiveMod{op, kind}`. Le `kind`
(`PassiveKind`, `src/engine/ops.ts`) porte annulation + combinaison (`intrinsèque` = Σ dans la
base pour trait/mutation/qualité ; le reste = pool non-cumul « meilleur bonus + pire malus », table
`PASSIVE_CANCELLERS` dans `trauma.ts:398`). **Ne JAMAIS lire un champ typé d'origine** dans un
consommateur (`effectiveChar`/`testValue`/`defenseValue`/`effectiveMovement`/`recomputeLoadout`) —
toujours passer par les helpers d'extraction de `trauma.ts` (`passiveCharSum`, `passiveSkillSum`,
`passiveTestMod`, `passiveMoveMod`…).

Traits de profil : un trait posé en `Combatant.liveTraits` (facultatif de bestiaire, statbloc
d'éditeur, `grantTrait` en jeu) applique son `passive` EN DIRECT via le collecteur — un trait
INHÉRENT du profil imprimé (déjà cuit dans les stats finales) n'y est PAS, pour éviter le
double-compte.

## 3. Canal `effects: TriggeredEffect[]` — le déclenché

`TriggeredEffect` (`src/engine/flowCore.ts:465`) :

```ts
interface TriggeredEffect<E = EffectOp> {
  trigger: EffectTrigger;   // onHit | onCrit | onWoundLoss | onSlain | onRoundStart | onStartled |
                            // onKill | onCharged | onGainCondition | onCombatStart | onCombatEnd |
                            // onRoundEnd | onTurnStart | onTurnEnd | onAttackResolved | onCastResolved | onMiscast
  on: EffectTargeting;      // 'self' | 'victim' | 'engaged' | 'grappled' | {near:…} | {pick:'engaged',…}
  flow: Flow<E>;            // le MÊME Flow d'ops que les sorts (seq/if/do/test)
  condition?: string;       // filtre onGainCondition : ne réagit qu'à cet État gagné
  attackType?: 'melee' | 'ranged';
  optional?: boolean;       // RAW « Vous pouvez… » : proposé en CHOIX à un héros manuel, jamais exercé par l'IA
}
```

(`EffectTrigger` défini `src/engine/flowCore.ts:443`.)

Champ `effects` sur `TraitData`, `QualityData`, `talents.json`, `etats.json`, `weapon.onHitEffects`
(atout d'arme). Le Flow est le vocabulaire des sorts (`GameOp` via `applyOps`) — jamais un handler
en dur par nom de trait/talent.

### Le dispatcher unique : `fireTriggers`

`fireTriggers(get, actor, trigger, ctx)` (`src/state/triggeredEffects.ts:379`) est le **SEUL**
point d'entrée pour jouer les effets déclenchés d'un combattant. Il réunit **toutes** les sources
via `effectSourcesOf(actor, weapon)` (`triggeredEffects.ts:80`, doc de tête l.72-79) : Atouts d'arme
(`weapon.onHitEffects`), Traits (`actor.traits[].effects`), Qualités d'arme, Talents, États
(`actor.conditions[]`), états psychologiques (`actor.psychState[]`). Ordre FIGÉ (enchant → traits →
atouts → talents → États → psy) pour un déroulé RNG déterministe.

**Ajouter une source de déclenché = l'ajouter dans `effectSourcesOf`, jamais un nouveau chemin de
dispatch parallèle.** Maladies et mutations n'ont PAS besoin d'une source dédiée : elles réagissent
« par composition » — elles octroient un Trait ou un État à leur porteur, déjà couvert.

`fireTriggers` combine trois dispatches identiques en cœur (`applyTriggeredEffects`,
`triggeredEffects.ts:303`) : traits/talents/atouts non-statut (`effectsOf`), États
(`fireConditionEffects`), psy (`firePsychEffects`) — un même moteur de folding pour les trois, avec
`stacks` (pions) injecté pour les statuts.

Un Flow d'effet déclenché portant un nœud `test` est routé **cadence-aware** : héros manuel →
cascade influençable (via `ctx.set` + le routeur `testRouter`) ; ennemi/auto/entretien hors combat
→ résolu inline. Il n'existe **aucune branche « succès silencieux »** — un Flow `test` sans routeur
disponible échouerait plutôt que de s'exécuter en douce.

## 4. Canal `capabilities` — l'irréductible

Réservé aux drapeaux que le moteur **interroge** (résolution de combat, IA, psychologie,
build/déplacement, artisanat), SANS valeur formule ni déclencheur — un booléen (ou un petit champ
scalaire comme `encDelta`) qui pilote une branche de code, pas un chiffre qui s'additionne.

- **Trait** : `TraitData.capabilities?: TraitCapabilities` (`src/data/index.ts:819`), lu PAR ID par
  `traitCapability(traits, cap)` (`src/engine/traits/dispatch.ts:201`, ex. `bestial`, `mindless`,
  `stupid`, `swarm`, `coldBlooded`…). `suppressesCapabilities` permet à un trait d'ANNULER une
  capacité d'un autre trait porté par le même combattant (Dressé ignore Bestial).
- **Qualité d'arme/armure/objet** : `QualityData.capabilities?: QualityCapabilities`
  (`src/data/index.ts:838-871` — `fastStrike`, `slowStrike`, `magazine`, `salvo`, `magic`,
  `unbreakable`…). Les **Indices** numériques (Salve N, Protectrice N…) restent lus du RUNTIME
  string via `parseQuality().indice` — la capability n'est qu'un marqueur de PRÉSENCE.
- **Objet** : `TrappingData.capabilities?: ItemCapabilities` (`src/data/index.ts:461-466`), lu par
  `itemCapability(it, cap)` (par-objet, non gaté sur le port — une ration se mange sans être
  « portée », `src/engine/capabilities.ts:25`).
- **Symptôme de maladie** : `SymptomData.capabilities?: SymptomCapabilities`
  (`src/data/index.ts:892-899` — `blocksHealing`, `amputation`, `contagious`…).

**Agrégat cross-source par personnage** : `hasCapability(c, cap)` (`src/engine/capabilities.ts:45`)
réunit objets portés/tenus, traits, qualités des objets portés/tenus, et maladies actives — un seul
point d'entrée, chaque canal reste disjoint par nom de cap.

Édition Codex : `capabilities` n'a **pas** de widget dédié — il n'est pas dans
`dedicatedFieldKeys` (`src/ui/compendium/CodexEdit.tsx:127-151`), donc il retombe dans le
**formulaire générique inféré** (`inferFields`), qui projette l'objet en sous-champs (checkbox par
booléen, champ nombre pour `encDelta`).

## 5. Éditer — au Codex, jamais en dur

Tout se fait dans le **Compendium in-app** (écran Codex DEV, `src/ui/compendium/CodexEdit.tsx`) :

- Champ `passive` (trait/qualité/mutation/talent/État/objet) → **`<GameOpEditor>`**
  (`src/ui/editor/GameOpEditor.tsx`, importé `CodexEdit.tsx:18`, rendu `CodexEdit.tsx:328`) — le
  **même composant** que celui utilisé pour les sorts (`EffectList`) et les symptômes
  (`severePassive`). Ajouter un modificateur de profil = ajouter une op dans la liste, jamais un
  nouveau widget.
- Champ `effects` (trait/qualité/talent/État) → **`<TriggeredEffectsField>`**
  (`CodexEdit.tsx:344`, catégories `traits`/`qualities`/`domains`/`talents`/`etats`).
- Champ `capabilities` → formulaire générique inféré (§4).
- Sauvegarde : `src.persist` réécrit le `.json` app-owned entier via File System Access
  (`fsPersist`) ; Vite recharge.

**Réutiliser, ne jamais réinventer** : pour toute liste d'ops (passif, effet déclenché, table
d'Imparfaites, mutation, consommable) → `GameOpEditor`/`EffectList`/`FlowEditor`. N'écrire aucun
widget de liste d'ops à la main, ne pas dupliquer le vocabulaire existant (ex. ne pas recréer un
`movementHalved` alors que `moveScale` existe déjà).

## 6. Frontière donnée / machinerie (anti-dette)

`docs/combat-events-coherence.md` §3 et §3bis posent la doctrine complète. Résumé opérationnel :

- **Donnée** = tout ce qu'un designer voudrait pouvoir varier par entité (monstre/objet/sort/État
  précis), éditable au Codex → `passive`/`effects`/`capabilities`.
- **Machinerie** (hooks `registerCombatHook`, `src/state/combat/roundHooks.ts`) = règles
  UNIVERSELLES du monde qui ne nomment AUCUNE entité : décrément des durées, `tick-death`,
  `clear-psych-of-dead`, `purge-summons`, ré-ordonnancement d'initiative, la règle de surnombre
  (les EXEMPTIONS de surnombre, elles, sont des traits = donnée).
- Un hook qui teste `hasCondition('sonne')`/`traitId==='infecte'`/un nom en dur est une **dette
  démasquée** — il doit migrer vers `effects`/`passive` de l'entité nommée et disparaître du
  registre de hooks.
- « Difficile à exprimer proprement » n'est **jamais** un motif pour replier en machinerie : on
  étend `GameOp`/`Formula`/`Condition` (cf. §0).

## 7. Recettes rapides

- **Ajouter un modificateur de profil à un trait** (ex. +1d10 Mouvement) : Codex → trait → champ
  `passive` → `+` op `moveMod{mod:10}` (l'unité de `M` est un petit entier hors Bonus).
- **Ajouter un effet « à la touche » à un Atout d'arme** : Codex → qualité → champ `effects` → `+`
  entrée `{trigger:'onHit', on:'victim', flow:{…}}`.
- **Ajouter une capacité irréductible à un trait** (« cette créature est Aveugle-née ») : Codex →
  trait → sous-champ `capabilities.<clé>` (checkbox) ; consommateur = ajouter la lecture
  `traitCapability(c.traits, 'maClé')` au site qui en a besoin (psychologie/IA/résolution).
- **Créer une mutation avec passif + armure naturelle** : Codex → catégorie Mutations →
  `passive` (ops) + champ `apAll`/`apLocations` (armure naturelle, hors collecteur passif — lu par
  `mutationArmourBonus`/`recomputeLoadout`).

## Fichiers clés

- `src/engine/ops.ts` — `GameOp`, `Formula`, `PassiveMod`, `PassiveKind`.
- `src/engine/trauma.ts` — `passiveMods` (collecteur unique) + `PASSIVE_CANCELLERS` + helpers.
- `src/engine/traits/dispatch.ts` — `traitPassiveMods`, `traitCapability`.
- `src/engine/capabilities.ts` — `itemCapability`, `hasCapability` (agrégat cross-source).
- `src/engine/flowCore.ts` — `EffectTrigger`, `TriggeredEffect`, `EffectTargeting`.
- `src/state/triggeredEffects.ts` — `fireTriggers` (dispatcher unique), `effectSourcesOf`,
  `applyTriggeredEffects`.
- `src/data/index.ts` — `TraitData`/`QualityData`/`SymptomData` + leurs `Capabilities`.
- `src/ui/editor/GameOpEditor.tsx` — éditeur d'ops (réutilisé partout).
- `src/ui/compendium/CodexEdit.tsx` — édition Codex (`dedicatedFieldKeys`, champs par catégorie).
- `docs/systeme-passifs.md` — détail complet du canal passif + Corruption/mutations.
- `docs/combat-events-coherence.md` §3/§3bis — doctrine de frontière donnée/machinerie.

## Gardes

- `src/ui/compendium/no-json-fields.test.ts` — tout champ d'un dataset éditable doit avoir un
  éditeur dédié ou être couvert par le formulaire générique ; empêche un champ mécanique de
  retomber en JSON brut.
- `src/data/defs-migrated.test.ts` — les défauts mécaniques vivent dans `traits.json`/
  `qualities.json` (capabilities/passive/effects), pas dans les `defs/` de registre.
- `src/data/data-wellformed.test.ts` — valide les `Formula` des `GameOp` (`FORMULA_OBJECT_KEYS`,
  `isValidFormula`) sur l'ensemble des datasets.
- `src/engine/trauma.test.ts` — couvre `passiveMods`/`PASSIVE_CANCELLERS` (gating par `kind`,
  non-cumul, combinaison intrinsèque).
- `src/state/triggered-effects.test.ts` — couvre `fireTriggers`/`effectSourcesOf` (ordre des
  sources, filtres `condition`/`attackType`/`optional`, routage cadence-aware des Tests).
- `src/state/combat-hardcode-guard.test.ts` — garde anti-régression qui fait rougir un hook de
  `roundHooks.ts` nommant une entité précise (dette de machinerie démasquée).
