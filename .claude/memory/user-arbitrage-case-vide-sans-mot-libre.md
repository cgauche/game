---
name: user-arbitrage-case-vide-sans-mot-libre
description: "Arbitrage utilisateur 2026-08-24 : une case de capacité VIDE ne porte JAMAIS le mot « LIBRE » (aucune interface, RT compris, ne fait ça) — c'est une alvéole creuse discrète ; supplante les « cases vides dessinées LIBRE » de la planche/spec HUD"
metadata:
  node_type: memory
  type: user
  originSessionId: 3c1689ae-eeaa-4da2-a83f-c35ecef5c557
  modified: 2026-08-23T21:18:56.501Z
---

Verbatim utilisateur (2026-08-24) : « Et je ne connais aucune interface, même pas Rogue Trader, qui dans les emplacement de capacité met "Libre" ».

**Why :** la planche/spec HUD (`docs/plans/2026-08-16-spec-hud-combat.md:206-210` « cases vides dessinées "LIBRE" ») était un artefact d'ANNOTATION de maquette passé tel quel dans le rendu (`CombatConsole.tsx:111`) sans validation d'écran ([[feedback-ecran-de-gout-validation-user-avant-commit]]). L'état de l'art (hotbars MMO/CRPG, Rogue Trader) : un slot vide est un CREUX visuel (fond en retrait, liseré discret), reconnaissable sans texte ; le mot n'apparaît au mieux qu'en mode ÉDITION/drag (« déposez ici »).

**How to apply :** case vide = alvéole creuse muette (aucun libellé) ; l'affordance de placement (chantier pages I/II/III + placement libre, #1434) ne montre un texte d'aide QUE pendant le geste de placement/édition, jamais au repos. Vaut pour la grille, la rangée LIBRE, l'ACCÈS RAPIDE. Voir [[user-arbitrage-raison-de-refus-au-survol-jamais-inline]] — même famille : la spec est un plan daté, le goût se valide à l'écran.

**Extension (2026-09-04, AskUserQuestion sur l'écran « Stations à bord », option retenue verbatim : « Non, case vide sans mot »)** : une case de SÉLECTEUR non renseignée (station non épinglée, rôle sans inférence dans `PostesRoster`) n'affiche AUCUN mot (« — choisir — » refusé), même règle que l'emplacement de capacité vide. À appliquer DANS la primitive `PostesRoster`/`OptionChooser`, jamais au site.
