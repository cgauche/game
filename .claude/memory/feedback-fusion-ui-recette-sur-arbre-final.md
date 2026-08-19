---
name: feedback-fusion-ui-recette-sur-arbre-final
description: "Un lot UI recetté AVANT un rebase n'est PAS recetté — la recette navigateur se rejoue sur l'arbre FINAL fusionné, surtout si le tronc a changé le régime de rendu"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3c1689ae-eeaa-4da2-a83f-c35ecef5c557
  modified: 2026-08-19T12:50:22.147Z
---

2026-08-19, chantier HUD #1349. Le lot intentions (Course/Charge : overlay de portée) a été recetté au navigateur dans son worktree (base pré-f21b993a), puis rebasé sur un tronc qui avait entre-temps passé la caméra/le rendu en IMPÉRATIF hors React (f21b993a), puis fusionné sur la seule foi de tsc + suites unitaires vertes. Résultat chez l'user (verbatim) : « je clique sur Course, il ne se passe rien » — l'état s'arme, la peinture ne suit plus.

**Why:** les tests unitaires prouvent l'ÉTAT, jamais la couture visuelle ; un rebase qui traverse un changement de régime de rendu invalide la recette d'origine. Cas particulier de [[feedback-recette-navigateur-arbre-gele]] : l'arbre gelé à recetter est l'arbre FUSIONNÉ, pas celui du lot.

**How to apply:** avant toute fusion d'un lot UI dont la base a bougé (rebase, conflits résolus, changement de régime de rendu dans l'intervalle), rejouer la recette navigateur du lot sur l'arbre final — même « déjà recetté », même pressé. Portes machine vertes ≠ recetté.
