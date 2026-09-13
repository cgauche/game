---
name: feedback-perf-profiler-avant-design-cache
description: "Un chantier perf commence par un PROFIL PAR ÉTAPE (énumération / lecture / parse / visite / constructeur), jamais par un design déduit de la forme du code"
metadata:
  node_type: memory
  type: feedback
---

**Why:** la cause supposée se trompe de cible — un « re-parse massif » peut peser cent fois moins qu'un CONSTRUCTEUR payé à chaque instanciation —, et un gain promis en simulation s'inverse en A/B alterné, la machine dérivant d'un run à l'autre.

**How to apply:** mesurer la suite en JSON, sonder PAR ÉTAPE avant de nommer la cause, écrire chaque hypothèse « à réfuter » dans le brief avec sa sonde discriminante, mesurer tout gain en A/B ALTERNÉ. Une mémoïsation partagée exige que l'arbre scanné soit STATIQUE pendant le run (nommer l'unique écrivain) et que le prix de rétention par worker soit chiffré ; hors de ce cas, mémoïsation intra-fichier et paresseuse.
