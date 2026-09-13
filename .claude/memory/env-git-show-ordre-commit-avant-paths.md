---
name: env-git-show-ordre-commit-avant-paths
description: "git show : la révision se place AVANT le séparateur de pathspec ; après, elle est traitée comme un chemin et la sonde rend le même résultat pour toutes les révisions"
metadata:
  node_type: memory
  type: reference
---

**Why:** avec la révision placée après le séparateur, la commande ne lève aucune erreur et rend silencieusement N résultats identiques sur N révisions — une attribution par révision y devient fausse sans le moindre signal.

**How to apply:** forme correcte `git show --stat --format= <révision> -- <chemins>` ; une boucle d'attribution qui rend des résultats IDENTIQUES sur des révisions différentes est suspecte par construction — re-vérifier l'ordre des arguments avant de conclure.
