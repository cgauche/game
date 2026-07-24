---
name: env-agents-tools-natifs-denies-leanctx
description: "Un type d'agent qui déclare tools: Read, Grep, Glob se lance avec ZÉRO outil (deny lean-ctx) et échoue ; les agents écrivains perdent Edit/Write ; le registre d'agents est CACHÉ au démarrage de session."
metadata:
  node_type: memory
  type: project
---

**Symptôme (2026-07-24)** : `Agent(subagent_type: 'lecteur')` échoue immédiatement —
« Agent 'lecteur' would be spawned with zero tools — refusing. Its tools list resolved to
nothing: unrecognized [Read, Grep, Glob] ». Idem `verif-mecanique`.

**Cause** : la politique lean-ctx du `~/.claude/CLAUDE.md` (Replace Mode) DENY les outils natifs
`Read`/`Grep`/`Glob`. Un `tools:` de frontmatter qui ne cite QUE ceux-là résout à l'ensemble vide.
`juge` et `codeur` survivaient uniquement grâce à `Bash`/`PowerShell`.

**Conséquence en cascade sur les agents ÉCRIVAINS** : `Edit` échoue (« File is covered by a Read
deny rule ») et `Write` refuse tout fichier existant non lu — un `codeur` sans outils `ctx_*` ne
peut donc éditer que par shell. Deux agents ont contourné par `Set-Content` (⚠ risque EOL, cf.
[[env-eol-mutilees-arbre-local-parseurs-seam]]) et par `cp` depuis le scratchpad.

**Correctif appliqué** : `tools:` des 5 définitions `.claude/agents/*.md` migré vers les noms
`mcp__lean-ctx__ctx_*` (`ctx_read`, `ctx_search`, `ctx_glob`, + `ctx_patch` pour les écrivains,
`ctx_shell` pour ceux qui lancent des commandes, `ctx_tree`/`ctx_compose` pour les lecteurs).
`recetteur` n'a pas de `tools:` (hérite tout) — non concerné.

**⚠ Le registre d'agents est CACHÉ au démarrage de session** : après correction des fichiers, un
dispatch dans la MÊME session échoue encore avec l'ancienne liste. La correction ne prend effet
qu'à la session suivante. Repli immédiat : `Explore` (lecture) ou `general-purpose`.

**Chemin d'édition canonique pour MOI** : `ctx_read(mode="anchored")` → `ctx_patch` ;
un batch `ctx_patch(ops:[…])` sur PLUSIEURS fichiers applique tout au `path` de premier niveau —
faire un appel PAR fichier.
