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

**Maquette du roster par poste VALIDÉE (2026-09-04 nuit, AskUserQuestion, option retenue verbatim : « A — toutes les lignes + banc « Sans poste » (Recommandé) »)** : chaque poste du catalogue sur sa ligne (ordre du catalogue, rien ne glisse), `[ libellé ⓘ ] [👤][👤][ + ]`, postes fermés visibles et éteints avec raison au survol, `[+]` = panneau ancré borné aux héros disponibles, portrait épinglé → clic détache, portrait « auto » (déduit) → clic épingle, marqueur « auto » sur le portrait (jamais dans le nom), banc final « Sans poste » / « Sans station » pour les héros sur aucune ligne. Écartées : B (sans banc — un héros sans poste déduit devient invisible), C (postes vides repliés sous un compteur — dévie de la maquette). Vaut pour les 3 écrans (Postes d'équipage, rôles de marche, Stations à bord) dans le MÊME commit. Design jugé : `C:\Users\gauch\.claude\jobs\31780a2a\tmp\design-postes-roster-v1.md`.

**Rappel utilisateur (2026-09-04 nuit, verbatim)** : « J'étais presque sure qu'on avait un écran du genre quand on clique sur le portrait d'un bateau, mais je me trompe peut etre » — VRAI : le dossier de navire `PosteSheet` (clic sur le portrait, `CampaignView.tsx:420`) porte l'onglet « Rôles · manœuvre » = `ShipCrewByRole` (`ShipSheet.tsx:133`), roster PAR RÔLE bâti sur la primitive partagée `AssignRow` (aussi `MassBattleView`). Leçon : la primitive poste-first EXISTAIT ; le train « PostesRoster par poste » COMPOSE `AssignRow` et ABSORBE `ShipCrewByRole` (un seul roster de rôles d'équipage, 4 écrans) ; deux inférences divergentes pour `shipRole` (`defaultCrewRole` carte vs `shipDefaultRoles` dossier) à unifier sur mesure ([[user-doctrine-ui-coherente-par-primitives-comme-les-donnees]] : inventaire par CONCEPT d'UI avant tout design d'écran).

**Décision (2026-09-04 nuit, AskUserQuestion, option retenue verbatim : « Épinglé seul + « Repos » explicite (Recommandé) »)** — roster de postes d'équipage UNIQUE (carte du monde ET dossier de navire) : n'affiche QUE ce que le joueur a ÉPINGLÉ (comme les Stations) ; les non-épinglés vont au banc « À la discrétion du Test » (le Test d'équipage les place selon SON type, ★ comprise, et le montre dans sa modale — `shipDefaultRoles` reste la SEULE source de résolution) ; une ligne « Repos » épinglable remplace la valeur cachée `repos` (`BENCHED`) ; « retirer » = désépingler (retour au banc, rien ne saute) ; aucun marqueur « auto » ; `defaultCrewRole` (devinette par compétence, affichage seul, divergente de la résolution) MEURT. Écartées : déduction « manœuvre » affichée (vraie pour 1 Test sur 10), devinette par compétence.

**Verbatim (2026-09-05, à la question « montrer la déduction pour les rôles de marche ? »)** : « J'ai du mal a comprendre. Le role de marche comme les postes et les activités, que ce soit terrestres, fluvial, maritime, tout ca c'est le même système non ? Pourquoi ca ne marche pas pareil ? » → RÈGLE UNIQUE sur les 3 rosters (équipage, marche, stations) et les 4 écrans : le roster montre l'ÉPINGLÉ seul, le reste au banc, le jeu affiche sa déduction au moment où il la joue (modale de Test d'équipage, cascade d'Étape). Aucune exception par écran. La divergence des deux moteurs de déduction (équipage : par TYPE de Test, `shipDefaultRoles` ; marche : par héros, `defaultTravelRole`) est un fait MOTEUR, inventorié à #1689 comme candidate à unification, jamais une raison de faire diverger l'interface.
