---
name: env-git-show-ordre-commit-avant-paths
description: git show --stat avec le commit APRÈS le séparateur -- rend silencieusement le même résultat pour tous les commits — le commit se place AVANT --
metadata: 
  node_type: memory
  type: reference
  originSessionId: 581b89eb-a389-4f97-87c2-713104a0fbca
  modified: 2026-08-26T05:22:03.882Z
---

**Piège mesuré (2026-08-26, juge d'audit DoD #1466)** : dans une boucle d'attribution par
commit, `git show --stat --format= -- src/data src/scenes <commit>` (le commit APRÈS `--`)
rend **silencieusement le même résultat pour tous les commits** — 9 lignes identiques
« aucun .json touché » alors qu'un commit changeait bien `arene-projet.json` (42 l.).
Aucune erreur, aucun avertissement : tout ce qui suit `--` est traité comme pathspec.

**Forme correcte** : `git show --stat --format= <commit> -- <paths>` — le commit AVANT `--`.

**Portée** : toute sonde d'attribution « quel commit du lot a touché quoi » (audits de DoD,
case « aucune donnée ne change », partage d'arbre entre sessions — voir
[[game-index-git-partage-entre-sessions]]). Une boucle qui rend N résultats IDENTIQUES sur
N commits différents est suspecte par construction : re-vérifier l'ordre des arguments avant
de conclure.
