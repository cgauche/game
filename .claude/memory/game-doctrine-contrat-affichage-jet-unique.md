---
name: game-doctrine-contrat-affichage-jet-unique
description: "DOCTRINE (2026-08-04) : UN contrat d'affichage pour TOUS les jets — mêmes informations, même forme, mêmes règles ; une spécificité de type étend la MÉCANIQUE, jamais le schéma d'informations affiché"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 032f0876-8eb3-421a-bddc-50a550c9bc09
  modified: 2026-08-04T14:01:21.207Z
---

Verbatim utilisateur (2026-08-04, cap du chantier #1078) :
« Mon but c'est toujours le même depuis le début: hamoniser. J'en ai marre que d'un jet a l'autre
les informations affichés changent et s'affichent différament, ou ne suivent pas les mêmes régles
(sauf spécificité du type de jet qui a ses propres régles, mais ca n'impacte normalement pas les
informations qu'on devrait afficher) »

**Why :** les lots #1064 (mods muets) et #1072 (difficulté en chip vs ligne) sont deux instances
de la même maladie — chaque écran compose son affichage librement. Traiter divergence par
divergence est sans fin ; la doctrine inverse la charge : le CONTRAT est premier, les écrans s'y
conforment.

**How to apply :**
- Le chantier #1078 livre d'abord LE SCHÉMA CANONIQUE de l'affichage d'un jet (les informations,
  leur forme, leur emplacement : nature+difficulté sur la ligne, base, chips circonstancielles
  nommées, cible, dé, verdit, influences, opposition/vs, sous-titre, raisons de refus…) — arbitré
  UNE fois avec l'utilisateur, écrit à la charte, porté par les primitives (RollShell/RollLine/
  RollRow/testPending/VsHeader).
- CHAQUE consommateur se mesure contre le contrat : un écart est une NON-CONFORMITÉ à converger
  (pas une préférence à arbitrer au cas par cas). Seule une spécificité MÉCANIQUE du type de jet
  (déclaration multi, table d100, dé fixé…) justifie une EXTENSION — jamais une divergence sur le
  schéma commun.
- Toute nouvelle surface de jet naît DU contrat (composition de primitives) ; une garde de
  conformité verrouille (patron des cliquets existants).
Cf. [[game-rollflow-canonical-system]], [[game-doctrine-declaration-avant-jets-reveles]],
[[feedback-composer-primitives-jamais-markup-brut]].
