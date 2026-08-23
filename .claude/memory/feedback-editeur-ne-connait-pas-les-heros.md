---
name: feedback-editeur-ne-connait-pas-les-heros
description: L'éditeur de scènes n'authore JAMAIS un héros (créé par le joueur avant la partie) — toute donnée « héros X à tel endroit » dans un document est une erreur de plan à refuser
metadata:
  type: feedback
---

Arbitrage utilisateur 2026-08-21 (verbatim) : « Comment on peut imposer au groupe la présence de certains héros qui peuvent avoir été créé par le joueur avant de commencer la partie ... dans l'éditeur ? » et « bah on parle de héros 1, héros 2, héros 3, héros 4 ... ».

**Why:** les héros sont créés par le joueur ; un document de scène / un MapSpec ne peut pas en connaître ni en imposer. Le plan du chantier #1443 (Task 6) portait « héros uniquement si le document fournit un id de héros fixe » — j'ai suivi le plan, construit une mémoire de session de héros, fait deux rounds de juge dessus (fuite inter-document…) avant que l'utilisateur ne pointe l'absurdité. Un plan n'est pas une autorité sur le SENS produit.

**How to apply:** toute donnée authorée qui désigne un héros par IDENTITÉ est refusée à la conception. Pré-asseoir/pré-poster un membre du groupe à l authoring est PERMIS, mais par EMPLACEMENT (« Héros 1..N », liste fixe, rang dans le groupe) — précision user du même jour : « c est par emplacement de heros qu on parle » ; au runtime party[rang-1], un rang sans héros présent s élague au chargement. Avant d'exécuter une clause de plan qui touche le groupe à l'authoring, la confronter à « l'éditeur peut-il connaître ça ? » — sinon la refuser et le dire. Lié : [[feedback-reflechir-avant-de-reagir]], [[feedback-la-carte-decide-le-moteur-suit]].
