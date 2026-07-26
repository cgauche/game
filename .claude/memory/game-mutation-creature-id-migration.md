---
name: game-mutation-creature-id-migration
description: "Mutations ET créatures migrées en id stable (slugId) — findCreatureById/mutationById, Combatant.creatureId, resolveRender id-based ; + 35 formes d'armes AA/ZI ; gotchas serialize.json & golden."
metadata: 
  node_type: memory
  type: project
  originSessionId: c200b807-58b0-4881-afff-0b8ebba80cc8
---

Session 2026-06-17 : « On ne devrait plus se baser sur le label » → migrations id ATOMIQUES livrées (2 commits, suite 5229 verte). Prolonge [[game-label-id-migration-complete]] (qui avait fait traits/skills/talents/spells).

**Mutations → id** (commit 16cffbc) : `mutations.json`/`mutationTables.json` portent/référencent un `id` (slugId(label)) ; l'accès se fait par `mutationById`/`IDS_PHYSIQUES`/`IDS_MENTALES` (`src/data/mutations.ts`) ; `Mutation.id` requis (label = affichage). `mutationsAtSpawn` résout l'arg d'auteur du trait « Mutation (X) » en id via `slugId`. `stateFragments` (combatantVisuals) résout l'apparence PAR ID depuis le registre. `mutationById('cornes-asymetriques')` = clé = clé du `data-mut` (élément), coïncide.

**Créatures → id** (commit 81d661c) : les entrées de `creatures.json` portent un `id` ; `findCreatureById`+`creatureLabel` (index par id) ; `findCreature(label)` GARDÉ pour authoring/affichage SEULEMENT (pickers éditeur, Codex). `Combatant.creatureId` posé au spawn → le rig résout l'apparence PAR ID (enemyProfile/bodyPlan/pickBackend), plus par `c.name`. Les refs de scènes (`arene-projet.json` + scénarios .ts via `ref:`) et l'op `polymorph` de spells.json pointent des ids.

**Piège central `resolveRender`** (`bodyPlan.ts`) : son 3ᵉ arg est un **id** — de créature, de véhicule, ou d'un trapping à `siegeRig` — jamais un libellé. La résolution est 100 % par la DONNÉE, dans cet ordre : véhicule à coque (`findVehicleById` → gabarit par `hull.propulsion`) → **espèce EXPLICITE passée en 1ᵉʳ arg** → `findCreatureById(id)?.appearance.species` → affût de siège (`findTrappingById(id)?.siegeRig`) → sinon `console.error` en DEV + repli VISIBLE sur `DEFAULT_RACE_ID` (`speciesRace.json`). **Aucun repli par libellé** : une créature dont le label ≠ l'espèce-def (Demigriffon→Griffon, Spectre de cairn→spectral) porte son `appearance.species` EN DONNÉE, sinon elle rend la race par défaut, visiblement fausse. Combattant : `enemyRigProfile` passe `c.creatureId` (`resolveRender(c.species, c.traits, c.creatureId)`).

**Distinction** : les ESPÈCES canoniques sont le vocabulaire du rig (registre `defById`, `src/gameIso/rig/creatures/`) et se résolvent en LOOKUP EXACT — `resolveSpecies(species)` est la porte des outils dev/QC/tests qui partent d'un nom d'espèce. Seule l'identité BESTIAIRE (record `creatures.json`) est keyée par id de migration.

**Gotchas vérifiés** :
- `serialize.test` (byte-fidélité datasets) : format canonique = `JSON.stringify(data,null,2)` SANS newline final. Mon script de migration ajoutait `+'\n'` → 2 échecs. (Prolonge le piège JSON Windows de [[game-frenchy-vo-bridge]].)
- Golden bestiaire : tests changés pour résoudre par `c.id` (clé d'affichage = label) ; régénérés → rendu INCHANGÉ (preuve d'iso-résolution id↔label). biped-golden : Cultiste/Mutant rendent en Humain pur (entityRigProfile par nom ≠ id → pas de record), sain.
- camRot : `rotateCam` est passé en 8 crans (45°) alternant `camEdge` (face/coin) ; test réécrit.
- Conversion tests par script DANGEREUSE : avait lowercasé les valeurs `{species:'Nain'}` et la table `cases` (espèces, pas des ids) → reverté, fait à la main (ne convertir QUE les args de résolution, jamais les valeurs `species`).

**35 formes d'armes AA/ZI** (16cffbc) : un `WeaponDef` dédié par arme à main (poudre noire/hast/lames/bagarre/parade), via 4 subagents //. `weaponForms.test` : count 48→83 ; engins de siège (`Armes de siège`) + munitions (`Munitions`) EXCLUS du contrat (non tenus en main). Art = 1ère passe dérivée des silhouettes existantes — QC visuel non fait (offrable).
