---
name: env-recette-jamais-en-parallele-dun-juge-qui-teste
description: "2026-09-02 — une recette navigateur lancée EN PARALLÈLE d'un juge de diff qui rejoue des tests dans le MÊME worktree a été cassée deux fois : `npm test` (gen-registry) réécrit `src/data/*.json` à contenu identique → HMR de Vite → TDZ #1464 → page blanche, état de combat perdu ; `git status` ne le voit pas (delta nul). Recette = arbre gelé y compris des ÉCRITURES idempotentes : un seul agent par worktree pendant une recette"
metadata:
  type: reference
---

**Fait (2026-09-02, train critiques #1657 B2a+#1682)** : juge de diff (rejoue des tests ciblés) et recetteur (dev server du worktree, port dérivé) dispatchés ensemble sur le même worktree. Le log du dev server montre 12 `page reload` en 2 min : chaque `npm test` lance `gen-registry` qui réécrit `src/data/props.json`, `raw.manifest.json`, `reliefMaterials.json`, `roofMaterials.json` (contenu identique, mtime neuf) → HMR → `store.ts` ré-exécuté → `ReferenceError: Cannot access 'testRouter' before initialization` (#1464) → page blanche. Le recetteur a perdu deux setups de combat et son point 5 n'a pas pu être joué.

**Why :** « arbre gelé » ([[feedback-recette-navigateur-arbre-gele]]) signifie aucune écriture disque sous `src/`, pas seulement aucun delta git — Vite réagit au mtime.

**How to apply :** pendant une recette, AUCUN autre agent (juge, codeur, gates) ne tourne dans le même worktree ; enchaîner juge → recette, ou donner à la recette un worktree à elle. Un contrôle pré-recette utile : la date de modification des fichiers `src/data/*.json` pendant la session, pas seulement `git diff --stat`.

Complément 2026-09-02 (#1680 lots 2-3, #1507) : la MÊME classe frappe une SUITE COMPLÈTE locale menée en parallèle d’une capture Chrome ou des sondes d’un juge — `silhouette-corps.test.tsx` et `weather-boucle.test.tsx` (bancs de rendu à temporisation, `attendreQuads`/frame rAF) rougissent 4 runs sur 6 sous charge, verts seuls et en CI. Règle : suite complète SEULE sur la machine (ni recette, ni juge qui sonde, ni second worktree — le verrou `wfrp-suite.lock` ne voit que les suites) ; un rouge de ces deux fichiers se rejoue seul avant toute attribution.
