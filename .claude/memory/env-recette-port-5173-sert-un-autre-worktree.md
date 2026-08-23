---
name: env-recette-port-5173-sert-un-autre-worktree
description: "Piège recette (2026-08-23) : `localhost:5173` peut être servi par un WORKTREE VOISIN (Game-mobilier, Game-1456…) — un recetteur qui « réutilise le serveur » recette un autre arbre et rapporte des bugs fantômes. Toujours identifier le processus du port (Get-NetTCPConnection → CommandLine) et contrôler le bundle avant de recetter."
metadata: 
  node_type: memory
  type: project
  originSessionId: 2a421ddf-a409-4ee5-990e-1d565fe6bd4f
  modified: 2026-08-23T16:03:53.844Z
---

Vécu 2026-08-23 (#1426) : le recetteur a réutilisé `localhost:5173` ; ce port était tenu par le Vite
de `C:\Users\gauch\PhpstormProjects\Foundry\Game-mobilier` (PID mesuré). Il a rapporté « bug réel :
`voyageStakeRef('seaBoardEvent')` jette, soft-lock » — l'entrée existait dans MON arbre (l.503) ; les
numéros de ligne de sa stack ne correspondaient à aucun fichier du lot. 5 autres Vite servaient déjà
`Foundry/Game` sur 5174-5178.

**How to apply :**
- Avant toute recette : `Get-NetTCPConnection -LocalPort <port> -State Listen` → PID →
  `Get-CimInstance Win32_Process` → `CommandLine` : le chemin DOIT être l'arbre du lot.
- Contrôle positif du bundle dans la page (fetch d'un fichier `src/data/*.json` modifié par le lot,
  ou un symbole neuf) AVANT le premier scénario.
- Un rapport de recette dont les `fichier:ligne` ne correspondent pas à l'arbre = mauvais serveur,
  pas un bug. Ne jamais lancer un Nᵉ serveur sans compter ceux qui tournent.
Lié : [[feedback-recette-navigateur-arbre-gele]], [[game-worktree-clone-remotes-pieges]].
