---
name: user-arbitrage-survol-rt-strict-refus-au-clic
description: "Arbitrage utilisateur 2026-08-24 (AskUserQuestion, option « RT strict ») : le survol d'un ennemi n'affiche la carte de jet QU'À PORTÉE ; hors d'atteinte/case non peinte = RIEN au survol — le refus ne se dit qu'AU CLIC ; aucun verbe de manœuvre dans la carte"
metadata: 
  node_type: memory
  type: user
  originSessionId: 3c1689ae-eeaa-4da2-a83f-c35ecef5c557
  modified: 2026-08-24T09:58:43.462Z
---

Déclencheur verbatim (2026-08-24) : « c'est mettre sa souris sur des cases non higtlighté ou sur des ennemies, ca te met un message genre "Charger marchin", c'est quoi ce délire ? Y'a des jeux qui font ca ? Dans RT, mettre sa souris sur un ennemi ou une case hors porté ca n'affiche rien de particulier ». Option retenue (assertion validée) : « Ennemi À PORTÉE de l'arme : carte de jet au pion (nom, valeur à battre, dégâts — déjà en place), SANS verbe de manœuvre. Ennemi hors d'atteinte ou case non peinte : RIEN au survol — le refus ne se dit qu'au clic (arbitrage 2026-08-19 « refus au point du geste »). La Charge redevient un geste qu'on arme (comme la Course). »

Ce qui était visé : le chip d'erreur au survol « Hors de portée — armez la Charge » (`useHoverTargeting.ts:59`) et la note-verbe « Charge (+1 Avantage) »/« Rejoindre + attaquer » de la carte (`targetingModes.ts:351`). La carte de jet au survol d'une cible VALIDE reste (RT l'a — analyse : « pourcentage de réussite, fourchette de dégâts, barre de PV, nom, au-dessus du pion »).

**How to apply :** tout refus (`kind: 'invalid'`) est MUET au survol — il se rend au CLIC par le mécanisme `refus` existant ; la carte info ne porte plus de verbe de manœuvre ; « Charge à armer » était déjà le modèle (`targetingModes.ts:323`), seul l'AFFICHAGE change. Cohérent avec [[user-doctrine-reference-rt-par-defaut-deviation-validee]] et l'arbitrage [[game-arbitrage-modele-gestes-2026-08-19]] (« refus visible AU POINT DU GESTE » — le survol n'est pas un geste).
