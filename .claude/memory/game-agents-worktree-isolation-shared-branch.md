---
name: game-agents-worktree-isolation-shared-branch
description: Agents qui mutent des fichiers + autre session en git add -A sur la MÊME branche = entanglement ; isoler en worktree.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c0ee09a3-d089-4078-86dc-9f7a9ef84a94
---

Sur ce repo, une **autre session tourne en parallèle sur la même branche** (`main`, trunk-based)
et commite vite avec `git add -A`. Conséquence vécue (2026-06-27) : un agent codeur lancé dans l'arbre
PARTAGÉ a laissé `combatFlow.ts` modifié non commité ; entre la fin de l'agent et ma vérification,
l'autre session a fait son commit `#76` (`77d6a0bf`) qui a **embarqué mon `scheduleRespawnFromOp`** dans
LEUR commit (code présent mais mal attribué + HEAD momentanément incohérent : `combatFlow` référençait
l'op `scheduleRespawn` dont la def vivait dans mon `ops.ts` encore dirty).

**Why:** `git add -A` de l'autre session ratisse TOUS les fichiers dirty de l'arbre, y compris le WIP de
mon agent. `git commit -- <chemins>` côté MOI ne protège pas : le danger vient de LEUR `add -A`.

**How to apply:**
- Pour tout **agent qui MUTE des fichiers** pendant qu'une autre session est active → lancer l'Agent en
  `isolation: "worktree"` (copie isolée ; leur `add -A` dans l'arbre principal ne voit pas ses fichiers),
  puis rapatrier/committer. À défaut : **committer mes fichiers IMMÉDIATEMENT** au retour de l'agent
  (fenêtre minimale), avant que l'autre session ne re-commite.
- Les **lots de DONNÉE JSON** (creatures/maladies/naval-data…) que l'autre session ne touche pas restent
  à risque faible ; les **fichiers moteur partagés** (combatFlow, ops, store, pendings, GameOpEditor,
  roll-modal-invariant, spells.json) sont chauds — y lancer un agent = isoler ou committer vite.
- Toujours `git --no-pager log/show` pour vérifier ce que HEAD contient AVANT de committer (l'autre
  session a pu déjà committer une partie de mon travail). Cf. [[git-commits-propres-wip-parallele]],
  [[feedback-jamais-git-surgery-arbre-partage-actif]].
