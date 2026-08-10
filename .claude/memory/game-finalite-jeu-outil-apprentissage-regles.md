---
name: game-finalite-jeu-outil-apprentissage-regles
description: "FINALITÉ (2026-08-05) : le jeu est aussi un OUTIL D'APPRENTISSAGE des règles (joueur ET MJ) — l'édifice grandit livre par livre par CURATION PURE ; critère du livre N+1 : accueillir les jets/tables d'un nouveau livre sans nouveau code"
metadata: 
  node_type: memory
  type: project
  originSessionId: 032f0876-8eb3-421a-bddc-50a550c9bc09
  modified: 2026-08-05T11:33:19.505Z
---

Énoncé utilisateur (2026-08-05, verbatim, fil #1117) : « C'est aussi utile pour un MJ qui veut apprendre les régles du jeu. Chaque livre ajoute une nouvelle pierre a l'édifice, et demain potentiellement on aura des régles pour naviguer dans le grand froids, avec de nouveaux jets a faire. Donc si je lis les régles du système de navigation, j'aurai de nouvelle entrée sur ces nouveaux jets, les tables avec conséquence, etc ... » — dans le même échange : « Je refuse toute phase d'aide non verbatine », « C'est le premier pas vers la dérive », « Et data driven ».

**Why :** le jeu n'est pas qu'un jeu — c'est une surface d'apprentissage du RAW. Une phrase d'aide rédigée crée une deuxième source de règles (invérifiable par les gardes, c'est ELLE que le joueur apprend) : la dérive n'est pas un risque de style mais une corruption de la base de règles par l'affichage.

**How to apply :**
- Toute « aide » à l'écran = descripteur MÉCANIQUE (faits que le moteur applique, valeurs calculées) et/ou VERBATIM court ; l'aide longue = renvoi Codex vers la fiche verbatim. JAMAIS de phrase d'explication rédigée.
- Contenu d'aide/enjeu en DONNÉE éditable keyée (patron night-stakes.json), jamais en littéral dans un flow.
- Critère du livre N+1 : un nouveau livre (ex. navigation par grand froid) doit entrer par CURATION PURE — fiches verbatim + entrées d'enjeu + tables — zéro nouveau code de surface. Un design qui exige du code pour accueillir les jets d'un nouveau livre est raté.
- Le Codex lu « par système » doit montrer l'édifice complet (jets existants, enjeux, tables de conséquences, chaque pierre taguée à son livre).
Cf. [[game-doctrine-une-entite-n-livres-n-variantes]], [[game-doctrine-contrat-affichage-jet-unique]], [[feedback-descripteur-mecanique-jamais-une-description]], ticket #1117.
