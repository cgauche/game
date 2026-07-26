---
name: game-apparence-catalogue-convergence
description: "Convergence B — catalogue d'apparence unifié (éléments réutilisables + sélections)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 583862c1-7e63-4e95-b150-b9b93ba918ab
---

Direction validée par l'utilisateur (2026-06-14, « BB ») : **convergence B**. Principe — **code = catalogues d'éléments d'apparence réutilisables, keyés ; donnée = sélections (combinaisons)**. Un PNJ/créature/race = une combinaison de clés ; rien n'est verrouillé à une créature (ex. yeux rougeoyants hors Vampire). Spec : `docs/superpowers/specs/2026-06-14-apparence-catalogue-unifie.md`.

**Livré :**
- Niveau 1 (944ff98) : dernier name-regex créature `isMutant` tué, tell mutant data-driven.
- Couche créature (fdfb4c2) : apparence UNIFIÉE sur le record `creatures.json` (`CreatureData.appearance: EntityAppearance`), lue par le rig (empilement défaut race → record → scène), éditable dans le Compendium via `MonsterPartsFields` ; défaut de tenue **« Nu »** (plus « Soldat »).
- **B1a (07d1562)** : features de race → catalogue partagé `src/gameIso/rig/parts/elements.ts` (`APPEARANCE_ELEMENTS` + `feat(keys)`). 14 RaceDef référencent par clé. Vampire `eyes` art→clé `'rouge'` (composeRig résout via `eyesArtFromKeys`). **Byte-identique** (goldens 250/250).
- **B1b (e35c420)** : `appearance.features: string[]` (clés catalogue) → traits ADDITIFS posables sur N'IMPORTE QUEL PNJ (race→def→instance dans composeRig). Pipeline : rigFieldsFrom/riggedAppearance/entityRigProfile/spawnEnemy/pickBackend. Éditeur : picker multi « Traits du corps » (MonsterPartsFields → CodexEdit créature + Inspector scène). Preuve testée (`elements.test.ts`) : Humain porte les oreilles d'Elfe (même art partagé). Byte-identique.

- **Catalogue = REGISTRE** (exigence user « ajouter un élément = déposer un fichier ») : `APPEARANCE_ELEMENTS` se dérive du registre auto-chargé `parts/elements/defs/<key>.ts` (gen-registry → `ELEMENT_DEFS`), 1 élément = 1 fichier (70 defs) ; `parts/elements/index.ts` dérive le catalogue et expose `elementsOf(category)` ; type `ElementOverlay` (superset scale+replace/behind). Byte-identique.
- **Codex aperçu + preview LIVE (a3d4a55)** : `CreaturePreview` (face+profil, chemin rendu réel) montré en LECTURE (CodexEntry, créatures) ET en ÉDITION (CodexEdit, en tête du form d'apparence, recomputé à chaque modif → on voit le rendu changer en direct).

- **BUT user (recadré) : « max perso, PNJ sur mesure SANS mettre de traits/talents ».** L'apparence se construit en VISUEL pur (appearance.features), découplée des mécaniques. LIVRÉ :
  - **Difformités posables en apparence pure (6b4d3d0)** : les visuels de mutation à calque (tentacule, bouche, écailles, plumes, cornes asym, pus, griffes, langue, groin…) sont agrégés au catalogue (`elements/index`, catégorie 'mutation', clé slug hyphénée) et posables via `appearance.features` SANS le trait Mutation. `composeRig` applique le calque COMPLET (replace membre / behind / scale). « Œil énorme » ajouté à EYE_OPTIONS. Éditeur : picker « Traits & difformités ». Byte-identique.
  - Donc un PNJ se construit : species + tenue + monster + traits + DIFFORMITÉS + yeux + couleurs + coiffure + sexe + carrure — tout en apparence, zéro trait/talent. Preview live (CodexEdit).
  - Morpho pures (Corpulent/Émacié build, Peau d'acier/Écailles peau, Court legs) → via build/colors directs (pas un trait posable). faceFlip/legs non exposés à l'éditeur (niche).

**Défaut de tenue (recadrage user 2026-06-14)** : « Nu » EST le bon défaut GLOBAL (corps nu pour créatures vraiment sans habit). « Tous les PNJs à poil » = les PNJs n'avaient pas d'apparence paramétrée → fix = PARAMÉTRER, pas changer le défaut. CHAQUE race porte donc sa `tenue` en donnée dans `src/data/raceAppearance.json` — les espèces civilisées habillées : Humain / Halfling / Haut-Elfe / Elfe sylvain → `bourgeois`, Nain → `artisan` (les autres gardent `nu` ou leur tenue d'espèce). Chaîne : `c.career ?? cd?.tenue ?? perso?.tenue ?? race.tenue ?? 'Nu'` (carrière/record/scène priment toujours). Habille d'un coup les humains officiels (Bella la Noire/Pol Dankels/Eusapia + génériques) ET les ~160 PNJ frenchy.bzh (espèce Humain). Tests `enemyProfile.test.ts`/`creatures.test.ts` calés sur Bourgeois.

**Reste (optionnel) :** mutations EN FOLDER (defs/) au lieu d'agrégées (canon, faible valeur) ; `applyElements` unique (yeux/membre/mutation appliqués pareil) — gros risque cœur rendu, gain faible. Le but produit est ATTEINT.

**Friction actée :** les éléments ont des TYPES hétérogènes — overlay sur os (scale, RaceFeature), swap d'œil en place, remplacement de membre (RigOverlay.replace/behind), morpho (build/legs), recolor (skin). `RaceFeature` (scale) ≠ `RigOverlay` (replace/behind) → B2 doit élargir le type d'overlay du catalogue. L'exemple yeux rougeoyants sur n'importe quel PNJ marche DÉJÀ via `appearance.eyes='rouge'`. Empilement d'apparence : [[game-data-driven-architecture]]. Garde-fou : goldens byte-identiques sauf partages assumés.
