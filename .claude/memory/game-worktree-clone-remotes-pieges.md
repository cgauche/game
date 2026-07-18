---
name: game-worktree-clone-remotes-pieges
description: Rebase/push sur arbre partagé sale — worktree détaché OK ; ⚠ un clone local a origin=repo LOCAL (pas GitHub) ; bug git worktree sur chemins temp longs
metadata: 
  node_type: memory
  type: project
  originSessionId: b01212b8-6728-41cc-b726-ae207da81ef1
---

Plomberie éprouvée le 2026-07-16 (vague masse-de-tickets) quand l'arbre principal porte du WIP
d'autres sessions (rebase impossible, stash interdit sur le travail d'autrui) :

- **Rebase/push** : `git worktree add --detach <chemin-court> HEAD` (⚠ BUG git sur les chemins
  scratchpad très longs : « How come '' becomes empty after sanitization » — utiliser un sibling
  court type `../game-rebase-wt`), rebaser LÀ, `git push origin HEAD:main`, `git worktree remove`.
  Les scripts `scripts/raw/*.mjs` tournent en node nu dans le worktree (pas de node_modules) ;
  vitest/tsc NON (déps absentes — jamais junctionner node_modules,
  [[game-worktree-node-modules-junction-hazard]]).
- **Build/deploy/tests sur état distant** : `git clone --no-checkout . <sibling>` + checkout SHA +
  `npm ci` (~2 min). ⚠ PIÈGE VÉCU : le clone a **origin = le repo LOCAL** — `git pull --rebase
  origin main` y tire la vieille ligne locale divergente (conflits absurdes sur les commits
  d'autrui) et `git push origin` « réussit » dans le vide. TOUJOURS `git remote add github <url
  réelle>` (récupérée du repo principal) et pousser/fetcher `github` explicitement.
- **Cherry-pick chirurgical** : pour pousser 2-3 commits locaux uniques sans embarquer la ligne
  conjointe, `git log --cherry-pick --right-only origin/main...HEAD` MENT pour les commits déjà
  rebasés-avec-résolution (patch-id divergent) — vérifier au CONTENU, puis cherry-pick dans le
  clone et push `github HEAD:main`.
- L'autre session a convergé sur le même patron (sa fiche 05a0e48d le confirme) — les DEUX
  sessions poussent désormais par worktree/clone, le tronc local est un cimetière de copies
  originales qui se résorbe aux `pull --rebase` (patchs identiques dédupliqués).
- **Gros rebase multi-sessions (vécu 2026-07-17, 71 locaux / 35 distants)** : cartographier les
  DOUBLONS par TITRE d'abord (`comm -12` des `git log --format=%s` des deux côtés depuis le
  merge-base) → boucle `rebase --skip` sur les titres communs, résolution manuelle sur l'unique
  seulement. `npm ci` FRAIS dans le worktree rend typecheck + suite complète possibles AVANT push
  — indispensable : les cliquets à stock (folio, part-view) DÉCROISSENT au merge, les rabaisser
  est leur geste prévu (régénérateurs existants) ; conflits de sections `Implémente :` = le côté
  GÉNÉRÉ prime toujours, régénérer après. ⚠ PIÈGE outillage : la couche shell (RTK) DIVISE les
  backslashes des scripts inline (heredoc python/node/perl : `\\\\` arrive en `\`) — tout patch
  de fichier à backslashes passe par un script écrit par l'outil Write puis `node script.cjs`,
  jamais inline.
