---
name: game-label-id-migration-complete
description: "Migration label→id ACHEVÉE de bout en bout (lot fondateur refs/traits/skills/talents/spells/gods + 6 phases A–F committées, vertes) — sous-systèmes, design const ouverts, commits"
metadata: 
  node_type: memory
  type: project
  originSessionId: 333a2452-91f2-47af-a7b3-4b9f7c88b676
---

La migration « id stables partout, label = affichage seul » est **complète** (déclenchée par l'audit : seuls compétences/talents/traits/créatures/sorts/dieux étaient migrés avant). 6 commits sur `feat/wfrp4-rpg-foundation`, chacun vert (typecheck + suite), garde-fou unique `src/data/refs-migrated.test.ts` étendu à chaque phase.

- **A** (`9365e5b`) — carrières/classes/espèces : `id` ajouté (n'en avaient AUCUN) ; `CareerData.class`=classId, `CareerLevelData.career`=careerId, `Combatant.career/species`+pregens=ids ; `interludeEvents.revenueClasses`→classId (« * » préservé). Rig : `appearance.species`/tenue/careerClass résolus id→label au SEUL bord du rig (contrat « label » préservé). `findCareerById/findClassById/findSpeciesById` ; `findCareer/findSpecies` par label SUPPRIMÉS.
- **B** (`fb5af35`) — États : `etats.json` id-ifié ; `ConditionInstance.name`=id ; op condition + gates + listes `conditions[]` + Conditions Flow (champ `condition`) migrés. **`ConditionId` OUVERT (=string)** → on peut CRÉER un État au Codex ; le moteur réfère les 12 canoniques via la const `COND` (zéro chaîne magique), synchro testée. `conditionLabel/findConditionById/conditionIdByLabel`.
- **C** (`2a083ab`) — Maladies : `DISEASE_DEFS` inline → **`maladies.json`** (dataset éditable au Codex) ; `DISEASE_DEFS` dérivé keyé par id ; `Disease.name`=diseaseId ; const `DISEASES` synchro. `findDiseaseById/diseaseLabel/diseaseIdByLabel`.
- **D** (`7b4e7bb`) — objets/marchand : **`weaponGroups.json`** id-ifie la taxonomie `subType` (34 groupes, armes/munitions/armures/catégories) ; `ItemInstance.trappingId` ; `itemFromTrappingById` (findTrapping par label SUPPRIMÉ) ; marchand stock/cart par trappingId ; `Effect/op giveTrapping`={trappingId}|{custom} ; qualités par id (`QUALITY_IDS`, engine/qualities/ids.ts, `hasQuality`/`indiceOf` par id).
- **F** (`09a69a7`) — refs GameOp : `addQualities`→ids, `grantTalent`→réf talent par id, `talents.json addSkill/addTalent`→réfs ; **combatFeatures dissous** (registre keyé par LABEL de talent → `TalentData.combat` par id, lu via `findTalentById` ; `defs/`+registry+normalize+`parity.test` SUPPRIMÉS) ; Codex `codexLookup`+CompendiumScreen/CodexEdit par id.
- **E** (`ed3a7d8`) — Pendings d'arme : uid UNIVERSEL (`buildWeapon` génère toujours un uid ; spawn statbloc/enemyProfile aussi) → `PendingReload/BladeTrap/Knockdown` `weaponName`→`weaponUid`, repli `w.name===` SUPPRIMÉ, affichage uid→nom au site.

DÉCISIONS clés (validées user) : weaponGroups id-ifié (pas vocab libre) ; États/maladies = DONNÉE JSON éditable (d'où `ConditionId/DiseaseId` ouverts + consts moteur) ; clés de règles (qualités/combatFeatures) poussées en id. Prolonge [[game-ids-internes-libelles-display-multilangue]].

PIÈGES rencontrés : remplacements de masse de littéraux ACCENTUÉS via PowerShell/sed ÉCHOUENT erratiquement sur cette machine (encodage) → utiliser l'outil Edit, ou `sed` Bash pour de l'ASCII seul ; le `git grep` git-bash a donné des comptes FAUX (se fier à ripgrep/l'outil Grep) ; `maladies.json`/datasets DOIVENT être au format `JSON.stringify(x,null,2)` sans newline final (sinon `serialize.test`).

## Lot fondateur (refs/traits/skills/talents/spells) — a ouvert la voie aux phases A-F

Avant les phases A-F ci-dessus, un premier chantier `structured.refs-gods-editable` avait déjà migré
compétences/talents/traits/sorts/dieux :
- **`slugId(label)`** (`src/data/slug.ts`) est LA source de tous les id dérivés d'un libellé : NFD, strip
  diacritiques, lowercase, œ→oe, `[^a-z0-9]+`→`-`.
- **Traits** : `id` slug sur `traits.json`(84)+`frenchy-traits.json`(5) ; `TraitInstance.key`→`id` ;
  **`TraitList = TraitInstance[]`** (plus de `string |`, `asTrait` SUPPRIMÉ) ; `CANON_BY_LOWER` (label→id)
  + `LABEL_BY_ID`/`traitLabelById` (id→label). Données destringifiées : `creatures.json` (2619 traits →
  `{id,value?,arg?}`) + `mutations.json`. Couche authoring (`CustomStatblock.traits`/`SceneEntity.combat.
  optionals`/`SpawnExtras.optionals`) aussi en id, pickers « parse-on-edge » (affiche `formatTrait`, stocke
  `parseTraitInstance` à l'édition).
- **`gods.json`** devenu dataset éditable, le registre codegen `engine/cults/defs` SUPPRIMÉ.
- **Bug runtime corrigé au passage** : `ActionBar` faisait `findSpell(id)` → undefined (les casters ne
  voyaient PLUS leurs sorts après migration spell-id) → corrigé en `findSpellById(id)` + pont id→libellé
  pour le flux de cast.
- **Piège fixture invisible au typecheck** : des fixtures de test construisaient `{name:'X'}` derrière des
  casts `as never`/`as any`/`as Combatant` → invisibles au typecheck, cassent seulement au runtime (id
  `undefined`). Toujours grep `name:` dans `skills:`/`talents:` après ce genre de migration.
- **Gap résiduel connu (pas cassé, juste pas pur)** : le flux de cast ÉPHÉMÈRE (`battle.selectedSpell`,
  `pendingCast.spellLabel`, `focus.spell`) identifie encore le sort par LIBELLÉ (`findSpell`), pont
  id→libellé fait par ActionBar — cohérent en interne mais pas id-pur pour le multilangue.

**Pénalités de port d'armure — même doctrine, jusqu'à la magnitude** : la pseudo-qualité `en-<skillId>` encode la Compétence dans l'ID et la magnitude dans sa `value` (`{id:'en-discretion', value:-10}` sur les pièces de `trappings.json`) ; `wornArmourPenalty`/`qualityWearMods` (`engine/wearPenalty.ts`) somment les pièces ÉQUIPÉES et modulent par l'artisanat (Pratique/Peu Fiable, LDB 63 l.84-95 + LDB 60 l.22/58). Aucune prose FR « -N% en <Compétence> » n'est re-parsée.
