---
name: user-arbitrage-stations-a-bord-deux-rosters-empiles
description: "Arbitrage utilisateur 2026-09-04 (AskUserQuestion, maquette B3-2b #1657) : la STATION à bord (pont/gréement/avirons/cale, catalogue fermé nommé par le livre) s'épingle dans un SECOND PostesRoster « Stations à bord » empilé sous « Postes d'équipage » au volet d'appareillage (mode mer) — même surface, même primitive, zéro composant neuf ; défaut authoré par rôle (maison), épinglage joueur par-dessus"
metadata:
  type: user
---

**Verbatim (2026-09-04, option retenue à la question « Maquette B3-2b : où et comment le joueur épingle-t-il la STATION à bord … »)** : « Deux rosters empilés (Recommandé) » — maquette validée :

```
┌ Postes d'équipage ─────────────────────┐
│ Capitaine   [Berta ▾]   Timonier [Otto ▾]│
│ Vigie       [Lise  ▾]   Mousse   [Gunnar▾]│
└────────────────────────────────────────┘
┌ Stations à bord ───────────────────────┐
│ Pont     [Berta, Otto ▾]                 │
│ Gréement [Lise ▾]                        │
│ Avirons  [Gunnar ▾]                      │
│ Cale     [— ▾]   (navire sans cale : ∅)  │
└────────────────────────────────────────┘
```

Options écartées : onglets Postes | Stations (`Tabs` sub) ; un roster par HÉROS (Poste + Station sur la ligne, extension de `PostesRoster` à mesurer).

**Comment appliquer :** `ShipStationsPanel` = jumeau de `ShipRolesPanel` (`PostesRoster`, `stationAsPoste`, `setShipStation`), rendu sous `ShipRolesPanel` dans `WorldMapView` mode mer ; la ligne « Cale » d'un navire sans cale se dit vide (jamais masquée en silence). Le mécanisme (cible = station STRICTE, jamais déduite) vient du design jugé #1657 issuecomment-5520816290 ; ce fiche ne fige que le GOÛT de l'écran ([[feedback-ecran-neuf-maquette-validee-avant-code]]).

**Complément 2026-09-04 (recette B3-2b-b)** : l'écran réel est « un héros par ligne » (surface de `PostesRoster` existante) ; l'ASCII station-first de la maquette était une approximation de l'orchestrateur. À la question « conforme ? » l'utilisateur a répondu « Qu'est ce qu'il vaut mieux ? » — recommandation donnée : une station par ligne (« qui est où », stations vides visibles, forme des postes d'officiers de Rogue Trader, `Poste.cardinality:'slotFilling'`), comme changement de la PRIMITIVE (3 écrans), maquetté avant code, en train dédié ; B3-2b-b posé tel quel d'ici là. **Décision utilisateur (2026-09-04, AskUserQuestion, option retenue verbatim : « Poser B3-2b-b, puis train « une station/poste par ligne » (Recommandé) »)** : B3-2b-b se pose tel quel (case vide sans mot) ; puis un train DÉDIÉ fait passer la PRIMITIVE `PostesRoster` à « un poste par ligne, des portraits dans la case, [ + ] pour ajouter, poste fermé grisé avec raison au survol » sur les 3 écrans (Postes d'équipage, rôles de marche, Stations à bord), maquette soumise avant code, séquencé AVANT #1508. Case vide : « Non, case vide sans mot » ([[user-arbitrage-case-vide-sans-mot-libre]]).
