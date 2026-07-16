---
name: game-isostage-walk-rerender-perf
description: IsoStage est re-rendu ~60×/s pendant un déplacement (useWalkAnim) ; toute couche lourde doit rester memoïsée sur des deps stables — VÉRIFIÉ ENCORE VRAI après la refonte builders/CulledScene (2026-07-05).
metadata: 
  node_type: memory
  type: project
  originSessionId: 569aa03a-3c64-4f9a-9d6f-f1121d3a049b
---

**Vérifié au code 2026-07-05** : `IsoStage.tsx` garde le patron `useMemo` massif (floorEls/wallEls/propEls/tokenEls/floorObjs/wallObjs/…, chacun sur des deps `[scene, visible, dims, mode, battle, partyPos, …]` — jamais `walkTick`) ; `useWalkAnim.ts` existe toujours et pousse `setWalkTick` à chaque `requestAnimationFrame`. Le conseil ci-dessous reste ACTIF, désormais posé sur l'architecture `builders/` (ex. `builders/floors.ts`) + `stage/CulledScene.tsx` plutôt que les fonctions monolithiques d'origine.

**Why** : pendant qu'un personnage glisse le long d'un chemin, `setWalkTick` (à chaque rAF) re-rend IsoStage entier. Sans mémoïsation, chaque frame reconstruit toute la grille de sol + décor + bâtiments + surbrillances de combat + `pickBackend`/résolution de rig de chaque acteur — alors que seuls le token qui glisse et la caméra changent par frame. Les rigs s'auto-animent via leur PROPRE rAF (`useRigClip`/idle) ; c'est le re-rendu GLOBAL pendant la marche qui sature.

**Comment appliquer** : toute nouvelle couche coûteuse dans IsoStage passe par `useMemo` avec des deps qui NE changent PAS à la frame d'anim (un vrai déplacement crée une nouvelle réf `battle`/`partyPos` via `set`/`moveParty` → recalcul 1×). Garder DYNAMIQUE (par frame) seulement ce qui suit le token qui glisse (halo actif, tether d'engagement) + la caméra. Les `useMemo` doivent précéder le `if (!scene) return null`. En mode exploration, les tokens d'entités de scène sont aussi memoïsés (deps `[scene, shownRot, viewMode, mode]`) — seul le leader (mobile) se re-rend par frame ; en combat les tokens restent par-frame (peu d'acteurs, acceptable).

**Culling viewport** : les acteurs hors-champ ne paient plus leur rAF d'anim — `viewport.ts` calcule le cadre visible en tuiles, IsoStage publie l'AABB des 4 coins projetés (suit la caméra), `usePlanAnim`/`useRigClip` sautent leur `force()`/`setPose` si hors-vue (`onImpact`/`onDone` toujours honorés — la logique de combat n'est jamais gated). Marge 4 tuiles (corps hauts). Effectif surtout en EXPLORATION.

**Gotcha idle-anim non-bipèdes** : au démontage/remontage (StrictMode dev), un cleanup de `usePlanAnim` qui n'annule le rAF SANS remettre `rafRef.current = 0` fait croire à `ensureLoop` que la boucle tourne encore (id tronqué mais truthy) → idle figé, l'animal ne bouge qu'au re-rendu de la marche. Toujours reset `rafRef.current = 0` au cleanup d'un rAF géré par ref.

**Limite de mesure** : FPS non mesurable via Playwright (rAF throttlé ~1 fps en onglet d'arrière-plan) — vérifier par correctness (rendu/rotation/console/typecheck/tests), pas par un chrono live.

Prolonge [[game-rig-2d-paper-doll]], [[game-refonte-rendu-builders-backends]], [[env-use-powershell-not-bash]].
