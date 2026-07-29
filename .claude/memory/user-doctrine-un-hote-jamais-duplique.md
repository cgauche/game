---
name: user-doctrine-un-hote-jamais-duplique
description: "DOCTRINE : UN seul hôte de jet — on NOURRIT l'hôte, on ne le duplique jamais ; « conséquence »/pendingReveals désavoué comme concept né d'un mot recyclé sans arbitrage (#942)"
metadata: 
  node_type: memory
  type: user
  originSessionId: 032f0876-8eb3-421a-bddc-50a550c9bc09
  modified: 2026-07-29T10:56:20.170Z
---

Deux verbatims utilisateur du 2026-07-29, fondateurs du programme #942 :

> « Pour moi il ne devait pas avoir plusieurs "hote", j'ai toujours essayé d'améliorer mon hote mais au lieu de cela il s'est dupliqué en nouveau hote plutot que de le nourrire. »

> « Le concept de "conséquence" m'a toujours échappé et n'a aucun sens. Un jour j'ai parlé de "conséquence", et depuis c'est devenu un mot qui justifie un design qui n'aurait jamais du naitre. »

> « Pour moi qui peut le plus peu le moins. Faire un jet ou plusieurs, c'est la même chose, pas 2 comportements différents »

⇒ La représentation canonique de l'hôte est une **séquence de N slots de jet, N ≥ 1** — le mono est le cas N=1, jamais un cycle distinct (la primitive UI le disait déjà : « le mono = N=1 » ; l'étage ÉTAT ne l'a jamais appliqué). La cascade EST la forme canonique, pas une structure à fondre.

> « C'est ca. Surtout qu'on a un mode de cadance semi-automatique qui cache les jets pour ceux qui aiment le jeu vidéo. »

**LE MODÈLE COMPLET — un objet, trois molettes** : l'HÔTE (jet canonique, N≥1 slots, existe toujours) × la CADENCE (visibilité : table ↔ jeu vidéo) × le SIÈGE (autorité : qui tient quels dés) × les DÉS FIXÉS (édition). Un « jet silencieux » légitime = cadence baissée sur le même objet ; le BUG = un jet roulé hors de l'hôte, qui échappe aux trois molettes (d'où `rollSansPilote` au noyau et l'option dés-fixés comme révélateur des évadés).

**Ce qu'est un « hôte »** : la structure qui possède le cycle de vie d'un jet face au joueur (état pending, fenêtre, affordances, marquage, application). État 2026-07-29 : TROIS hôtes — pendings `makeRollFlow`/`RollShell` (le canonique), étapes `pendingCascade`, file `pendingReveals` (critiques/maladresses — née du mot « conséquence »).

**Why:** chaque hôte parallèle re-plombe les affordances ; une capacité ajoutée au seam ne profite qu'à l'hôte canonique (vécu #939 : les dés fixés morts sur 2 hôtes sur 3). C'est la même maladie que le socle-qui-délègue ([[feedback-socle-resout-specs-adressent]]), un étage au-dessus.

**How to apply:**
- Tout besoin nouveau (séquencer, révéler, batcher, table) = une CAPACITÉ de l'hôte canonique, jamais une structure à côté. Un diff qui ajoute `pendingX` + fenêtre hors seam = FORK d'hôte, refusé par principe.
- `pendingReveals` est en DISSOLUTION (#939 lot 2 / #942) ; la cascade converge vers « séquenceur du cycle canonique ».
- Le mot « conséquence » ne justifie RIEN : toute structure qui s'en réclame se re-justifie par sa fonction ou se dissout.
- Corollaire de méthode : un mot d'utilisateur prononcé une fois n'est pas un arbitrage — sans citation datée, c'est une évaluation révisable ([[feedback-enterine-mot-reserve-utilisateur]], [[feedback-brief-fait-autorite-grounding-seconde-main]]).
