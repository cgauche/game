---
name: env-worktree-node-modules-vide-tsx-spawn
description: "Les worktrees d'agents ont un node_modules VIDE — les imports passent (résolution ascendante), mais tout test qui SPAWNE tsx par chemin explicite échoue MODULE_NOT_FOUND ; classe d'artefact à attribuer avant tout diagnostic"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3c1689ae-eeaa-4da2-a83f-c35ecef5c557
  modified: 2026-08-19T12:20:47.517Z
---

Mesuré 2026-08-19 (worktree `agent-a275250b325f6026f`, lot G5) : `node_modules/` du worktree est **vide** (`ls` : rien). La suite y tourne quand même parce que le worktree vit SOUS le dépôt (`.claude/worktrees/…`) — la résolution ascendante de Node remonte jusqu'au `node_modules` du dépôt parent.

**Mais** tout test/script qui construit un chemin EXPLICITE `<racine-du-worktree>/node_modules/tsx/dist/cli.mjs` (les tests-compilateurs de rig : `quad-harnais.test.ts` et 5 voisins) casse en `MODULE_NOT_FOUND`. Suite complète dans un worktree d'agent = **~6 rouges d'environnement attendus**, tous de cette classe.

**Why:** j'ai failli attribuer ces rouges au lot jugé — le même test passait 19/19 sur main ([[feedback-attribution-rouge-suite-sonde-arbre-committe]]).

**How to apply:** un rouge en suite complète DANS un worktree d'agent dont la trace montre `MODULE_NOT_FOUND` + un spawn de `tsx` → artefact d'environnement : rejouer le fichier sur l'arbre principal pour attribuer, ne PAS « corriger » le test ni bloquer la fusion dessus. La vraie porte verte de ces 6 fichiers = la suite sur main après fusion. Voir aussi [[game-worktree-node-modules-junction-hazard]] (ne JAMAIS junctionner node_modules pour « réparer » ça).
