---
name: game-vue-du-dessus
description: Vue du dessus (mode bascule grille carrée) + caméra tactique libre — livré 2026-06-10
metadata: 
  node_type: memory
  type: project
  originSessionId: e7e4fd62-9e0b-46db-8013-55fc5e1eb6e3
---

**Vue du dessus** (mode bascule iso ⇄ top) LIVRÉE 2026-06-10. Spec/plan : `docs/superpowers/specs/2026-06-10-vue-du-dessus-design.md` + `docs/superpowers/plans/2026-06-10-vue-du-dessus.md`.

Architecture = **2ᵉ axe `view: 'iso' | 'top'` de `Dims`** (comme `rot`), couture unique dans `src/gameIso/iso.ts` : `tileCenter`/`diamondCorners`/`screenToTile`/`stageSize`/`depth`/`originX` branchent sur `view`. `CELL=56`. Grille carrée, picking carré, profondeur par rangée (`r.y`). Jeu **et** éditeur en héritent.

- **Acteurs → disque-portrait** en top : `pickBackend(subject, view)` renvoie la vue de face cadrée (`faceFrame`, typé) + `flat:true` ; `BodyToken` a un mode `flat` (disque clippé centré, anneau circulaire). Décor = billboard inchangé (`flat:false`). `RigPortrait` (HUD) consomme la MÊME `pickBackend(_, 'top')` → pas de duplication du cadrage visage.
- **Décor iso-extrudé** doit brancher en top : **murs (`wallBlock` terrain `mur`) = bloc plein sur la case** (l'extrusion iso surélevée de H paraissait « mal orientée/non alignée ») ; **bâtiments (`buildingObj`) = plan toit + contour de murs ÉPAIS + porte** (l'empreinte unie se confondait avec des tuiles — « faut savoir que c'est un building »).
- **Bascule par surface** : store `viewMode`/`toggleViewMode` (jeu, préservé au reset comme zoom/camRot), `useEditorView.viewMode` (éditeur). Bouton dans `ViewControls` (partagé) **à droite du +**.
- Monté en top = cavalier+monture en 2 disques distincts (composite iso seulement).

**Caméra tactique libre** (même commit, feedback live) : dézoom floor **1 → 0.4** (`store.setZoom` + `ZOOM_MIN`) ; **panoramique au glisser** (seuil 6px, clic différé au pointer-up → tap=clic, glisser=pan ; `camPan` dans le store, `panCamBy` delta=ΔviewBox/zoom) ; **refocus auto sur l'unité active au changement de tour** (`resetCamPan` via effet sur `battle.order[battle.turn]`). Retrait de la `date-chip` HUD (déjà dans le menu).

Vérifié navigateur (Marchand + éditeur top-down) : grille carrée, disques, dézoom, bâtiment aligné, 0 erreur console. Prolonge [[game-orientation-monde-facing]] et [[feedback-contenu-donnee-editeur-pas-code]].
