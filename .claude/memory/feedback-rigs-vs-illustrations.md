---
name: feedback-rigs-vs-illustrations
description: "Mandat permanent : corriger les défauts de rig au passage, et TOUJOURS confronter le rendu à l'illustration officielle (art-ref/ldb/mapping.json — un script d'extraction alimente art-ref)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dbb7bc70-76e7-4534-b7a5-d556ce0815d1
---

**Instruction utilisateur (2026-06-11, après la refonte Chaos)** : « Profite-en, quand tu vois
des défauts sur les rigs actuels, de les corriger. On a un script qui extrait les images pour
les mettre dans art-ref. C'est important d'utiliser aussi l'illustration pour avoir le
meilleur rendu. »

**Why** : le texte canon ne suffit pas — la Démonette « crémeuse et pâle » (texte) est LILAS
à corset doré sur l'illustration p.337, et l'utilisateur juge « par rapport à l'illustration »
(« couleurs immondes »). L'illustration officielle = la référence visuelle de vérité.

**How to apply** :
- `art-ref/ldb/mapping.json` → clé `creatures` : nom → chemin PNG de l'illustration LDB
  (art-ref est GITIGNORÉ — droits Cubicle 7 — mais lisible localement par l'outil Read).
- Avant de créer/retoucher un rig : LIRE l'image, caler couleurs + tenue + accessoires dessus.
- Défaut de rig repéré en passant (élément décollé, profil faux, dents/bouche ratées,
  proportions) → le corriger dans la foulée, pas le noter pour plus tard.
- Récidives connues à traquer : oreilles/cheveux/cornes décollés du crâne ; art de face
  plaqué de profil (cornes par-vue + lateralPair) ; poing générique sous un membre remplacé ;
  dents de face « lapin » (gueule au bout du museau, crocs aux commissures).

Prolonge [[game-qc-reconnaissabilite]].
