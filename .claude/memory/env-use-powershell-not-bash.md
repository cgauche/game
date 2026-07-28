---
name: env-use-powershell-not-bash
description: "Sur cette machine, l'outil Bash est lent (pont WSL + hook RTK) ; utiliser PowerShell pour git/tests/fichiers"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 024cd482-0bab-4295-9fab-7d5591050488
  modified: 2026-07-28T17:47:18.578Z
---

Sur la machine de l'utilisateur (Windows), **l'outil Bash est très lent** : c'est un bash Unix (WSL/git-bash, on voit `/usr/bin/bash`, `/usr/bin/ls`, chemins Windows mmanglés `C:Usersgauch…`) qui accède au disque Windows via une couche de traduction LENTE, **+** le hook RTK qui réécrit/tee chaque commande. Même un `git ls-files` met « une plombe ». Les `run_in_background: true` finissent par ne plus répondre (l'utilisateur a dû tuer les tâches).

**Preuve mesurée** : le MÊME `git ls-files` met ~0,05 s via l'outil **PowerShell** (Windows natif) vs des dizaines de secondes / hang via Bash.

**How to apply:** sur ce projet (`Foundry/Game`), utiliser l'outil **PowerShell** pour TOUT (git, `npx vitest run`, `tsc`, fichiers) — PAS l'outil Bash, et éviter `run_in_background` pour les runners. Ça contourne le pont bash ET le hook RTK. (La règle globale « runners via native Bash pour RTK » du CLAUDE.md perso ne tient pas ici : Bash y est le goulot.)

**RÉCIDIVE 2026-06-16 :** j'ai utilisé Bash TOUTE une longue session (grep/cat/find/git/vitest) — l'utilisateur a dû me reprendre (« Je suis certain qu'une de tes instructions t'interdit d'utiliser Bash »). Renforcement : **réflexe par défaut = JAMAIS Bash ici.** Pour chercher → outil **Grep** ; lister/trouver → **Glob** ; lire → **Read** ; shell/git/tests → **PowerShell**. Ne JAMAIS taper `grep`/`cat`/`head`/`find`/`node -e` dans Bash sur cette machine (lent + hang en background). Si je m'apprête à appeler l'outil Bash, m'arrêter et choisir l'outil dédié.

**Why:** la lenteur n'est pas Vite/codegen — c'est la couche d'exécution Bash. Confirmé par chrono 0,05 s vs hang.

**RÉCIDIVE 2026-07-11 (par l'orchestrateur lui-même)** : toute une session à router les runners des AGENTS via Bash (« RTK compresse ») — l'utilisateur excédé a dû REDÉMARRER Claude Code. Deux leçons structurelles : (1) les définitions d'agents (`.claude/agents/*.md`) portent désormais l'outil `PowerShell` + la consigne « PowerShell pour TOUT sur cette machine » (commits d9070fa2 + suivant) ; (2) **les défs d'agents se chargent au démarrage de SESSION** — après toute modification de leurs `tools:`, un redémarrage est nécessaire pour qu'elle porte sur les nouveaux agents. La règle globale « runners via Bash pour RTK » du CLAUDE.md perso est INVERSE de la vérité sur cette machine.

**RÉCIDIVE 2026-07-19 (encore l'orchestrateur) — et Bash ne se contente pas d'être lent, il CORROMPT SILENCIEUSEMENT** : `gh issue comment 559 --body "… \`TenueSet\` … \`resolve.ts:201\` …"` en Bash → les backticks sont pris pour de la **substitution de commande**. Le shell a exécuté `main`, `pied`, `TenueSet` (« command not found ») et posté le commentaire **amputé de tous les noms de symboles** — un texte de ticket qui ment, publié, sans aucune erreur remontée (`gh` a rendu l'URL, exit 0). C'est le pire mode d'échec : fail-OPEN et invisible. **Tout texte destiné à GitHub passe par `--body-file`** (jamais `--body "…"`), et le fichier s'écrit avec l'outil **Write** dans le scratchpad. ⚠ `gh api -F body=@fichier` est BLOQUÉ par une garde maison (contrôle de solde) — pour corriger un commentaire déjà posté : `gh issue comment <N> --edit-last --body-file <chemin>`.

**RÉCIDIVE 2026-07-28 (4ᵉ, encore l'orchestrateur)** : session entière à l'outil Bash (`node -e`, `grep`, `sed`, `head`, `gh`). Cette fois SANS que l'utilisateur ait à me reprendre et sans hang — les commandes ont abouti, donc rien ne m'a signalé que j'enfreignais une instruction enregistrée quatre fois. C'est précisément ce qui rend la récidive facile. Le volet `--body-file` de 2026-07-19 a bien été respecté (aucun commentaire GitHub amputé). Deux pièges NEUFS mesurés ce jour-là :
- **les variables de boucle ne s'expansent pas** — `for id in a b; do grep "$id" …; done` a cherché la chaîne VIDE à chaque itération et rendu des résultats faux, sans erreur ; deux fois dans la même session ;
- **l'échappement `jq` casse** en passant `--jq '"#\(.number)"'` via `execSync` (« unexpected token »).
Contournement quand Bash est malgré tout employé : mettre la logique ENTIÈRE dans un `node -e` en JavaScript (zéro variable shell, zéro `for`, zéro pipe), et écrire les corps de messages dans des FICHIERS. Mais le réflexe juste reste **PowerShell / Grep / Glob / Read**.

Optimisation secondaire connue (non appliquée mi-session multi-agents) : le plugin Vite `registryGen()` lance `genAll()` dans `buildStart()` → re-génère les 29 registres de `REGISTRIES` (`scripts/gen-registry.mjs`) à CHAQUE `vitest run` (et cause la corruption du codegen sur runs concurrents). Les `_registry.generated.ts` sont COMMITÉS → on peut g, sous `process.env.VITEST`, skipper `genAll()` pour accélérer + supprimer la corruption. Prolonge [[game-creature-registry]].
