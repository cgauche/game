---
name: user-doctrine-campagne-jamais-generee-par-script
description: "2026-08-31 : une CAMPAGNE générée par script = ÉNORME DÉFAUT (aucune modification possible à l'éditeur) — l'éditeur est le propriétaire du contenu de campagne, un générateur ne se justifie que pour du contenu CALCULÉ"
metadata: 
  node_type: memory
  type: user
  originSessionId: 7fa03aff-afd5-481d-b04f-f8c0892b5ff1
  modified: 2026-08-31T09:49:05.608Z
---

Verbatim utilisateur (2026-08-31, arbitrage design #684) : « la diligence a été créé principalement pour s'assurer que le moteur sache construire ce batiment. Mais en définitive, une campagne doit pouvoir etre modifié depuis l'éditeur, et donc si la campagne est généré par un script, c'est un énorme défaut, car ca veux dire qu'aucune modification n'est possible. »

**Why :** la garde byte-stable (`src/scenes/generateurs-byte-stables.test.ts`, #1522) fait du générateur le PROPRIÉTAIRE exclusif du paquet : toute édition studio est écrasée/refusée à l'octet. C'est l'anti-thèse de la règle 2 (« tout le contenu de campagne est éditable dans l'éditeur »). La diligence était une preuve MOTEUR (construction de bâtiment), pas un patron d'authoring.

**How to apply :**
1. JAMAIS de `scripts/<campagne>/generate.mjs` pour un projet de campagne — le contenu se pose à l'éditeur, le paquet est MANUSCRIT (liste `MANUSCRITS` de la garde).
2. Un générateur ne se justifie que pour du contenu CALCULÉ non authorable à la main (rangées ASCII de mer, postes dérivés — l'exemple barge-du-sel), et ce statut est lui-même un DÉFAUT pour une campagne jouable : `barge-du-sel` et `loup-et-saumure` sont sous cette doctrine des défauts à statuer (ticket ouvert le 2026-08-31).
3. « Enrichir un JSON manuscrit par script » est structurellement interdit (la garde exige que build() possède 100 % de la donnée) — c'est l'un OU l'autre, et pour une campagne c'est l'éditeur.
4. Voir [[game-campagne-json-portable-frontiere-reference-narratif]], [[feedback-toute-donnee-de-scene-editable-sans-ia]].
