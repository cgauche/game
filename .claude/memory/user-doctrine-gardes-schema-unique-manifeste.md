---
name: user-doctrine-gardes-schema-unique-manifeste
description: "Une garde n'existe que DÉCLARÉE dans son propre fichier, selon un schéma unique, et elle GATE ; la doc des gardes se génère par extraction"
metadata:
  type: user
---

**Verbatim (2026-08-23)** : « C'est triste d'avoir 4 facon de répondre au même besoin ? » puis « C'est un besoin global de s'assurer que tous ces éléments soient documentés et suivant un schéma unique. Triste qu'il soit possible de faire un peu n'importe quoi aujourd'hui ».

**Why :** plusieurs machineries pour la même question, c'est autant de façons de diverger et rien qui dise ce que chaque garde couvre ; et une garde qui MESURE sans GATER fabrique du silence — pire qu'aucune garde, car elle donne l'illusion de la couverture.

**How to apply :** toute garde porte dans SON fichier un en-tête structuré (question posée A→B→C, primitive employée, périmètre mesuré, angle mort, baseline avec `decroissant` et sa raison, ticket) et se termine par un verdict qui GATE — un rapport écrit par une garde n'est lu par personne, seule une sortie non nulle force la lecture : le vérifier avant de croire une garde ; la doc des gardes se GÉNÈRE par extraction de ces en-têtes et un fichier reconnu comme garde sans en-tête est rouge ; jamais un manifeste de gardes parallèle ; une indirection qui « exige des types » est une couture manquante à créer, pas une exception à tolérer.
