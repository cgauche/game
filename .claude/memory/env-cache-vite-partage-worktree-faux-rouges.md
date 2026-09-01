---
name: env-cache-vite-partage-worktree-faux-rouges
description: "Un worktree DANS le dépôt partage node_modules/.vite par remontée ESM : vitest peut y servir le schéma d'un WIP TIERS en cours d'écriture — faux rouges impossibles à HEAD ; purger .vite avant tout run probant en worktree"
metadata: 
  node_type: memory
  type: project
  originSessionId: 39a8970a-cba9-474a-be43-12bdf0b366e7
  modified: 2026-09-01T05:25:15.611Z
---

Vécu 2026-09-01 (3 sessions, même arbre) : une session en worktree (`.wt-1624`, DANS le dépôt) mesure
une collecte vitest MORTE (152 suites, 0 test) sur « effect.montant expected object / Unrecognized key
silver » — un message que le sha de base (8d7465698) ne PEUT PAS produire (le schéma committé était
encore plat `{gold?,silver?,brass?}`, contre-prouvé par `git show HEAD:…` et `git grep montant <sha>`).
Le vecteur : `node_modules/.vite` (cache de transform vitest) est résolu par REMONTÉE ESM vers l'arbre
principal, où un codeur écrivait ACTIVEMENT le schéma `montant` de son lot L3 — le worktree a exécuté
le schéma WIP d'un TIERS contre ses propres JSON.

**Pourquoi c'est vicieux :** le symptôme accuse le COMMITTÉ (« les *-projet.json committés sont
invalides ») alors que la cause est un WIP non committé d'une AUTRE session ; deux orchestrateurs ont
d'abord attribué le rouge à un train poussé (moi compris — inféré du LISTING de fichiers d'un train
sans vérifier le CONTENU du schéma à HEAD : grounding de seconde main).

**Comment appliquer :**
- Tout run vitest PROBANT dans un worktree interne au dépôt : purger `node_modules/.vite` (et le
  cacheDir vitest s'il est configuré) AVANT, surtout si une session voisine écrit dans l'arbre.
- Un rouge « impossible à HEAD » se contre-prouve par `git show HEAD:<schéma>` / `git grep <clé> <sha>`
  AVANT toute attribution — le message d'erreur peut décrire un état que SEUL un WIP possède.
- Jamais de hotfix sur un symptôme que le sha incriminé ne peut pas produire.
- Corollaire arbre partagé : les DOCS DÉRIVÉS régénérés sur l'arbre embarquent le WIP des voisins
  (deux occurrences le même jour : mon coverage.md avec son sea-weather, son structures-donnees.md
  avec mes +12 notes non committées) — un doc dérivé se committe soit regénéré SUR L'INDEX
  ([[game-train-chirurgical-portes-sur-l-index]]), soit en le DISANT au message de commit.
- Liens : [[game-worktree-node-modules-junction-hazard]], [[env-worktree-node-modules-vide-tsx-spawn]],
  [[env-coordination-arbre-partage-sessions]].
