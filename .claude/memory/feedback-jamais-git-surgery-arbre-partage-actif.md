---
name: feedback-jamais-git-surgery-arbre-partage-actif
description: "JAMAIS de stash/cherry-pick/pop/checkout sur l'arbre principal quand une session // y travaille — ça écrase son WIP, même avec un stash « de sauvegarde »."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8ba2f4e3-7607-427c-936e-94647153705c
---

NE JAMAIS faire de chirurgie git (`stash push/pop`, `cherry-pick`, `merge`, `checkout -- <f>`, `reset`) sur l'**arbre principal partagé** tant qu'une **session parallèle y travaille activement** — même en croyant « préserver le WIP » via un stash. Le stash/pop fait un merge 3-way ; si les deux sessions touchent le MÊME code (ici : tous les deux sur #80, re-tirage de localisation du Critique LDB 18 l.53/55), le pop résout vers MA version et **efface silencieusement** le WIP de l'autre (working tree == HEAD, marqueurs absents), puis son `git add -A; commit` ne voit plus rien. Le stash droppé reste récupérable (`git cat-file -t <sha>`, `git stash apply <sha>`) mais c'est déjà un incident.

**Incident concret (2026-06-28)** : pour appliquer mon commit Déviation `765df529`, j'ai fait `stash → cherry-pick → pop → checkout -- → re-pop` sur `feat/wfrp4-rpg-foundation` pendant que la session IA codait #80 (`locOverride` magic.ts, `applyOpposedCritical` combatFlow.ts). Son WIP combatFlow+magic a été écrasé ; récupéré dans le stash droppé `52eb4030`. Cf. [[game-agents-stray-main-tree-destructive-git]], [[feedback-no-commit-surgery-shared-tree]], [[game-agents-worktree-isolation-shared-branch]].

**Why:** l'arbre partagé est la prod live de l'autre session ; tout merge/stash y est destructif dès qu'il y a chevauchement de code.

**How to apply:**
1. Mon travail vit dans MON worktree/branche. Pour le porter sur la branche partagée : ne JAMAIS le faire moi-même par git pendant que l'autre session est active. Soit (a) l'autre session merge/rebase ma branche quand ELLE est au point mort, soit (b) je le fais SEULEMENT avec feu vert explicite ET la session // mise en pause ET confirmée propre.
2. Si deux sessions touchent le même domaine (ex. #80), COORDONNER d'abord (qui possède quoi) — pas de cherry-pick « par-dessus » à l'aveugle.
3. Récupération d'un WIP écrasé : le stash droppé survit jusqu'au GC → `git stash apply <sha-droppé>` (apply, pas pop, garde le filet), puis réconcilier à la main.
