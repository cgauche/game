---
name: feedback-police-dacces-aveugle-a-la-recopie
description: "Une garde qui police l'ACCÈS (import, label, route) ne voit jamais la RECOPIE du contenu — toute garde neuve s'attaque sur « attrape-t-elle le cas fondateur ? » avant livraison."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 032f0876-8eb3-421a-bddc-50a550c9bc09
  modified: 2026-08-12T18:51:17.712Z
---

Trois gardes livrées coup sur coup (2026-08-12, chantier #1262) ont eu la MÊME cécité de classe, chacune découverte par le juge APRÈS livraison :

1. `give-trapping-custom-guard` : rapprochement par LABEL — aveugle au `custom: 'Épée'` qu'elle accompagnait (équivalent conceptuel d'« Arme simple », homonyme de rien). Sortie : 2e signal data-driven (formChoices).
2. `no-restricted-imports` sur `ownsLocally` (L1 V3) : police d'IMPORT — aveugle aux 2 RECOPIES de la formule de possession (`InterludeScreen:161`, `PartyScreen:386`), précisément la classe qui produit les bugs. Sortie : garde de FORME (`ownership[...]===mySeat`).
3. garde d'import `flowOutcomes` (Lj V3) : même forme — mesure des imports, pas la recopie d'une phrase d'issue composée à la main.

**Why :** une police d'ACCÈS borne la route officielle ; or le poison naît presque toujours par RECOPIE (quelqu'un réécrit la formule/le texte au lieu d'importer). La garde verte donne alors une fausse assurance — pire qu'aucune garde. C'est le raffinement de [[feedback-un-detecteur-ne-mesure-que-sa-couverture]] : la couverture d'une police d'accès EXCLUT structurellement le cas fondateur.

**How to apply :** toute garde neuve se juge sur UNE question avant livraison : « réintroduis le cas fondateur (le bug qui a motivé la garde) — rougit-elle ? » (mutation obligatoire au brief du codeur). Si la réponse est non : soit un 2e signal de FORME/CONTENU s'ajoute (motif de la formule, patron du texte, donnée du catalogue), soit la limite s'ÉCRIT à la portée de la garde (jamais tue). Au dispatch d'un lot qui pose une garde, le brief du juge inclut d'office la mutation « cas fondateur réintroduit ».
