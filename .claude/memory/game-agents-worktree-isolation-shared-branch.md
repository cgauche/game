---
name: game-agents-worktree-isolation-shared-branch
description: Agents qui mutent des fichiers + autre session en git add -A sur la MÊME branche = entanglement ; isoler en worktree.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c0ee09a3-d089-4078-86dc-9f7a9ef84a94
  modified: 2026-08-24T18:59:53.247Z
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

**Deuxième visage du même mal (2026-08-24, flag user : « Tu tiens en hotage une autre session, et tu
dépends encore d'une autre, c'est vicieux »)** : une VAGUE multi-lots tenue non committée des heures
dans l'arbre principal fait de ma session le BLOQUEUR de tous les `git merge --ff-only` des voisines
(le checkout refuse dès qu'un fichier localement modifié est touché par le ff) — j'ai fini par
distribuer des « autorisations de passage » (mise de côté d'index.ts, 5 docs générés au HEAD) tout en
dépendant transitivement d'une 3e session. Remèdes, par ordre :
1. Vague longue + sessions parallèles actives → la vague entière en WORKTREE (pas seulement l'agent).
2. À défaut : ne JAMAIS répondre « attends mon timing » à un ff — DÉCOUPLER : j'avance vers mon commit
   sans attendre, eux ff dès que possible, l'ordre est indifférent (un commit divergent se re-merge
   trivialement ; un doc GÉNÉRÉ se remet au HEAD sans perte, `docs:build` le recale).
3. Le seul recouvrement légitime à négocier est un fichier PARTAGÉ réellement co-modifié — un
   doc-comment ou un dérivé ne se négocie pas, il se libère.

**Deux pièges de worktree vécus le même soir (2026-08-24, vague #1501)** :
- La PILE DE STASH est PARTAGÉE entre tous les worktrees du dépôt : un `git stash` sur arbre PROPRE
  n'empile rien, et le `git stash pop` qui suit ressort le stash d'UNE AUTRE SESSION (vécu : un
  stash de juillet appliqué en conflit UU sur 53 fichiers). Un contrôle « HEAD pur » se fait par
  `git switch --detach <commit>` puis retour de branche — JAMAIS stash/pop en worktree.
- Un worktree (même avec `npm ci` propre) peut produire un ROUGE DE MASSE environnemental absent de
  l'arbre principal aux mêmes commits (vécu : 127 fichiers / 303 « reading 'setState' » — ordre
  d'init des modules dépendant du répertoire ; #1512). Les gates de vague en worktree se font en
  DIFFÉRENTIEL (HEAD-pur vs lot, même environnement, checkout détaché) ; la suite COMPLÈTE et la
  recette se rejouent sur l'ARBRE PRINCIPAL après le ff, AVANT la fermeture du ticket.
