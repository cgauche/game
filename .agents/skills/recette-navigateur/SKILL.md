---
name: recette-navigateur
description: À utiliser avant de valider TOUTE feature visible en jeu (UI, combat, IA, voyage) dans le navigateur — Playwright sur le serveur de dev de CET arbre (localhost:5173 sur l'arbre principal, port dérivé en worktree lié — scripts/port-dev.mjs) — ou quand un clic/survol/état ne répond pas comme attendu en recette. Obligatoire avant de déclarer une feature UI terminée.
---
<!-- GENERATED: agents:sync; source=.claude/skills/recette-navigateur/SKILL.md -->

# Recette navigateur

Lire **`docs/recette-navigateur.md`**. L'essentiel non négociable : piloter **COMME UN JOUEUR**
(clavier `keybindings.ts` + clics réels d'abord ; `__wfrp` pour le setup/l'observation ; fonctions
du store en dernier recours — jamais pour valider le flux testé). Console à 0 erreur. Piège
closure-sync : jamais lire le DOM dans le même `evaluate` que l'action qui change l'état React.
