---
name: feedback-no-commit-surgery-shared-tree
description: "Dans l'arbre partagé (4 sessions //), committer SIMPLEMENT — pas de chirurgie index/amend pour des commits « parfaits »"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4e6c5100-25b0-4b77-aea8-b26dd13e5d75
---

« Vous passez plus de temps à créer vos commits parfaits qu'à développer. » — l'utilisateur, après que ma chirurgie git (index isolé + reconstruction depuis HEAD + `--amend`) a **deux fois reverté du travail de sessions parallèles** et coûté ~20 allers-retours.

**Pourquoi :** 4 sessions Claude committent dans **le même working tree / le même `.git`** toutes les quelques minutes. HEAD bouge sous moi : un `git show HEAD` au temps T puis un commit au temps T+n se base sur un HEAD périmé → reconstruire store.ts depuis ce HEAD **revert** ce qu'une session a committé entre-temps. Pire, `--amend` a réécrit le commit d'une AUTRE session (le tip avait bougé).

**Comment faire à la place :**
- **Committer simplement** : `git add <mes fichiers> && git commit`, ou même accepter d'embarquer des hunks voisins. L'attribution salie est SANS conséquence (single repo partagé, HEAD = vérité). Cf. [[git-commits-propres-wip-parallele]] mais **sans** l'index isolé en cas de tree à forte rotation.
- **Le working tree EST la vérité partagée** : si HEAD doit être complet, `git diff HEAD -- <file>` vide = déjà bon ; sinon committer le working tree.
- **JAMAIS `--amend`** dans ce repo (le tip peut être le commit d'une autre session).
- **Vérifier le TREE de HEAD** (contenu présent + tests), pas la propreté des diffs intermédiaires.
- La règle « committer mes seuls hunks » de [[git-commits-propres-wip-parallele]] reste valable pour des fichiers à faible contention, mais **pas** au prix de reconstructions fragiles quand ça tourne vite. Prolonge [[feedback-decisiveness-routine-git]] (agir simplement) et [[feedback-workflows-calibres-taille]] (ne pas sur-investir).
