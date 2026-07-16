---
name: feedback-regles-generales-jamais-specifiques
description: "Toujours résoudre par une règle GÉNÉRALE (data/vision-aware), jamais un cas spécifique en dur."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c104c1bc-08ae-405c-8b02-96deb8a53b4c
---

**« Toujours faire des règles générales et non spécifiques. »** Quand un bug apparaît sur UN contenu
(ex. le chemin de ronde du siège caché depuis la cour), la correction doit être une règle qui vaut pour
TOUS les cas analogues — jamais un patch nommant ce contenu.

**Why:** un cas en dur = dette + ça re-casse sur le prochain contenu ; la règle générale corrige la classe entière.

**How to apply:** formuler l'invariant (« un surplomb ne s'efface que pour ne pas masquer un étage inférieur
VISIBLE ; sinon on l'affiche plein »), l'exprimer sur les primitives existantes (vision/`visible`, relief,
GameOp…), le vérifier sur PLUSIEURS scènes (siège **ET** opéra **ET** pont). Prolonge
[[feedback-effet-existant-general-parametrable]], [[feedback-contenu-donnee-editeur-pas-code]],
[[feedback-mutualiser-invariant-pas-juste-appel]].
