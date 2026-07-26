---
name: feedback-la-carte-decide-le-moteur-suit
description: "La fidélité à la planche est l'objectif ; ce que le moteur sait faire n'est jamais une contrainte sur ce que la carte doit être."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 28c99d31-0f31-42bf-b192-e530e82d7635
  modified: 2026-07-25T09:46:12.787Z
---

Arbitrage utilisateur, 2026-07-25, verbatim :

> « M'en fiche s'il l'authorise ou non, l'objectif c'est la carte, le moteur doit suivre »

(contexte : je venais de vérifier que le compilateur autorisait un escalier en L et de présenter ça
comme une bonne nouvelle)

**Why:** l'objectif du chantier est d'intégrer beaucoup de planches de livre en cartes jouables. Le
moteur est un POC au service de cet objectif, pas une contrainte à respecter. Vérifier « est-ce que
le format le permet ? » avant de décider ce que la carte doit être, c'est laisser l'outil dicter le
contenu — et c'est ce qui a produit la carte actuelle de La Diligence, pleine de compromis dont plus
personne ne sait s'ils étaient voulus.

`docs/map-authoring.md` porte déjà la règle (« si un besoin ne s'exprime pas proprement, on étend une
primitive, on ne bricole jamais le scénario ») ; cet arbitrage la renforce et en fait la priorité.

**How to apply:**
- On lit la planche d'abord, on décide ce que la carte doit être, et SEULEMENT ensuite on regarde ce
  que le moteur sait faire. Jamais l'inverse.
- Un besoin de carte que le format n'exprime pas est un **manque du moteur à combler**, jamais une
  raison de modifier la carte. L'agent le REMONTE avec le cas précis ; il ne « trouve pas un
  contournement ».
- Ne présente jamais « le format le permet déjà » comme un résultat positif : c'est neutre. Le seul
  résultat qui compte est la fidélité de la carte.
- Corollaire pour les exports/sérialiseurs : « ça ne fait pas l'aller-retour, je le signale » est une
  réponse insuffisante — on rend l'aller-retour complet.

Voisines : [[game-mapspec-unified-authoring]] ·
[[feedback-fidelite-raw-et-editabilite-non-negociables]] · [[game-existant-poc-refactor-libre]] ·
[[feedback-effet-existant-general-parametrable]]
