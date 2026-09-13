---
name: game-ctx-search-skips-large-files-use-grep
description: "ctx_search saute silencieusement les fichiers >512 Ko — un « 0 match » y est FAUX ; preuve d'absence = grep natif ou node"
metadata:
  type: reference
---

**Why:** `ctx_search` écrit « (N files >512KB skipped) » en marge mais rend « 0 match » dans son résultat — un faux zéro devient un brief faux (doublons créés, section d'Atlas « manquante » qui existait deux fois).

**How to apply:** au-dessus du seuil (`src/data/creatures.json` = 1 339 155 o ; fiches `docs/raw/` et `Source/` souvent au-dessus — vérifier par `(Get-Item <chemin>).Length`), toute preuve d'existence ou d'absence se fait en `grep -n` natif ou `node -e` (JSON.parse + filter). Un brief qui envoie un agent sonder `src/data/`, `docs/raw/` ou `Source/` porte l'avertissement et impose l'outil ; une absence rapportée par un agent n'entre dans un brief aval qu'avec l'outil de sonde nommé.
