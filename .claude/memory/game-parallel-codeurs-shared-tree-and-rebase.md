---
name: game-parallel-codeurs-shared-tree-and-rebase
description: "Codeurs en // sur l'arbre main partagé git-stashent pour isoler des erreurs tsc (= WIP du sibling) ; recetteur peut se re-déléguer en boucle ; sur longue session origin diverge → fetch+rebase+re-vérifie avant push ; gros chantier pendant qu'une session // travaille = worktree dédié + publication par push origin branche:main (jamais bouger main local sous une session active)."
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
- **Gros chantier PENDANT qu'une autre session travaille l'arbre principal** (vécu #487, 2026-07-16) : tout le chantier (agents + régénérations + gates + commits) dans un **worktree dédié** (`git worktree add ../Game-wtXXX -b chantier-XXX`, `npm install` frais — jamais de junction node_modules), rebases intermédiaires sur main au fil de leurs commits (mes fiches régénérées se REGÉNÈRENT après chaque rebase, jamais résolues à la main ; dérivés/`_registry.generated` : prendre n'importe quel côté puis régénérer). Publication : **`git push origin chantier-XXX:main`** (ff) — JAMAIS `update-ref`/merge du main local pendant que l'autre session y a du WIP : leur `pull --rebase` synchronisera. Nettoyage : `git worktree remove` + `branch -D` après push.
- **Un RECETTEUR est un étage séquentiel même face à un CODEUR** (vécu #514, 2026-07-16) : j'ai parallélisé recette navigateur et correctifs codeur dans le MÊME worktree pour gagner du temps → HMR du serveur dev en pleine recette, exceptions transitoires de contrat de donnée (JSON en cours d'édition), ~15 appels de rejeu, une inspection incomplète. Le worktree d'une recette est GELÉ : aucun agent n'y écrit tant qu'elle tourne. Aussi : le profil Chrome MCP partagé peut être verrouillé par une autre session → le recetteur pilote via script `playwright-core` à profil temporaire dédié (patron scratchpad), on ne tue JAMAIS un Chrome existant.
