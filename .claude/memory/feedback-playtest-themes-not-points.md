---
name: feedback-playtest-themes-not-points
description: "Retours playtest = THÈMES à traiter en lot, pas des points isolés ; chaque retour = symptôme cachant un cluster"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e8da4937-e7c9-443e-bf71-432062e78922
---

L'utilisateur, sur les retours playtest du combat : « On ne peut pas traiter les points individuellement. Les retours du joueur remontent juste ce qu'il ressent sur le moment mais cachent souvent d'autres problèmes qui doivent être gérés avec. » puis « C'est plus des thèmes sur lesquels il faut agir » — ex : « début de combat » = en fait TOUT le tempo/lisibilité du combat ; les retours « quelle arme / estimation dégâts / qui est qui / valeurs incomprises » = la même facette « lisibilité ».

Précision (mêmes retours) : « Et sûrement plein d'autres choses, c'est incomplet » + « Faut réfléchir jeu tactique » → la liste du joueur n'est PAS le cahier des charges, juste des exemples-germes. Auditer TOUT le combat contre les standards du genre (jeu tactique tour-par-tour, école « information parfaite » à la Into the Breach/XCOM, héritage NWN/BG) : information parfaite / preview d'issue (chances de toucher, fourchette de dégâts, effets décomposés ET sourcés), télégraphe de la menace, lisibilité positionnelle (engagement/zones de contrôle, couvert, LdV, bandes de portée, empreintes), clarté de l'économie d'action, feedback cause→effet (« juice »), lisibilité de l'état, agency & garde-fous, cohérence inter-modes. Trouver proactivement ce que le joueur n'a pas su nommer.

**Why:** chaque retour est la pointe d'un iceberg ; corriger le symptôme isolé laisse les bugs / manques RAW / pièges UX adjacents en place et donne une fausse impression de « réglé ».
**How to apply:** regrouper les retours en THÈMES (ex thème « on ne comprend pas le combat » = tempo/ouverture + rendu du mouvement + lisibilité attaque/défense + file de modales). Pour chaque thème : d'abord CARTOGRAPHIER le flux réel (code `file:line` + RAW `LDB l.x`, ne rien inventer) et sortir le cluster complet, puis façonner le redesign AVEC l'utilisateur, puis corriger en LOT. Ne jamais livrer un fix isolé sans avoir scanné son cluster. Prolonge [[game-playtest-feedback-lots]] et [[feedback-source-user-claims]].
