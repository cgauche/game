---
name: game-worktree-node-modules-junction-hazard
description: NE JAMAIS junctionner node_modules dans un worktree — la suppression du junction a strippé le node_modules PARTAGÉ
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 595d00e2-e728-4472-a745-cee05f908fbc
---

Pour tester `HEAD` en isolation (sans le churn d'une session //), j'ai créé un `git worktree --detach` puis un **junction** `node_modules` → le `node_modules` du repo principal. Deux problèmes : (1) le junction casse la résolution ESM des deps transitives (vitest : `Cannot find package '@jridgewell/sourcemap-codec'` depuis `magic-string`) → tests « en échec » qui sont en fait des **erreurs de démarrage**, pas de vrais échecs ; (2) **`cmd /c rmdir` du junction a SUPPRIMÉ `.bin` + `@jridgewell` du `node_modules` PARTAGÉ** → `vitest n'est pas reconnu` dans les DEUX sessions. Récupéré par `npm install` dans le repo principal.

**Why:** un junction Windows vers un node_modules partagé est fragile (résolution + suppression destructive) ; ça casse l'outillage des deux sessions sur l'arbre partagé — incident auto-infligé, cf. [[feedback-jamais-git-surgery-arbre-partage-actif]].

**How to apply:** pour valider `HEAD` en isolation → `git worktree add --detach .wt-<ticket>-L<n> HEAD` (à la racine du dépôt, convention #1679 L1c gitignorée `/.wt-*/`) puis **`npm ci` PROPRE dans le worktree** (son propre node_modules, jamais de junction/symlink vers le principal). Worktree pour agents = même règle ([[game-agents-worktree-isolation-shared-branch]]) : un vrai install, lent mais sûr. Nettoyer avec `git worktree remove`. **PORTÉ PAR** `scripts/hooks/git-destructive-guard.mjs` (26be12347) : toute jonction/lien (`New-Item -ItemType Junction|SymbolicLink|HardLink`, `mklink /J|/D|/H`, `ln -s`) ciblant `node_modules` est REFUSÉE avant exécution.
