---
name: user-arbitrage-tour-adverse-console-spectatrice-jamais-pont-entier
description: "Arbitrage utilisateur 2026-08-24 : pendant le tour de l'ADVERSAIRE (et l'ouverture), on ne voit JAMAIS son pont entier — la console se TRANSFORME en forme spectatrice (patron RT : médaillon rond de l'actif, PV rouges, grille/sets/accès-rapide/fin-de-tour disparaissent) ; supplante « tour adverse = console en LECTURE, mêmes cases inertes » de la spec zone 7"
metadata:
  node_type: memory
  type: user
  originSessionId: 3c1689ae-eeaa-4da2-a83f-c35ecef5c557
  modified: 2026-08-23T21:47:32.913Z
---

Verbatim utilisateur (2026-08-24) : « D'ailleurs même au tour de l'adversaire, pourquoi je vois son pont entier ? Même RT ne fait pas ca » — après la capture d'ouverture où la console rendait portrait, stats, sets et arsenal de l'ennemi Knud Cratinx.

Référence (l'analyse RT du dépôt, `docs/plans/Analyse HUD Rogue Trader.dc.html:330-331`, verbatim) : « Quand l'adversaire joue, la console basse se transforme : le portrait du fronton laisse place à un médaillon rond contenant l'icône de l'arme ennemie, les PV passent en rouge, la grille carrée de capacités devient une rangée de médaillons circulaires, et les alvéoles d'objets, les raccourcis et la plaque de fin de tour disparaissent. […] Le changement de FORME porte le changement d'état : rond = on regarde, carré = on peut cliquer. Rien ne se grise, rien ne se désactive — la console cesse d'être une console. »

**Why :** la spec zone 7 (`2026-08-16-spec-hud-combat.md:457` « tour adverse/autre joueur/auto-combat = console en LECTURE (mêmes cases, inertes) ») avait tranché CONTRE la référence — cas d'école de [[user-doctrine-reference-rt-par-defaut-deviation-validee]] : la déviation n'avait pas de contrainte propre ni de validation. Montrer l'arsenal navigable de l'ennemi est en plus une fuite d'information tactique.

**How to apply :** pendant tout tour NON contrôlé par le joueur local (ennemi, IA, autre siège coop, auto-combat) ET pendant l'ouverture (`pendingRoundStart`, `turn = -1`) : la console rend une FORME SPECTATRICE — médaillon rond de l'actif (portrait, PV en rouge pour un hostile, États), le reste (sets, grille, accès rapide, fin de tour, gouttières d'économie) DISPARAÎT ; la puce « X joue Y » coop reste. Géométrie du pont conservée (la bande ne bouge pas), c'est le CONTENU qui change de forme. Jamais de grisage du pont entier. Le rail/dock du groupe reste au joueur.
