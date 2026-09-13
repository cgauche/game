---
name: feedback-jamais-git-surgery-arbre-partage-actif
description: "Un fichier GÉNÉRÉ ou un stray d'agent se restaure par son GÉNÉRATEUR et par des opérations de fichiers, jamais par une commande git ; le régime d'arbre partagé, lui, est porté par le hook."
metadata:
  type: feedback
---

Le régime (ask sur l'arbre principal et tout répertoire non prouvé, silence dans un worktree lié prouvé, `stash` ask partout, jonction `node_modules` deny) vit dans `scripts/hooks/git-destructive-guard.mjs:1-8` et ses tests FONDEMENT — il ne se recopie pas ici.

**Why:** un `checkout`/`restore` « sûr » n'existe pas sur un arbre partagé — le merge 3-way d'un stash efface silencieusement le WIP de la session voisine —, et la règle n'a aucune exception « fichier généré » ni « ma propre écriture toute fraîche ».

**How to apply:** défaire un stray = supprimer/recréer les fichiers puis rejouer le générateur ; porter du travail sur la branche partagée = la session qui l'occupe le fait elle-même, à l'arrêt ; un WIP écrasé se récupère par `git stash apply <sha-droppé>` (apply, jamais pop).
