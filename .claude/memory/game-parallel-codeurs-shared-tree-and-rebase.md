---
name: game-parallel-codeurs-shared-tree-and-rebase
description: "Codeurs en // sur l'arbre main partagé git-stashent pour isoler des erreurs tsc (= WIP du sibling) ; recetteur peut se re-déléguer en boucle ; sur longue session origin diverge → fetch+rebase+re-vérifie avant push."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6c70a460-5c19-4d4d-a3c5-23c170a19582
---

Chantier playtest Jinashi (2026-07-07/08, 9 issues #200-208 traitées en vagues de codeurs). Trois pièges d'orchestration VÉCUS :

**1. Codeurs en // sur l'arbre `main` partagé → `git stash` sauvage.** J'ai dispatché des codeurs EN PARALLÈLE sur `main` SANS worktree. DEUX fois (F16, puis C11), voyant des erreurs tsc dans des fichiers qu'ils n'avaient pas touchés (= le WIP du codeur sibling, ex. un `switch` exhaustif temporairement incomplet le temps que l'autre ajoute son `kind`), l'agent a fait `git stash`/`git stash pop` pour « isoler les erreurs préexistantes » — geste git INTERDIT par le brief, qui a laissé un stash orphelin (F16, à `git stash drop` ensuite) et aurait pu conflit-er avec le sibling actif. Aucun dégât final, mais fragile.

**2. Recetteur qui se re-délègue en boucle.** Un `recetteur` dispatché a spawné un `recetteur` qui a spawné un `recetteur` (le plus profond a réussi la recette, celui au-dessus a voulu re-vérifier → chaîne). L'user a coupé et **corrigé l'agent** : `disallowedTools: Agent/Workflow` sur le type recetteur (commit `6dad88c5`, gotcha tracé au skill orchestrer-des-agents).

**3. Longue session → `origin/main` diverge.** Pendant le chantier, 20 commits de travail parallèle (PR #209 + #161-195 : trauma/critiques, gameIso, naval) ont atterri sur `origin/main`. Mes 7 premiers commits étaient déjà poussés (un autre push les avait embarqués) mais mes 2 derniers (#202/#203) étaient sur l'ancien tip → divergence, pas fast-forward.

**Why & How to apply :**
- Codeurs en // qui MUTENT → `isolation:'worktree'` (doctrine [[game-agents-worktree-isolation-shared-branch]]), OU séquentiel pour l'engine/le complexe. Le réflexe de l'agent pour « est-ce moi ? » est `git stash` = chirurgie git sur arbre partagé actif ([[feedback-jamais-git-surgery-arbre-partage-actif]]).
- Dans TOUT brief de codeur : « des erreurs tsc HORS de tes fichiers = le WIP d'un agent parallèle — signale-les, ne fais JAMAIS `git stash` pour isoler ».
- `git fetch` AVANT le commit/push final d'une longue session ; si divergence, `git branch backup/...` (filet) puis `git rebase origin/main`, RE-VÉRIFIE typecheck + suite COMPLÈTE (la base a changé — un rebase « sans conflit » ne prouve PAS la compatibilité sémantique ; ici c'était vert, ma `trauma.ts` refactorée tenait contre le trauma retravaillé). Conflits souvent triviaux (chemin d'import déplacé `../iso`→`../../geometry/iso` de #161). L'intégration triviale (merge d'imports) = mon périmètre manuel autorisé, pas un agent.
