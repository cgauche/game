---
name: feedback-recette-juge-l-ecran-pas-le-mecanisme
description: "Une recette visuelle doit juger l'ÉCRAN ENTIER, jamais le mécanisme qu'on vient de poser — sinon elle certifie « ça marche » sur une image illisible"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 28c99d31-0f31-42bf-b192-e530e82d7635
  modified: 2026-07-28T23:13:34.083Z
---

Un brief de recette qui demande « est-ce que le héros est visible ? » ou « est-ce que le dégagement
se lit comme un geste voulu ? » pose une question de **mécanisme**. L'agent y répond — et rend un
verdict positif sur un écran que l'utilisateur trouve inregardable.

Vécu 2026-07-29 (#907). Le recetteur a validé « l'opacité fonctionne » et écrit « ça ressemble à un
jeu vidéo ». L'utilisateur, en lui parlant directement, décrit le MÊME écran : sous le tunnel qui
passe sous le premier étage, on voit à la fois les toits, les dalles du 1er, les dalles du rez,
certains murs du 1er, parfois ceux du rez — « tout ca sans aucune logique, comme si on voyait a
travers certains murs, le tout mélangé avec des éléments transparant ou absent ».

Verbatim de l'utilisateur : « ton agent recetteur s'est limité a vérifié que l'opacité fonctionne
sans jamais vérifier que le résultat final soit bon ou pas. J'ai du lui dire ce qui n'allait pas
pour qu'il réalise le problème. »

**Why** : un mécanisme qui marche isolément peut dégrader l'image d'ensemble. Une recette qui vise
le mécanisme est structurellement aveugle à ça — elle mesure ce qu'on vient d'écrire, pas ce que le
joueur voit. C'est la version visuelle du test qui verrouille son implémentation au lieu du contrat.

**How to apply** : le brief de recette visuelle demande à l'agent d'ÉNUMÉRER tout ce qu'il voit à
l'écran, calque par calque, et de dire ce que CHAQUE chose est censée être — puis de juger si
l'ensemble obéit à une règle qu'un joueur pourrait deviner. Jamais « est-ce que X marche ». Le
verdict attendu est « un joueur comprend-il ce qu'il regarde », et une seule position ne suffit
jamais : le cas qui tranche est celui où PLUSIEURS choses se recouvrent (sous un porche, sous une
dalle d'étage, en lisière de bâtiment) — pas celui où un seul élément couvre le sujet.

Corollaire : ne jamais relayer un « ça ressemble à un jeu » sans avoir REGARDÉ la capture soi-même.
Voir [[feedback-rendu-ui-sans-preuve-navigateur-refuse.md]] et [[feedback-recette-joueur-rpg-persona]].
