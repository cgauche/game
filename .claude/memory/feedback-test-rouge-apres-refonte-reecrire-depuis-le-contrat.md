---
name: feedback-test-rouge-apres-refonte-reecrire-depuis-le-contrat
description: "Un test rouge après une refonte n'est pas une consigne : il s'ATTRIBUE (contrat vs ancienne mécanique) et se réécrit depuis le nouveau contrat — jamais un retour à l'ancien comportement ni un hack pour le satisfaire (user 2026-08-23)."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2a421ddf-a409-4ee5-990e-1d565fe6bd4f
  modified: 2026-08-23T10:37:03.900Z
---

Constat utilisateur (2026-08-23, verbatim, reprise #1426 volet maritime) : « C'est le soucis que j'ai
avec les tests unitaires, des qu'on fait une refonte, on a les tests qui nous pousse a revenir a
l'ancien comportement ou faire des hacks ».

**Why :** les tests verrouillent souvent une MÉCANIQUE (ex. « après `runSeaDay`, l'événement de bord
est déjà tiré » = résolution inline) et pas le CONTRAT (« l'événement de bord est une étape du canal
canonique ; drainée, son d100 est capturé »). Après refonte, ces tests rougissent et poussent soit à
régresser le flux, soit à le hacker pour les faire passer — l'inverse du but du chantier.

**How to apply :**
- Tout rouge post-refonte s'ATTRIBUE d'abord : verrouille-t-il le contrat (RAW, invariants du ticket,
  design jugé) ou l'ancienne mécanique ? Le premier se respecte, le second se RÉÉCRIT depuis le
  nouveau contrat (assertion sur ce que le contrat garantit, pas sur le chemin d'avant).
- Jamais adapter le flux aux tests ; jamais un hack de test (skip, timeout, mock du nouveau chemin).
- Le pilotage d'un mécanisme transverse dans les tests (drainer une cascade, résoudre une étape à
  table…) vit dans UN helper de test partagé — un patron recopié dans N tests rougit N fois à la
  refonte suivante et reproduit le réflexe.
Lié : [[feedback-tests-tombale-contrat-positif]], [[user-doctrine-forme-canonique-unique-jets]].
