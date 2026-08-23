---
name: game-detecteur-reference-ancre-index-ids
description: "L0 #1465 (2026-08-23) : mesurer « où sont les références » s'ancre sur l'INDEX DES IDS existants, jamais sur un vocabulaire de clés ou un seuil de champ — deux critères circulaires prescrits par mes briefs, réfutés par 4 juges"
metadata: 
  node_type: memory
  type: project
  originSessionId: 581b89eb-a389-4f97-87c2-713104a0fbca
  modified: 2026-08-23T13:28:32.928Z
---

Chantier #1463, lot L0 (carte des structures `docs/structures-donnees.md`). Trois designs successifs du détecteur de références dans `src/data/*.json` + scènes :
1. **Signature de clés seule** (`{id,spec}`…) → `{id,value}` (5 654 objets, graphie MAJORITAIRE des compétences de créature) invisible : une signature ne distingue pas une référence d'un document.
2. **Champ porteur** prescrit par MON brief (« ≥ 80 % des valeurs portent un `id` ») → réfuté par la sonde du codeur (retient `scenes`/`specs`, rejette `skills`/`talents`/`trappings`) ; sa version « pointeur = clés ⊂ vocabulaire + marqueur, champ ≥ 80 % de pointeurs » → réfutée par la contre-passe : **circulaire** (`+'label'` au vocabulaire fait de `specs` un champ porteur), aveugle aux 452 refs à plat dans les ops (`{op, id}`) et aux 248 objets référençant par `entityId`/`tableId`/`…Ref` (14 969 objets « invisibles »).
3. **Ancrage sur l'index des ids** (design v4) : une valeur chaîne égale à un id existant (hors clé d'identité du document lui-même) EST une occurrence de référence, où qu'elle soit ; le champ porteur se MESURE depuis ces occurrences ; le lexique ne nomme que les FORMES cibles. Non circulaire, exhaustif par construction, et c'est le même principe que la FK générique de L1a (#1466 : `ref(type)` validée contre le registre d'ids généré).

**Why :** « un détecteur ne mesure que sa couverture » ([[feedback-un-detecteur-ne-mesure-que-sa-couverture]]) — un critère fondé sur un vocabulaire ne voit que ce que le vocabulaire nomme, et se solde en éditant le vocabulaire (fuite du contrat). La vérité de « qu'est-ce qu'une référence » est dans la DONNÉE (les ids), pas dans une liste de clés. Deux passes de juge sur la même classe = remonter d'un niveau ([[feedback-altitude-de-design-avant-increments]]) — ce que j'ai fait à la 3ᵉ seulement.

**How to apply :** toute mesure/garde « X référence Y » (FK, orphelins, formes de ref, consommateurs) s'ancre sur l'index des ids (ou le registre généré) ; un seuil (80 %) ou un vocabulaire de clés dans un brief de détection = signal d'alarme, à remplacer par une résolution contre la donnée. Collisions d'ids inter-datasets et labels égaux à un id = angles morts à IMPRIMER, pas à ignorer. Voir [[feedback-coherence-structurelle-jusquau-bout-toutes-donnees]].
