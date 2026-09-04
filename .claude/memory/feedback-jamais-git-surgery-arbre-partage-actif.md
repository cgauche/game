---
name: feedback-jamais-git-surgery-arbre-partage-actif
description: "JAMAIS de stash/cherry-pick/pop/checkout sur l'arbre principal quand une session // y travaille — ça écrase son WIP, même avec un stash « de sauvegarde ». Y compris checkout d'un fichier GÉNÉRÉ : on restaure par le GÉNÉRATEUR, jamais par git."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8ba2f4e3-7607-427c-936e-94647153705c
  modified: 2026-08-09T17:17:58.263Z
---

NE JAMAIS faire de chirurgie git (`stash push/pop`, `cherry-pick`, `merge`, `checkout -- <f>`, `reset`) sur l'**arbre principal partagé** tant qu'une **session parallèle y travaille activement** — même en croyant « préserver le WIP » via un stash. Le stash/pop fait un merge 3-way ; si les deux sessions touchent le MÊME code (ici : tous les deux sur #80, re-tirage de localisation du Critique LDB 18 l.53/55), le pop résout vers MA version et **efface silencieusement** le WIP de l'autre (working tree == HEAD, marqueurs absents), puis son `git add -A; commit` ne voit plus rien. Le stash droppé reste récupérable (`git cat-file -t <sha>`, `git stash apply <sha>`) mais c'est déjà un incident.

**Incident concret (2026-06-28)** : pour appliquer mon commit Déviation `765df529`, j'ai fait `stash → cherry-pick → pop → checkout -- → re-pop` sur `feat/wfrp4-rpg-foundation` pendant que la session IA codait #80 (`locOverride` magic.ts, `applyOpposedCritical` combatFlow.ts). Son WIP combatFlow+magic a été écrasé ; récupéré dans le stash droppé `52eb4030`. Cf. [[game-agents-stray-main-tree-destructive-git]], [[git-commits-propres-wip-parallele]], [[game-agents-worktree-isolation-shared-branch]].

**Précédent durci (2026-08-04, session d'art)** : pour remettre l'arbre propre après l'arrêt d'un artiste en vol (stray = `Boeuf.ts` neuf + `creatures/_registry.generated.ts` régénéré), l'orchestrateur a tenté `git checkout -- src/gameIso/rig/creatures/_registry.generated.ts`. Rejet utilisateur : « Commande interdite ». La règle n'a AUCUNE exception « fichier généré » ni « stray de MON propre agent » : un fichier généré se restaure par son GÉNÉRATEUR (supprimer la def ajoutée puis `npm run gen`), jamais par git. La lettre de la règle EST son esprit — un `checkout` « sûr » n'existe pas sur un arbre partagé actif.

**Précédent re-durci (2026-08-09)** : `git restore -- docs/consommateurs-de-champs.md` tenté pour défaire MA PROPRE régénération accidentelle (vieille de dix secondes) d'un doc généré — rejet utilisateur. La règle couvre AUSSI `git restore`, sans exception « ma propre écriture toute fraîche » : un doc généré sali reste tel quel (inoffensif non commité) ou se remet par son GÉNÉRATEUR, jamais par git.

**Desserrage en worktree — ce qui l'autorise.** L'utilisateur POSE UNE QUESTION, il ne tranche pas (2026-09-03, verbatim) : « Pour les git destructif, on devrait pouvoir les faire sur les worktree, tu ne pense pas ? ». Une question ne fait pas autorité ; l'autorité du desserrage est la MESURE, en dépôt jetable : git REFUSE lui-même d'extraire ailleurs une branche qu'un worktree tient (`fatal: 'chantier' is already used by worktree`), un `reset --hard` en worktree laisse intact le WIP de l'arbre principal (index privé), et `git clean -fdx` retire le point de reparse d'une jonction `node_modules` sans suivre la jonction. Les trois sont verrouillées par les tests « FONDEMENT » de `scripts/hooks/git-destructive-guard.test.mjs` : le jour où git change, c'est là que ça rougit.

**PORTÉ PAR** `scripts/hooks/git-destructive-guard.mjs` : `ask` dans l'arbre principal et dans tout répertoire NON PROUVÉ ; SILENCE pour `checkout`/`restore`/`reset`/`clean` dans un worktree LIÉ dont la commande porte `git -C <chemin>`/`cd <chemin>` (ou dont le canal transmet `tool_input.cwd`) ; `stash` = `ask` PARTOUT, sa pile étant partagée par tous les worktrees ; toute jonction sur `node_modules` = `deny`. La règle de cette fiche vise l'arbre PARTAGÉ : un worktree lié a son index et son arbre de travail à lui, et un `reset --hard` n'y atteint le WIP de personne d'autre (mesuré en dépôt jetable le 2026-09-03).

**Why:** l'arbre partagé est la prod live de l'autre session ; tout merge/stash y est destructif dès qu'il y a chevauchement de code.

**How to apply:**
1. Mon travail vit dans MON worktree/branche. Pour le porter sur la branche partagée : ne JAMAIS le faire moi-même par git pendant que l'autre session est active. Soit (a) l'autre session merge/rebase ma branche quand ELLE est au point mort, soit (b) je le fais SEULEMENT avec feu vert explicite ET la session // mise en pause ET confirmée propre.
2. Si deux sessions touchent le même domaine (ex. #80), COORDONNER d'abord (qui possède quoi) — pas de cherry-pick « par-dessus » à l'aveugle.
3. Récupération d'un WIP écrasé : le stash droppé survit jusqu'au GC → `git stash apply <sha-droppé>` (apply, pas pop, garde le filet), puis réconcilier à la main.
4. Défaire un stray d'agent : par OPÉRATIONS DE FICHIERS (supprimer/recréer) et par les GÉNÉRATEURS (`npm run gen`), jamais par une commande git — et au moindre doute, demander à l'utilisateur AVANT de toucher.
