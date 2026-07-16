---
name: game-mutation-creature-id-migration
description: "Mutations ET créatures migrées en id stable (slugId) — findCreatureById/mutationById, Combatant.creatureId, resolveRender id-based ; + 35 formes d'armes AA/ZI ; gotchas serialize.json & golden."
metadata: 
  node_type: memory
  type: project
  originSessionId: c200b807-58b0-4881-afff-0b8ebba80cc8
---

Session 2026-06-17 : « On ne devrait plus se baser sur le label » → migrations id ATOMIQUES livrées (2 commits, suite 5229 verte). Prolonge [[game-refs-ids-migration]] (qui avait fait traits/skills/talents/spells).

**Mutations → id** (commit 16cffbc) : `mutations.json`/`mutationTables.json` portent/référencent un `id` (slugId(label)) ; `mutationByLabel`/`LABELS_*` SUPPRIMÉS → `mutationById`/`IDS_PHYSIQUES`/`IDS_MENTALES` ; `Mutation.id` requis (label = affichage). `mutationsAtSpawn` résout l'arg d'auteur du trait « Mutation (X) » en id via `slugId`. `stateFragments` (combatantVisuals) résout l'apparence PAR ID depuis le registre. `mutationById('cornes-asymetriques')` = clé = clé du `data-mut` (élément), coïncide.

**Créatures → id** (commit 81d661c) : `creatures.json` (406) portent `id` ; `findCreatureById`+`creatureLabel` (index par id) ; `findCreature(label)` GARDÉ pour authoring/affichage SEULEMENT (pickers éditeur, Codex). `Combatant.creatureId` posé au spawn → le rig résout l'apparence PAR ID (enemyProfile/bodyPlan/pickBackend), plus par `c.name`. Refs réécrites : scènes (`arene-projet.json` + scénarios .ts via `ref:`), op `polymorph` de spells.json, par `scripts/migrate-creature-ids.mjs`.

**Piège central resolveRender** (bodyPlan.ts) : le 3ᵉ arg est un `id` de créature OU un nom d'espèce canonique (statbloc custom nommé « Nain »). Design : `rec = findCreatureById(arg)` ; `nameSp = rec?.label ?? arg` ; le repli « nom EST une espèce » utilise `defByName(nameSp)` (le LIBELLÉ du record, jamais l'id lowercase → pas de faux match). Sans ça, une créature dont le label ≠ espèce-def (Demigriffon→Griffon, Spectre de cairn→spectral) rendait Humain. Combattant : `enemyRigProfile` passe `c.creatureId ?? c.name`.

**Distinction NS** : `defByName('Squig'/'Humain')` = ESPÈCES canoniques (vocabulaire rig, defs/) — PAS migrées en id (taxinomie, pas un libellé). Seule l'identité BESTIAIRE (label creatures.json) → id.

**Gotchas vérifiés** :
- `serialize.test` (byte-fidélité datasets) : format canonique = `JSON.stringify(data,null,2)` SANS newline final. Mon script de migration ajoutait `+'\n'` → 2 échecs. (Prolonge le piège JSON Windows de [[game-frenchy-vo-bridge]].)
- Golden bestiaire : tests changés pour résoudre par `c.id` (clé d'affichage = label) ; régénérés → rendu INCHANGÉ (preuve d'iso-résolution id↔label). biped-golden : Cultiste/Mutant rendent en Humain pur (entityRigProfile par nom ≠ id → pas de record), sain.
- camRot : `rotateCam` est passé en 8 crans (45°) alternant `camEdge` (face/coin) ; test réécrit.
- Conversion tests par script DANGEREUSE : avait lowercasé les valeurs `{species:'Nain'}` et la table `cases` (espèces, pas des ids) → reverté, fait à la main (ne convertir QUE les args de résolution, jamais les valeurs `species`).

**35 formes d'armes AA/ZI** (16cffbc) : un `WeaponDef` dédié par arme à main (poudre noire/hast/lames/bagarre/parade), via 4 subagents //. `weaponForms.test` : count 48→83 ; engins de siège (`Armes de siège`) + munitions (`Munitions`) EXCLUS du contrat (non tenus en main). Art = 1ère passe dérivée des silhouettes existantes — QC visuel non fait (offrable).
