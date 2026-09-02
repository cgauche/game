---
name: index-env-outillage
description: Sous-index des pièges d'environnement/outillage (worktree, vitest, RTK, lean-ctx, shell, navigateur) — chaque fiche garde son détail
metadata:
  type: reference
---

# Pièges d'environnement / outillage (sous-index)

Déplacés ici depuis `MEMORY.md` le 2026-09-01 (compaction) — les fiches font foi, ce sous-index ne fait que router.

## Worktree, cache, dépendances
- Isolation d'un worktree = PORTES, pas des consignes (#1679 L1c) : setup vitest ancré + garde `src/worktree-isolation-guard.test.ts` (son en-tête explique le mécanisme), refus nommé sans `node_modules` local (`scripts/outillage-local.mjs`), verrou de suite complète (`scripts/test/verrou.mjs`), port de dev dérivé strict (`scripts/port-dev.mjs`). Un rouge « impossible à HEAD » se contre-prouve par `git show HEAD:<fichier>` avant toute attribution ([rouge = ARBRE COMMITTÉ](feedback-attribution-rouge-suite-sonde-arbre-committe.md)).
- [Worktree/clone : remotes, convention `.wt-<ticket>-L<n>`](game-worktree-clone-remotes-pieges.md) · [npm 10 jamais 11](env-npm-lock-regen-npm10-ci.md) · [jamais junctionner node_modules](game-worktree-node-modules-junction-hazard.md) (refusé par `git-destructive-guard`).

## Vitest / RTK / preuve des runners
- [Vitest isolate:false](game-tests-isolate-false-speedup.md) + [vi.mock = ORDRE](game-vi-mock-isolate-false-liaison-ordre.md).
- [Exit AVALÉ](env-exit-code-avale-par-l-outillage-shell.md) · [gen « inchangé » post-vitest = buildStart ; preuve runner = fichier, jamais pipe](env-gen-registry-buildstart-et-preuve-par-pipe.md) · [FAUX VERT pont RTK](env-faux-vert-pont-rtk-vitest-collecte.md) · [fausses catastrophes RTK](game-rtk-gitshow-tsbuildinfo-phantom-errors.md).

## lean-ctx / shell
- [ctx_search saute >512 Ko](game-ctx-search-skips-large-files-use-grep.md) · [ctx_patch FAUX SUCCÈS / ctx_read tronque](env-ctx-patch-faux-succes-relire-au-fichier.md) · [« BLOCKED » exécuté quand même](env-blocked-leanctx-execute-quand-meme.md) · [Read PNG agents + dedup MENTEUR](env-lecture-png-agents-et-dedup-leanctx-menteur.md).
- [backticks EXÉCUTÉS dans un contenu interpolé](env-backticks-executes-dans-contenu-interpole.md) — `--body-file` ; le pont mange aussi variables/boucles shell → scripts `.mjs` · [EOL mutilées](env-eol-mutilees-arbre-local-parseurs-seam.md) · [écritures HORS DÉPÔT éphémères](env-ecritures-hors-depot-ephemeres-inter-appels.md) · diagnostics LSP sur fichiers d'agents frais = souvent PÉRIMÉS, foi au typecheck.

## Navigateur / recette
- [tempo navigateur](game-browser-verif-tempo.md) · [evaluate borné](game-browser-evaluate-no-infinite-loop.md) · [Captures QC = arbre AU REPOS](env-capture-qc-arbre-au-repos-vite-reload.md) · la recette REFUSE le serveur d'un autre arbre (`checkServer`, `docs/recette-navigateur.md` § « Quel process sert un port ? »).
- [Bash background TUÉ → gates au premier plan ; chemin littéral pour le message de commit](env-bash-background-tue-gates-au-premier-plan.md) — 2026-09-02.
- [Recette JAMAIS en parallèle d'un juge qui teste (gen-registry réécrit src/data → HMR → TDZ)](env-recette-jamais-en-parallele-dun-juge-qui-teste.md) — 2026-09-02.
- [Recette en WORKTREE : preview racine `--prefix`, volet masqué = rAF figé, kit = lib du même arbre](env-recette-worktree-preview-kit.md) — 2026-09-02, la sonde de picking rendait « aucune » par caméra du store.
