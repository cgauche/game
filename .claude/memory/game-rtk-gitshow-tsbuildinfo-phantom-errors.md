---
name: game-rtk-gitshow-tsbuildinfo-phantom-errors
description: "Forensique git/types faussée par 2 couches d'outillage — git show via RTK + tsbuildinfo périmé fabriquent une fausse catastrophe."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 638edf37-5125-453f-9364-6fd1d1e5d63e
---

Dans ce dépôt, DEUX couches d'outillage peuvent fabriquer une « catastrophe » inexistante — ne pas paniquer, vérifier via les canaux fiables.

1. **`git show HEAD:fichier | grep` passe par RTK** (hook Bash de compression) → sortie **partielle/compressée** : `grep -c "Motif"` a renvoyé **0** alors que le motif existait (l.84/316), et `wc -l` a compté **11** lignes pour un fichier de centaines. Diagnostic faux « mon travail a été effacé ». **Vérité = le Grep TOOL** (ripgrep direct, hors RTK) sur le fichier de travail, ou `git show … | rtk proxy` / `raw=true`.

2. **`tsconfig.tsbuildinfo` (incrémental) périme** après un commit d'une **session concurrente** qui change un fichier sous le cache → `npm run typecheck` (= `tsc --noEmit` incrémental) rapporte des **erreurs FANTÔMES** (ex. « `massBattle` n'existe pas sur les props de HeroCard » alors que la prop EST déclarée). Elles **disparaissent** sous `npx tsc --noEmit --incremental false` (exit 0) ou après `rm tsconfig.tsbuildinfo`.

**Réflexe** : arbre partagé + « erreurs/pertes » surprenantes → confirmer l'état RÉEL de HEAD par (a) le Grep tool sur le contenu, (b) `merge-base --is-ascendant` + reflog `--all` pour l'atteignabilité des commits, (c) `tsc --incremental false` pour les types, (d) `vitest run` (les erreurs de type tsc ne bloquent PAS vitest — esbuild). En une session, ces 2 couches ont simulé « le factory RollFlowLens effacé + 2 erreurs de types » — TOUT était faux (base verte). Cf. [[env-use-powershell-not-bash]], [[game-worktree-node-modules-junction-hazard]], [[game-agents-stray-main-tree-destructive-git]].
