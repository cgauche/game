---
name: env-capture-qc-arbre-au-repos-vite-reload
description: "Les captures navigateur (spike-webgl.mjs, recette) ne sont fiables que sur arbre src/ AU REPOS : toute écriture concurrente d'une autre session déclenche un full-reload Vite qui efface __wfrp/__spike en plein run — TypeError « reading 'set' » trompeur."
metadata: 
  node_type: memory
  type: project
  originSessionId: 5d129c4b-c665-4e81-9389-8f4edf55ae2a
  modified: 2026-08-09T18:35:00.619Z
---

Vécu 2026-08-09 (chantier WebGL #1176) : `node scripts/qc/spike-webgl.mjs` mourait sur `TypeError: Cannot read properties of undefined (reading 'set')` — diagnostic falsifié par un codeur : la page était RECHARGÉE sous le script (post-mortem CDP : `executionContextsCleared` ×2, `performance.now()=64 ms`, `__spike`/`__wfrp` undefined). Cause : les écritures d'une AUTRE session dans `src/` → Vite full-reload (module sans frontière Fast Refresh). Corrélation à la demi-seconde (PNG 20:17:22 vs `encounterPsychFlow.ts` 20:17:22.43) ; contre-épreuve A/B (textures neutralisées → crash quand même) ; 3 tours complets en fenêtre calme = 225 captures, 0 incident.

**Why :** en multi-sessions sur le même arbre, le serveur dev est un canal de couplage invisible — un run de capture est une section critique.

**How to apply :**
- Lancer les captures QC navigateur dans une FENÊTRE CALME de l'arbre `src/` (pas de codeur d'une autre lane en écriture) ; si un run meurt sur un `TypeError` d'API `__wfrp`/`__spike` absente, suspecter le reload AVANT le code.
- Diagnostic type : `Runtime.executionContextsCleared`/`Page.frameNavigated` au post-mortem CDP + `performance.now()` minuscule = contexte neuf.
- Résilience du script à faire (#1187) : détecter la navigation et RE-JOUER la capture au lieu de mourir.
- Corollaire : l'écriture des PNG dans `public/qc/` ne déclenche AUCUN reload (sondé) — le coupable est toujours `src/`.
