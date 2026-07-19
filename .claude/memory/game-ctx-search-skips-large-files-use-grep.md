---
name: game-ctx-search-skips-large-files-use-grep
description: "ctx_search (lean-ctx) saute SILENCIEUSEMENT les fichiers >512 Ko (creatures.json, trappings.json) — un « 0 match » y est FAUX ; sur ces fichiers, seul grep (Bash) / parse node fait foi."
metadata:
  type: reference
---

`ctx_search` (regex/semantic) écrit « (N files >512KB skipped) » en marge MAIS retourne « 0 match »
dans le résultat principal — il ne recherche PAS dans les fichiers >512 Ko. `src/data/creatures.json`
(~63 k lignes) et `src/data/trappings.json` en font partie. Un `ctx_search` « 0 match » sur ces
fichiers ne prouve RIEN.

Incident 2026-07-20 (SOCLE POSSESSIONS #611) : conclu à tort « aucune créature `destrier`/`palefroi` »
→ brief de codeur faux → DOUBLONS créés, alors que le `destrier-cheval-de-guerre-lourd` officiel
(AA:29) ET un `destrier`/`palefroi` frenchy-bzh gonflés existaient. Les agents `lecteur` Read-only
(sans grep) ratent aussi une aiguille dans 63 k lignes (sondage par offsets ≠ exhaustif).

**Règle : sur creatures.json / trappings.json (et tout `.json` de données volumineux), preuve
d'existence/d'absence = `grep -n` (Bash natif) ou `node -e` (JSON.parse + filter), JAMAIS
`ctx_search`.** Le Bash natif lit les gros fichiers ; le codeur qui a grepé a trouvé ce que
`ctx_search` avait caché. Voir [[game-socle-possessions-programme]] et
[[feedback-verifier-les-claims-architecturaux-des-agents]] (contre-grep les claims — y compris les
« 0 match » de mes propres outils).
