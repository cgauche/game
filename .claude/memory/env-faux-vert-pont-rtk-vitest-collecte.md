---
name: env-faux-vert-pont-rtk-vitest-collecte
description: "Le pont shell AFFICHE des valeurs fausses — exit 0 sur un rouge, « No errors found » sur un tsc à 4 erreurs, 0 match sur 6 occurrences : seul spawnSync.status hors pipe fait foi"
metadata:
  node_type: memory
  type: reference
---

**Why:** ce n'est pas seulement le pipe qui mange le code de sortie, c'est le pont qui AFFICHE un code, une ligne de log ou un compte faux — un lot se ferait livrer sur un « vert » qui est un rouge, et une conclusion « n'existe pas » se fonde sur un faux négatif de recherche.

**How to apply:** toute mesure de gate = `spawnSync(...).status` écrit HORS pipe (fichier relu), jamais la ligne « EXIT »/« PASS »/« No errors found » rendue par le pont, et un fichier de sonde vide ne vaut qu'avec son code de sortie collé à côté ; un `status = 1` avec ZÉRO assertion en échec est une erreur de COLLECTE, pas un test fantôme ; toute affirmation d'absence issue du pont se recoupe par un outil d'une autre famille ; la mesure finale d'un lot se refait sur arbre gelé.
