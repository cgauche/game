---
name: game-ctx-search-skips-large-files-use-grep
description: "ctx_search (lean-ctx) saute SILENCIEUSEMENT les fichiers >512 Ko (creatures.json, 1,32 Mo) — un « 0 match » y est FAUX ; au-dessus du seuil, seul grep / parse node fait foi."
metadata:
  type: reference
---

`ctx_search` (regex/semantic) écrit « (N files >512KB skipped) » en marge MAIS retourne « 0 match »
dans le résultat principal — il ne recherche PAS dans les fichiers >512 Ko. `src/data/creatures.json`
(1,32 Mo / ~65 k lignes) en fait partie ; le seuil se vérifie fichier par fichier avant de conclure
(`(Get-Item <chemin>).Length`) — `src/data/trappings.json` (~366 Ko / ~14 k lignes) passe SOUS la barre
et est bien lu. Un `ctx_search` « 0 match » sur un fichier au-dessus du seuil ne prouve RIEN.

Incident 2026-07-20 (SOCLE POSSESSIONS #611) : conclu à tort « aucune créature `destrier`/`palefroi` »
→ brief de codeur faux → DOUBLONS créés, alors que le `destrier-cheval-de-guerre-lourd` officiel
(AA:29) ET un `destrier`/`palefroi` frenchy-bzh gonflés existaient. Les agents `lecteur` Read-only
(sans grep) ratent aussi une aiguille dans 63 k lignes (sondage par offsets ≠ exhaustif).

**Règle : sur `creatures.json` (et tout `.json` de données au-dessus du seuil), preuve
d'existence/d'absence = `grep -n` (Bash natif) ou `node -e` (JSON.parse + filter), JAMAIS
`ctx_search`.** Le Bash natif lit les gros fichiers ; le codeur qui a grepé a trouvé ce que
`ctx_search` avait caché. Voir [[game-socle-possessions-programme]] et
[[feedback-verifier-les-claims-architecturaux-des-agents]] (contre-grep les claims — y compris les
« 0 match » de mes propres outils).
