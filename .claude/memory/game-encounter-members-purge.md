---
name: game-encounter-members-purge
description: "Format de rencontre legacy `enemies[]` SUPPRIMÉ — authoring via buildEncounter, champ species câblé, arène visible/embuscade nature"
metadata: 
  node_type: memory
  type: project
  originSessionId: 153bea1b-cc95-4835-afe5-c82511433515
---

Purge totale du format de rencontre legacy (demande user « à mort le legacy / pas de rétro-compat / pas de dupe »). Ne PAS réintroduire `enemies[]`.

- **Plus de `EncounterDef.enemies` / `LegacyEncounterEnemy` / branche encounters de `migrateEncounters`.** Le runtime ne lit QUE `EncounterDef.members` (EncounterMember → SceneEntity 'personnage' qui porte ref/statblock/apparence/arme/`combat`).
- **Authoring = `buildEncounter`/`buildEncounters` (`src/state/encounterAuthoring.ts`, PUR)** : terse `{ id, enemies:[…], hidden?, surprise?, onVictory? }` → `{ entities, encounter(members) }`. Id stable `enemy-<encId>-<i>`. SOURCE UNIQUE (pas de dupe) :
  - scénarios de test : `setEncounters(scene, [...])` dans `test-scenarios/_shared.ts` ;
  - générateur d'arène : `scripts/campagne/lib.mjs#scene()` (l.139) passe ses `encounters` terse au compilateur `buildScene` (`src/state/mapSpec.ts`), qui appelle `buildEncounter` ; tourne via **tsx** (`tsx scripts/arene/generate.mjs`, plus `node`).
- **`hidden` (défaut false = VISIBLE)** pose `combat.hiddenUntilCombat`. Convention arène (Q2 user) : zones 1-13 = ennemis VISIBLES (gladiateur — RAW on voit ses adversaires) ; expéditions Futaie-harde / Tourbière / Gué = `hidden:true` + `surprise:'party'` (Test de Surprise opposé). `surprise` (mécanique LDB 13) est ORTHOGONAL à `hidden` (visuel).
- **`appearance.species` ENFIN CÂBLÉ** (était authored mais jamais lu) : explo `pickBackend → entityRigProfile`, combat `spawnEnemy` (→ `c.species`). `baseSpeciesOf` défaut 'Humain'. Forgeron Nain / prisonnier Halfling se rendent vraiment ; PNJ neutres reçoivent une `career` (fini le soldat générique).
- `migrateScene`/`migrateSceneEntity` GARDÉS : normalisent encore kind (`pnj`/`ennemi`/`objet`) + `loot`/`search` à l'import éditeur (`Editor.tsx`) et au load — utilisés, pas morts.

Recette navigateur passée (3250 tests + 0 erreur console) : zone1 6 ennemis visibles→combat, Futaie harde cachée+bande visible, forgeron `Nains`→`Nains`. Voir [[credo-exemples-calibrants]].
