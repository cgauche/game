---
name: feedback-full-suite-gate-avant-commit
description: "Lancer la suite COMPLÈTE avant de committer un changement de code — un arbre churné par une // session n'excuse PAS de sauter le gate"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 7dce2773-7f3e-4b49-bf35-1b5bc3ba4b66
---

Avant de committer un changement de code, je lance la suite COMPLÈTE (`npm test`), pas seulement
les tests ciblés — **même si l'arbre est churné par une session //**. Les échecs s'ATTRIBUENT
(mes fichiers vs // session vs orphelins), ils ne servent pas d'excuse pour sauter le gate.

**Why:** 2026-07-05, refactor specsSource (`arme`/`a-distance`). J'ai committé (`92c70234`) en ayant
DÉLIBÉRÉMENT différé la suite complète (« la // session churne 46 fichiers, pas attribuable »). Le
commit contenait une RÉGRESSION : `spawn.test` alimentait `weaponFromTrait` par LIBELLÉ mort (`Dague`
ne résolvait plus post-migration → repli générique `epee`). `tsc` vert + tests ciblés + garde
`refs-migrated` ne l'ont PAS attrapée — SEULE la suite complète l'a révélée. L'user : « tu sais ce
qu'il te reste à faire » = lancer le gate différé. Corrigé en `55c7025a`.

**How to apply:** un arbre partagé churné n'est PAS une excuse pour sauter le gate AVANT commit. Les
tests ciblés couvrent le chemin heureux ; la suite complète attrape les tests EXISTANTS (souvent
dupliqués ailleurs — ici `spawn.test` doublait `creatureEquip.test`) qui verrouillaient l'ancien
comportement. « Vérifié = prouvé » inclut la suite verte AVANT le commit, pas après coup. Voir
[[feedback-typecheck-verify-full-not-tail]].
