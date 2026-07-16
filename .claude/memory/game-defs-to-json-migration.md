---
name: game-defs-to-json-migration
description: "Migration « defs/ mécaniques → JSON + label→id » TERMINÉE — defs traits ET qualités supprimés, registres dérivés des JSON, tout résout par id ; suite verte 5444/5444."
metadata: 
  node_type: memory
  type: project
  originSessionId: e7d15c25-5b93-4610-9112-33030b29822a
---

Grand chantier (juin 2026, plan `tranquil-forging-lantern.md`) issu de l'audit de fidélité : **directive user « les `defs/` ne servent QU'aux SVG (rig), tout le reste en JSON »** + « pousser au max GameOp/effects, nouvelles ops/triggers OK ». Mené sur arbre PARTAGÉ avec une session // qui refondait le combat (sweep assumé — mes commits balayés par les leurs).

**FAIT et VERT (suite ~5443/5443, typecheck 0)** :
- `src/engine/traits/defs/` (43) ET `src/engine/qualities/defs/` (47) + `_registry.generated.ts` **SUPPRIMÉS** ; `TRAITS`/`QUALITIES` **dérivés** de `traits.json`/`qualities.json` (`Object.fromEntries(...map(t=>[t.id,{key:t.label}]))`) ; `TraitDef`/`QualityDef` = `{key}` ; entrées retirées de `scripts/gen-registry.mjs`.
- Nouvelles ops (engine/ops.ts, éditables GameOpEditor) : `skillDRBonus`, `incomingAttackMod`, `attackKeyword`, `mitigateIncoming` (traits) ; `weaponRollMod`, `weaponDamageMod`, `armourPierce`, `critOnRoll`, `spendAdvantage` (armes). Champ `TraitData.capabilities`/`QualityData.capabilities` (drapeaux irréductibles IA/psy/build), `qualityById`/`qualityPassiveMods`. Collecteur passif + lectures PAR ID.
- Chaîne création/avancement par id (skillCharKey→skillCharKeyById, applyTalentAcquisition(talentId), talentMax→talentMaxById, learnFails keyé id). Domaines par id (`SpellData.domainId`, 64 sorts ; `findDomainById`). Name-matches : exposure `effectId`, trauma `traumaId`, conjuredWeapons group id, flow `hasItem.trappingId`, `MutationTable.id`, **identité prothèse par trappingId**, trait `rongeur` (fin du regex `/skaven/` sur le nom), Esquive→`RollBreakdown.mode`, bouclier→`isShieldItem`, **Constricteur→effects**, COND partout (fin des littéraux d'État). Tables en dur→JSON (`isPrayer`, transports.json, lastNameSuffixes, `standard` traits, `group?`). Code mort supprimé (findLocation/findBook/diseaseIdByLabel). Garde-fou `src/data/defs-migrated.test.ts`.

**TERMINÉ** (suite 5444/5444, typecheck 0) :
- **Lot 6 — flux d'incantation** : `PendingCast/PendingFocus.spellLabel`→`spellId`, `battle.selectedSpell`→`selectedSpellId`, `Combatant.focus.spell`→id, `selectSpell/focusSpell(id)`, `effectiveSpellOf/resolveSpell/castZoneSpell` par id ; tous consommateurs (IsoStage/CastModal/ActionBar/FocusModal/rollFlows/targeting/devtools) + ~21 tests migrés. Persistance OK (saves hors combat, snapshots same-build).
- **Vampirique** : Condition Flow GÉNÉRALE `attackKind` ajoutée (flow.ts + threading ConditionCtx/OpsCtx/TriggerCtx, émission `creatureAttackKind(weapon.name)` à l'onHit, éditable Codex ConditionEditor) ; `traits.json#vampirique.effects onHit on:self if(attackKind 'morsure')→lifeSteal 1/1` ; bloc en dur retiré de `applyFreeAttackEffects`.

Gotchas confirmés : linter reformate les `*.json` → re-canonicaliser `JSON.stringify(d,null,2)` SANS newline final (garde-fou `serialize.test`), écrire en LF (piège CRLF Windows). `arcaneDomainOf(talent.spec)` reste label-based (frontière authoring légitime). Prolonge [[game-label-id-migration-complete]], [[game-talents-editable-data]], [[feedback-effet-existant-general-parametrable]].
