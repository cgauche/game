---
name: user-doctrine-etat-de-lart-avant-invention
description: "Doctrine user 2026-08-16 : pour les questions de rendu/moteur déjà résolues par l'industrie, instruire l'ÉTAT DE L'ART avant d'inventer ou d'arbitrer entre solutions internes."
metadata:
  type: feedback
---

**Verbatim (2026-08-16, arbitrage L3 dégagement, #1176)** : « Nouveau moteur, on peut se poser maintenant les vrais questions. Ce n'est pas le premier moteur 3D jamais créé avec ce type de vue, ces questions ont deja leurs solutions non ? »

**Why** : je lui avais présenté un choix entre deux demi-solutions internes (lever le bâtiment entier vs silhouette nue) alors que l'occlusion caméra en vue tactique est un problème RÉSOLU (dissolution locale, murs abaissés côté caméra, peeling d'étage — BG3/DOS2/XCOM). Le prototype naïf avait déjà mesuré l'échec de la silhouette nue (héros illisible sur mer de tuiles). L'invention interne AVANT l'état de l'art fait perdre un cycle et produit des faux dilemmes.

**How to apply** : pour toute question de DESIGN DE RENDU/MOTEUR dont le genre a des précédents (occlusion, caméra, LOD, picking, éclairage tactique…), la chaîne est : (1) étude d'état de l'art (jeux comparables, technique précise, cas limites, coût sur NOS acquis) ; (2) design jugé DEPUIS ces solutions ; (3) arbitrage utilisateur sur pièces. Ne jamais présenter un dilemme entre solutions maison sans avoir instruit ce que font les moteurs matures. S'articule avec [[user-doctrine-nouveau-moteur-liberer-le-produit]] (refaire MIEUX = aussi regarder comment les meilleurs font).
