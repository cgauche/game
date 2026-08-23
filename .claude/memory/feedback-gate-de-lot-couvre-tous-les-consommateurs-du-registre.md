---
name: feedback-gate-de-lot-couvre-tous-les-consommateurs-du-registre
description: "Un lot qui touche le registre d'actions (actions.json, actionRegistry, modes) passe ses gates sur TOUS les dossiers consommateurs — src/gameIso inclus — pas seulement src/ui/src/state ; vécu 2026-08-23 : P2-B a supprimé l'entrée `cast`, gates ui/state/data vertes, régression `useHoverTargeting › grisage hors-LdV du sort` découverte par le lot suivant"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3c1689ae-eeaa-4da2-a83f-c35ecef5c557
  modified: 2026-08-23T17:46:39.210Z
---

2026-08-23, #1411 P2-B : le lot supprime l'entrée de registre `cast` (le mode passe sur `cast-spell`). Gates du codeur : `vitest run src/ui src/state src/data` → verts hors rouges attribués. Fusionné. Le codeur du lot SUIVANT (P2-D, `src/gameIso`) mesure `useHoverTargeting.test.tsx › grisage hors-LdV du SORT` rouge sur `origin/main` ; bisect : vert sur `7c059b62`, rouge sur `9f069b3d` → c'était P2-B.

**Why :** le registre d'actions est lu par le MONDE (`src/gameIso/stage/useHoverTargeting.ts`, `targetingModes`, overlays) autant que par la console. Un périmètre de gates choisi par « où j'ai écrit » ignore « qui me lit ». [[feedback-un-detecteur-ne-mesure-que-sa-couverture]] — une suite verte ne prouve que ce qu'elle a couvert ; [[feedback-full-suite-gate-avant-commit]].

**How to apply :** pour tout lot touchant `src/data/actions.json`, `src/state/actionRegistry.ts`, `targetingModes.ts` ou un mode armé : gates = `src/ui src/state src/data src/gameIso` au minimum (la suite COMPLÈTE avant fusion reste la règle), et la liste des dossiers consommateurs se mesure par `grep -rl "actionRegistry\|ACTIONS\b\|findActionById" src/` avant d'écrire le brief — pas de mémoire.
