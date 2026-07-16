---
name: game-test-spine-fk-by-label-migration
description: "Migration « résolution par id, jamais par libellé » ACHEVÉE — spine Tests + cluster magie + 3 FK-par-libellé corrigées (dont 1 bug runtime)"
metadata: 
  node_type: memory
  type: project
  originSessionId: f9d1d630-180f-4d99-b9db-4ad2cc2e40cf
---

Plan `sparkling-munching-tulip` LIVRÉ + extension FK-par-libellé. 8 commits, suite hors-golden **3993/0 verte**, typecheck propre.

**Spine Tests** : `testValue(c, skill?, characteristic?, spec?)` matche `s.skillId === skill` (param `spec?` AJOUTÉ — précision Savoir/Métier) ; `skillCharKeyById` ; `conditions.testStatePenalty` = `Set` d'ids (BRISE_EXEMPT/MOVEMENT_SKILL) ; `trauma.passiveSkillSum` match exact id ; `wearPenalty` émet un skillId (landmine : sinon casse SILENCIEUSE vs `passiveSkillSum`). Affichage TOUJOURS via `refLabel`/`skillInstanceLabel`.

**Magie** : `SpellData.family: CastingKind` (discriminant, `type` = affichage seul) — a corrigé 35 prières frenchy mal classées Arcane. `castingValue`/`castPenalty`/`castInfoIsPrayer` par id/family.

**FK-par-libellé corrigées** (directive « jamais de libellé comme index intertable », audit agent) :
- `skills.characteristic` « Dextérité »→CharKey `'Dex'` ; `skillCharKeyById`=`d.characteristic` direct ; RefField `valueKey:'abr'` (characteristics keyé par `abr`=CharKey).
- **`domains.castBonus.perCondition` = BUG runtime** : « En flammes » (libellé) ≠ `ConditionInstance.name` slug `'en-flammes'` → `stacks()` toujours 0 → bonus +10 Domaine Feu (Aqshy) ne s'appliquait JAMAIS. Corrigé.
- `talents.addCharacteristic` → clé stable : 10 CharKeys + 5 dérivés (`wounds`/`fortune`/`resolve`/`move`/`corruption`). Les dérivés sont des DISCRIMINANTS purs de `talentEffects` (timesWithAddChar), PAS des FK characteristics → talents.json + talentEffects seuls ; `talentCharBonusById` = `CHAR_KEYS.includes`.
- **`locations.parent` = FAUX POSITIF** : les `parent` (« Les montagnes… ») sont des CATÉGORIES d'affichage Codex, PAS des entrées de location (aucune location ne porte ce label) → pas une vraie FK inter-table, NON migré.

**P1.3** : GameOpEditor (test/skillMod/opposedTest) + FlowEditor (test.skill) émettent un skillId via `<RefField>` (fini l'input libre de libellé).
**P2.4** : `Weapon.builtinId` (id de trapping source) + `isUnarmed(w)` ; `unarmedWeapon()` pose `'mains-nues'` ; 5 filtres `w.name !== 'Mains nues'` → `!isUnarmed(w)`. Fixtures de test synthétiques doivent porter `builtinId`.

Garde-fous `refs-migrated.test` étendus (skills.characteristic ∈ CHAR_KEYS, domains.perCondition résout, talents.addCharacteristic ∈ CharKey∪dérivés). Arbre PARTAGÉ (session combat //) : conditions.ts/roundHooks cassés transitoirement (leur WIP) → typecheck bloqué un temps, résolu par eux. Prolonge [[game-label-id-migration-complete]] + [[game-ids-internes-libelles-display-multilangue]].

**Complément (lot précédent du même chantier)** : un audit à 3 agents avait trouvé **16 résolutions
runtime par libellé** alors que seuls « 2 résidus » avaient été annoncés — ne pas se fier au chiffre
auto-rapporté d'un audit précédent, ré-auditer. Deux migrations d'id annexes livrées dans la foulée :
Exposition comptée par `effectId:'exposition-froid'` (plus de libellé) ; stock de marché garanti (curated)
indexé par id de trapping (plus de libellé).
