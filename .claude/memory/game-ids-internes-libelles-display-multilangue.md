---
name: game-ids-internes-libelles-display-multilangue
description: "l'app utilise des id stables partout ; libellé UNIQUEMENT à l'affichage. Un lookup par libellé n'est légitime que si son SEUL usage est de produire un texte montré à l'utilisateur."
metadata: 
  node_type: memory
  type: project
  originSessionId: e7d15c25-5b93-4610-9112-33030b29822a
---

L'app utilise les `id` stables partout (data, runtime, sauvegardes) ; les libellés ne servent qu'au **bord UI** (`refLabel`/`findById`/`conditionLabel`…). Raison = **multilangue** : l'id est indépendant de la langue, donc toute jointure/lookup/clef par libellé au runtime = bug multilangue. Façade : `src/data/index.ts` (`findXById` = runtime ; `*Label` = affichage).

**Nuance (feedback user, 2026-06-18) — se méfier des « légitimes ».** Les lookups par libellé classés « authoring/affichage » (`findSkill`/`findTalent`/`findCreature`/`findSpell` par label, `traitByLabel`/`qualityByLabel`, `domainByLabel`, bridges `*IdByLabel`) ne sont légitimes **que si le SEUL usage du résultat est d'afficher un libellé à l'utilisateur** (ou un picker d'éditeur dont la sortie est convertie en id avant persistance).

**Why:** dès que le résultat d'un lookup-par-libellé est comparé, branché dessus, stocké/persisté tel quel, utilisé comme clef d'une autre map, ou passé en entrée de logique moteur/combat → le libellé redevient une clef de fait = résidu de migration déguisé en « légitime ».

**How to apply:** lors d'un audit id/label, ne PAS exclure ces helpers d'office. Tracer leurs **sites d'appel** et classer l'usage du retour : affichage pur (OK) vs logique/persistance/clef/entrée-moteur (résidu à corriger en id). Hypothèse par défaut = suspect tant qu'on n'a pas prouvé que c'est purement de l'affichage. Cas `domainByLabel` réputé légitime par design (label = `subType` de Sort) : à re-vérifier, pas à présumer.

**DOCTRINE FINALE (user, verbatim, 2026-07-09 — playtest naval)** : « Le seul endroit où on peut mettre des labels, c'est dans le champ `label`, ou pour l'afficher, ou sur des écrans du codex/éditeur pour aider à la saisie — mais au final ce qu'on manipule c'est des IDs. » Durcissements actés le même soir :
- **Y COMPRIS à l'AUTHORING** : l'auteur écrit des IDS (`hache-d-armes`, jamais « Hache » ; « Marchande » = interdit) ; les résolveurs de `scripts/arene/lib.mjs` deviennent des VALIDATEURS id-only fail-fast (l'acceptation de libellé de `speciesId` livré le soir même SAUTE) ; les pickers éditeur/codex affichent le libellé et stockent l'id (seule aide à la saisie légitime).
- **L'adjudication de juillet « tenue/arme par libellé = contrat rig » ([[game-rig-datadriven-sweep]]) est ABROGÉE** : `appearance.tenue` = id de def, `weapon` = trappingId, garde-robe keyée par id de carrière sans repasser par un libellé au milieu ; #242 requalifié affichage pur (formes féminines = display).
- Skill `creer-une-campagne` (étape 3 « libellés lisibles normalisés ») + encadré CLAUDE.md à réécrire dans la tranche.
- Tranches d'exécution : species FAIT (`90bf3b5c`), ShipPoste/trappingId = #222, tenue/arme/carrière = tranche suivante, étalon régénéré id-pur au passage campagne.

Prolonge [[game-refs-ids-migration]] et [[game-label-id-migration-complete]] ; relié à [[feedback-zero-retrocompat-briques-solides]].
