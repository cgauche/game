---
name: user-arbitrage-round0-forme-rt-et-splash-conserve
description: "Arbitrage utilisateur 2026-08-24 (capture RT round 0 fournie) : l'ouverture de combat prend la forme RT — bandeau-message CENTRÉ en haut + bouton « Démarrer le combat » dessous au centre, console basse = MÉDAILLON compact d'un héros (jamais un pont entier, jamais l'ennemi) ; et le splash « COMBAT !/EMBUSCADE ! » est CONSERVÉ (il remplace les cinématiques d'intro que RT a et nous non)"
metadata:
  node_type: memory
  type: user
  originSessionId: 3c1689ae-eeaa-4da2-a83f-c35ecef5c557
  modified: 2026-08-23T21:57:21.945Z
---

Verbatim utilisateur (2026-08-24, avec capture RT du « round 0 » à l'appui — archivée `scratchpad/reference-rt-round0.jpeg` de la session 3c1689ae) : « Ca c'est le round 0 de Rogue Trader. On a peut etre pas le "Combat !", car RT aime mettre des "cinématiques" pour présenter ses combats, mais non on a pas ca donc c'est "Combat !". »

Ce que montre la référence : bandeau vert translucide CENTRÉ en haut de la carte (« Préparez-vous au combat. Mettez vos personnages en position. »), bouton « DÉMARRER LE COMBAT » centré juste dessous ; fantômes de placement verts sur le sol (RT a une phase de déploiement) ; frise de portraits en haut ; console basse réduite à UN médaillon compact (portrait Cassia, 58/58, chips d'objets, deux compteurs 5/3) — aucun pont complet.

**How to apply :** (1) le splash plein écran « COMBAT !/EMBUSCADE ! » (`CombatStartSplash.tsx`) est CONSERVÉ — décision explicite (invention I2 de l'audit RT : validée) ; (2) l'ouverture (`pendingRoundStart`) : message de phase + « Commencer le combat » CENTRÉS en haut de la carte (plus jamais en haut-gauche), console basse en MÉDAILLON compact d'un héros contrôlé — cohérent avec [[user-arbitrage-tour-adverse-console-spectatrice-jamais-pont-entier]] (la forme spectatrice/compacte couvre ouverture ET tours non contrôlés) ; (3) la phase de DÉPLOIEMENT de RT (fantômes verts, repositionnement pré-combat) n'est PAS demandée — à proposer un jour comme feature séparée, pas à improviser.
