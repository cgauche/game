---
name: game-vents-de-magie-integration
description: Les Vents de Magie (VDM) = 16e livre autorisé — corpus + enregistrement landés 2026-07-22 ; intégration Atlas RAW = phase suivante (15 chapitres en ⬜)
metadata: 
  node_type: memory
  type: project
  originSessionId: 7589f79f-ac8f-465b-a31d-eaa189991f04
  modified: 2026-07-22T05:01:02.458Z
---

**Les Vents de Magie** (VF de *Winds of Magic*, © 2025 Cubicle 7/Khaos) livré le 2026-07-21, intégré
via le pipeline [[game-mdg-new-book-pipeline]] (skill `ajouter-un-livre-source`). Abbrév **VDM**,
id `vents-de-la-magie` (était un placeholder VO sans `dir`, complété VF).

**LANDÉ 2026-07-22** (scope user « Corpus + Atlas d'abord », curation data = tickets différés) :
- Extraction Marker (228 p., 142k mots, sans perte OCR) → 15 chapitres `Source/Warhammer v4 - Les
  Vents de Magie/NN - *.md` (splitter `scripts/raw/split-vdm.mjs`, ancré sur pastilles `• •`).
- Enregistrement : `books.json` (VF+dir+abbr) + `BOOK_ORDER` (BOOKS=16) + `sources.md`/`sources-vf.md`/
  `CLAUDE.md`. Commits `c18e4acb` (feat) + `b86c9bc2` (chore : dette raw pré-existante soldée, cf.
  [[game-pre-commit-raw-gate-collision-arbre-partage]]).

**⏳ RESTE — intégration Atlas RAW (étape 4, coverage VDM = 15 ⬜)** :
- ch.2 « Révisions des règles d'incantation » : ⚠ **VDM DÉCLARE REMPLACER LDB 46-51** (l.5 : « remplacent
  celles du Livre de Règles ») — pas un simple ajout. Enrichir `docs/raw/magie.md` en variantes/màj
  (Focalisation, Surincantation, Imparfaites, dissipation, magie rituelle & rituels), doctrine
  [[game-doctrine-une-entite-n-livres-n-variantes]]. → fiche ✅.
- ch.3 « Travaux arcaniques » (carrières Alchimiste ord./Bedeau/Devin/Magister Vigilant + compétences
  Augure/Psychométrie/Alchimie) → `carrieres.md`/`competences.md`/`talents.md`. → fiche ✅.
- ch.4-11 (8 domaines : listes de sorts révisées) → `catalogue-sorts.md` (table DOMAINS de
  `build-catalogs.mjs`) → 📖. ch.12 artefacts → catalogue équipement/divers. ch.13 créatures magiques
  (élémentaires, familiers jouables) → `catalogue-creatures.md` → 📖.
- ch.1 (histoire magie), ch.14 (sites/lignes de force), ch.15 (némésis/aventures) → `HORS_REGLE` de
  `coverage.mjs` (cadre) → ➖.
- Gardes finales : `coverage.mjs` (viser ⬜=0), `reconcile.mjs`, `reanchor.mjs`.

**Curation `src/data` (étape 5, différée en tickets)** : sorts par domaine, carrières de sorcier,
familiers/élémentaires, artefacts → JSON tagués `source:{book:"vents-de-la-magie"}`, à la main.
