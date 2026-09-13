---
name: game-existant-poc-refactor-libre
description: "Le comportement de l'existant n'est PAS un oracle — migrer, c'est rouvrir le Source et porter la version CORRECTE, jamais la parité"
metadata:
  node_type: memory
  type: feedback
---

**Why:** le POC peut être INFIDÈLE au RAW, pas seulement mal architecturé ; un test réécrit « à parité » enshrine le bug, et une consigne de parité stricte donnée à un agent lui interdit de le voir.

**How to apply:** pour chaque règle migrée, rouvrir `Source/`, vérifier la règle réelle et migrer la version corrigée ; un test réécrit assertit le RAW vérifié, jamais le comportement de l'ancien code. Ne JAMAIS briefer un agent en « parité de comportement stricte » sur du code métier RAW — lui demander de vérifier la source et de corriger. Les commentaires qui avouent une interprétation (« mappé de façon monotone », « artefact de conversion ») se re-vérifient d'abord.
