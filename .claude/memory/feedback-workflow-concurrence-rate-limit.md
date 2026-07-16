---
name: feedback-workflow-concurrence-rate-limit
description: Ne pas lancer plusieurs workflows lourds en parallèle (rate-limit serveur) ; auto-throttler par lots séquentiels dans le script.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 00336363-0f77-4c1d-8153-f37d57b697b2
---

Lancer **3+ workflows lourds en parallèle** (chacun ~30-40 agents Opus chatty) déclenche un **rate-limit côté serveur Anthropic** (« Server is temporarily limiting requests — **not your usage limit** ») qui tue des agents en masse après épuisement des retries → des dimensions entières de finder reviennent vides.

**Why:** Le cap de concurrence est PAR workflow (min(16, cores−2)). N workflows simultanés = N× ce cap de requêtes concurrentes → la rafale de départ sature le serveur. Observé 2026-06-27 : 3 workflows d'audit en // → 8/12, 18/37, 6/7 finders tombés.

**How to apply:** (1) Lancer les workflows **séquentiellement** (un à la fois, reviewer entre). (2) Si un seul gros workflow, **auto-throttler DANS le script** : traiter les items par **lots séquentiels** (`for (chunk of slices(items, 5)) await pipeline(chunk, ...)`) → garantit ≤~10 agents simultanés quelle que soit la limite machine. Une passe de récupération chunkée a réussi 28/29 là où le // échouait. (3) Les agents échoués reviennent `null`/vides ; relancer via un workflow ciblé sur les seuls items tombés (le resume peut re-servir le null caché). Lié à [[feedback-workflows-calibres-taille]].
