---
name: game-garde-exemption-au-site-jamais-au-fichier
description: "Une garde ne vaut que par sa COUVERTURE : exemption au SITE (jamais au fichier), détection d'une FORME (jamais d'un nom), vérité dérivée du CATALOGUE (jamais d'une liste)"
metadata:
  node_type: memory
  type: project
---

Doctrine utilisateur (2026-07-27, verbatim) : « avoir des listes qui doivent dinimuner avec le temps, c'est un truc pour dire "c'est fait, on en parle plus", et au final on a juste une liste d'exception qui empoisonne et qu'on maintient a jamais. On l'a vu en plus, les agents le contournaient » — et : « Quand on voit une anomalie, on s'assure qu'il n'y en a pas d'autres ».

**Why:** l'exemption posée sur un FICHIER blanchit tout ce qu'il contiendra ; une garde qui cherche un NOM se contourne en renommant ; une garde qui ÉNUMÈRE les cas connus ne prouve que les cas connus.

**How to apply:** une exemption se pose au SITE et porte un test committé qui prouve sa légitimité — jamais un commentaire ni une liste de fichiers. Une garde détecte une FORME (structure AST) et dérive sa vérité du CATALOGUE (itérer chaque def, aucune allowlist) ; toute preuve par mutation emploie un cas délibérément MAL NOMMÉ. Une garde neuve se juge sur « le cas fondateur réintroduit la fait-il rougir ? » — sinon, ajouter un second signal de FORME ou de CONTENU, ou ÉCRIRE sa limite de portée, jamais la taire.
