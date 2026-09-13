---
name: env-recette-worktree-preview-kit
description: "Recette navigateur depuis un worktree : le lanceur ne lit que le launch.json de la RACINE, le volet masqué fige rAF, le kit refuse un serveur d'un autre arbre"
metadata:
  node_type: memory
  type: project
---

**Why:** une config posée dans le worktree est ignorée et c'est le serveur de l'ARBRE PRINCIPAL qui démarre ; et un volet navigateur masqué ne bat pas `requestAnimationFrame` — la caméra ne se met pas à jour et toute mesure d'écran est nulle.

**How to apply:** entrée dans `.claude/launch.json` de la RACINE, avec `npm --prefix <worktree> run dev` et le port dérivé par `scripts/port-dev.mjs` ; toute mesure d'écran passe par le kit `scripts/recette/lib.mjs` (Chrome réel, CDP) DU MÊME arbre — `checkServer` (`scripts/recette/lib.mjs:177`) refuse un serveur qui sert un autre arbre ; jamais de mesure via le volet masqué ; une position d'écran s'inverse avec la caméra RENDUE, pas avec l'état de panoramique du store.
