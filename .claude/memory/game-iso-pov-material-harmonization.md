---
name: game-iso-pov-material-harmonization
description: "Harmonisation de l'ombrage des matériaux ISO ⇄ POV — fait ; mécanisme + gotcha QC"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9d554361-2e93-48b6-aa3d-8aeb9375d029
---

Harmonisation ISO ⇄ POV livrée (commit `feat(lumiere): harmonise l'ombrage des matériaux ISO ⇄ POV`, 2026-07-03). Tout est **data-driven dans `src/data/ambiance.json`** (éditable au Codex) :

- **POV rapproché de l'ISO** : voile chaud `pov.warm` (miroir de `iso.warm`, température), `pov.fogOutdoorSurface` (brume des SURFACES **découplée** du ciel `fogOutdoor` → sols lointains plus délavés froids), fog-lift atténué (`pov.depth.outdoor` fogStartT 8/gamma 2), et occlusion intra-tuile `pov.floorOcclusion` → gradient neutre partagé `pov-floor-shade` (spéculaire haut/loin → ombre bas/près) sur chaque losange = « creusé » comme l'iso. Nouveau `DrawItem.kind='occl'` (dégradé neutre `url(#pov-floor-shade)`, pas une teinte `rgb(...)` — les tests d'invariants le distinguent).
- **Sol ISO réactif à la lumière par-case** (`affineFloors.groundFaceSvg`) : voile `ao(1 − light)` par losange ≡ `base × light` du POV. **NO-OP au plein jour** (light=1 → 0 élément émis, byte-identique) ; pools de torche/mares de nuit visibles comme en POV. `sceneLightField` filé `IsoStage → floorLayerObjs → floorSvg` (param optionnel : éditeur/QC/tests intacts). Conséquence voulue : les scènes DIM/nuit assombrissent maintenant le sol iso par-case (avant : seulement le voile global).
- `AMBIENT_FLOOR` (0.12, clamp de lumière) promu en donnée partagée `ambiance.ambientFloor`, lu par POV (`pov/camera.ts`) ET iso.

**Gotcha QC** : `npm run qc:env` (planches `public/qc/env-*.png`) rend le POV fidèlement MAIS **omet les AmbianceVeils de l'ISO** (warm/vignette/nuit) → l'ISO y paraît plus clair qu'en jeu. Juger la **cohérence jour ISO en LIVE** (Playwright `togglePov`), pas depuis qc:env. Cf. [[game-browser-verif-tempo]].
