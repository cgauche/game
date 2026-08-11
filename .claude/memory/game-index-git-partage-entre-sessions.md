---
name: game-index-git-partage-entre-sessions
description: "L'INDEX git est partagé entre sessions parallèles — `git add <mes chemins>` puis `git commit` emporte TOUT l'index, y compris ce qu'une autre session y a mis. La seule forme sûre est `git commit -- <chemins>`."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 032f0876-8eb3-421a-bddc-50a550c9bc09
  modified: 2026-08-10T08:10:55.332Z
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

**RÉCIDIVE 2026-08-10 (`9135f643`, lot #1202)** — la règle existait, je l'ai violée : `git add <mes
chemins>` puis `git commit -F` NU a emporté ~15 fichiers de la tranche « départage nue » que la session
voisine venait de stager (recover*, cast-opposition*, tests.ts, rollSeamWhitelist, landMarketFlow…).
Ce qui a érodé la discipline : plusieurs commits précédents de la même session avaient utilisé le
commit nu SANS incident (l'index voisin était vide à ces instants) — l'absence de symptôme n'est pas
une absence de danger. Réparé par commit RECTIFICATIF `--allow-empty` (la fiche le prescrivait).

**NUANCE qui manquait à la fiche — le staging PAR HUNK interdit `git commit -- <chemins>`** : cette
forme committe le CONTENU DE L'ARBRE des chemins nommés (elle ignore l'index), donc elle emporterait
les hunks voisins qu'on vient d'exclure. Deux formes sûres, selon le lot :
1. **Aucun hunk exclu** → `git commit -- <chemins>` (ignore l'index, insensible au voisin) ;
2. **Staging par hunk** → commit d'index NU, mais SEULEMENT après `git diff --cached --stat`
   re-vérifié À L'INSTANT du commit (compte de fichiers = ma liste, sinon `git restore --staged`
   des chemins étrangers — c'est la SEULE commande de restauration licite : elle ne touche que
   l'index, jamais l'arbre). Le contrôle se refait à CHAQUE tentative (un pre-commit refusé puis
   re-committé = une fenêtre de plus pour le voisin).

**LES DEUX FORMES NE SE MÉLANGENT JAMAIS dans un même commit** (récidive 2026-08-10, lot L3,
`acf2a447`) : j'ai stagé `combatEffects.ts` par hunk (`git apply --cached`) PUIS committé le lot en
forme pathspec — la pathspec a committé l'ARBRE des chemins nommés et a IGNORÉ mes hunks stagés :
le fichier au hunk exclu n'était pas dans la liste, il est resté dehors, le tronc était incohérent
(commit de complément `17ce3cab` dans la minute). Un lot MIXTE (fichiers entiers + un fichier par
hunk) se committe en DEUX commits — pathspec pour les entiers, index nu pour le par-hunk — ou tout
en index nu avec le contrôle du point 2.

**Leçon CÔTÉ VICTIME (même incident `9135f643`, vécu de l'autre session)** : mon lot L5 était stagé
chirurgicalement (`git apply --cached`, 17 fichiers) et ATTENDAIT le verdict de la suite complète
(~10 min). Le commit voisin est tombé dans cette fenêtre et a tout emporté. Un stage qui attend est
une fenêtre ouverte : **la suite se lance AVANT de stager, et le stage (surtout par hunk) se fait à
L'INSTANT du commit**, jamais en avance. Si un gate long doit re-tourner, dé-stager (`git restore
--staged`, seule commande licite) plutôt que laisser le lot parqué dans l'index commun.

**Why** : sur un arbre partagé, l'index n'est pas un espace de travail privé — c'est une ressource
commune, au même titre que les fichiers. Toute la doctrine « ne committe que TES fichiers » supposait
implicitement un index privé, et cette prémisse est fausse.

Lié : [[git-commits-propres-wip-parallele]] (la règle qu'elle corrige),
[[game-stage-chirurgical-hunk-arbre-partage]], [[feedback-jamais-git-surgery-arbre-partage-actif]],
[[game-agents-worktree-isolation-shared-branch]] (l'isolation par worktree supprime le problème à la
racine — c'est la vraie parade quand le travail est long).
