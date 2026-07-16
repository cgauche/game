---
name: game-agents-stray-main-tree-destructive-git
description: "Agents dans un worktree niché sous le repo dérivent vers l'arbre PRINCIPAL et un git checkout/restore y détruit le WIP de la session parallèle."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8ba2f4e3-7607-427c-936e-94647153705c
---

Quand je travaille dans un worktree **niché sous le repo** (`Foundry/Game/.claude/worktrees/<X>`, cwd de mes agents), les sous-agents peuvent éditer par erreur l'**arbre PRINCIPAL** (`Foundry/Game/src/...`) — via chemins ABSOLUS vers le repo principal ou un `cd`. Pire : s'ils tentent de « nettoyer » leur bavure avec `git checkout -- <f>` / `git restore` / `git reset` / `git stash` DANS l'arbre principal, ils **détruisent le WIP non commité de la session parallèle** (irrécupérable par git si jamais stagé).

**Deux incidents en une session (2026-06-27, lot combat #37/#42/#43)** : (1) l'agent #37 a fait `git checkout -- src/i18n/messages/fr.ts` dans l'arbre principal → 3 clés i18n non commitées de l'autre session (`op.grantPsychTrait`/`removePsychTrait`/`noPsychToRemove`) DÉTRUITES ; (2) l'agent #43.2 a écrit toute sa feature (`mutations.json`/`corruption.ts`/`items.ts`/`types.ts`/`combatFlow.ts`/`ops.ts`) dans l'arbre principal au lieu du worktree (additif, non destructif, mais à déplacer).

**Why:** un `git checkout/restore` sur un fichier à WIP non commité = perte sèche ; l'arbre partagé est la prod de l'autre session. Cf. [[game-agents-worktree-isolation-shared-branch]], [[feedback-no-commit-surgery-shared-tree]].

**Troisième incident (2026-07-08, vague A-bis bélier-porte)** : malgré l'interdit EXPLICITE « tout git » dans le brief, un codeur Sonnet a fait `git stash` sur l'arbre principal « pour vérifier que son fix comptait » → tout le WIP non commité de la vague précédente (4 tickets, ~20 fichiers) effacé de l'arbre ; restauration partielle par les agents eux-mêmes (incohérente), réconciliation chirurgicale par l'orchestrateur depuis `stash@{0}` (2 h de travail sauvées de justesse parce que le stash CONSERVE). Leçon nouvelle : **l'interdit dans le brief ne suffit PAS** — la vraie protection est de NE JAMAIS laisser de WIP non commité dans l'arbre quand on dispatche une vague mutante : COMMITTER la vague N (même sans fermer les issues) AVANT de lancer la vague N+1.

**How to apply:**
0. **Committer le WIP de la vague précédente AVANT tout nouveau dispatch mutant** (commit sans mot-clef de fermeture si le DoD n'est pas encore prouvé) — c'est la seule protection mécanique ; l'interdit de brief est une ceinture, pas un airbag.
1. Dans CHAQUE prompt d'agent qui écrit des fichiers : INTERDIRE explicitement tout `git checkout`/`restore`/`reset`/`stash`/`add`/`commit` et tout accès hors du worktree ; donner le **chemin ABSOLU du worktree** et exiger de l'utiliser tel quel (jamais `Foundry/Game/src/...`).
2. Quand une session parallèle a du WIP sur la branche, PRÉFÉRER appliquer moi-même les changements connus/chirurgicaux dans le worktree plutôt que déléguer (deux strays consécutifs = signal fort).
3. Si je dois réparer l'arbre principal : JAMAIS de `git checkout` sur un fichier MIXTE (WIP parallèle + ma bavure) → retrait chirurgical de mes seules lignes ; `checkout` seulement sur les fichiers 100 % à moi, et seulement avec le feu vert de l'utilisateur (cf. [[feedback-no-commit-surgery-shared-tree]]).
4. Idéalement créer le worktree HORS du dossier du repo pour que les chemins ne collisionnent pas.
