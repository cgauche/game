---
name: game-vague-de-stock-lecons-2026-09-01
description: Leçons des vagues de résorption du stock #1463 (reference, de) — cardinal asserté sur le RÉSULTAT, noyau de lexique qui VOLE des formes, le vrai défaut est souvent le LECTEUR, un récapitulatif figé se recale avec ses lignes
metadata:
  type: project
---

Vécu 2026-09-01 (vagues `reference` et `de`, #1463 L4, 6 trains, 3 juges de design, 3 juges de diff) :

- **Cardinal asserté sur le RÉSULTAT, jamais sur le delta** : une migration qui asserte « j'ai réécrit N sites » laisse passer un arbre à demi migré (rejeu sur un état intermédiaire = N−k sites, aucun rouge). Asserter « le document final porte exactement N formes cibles » (et 0 forme source) — le codeur `de` l'a constaté sur son propre diff.
- **Un noyau de lexique se MESURE avant d'être posé** : le noyau prescrit par le juge de design (`[sum, dice, sinPoints, times]`) volait 7 formes étrangères (`creatures › talents {times}` = le COMPTE d'une réf, `maladies {dice,unit}` = un DiseaseTime…) → 7 divergentes déguisées en solde. Sonde obligatoire : comptes de TOUS les autres concepts identiques avant/après ; le noyau retenu est le plus petit qui ne nomme QU'une forme du concept.
- **Le vrai défaut est souvent le LECTEUR, pas la graphie** : la « divergence » `miscast › dice {sinPlus}` (6 occ) cachait 27 « [object Object] » à l'écran du joueur et une mitigation inventée — le juge de design doit exécuter une sonde sur le RENDU (Codex/écran), pas seulement sur la donnée. Idem `reference` : la spec de dotation s'affichait à la liste mais se perdait à la MATÉRIALISATION (`ItemInstance` sans `spec`) — attrapé par la recette, pas par les tests.
- **Un récapitulatif FIGÉ (en-tête de stock, littéral de test, cas de corpus) se recale avec ses lignes — ou se DÉRIVE** : 3 rouges CI le même jour (slotsStock spells, en-tête ORPHELINES 408, corpus « 1 lecteur ») pour des lignes recalées sans leur récapitulatif. Cause racine traitée par dérivation (#1633 : sonde D dérivée ; #1620 : corpus à 2 rôles).
- **Frontière de design ≠ dogme** : `sinPlus1` avait été mis hors vague par crainte d'une hausse de `STRUCTURES_OPS` ; une fois le concept de lexique posé, la crainte tombait et la doctrine « jamais de demi-migration » primait — le juge de diff a raison de rouvrir une frontière dont la raison est morte.
- **Sonde « irréalisable telle qu'écrite »** : la rangée 11-15 était inatteignable à sin=3 (LDB 40 l.46 « +10 par Point de Péché ») — une sonde prescrite se vérifie ATTEIGNABLE avant d'être promue ; dé forcé + même rangée à deux valeurs de sin.

Liens : [[feedback-jamais-de-demi-migration]], [[feedback-gate-de-lot-couvre-tous-les-consommateurs-du-registre]], [[env-coordination-arbre-partage-sessions]], [[feedback-migrer-l-existant-listes-doivent-decroitre]].
