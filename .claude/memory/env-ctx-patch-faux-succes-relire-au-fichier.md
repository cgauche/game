---
name: env-ctx-patch-faux-succes-relire-au-fichier
description: ctx_patch replace_unique peut rendre SUCCÈS sans rien écrire (old_text inexistant) ; ctx_read tronque ~2/3 des lignes par triage — toute édition/lecture critique se vérifie par Get-Content
metadata: 
  node_type: memory
  type: project
  originSessionId: b271b656-ac04-461c-ac84-421882871a94
  modified: 2026-08-20T08:10:52.585Z
---

Vécu 2026-08-20 (lot 1a #1401, agent codeur) : `ctx_patch op=replace_unique` a rendu un **succès** sur un `old_text` INEXISTANT (`import * as THREE from 'three';` alors que le fichier porte `import type * as THREE`) — fichier non modifié, aucune erreur signalée. Détecté uniquement parce qu'une mutation de test attendue ROUGE restait verte. Même session : `ctx_read` (tous modes, y compris `raw`/`fresh`/`aggressiveness:0`) supprimait ~2/3 des lignes (« filtered by triage (level 2) ») sur ce dépôt.

**Why:** un patch « réussi » non appliqué transforme une preuve par mutation en faux vert silencieux ; une lecture tronquée fait raisonner sur un fichier fantôme.

**How to apply:** toute édition par `ctx_patch` dont dépend une PREUVE (mutation rouge/verte, retrait de mutation, gate) se RELIT au fichier par `Get-Content` (PowerShell) après coup ; lecture verbatim critique = `Get-Content`, jamais `ctx_read`. Consigne à recopier dans les briefs d'agents codeurs. Voir aussi [[env-lecture-png-agents-et-dedup-leanctx-menteur]] et [[env-blocked-leanctx-execute-quand-meme]].

## Extension 2026-08-28 (ENTITE-c #1467) — le TRIAGE ampute AUSSI les relevés de mesure
`ctx_shell`, `ctx_read(mode=raw|full, aggressiveness=0, fresh)` ET le pont Bash/cat interceptés rendent des relevés AMPUTÉS EN SILENCE (« N lines filtered by triage (level 2) » — jusqu'à 23/25 lignes supprimées, dont la ligne cherchée). Un rendu partiel y est INDISCERNABLE d'un rendu complet = faux-vert de mesure. **Seul canal fiable : script `.mjs` DANS le dépôt, exécuté par le tool Bash natif, imprimant sur stdout.** `node -e`, `Remove-Item`, pipelines contenant `(git …)` : bloqués en dur. À inscrire au brief de TOUT codeur qui mesure (le codeur ENTITE-c a perdu ~8 appels).
