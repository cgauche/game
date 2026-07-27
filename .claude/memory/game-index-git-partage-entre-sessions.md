---
name: game-index-git-partage-entre-sessions
description: "L'INDEX git est partagé entre sessions parallèles — `git add <mes chemins>` puis `git commit` emporte TOUT l'index, y compris ce qu'une autre session y a mis. La seule forme sûre est `git commit -- <chemins>`."
metadata:
  node_type: memory
  type: feedback
---

**Vécu 2026-07-27.** J'ai commité `5d154d3d` (« une zone se dessine par ses CASES ») avec `git add` de **3**
fichiers. Le commit en portait **13** : les quatre fichiers de configuration `.claude/**`, deux gardes
neuves `scripts/guards/lib/tableConsumerStock.*` et 700 lignes de `src/data/careerLevels.json` —
tout le travail que la session parallèle avait mis en scène et pas encore commité.

**Pourquoi** : `git add` AJOUTE à l'index, il ne le remplace pas ; et l'index (`.git/index`) est **UN
SEUL fichier partagé par toutes les sessions travaillant dans le même arbre**. La discipline « je
committe uniquement mes fichiers par chemins explicites » ne protège donc de rien : elle contrôle ce
que J'ajoute, pas ce qui s'y trouve déjà.

**La parade** : `git commit -- <chemins>` (ou `git commit <chemins>`) committe les **seuls chemins
nommés** et ignore complètement l'index. C'est la seule forme sûre dès qu'une autre session est active.

```
git commit -- src/ui/editor/EditorCanvas.tsx src/ui/editor/Inspector.tsx -m "…"
```

**Vérification qui aurait attrapé le coup** : lire le compte rendu de `git commit`. « 13 files changed »
quand on en a mis 3 en scène est un signal net — je l'ai vu et j'ai su tout de suite. Le contrôle coûte
une seconde : le nombre de fichiers annoncé doit égaler le nombre de chemins passés.

Contrôle a posteriori sur toute une série :
```
git show --stat --format="" <hash> | grep -cE "<motifs des autres sessions>"
```
(les dix commits précédents étaient indemnes — l'autre session avait mis en scène entre-temps.)

**Réparation** : la branche était **poussée et partagée**, donc PAS de `--amend`, PAS de `reset`, PAS de
réécriture. Rien n'était perdu ni corrompu — du travail commité en avance sous un message qui ne le
décrit pas. Un commit vide (`--allow-empty`) portant un RECTIFICATIF nommant les dix fichiers et la
cause laisse la trace au journal sans toucher à l'histoire. C'est la même réponse qu'un message de
commit qui ne correspond pas à son contenu.

**Why** : sur un arbre partagé, l'index n'est pas un espace de travail privé — c'est une ressource
commune, au même titre que les fichiers. Toute la doctrine « ne committe que TES fichiers » supposait
implicitement un index privé, et cette prémisse est fausse.

Lié : [[git-commits-propres-wip-parallele]] (la règle qu'elle corrige),
[[game-stage-chirurgical-hunk-arbre-partage]], [[feedback-jamais-git-surgery-arbre-partage-actif]],
[[game-agents-worktree-isolation-shared-branch]] (l'isolation par worktree supprime le problème à la
racine — c'est la vraie parade quand le travail est long).
