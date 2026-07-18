---
name: env-session-background-pieges-outils
description: "lean-ctx écrase settings.json à CHAQUE début de session (Read deny, redirects) — exécuter ~/.claude/fix-leanctx-settings.mjs ; + pièges Set-Location silencieux et worktree remove partiel"
metadata: 
  node_type: memory
  type: project
  originSessionId: fe239011-bf46-4e5d-b120-539f4c477f25
---

Vécu 2026-07-16 (session background, lot fiche #492/#414) :

1. **lean-ctx réapplique son « Replace Mode » dans `~/.claude/settings.json` à CHAQUE début de
   session** (deny natif `Read` + redirect Read→ctx_read + hooks sans timeout) — ce qui casse
   l'outil Edit, la lecture d'IMAGES (aveugle sur les jalons de goût !) et fait résoudre les types
   d'agents `lecteur`/`verif-mecanique` (outils Read/Grep/Glob seuls) à zéro outil → spawn refusé.
   **Le correcteur consenti existe : exécuter `node ~/.claude/fix-leanctx-settings.mjs`**
   (consentement user explicite 2026-07-15 ; idempotent ; l'effet est IMMÉDIAT, même en cours de
   session — vérifié). Si Read/Edit/lecture d'image échouent ou qu'un agent « resolve to zero
   tools » : lancer ce script AVANT tout contournement. Grep/Glob restent deny par politique
   (ctx_search/ctx_glob) — replis d'agents : `Explore`, `codeur`, `juge` (Bash/PowerShell).
   Tant que Read est cassé, ne JAMAIS présenter un jalon de goût sur la foi d'un juge vision seul :
   gater par comparaison de VALEURS (styles calculés vs planche, garde `atelier-conformance`).

2. **`Set-Location` vers un chemin mort échoue en NON-terminant** : les commandes git suivantes
   frappent l'arbre COURANT (vécu : cherry-pick parti dans l'arbre principal partagé — rattrapé
   par `git cherry-pick --quit`, qui sort du séquenceur SANS toucher le working tree ; jamais
   `--abort` qui reset). Règle : après tout `Set-Location`/`cd` en contexte git partagé,
   VÉRIFIER le cwd (`git rev-parse --show-toplevel`) avant la moindre commande d'état.

3. **`git worktree remove` peut échouer à moitié** (Permission denied sur node_modules) en
   DÉSENREGISTRANT quand même le worktree → le chemin devient un dossier mort. Vérifier
   `git worktree list` après remove, et ne jamais chaîner d'autres commandes derrière un remove
   non vérifié. Lié : [[game-worktree-node-modules-junction-hazard]] (jamais junctionner —
   `npm ci` dans le worktree, ~20 s).
