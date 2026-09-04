---
name: env-recette-worktree-preview-kit
description: "Recette navigateur depuis un WORKTREE — preview_start ne lit que le launch.json de la racine, le volet masqué fige rAF (mesure nulle), le kit de recette refuse un serveur d'un autre arbre"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4407a64f-b0ad-4d3d-b30f-ffca252025d6
  modified: 2026-09-02T13:17:31.295Z
---

Mesuré le 2026-09-02 (#1680 lot 2, worktree `.wt-1624`) :
- `preview_start {name}` ne lit QUE `.claude/launch.json` de la RACINE du projet : une config posée dans `<worktree>/.claude/launch.json` est ignorée et c'est le serveur de l'ARBRE PRINCIPAL qui démarre. Entrée qui marche : `{"name":"dev-wt-1624","runtimeExecutable":"npm","runtimeArgs":["--prefix",".wt-1624","run","dev","--","--port","5174","--strictPort"],"port":5174}` (port dérivé du worktree = `scripts/port-dev.mjs`, 5174).
- Le volet navigateur MASQUÉ ne bat pas `requestAnimationFrame` : la caméra three ne se met pas à jour, `__wfrp.pickTileAt` rend n'importe quoi (dix pixels → la même case) et un `await rAF` pend 45 s. Une mesure d'écran passe par le kit `scripts/recette/lib.mjs` (Chrome réel, CDP), jamais par le volet masqué.
- Le kit refuse un serveur qui sert un autre arbre (`checkServer` : « Arbre SERVI ≠ arbre courant ») — l'arbre courant est celui de la LIB importée, pas le cwd : sonder MAIN exige le kit de main (`Foundry/Game/scripts/recette/lib.mjs`) contre le port de main.
- Premier chargement à froid > 10 s (`APP_READY` du kit) quand la suite complète tourne en parallèle : relancer une fois, Vite chaud.
- `tileScreenPos` rend un pixel CLIENT ; la sonde et le geste doivent inverser avec la caméra RENDUE (`camRef` après focal), pas `st.camPan` (vaut (0,0) écran centré sur le groupe) — c'est le défaut corrigé par le lot 2.

**Why:** deux heures perdues à attribuer un « aucune » à un bug de chaîne alors que c'était la caméra du store ; un serveur de l'arbre principal lancé par erreur.
**How to apply:** avant toute recette en worktree : config racine `--prefix`, kit de recette avec la lib DU MÊME arbre, jamais de mesure via le volet masqué. Voir [[env-coordination-arbre-partage-sessions]], [[feedback-preuve-mesuree-sur-le-chemin-reel]].
