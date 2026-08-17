---
name: game-doctrine-camera-boucle-jamais-react
description: "INVARIANT RENDU (2026-08-17, chantier caméra impérative f21b993a) : tout ce qui bouge PAR FRAME (caméra, pan, easing de focal, glissements) vit dans la BOUCLE (modules vivants + battement stageFrames), JAMAIS dans l'état React — et une valeur de caméra a UN calcul, N consommateurs même-frame, ZÉRO lissage par consommateur"
metadata:
  type: project
---

Bug utilisateur fondateur (2026-08-17, verbatim) : « le jeu ram a mort des qu'on se déplace ou bouge la camera. D'ailleurs les barres de vies, le tracés du déplacement, la grille, ne suivent pas imaediatement les mouvements de la camera » — et son diagnostic mesuré : `panCamBy` = un `set` Zustand par `pointermove` (commit React complet + `renderer.render` par événement souris), et `transition: transform 0.3s` CSS sur le groupe SVG pendant que la caméra three s'appliquait instantanément (désync 300 ms). Deux conventions de l'ère tout-SVG portées telles quelles dans le monde hybride canvas+DOM.

**Why :** l'industrie (react-three-fiber, `CSS2DRenderer` de three.js) a résolu ce problème depuis toujours : caméra dans la boucle de rendu, overlays DOM repositionnés depuis la MÊME caméra dans le MÊME battement. Tout écart à ce patron reproduit mécaniquement les deux symptômes (tempête de commits React par événement d'entrée, désynchronisation canvas/DOM). Cf. doctrine [[user-doctrine-etat-de-lart-avant-invention]].

**How to apply :**
- **Par-frame = boucle** : un geste/une animation qui écrit à la cadence de l'image passe par un module vivant (`state/stagePan.ts`, `state/stageYaw.ts` — patron vivant/commis) + le battement UNIQUE `src/gameIso/stage/stageFrames.ts` (`battreStageFrames` si on tient déjà une horloge, `demanderFrames`/`relacherFrames` sinon, clé de source PAR INSTANCE). React ne commite qu'aux frontières discrètes (pointerup, franchissement de pas, changement d'unité/scène) — commit ABSOLU (`setCamPan`), jamais relatif.
- **Une valeur, N consommateurs** : la caméra se calcule UNE fois par frame (`camAt` : focal adouci + pan vivant) et TOUS les consommateurs (caméra three de `dessiner()`, `style.transform` du groupe SVG) la lisent dans la même frame. AUCUN lissage par consommateur — jamais de `transition` CSS sur un `transform` de caméra ; tout easing (focal ~300 ms) se calcule à la SOURCE, pur en `now`.
- **Pièges vécus au chantier** : un module vivant partagé se REMET À ZÉRO aux frontières (entrée de scène, recentrage — sinon pan orphelin après démontage en plein geste) ; un recentrage pendant un geste doit agir sur le VIVANT (le commis peut déjà valoir 0) et notifier la repeinte ; les tests qui panoramiquent remettent le module au repos en `afterEach` (`isolate:false`).
- Dette connue : le redessin reste par-commit-React de l'hôte (littéraux `frameCam`/`chromeAt`/`dynMarks`/`halos` reforgés par rendu) — stabilisation = #1371.
Cf. [[game-refonte-rendu-builders-backends]], [[game-isostage-walk-rerender-perf]].
