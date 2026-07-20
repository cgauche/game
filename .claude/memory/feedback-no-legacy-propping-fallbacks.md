---
name: feedback-no-legacy-propping-fallbacks
description: "User 2026-07-20 : un fallback qui fait VIVRE un comportement legacy (résoudre un id en essayant l'ancien foyer PUIS le nouveau, résolution par label) est interdit — le legacy se SUPPRIME, pas se répare ni se prop."
metadata:
  type: feedback
---

**User 2026-07-20 (verbatim)** : « Je n'aime pas les fallback qui pousse a garder un comportement legacy,
dans parfois l'utilisation de label interdit » + « Que des comportements interdit par le credo ».

**Contexte** : #610 (SOCLE, véhicules unifiés). Un codeur avait « réparé » le VÉHICULE-EN-OBJET (legacy que
le socle SUPPRIME — un véhicule devient une POSSESSION en T1, plus jamais un objet de sac) avec des
fallbacks : `sellGain` retombant sur `findVehicleById` quand `findTrappingById` échoue ; `itemFromTrappingById`
→ `itemFromVehicleById` ; `isVehicleItem` lisant un id véhicule dans le champ `trappingId` (conflation).

**Why** : investir du code pour faire VIVRE un modèle que le programme élimine est de la DETTE, pas une
réparation. Le fallback « essaie l'ancien foyer PUIS le nouveau » masque une migration incomplète et
ré-introduit souvent la résolution par LABEL (interdite — [[game-ids-internes-libelles-display-multilangue]]).

**How to apply** : quand un modèle est destiné à disparaître, ne le PROPPE pas — SUPPRIME-le (fonctions
mortes, champ de conflation) et remplace la référence par une réf TYPÉE résolue DIRECTEMENT (ex.
`{vehicleId}` → `findVehicleById`, JAMAIS un fallback depuis le foyer trapping). Une régression transitoire
ASSUMÉE (la dotation véhicule ne produit plus d'objet — elle deviendra une possession) est préférable au
legacy propé. Lié : [[game-existant-poc-refactor-libre]], [[game-socle-possessions-programme]].
