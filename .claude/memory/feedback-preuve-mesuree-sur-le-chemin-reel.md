---
name: feedback-preuve-mesuree-sur-le-chemin-reel
description: "Une preuve mesurée sur un chemin OPTIONNEL ne prouve rien du cas normal : une preuve nomme son CHEMIN et son RÉGLAGE, et une classe se prouve par matrice, jamais par un point choisi."
metadata:
  type: feedback
---

**Why:** un agent qui construit son banc choisit le chemin le plus commode à instancier, rarement le chemin normal du produit ; la précision d'un chiffre ne dit rien de la représentativité du cas mesuré, et un scalaire agrégé peut être bon pour une mauvaise raison — c'est l'ancrage d'un percentile sur une valeur CONNUE qui ne ment pas.

**How to apply:** exiger « mesuré sur quoi, avec quels champs renseignés, est-ce le défaut du produit ? », le brief disant « sans jamais forcer <le champ optionnel> » ; exiger une MATRICE ; se méfier d'un chiffre qui tombe trop bien. Pour une équivalence après migration, le témoin s'EXTRAIT de `git show HEAD:<fichier>` et se JOUE, jamais retranscrit à la main. (Le harnais d'art canonique `scripts/qc/mesure-volume.mts` et l'interdit de l'écrire soi-même vivent dans `.claude/agents/juge.md` et `.claude/agents/artiste.md`.)
