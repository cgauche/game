> ⚠️ **ARCHIVE (2026-07-05)** — document DATÉ : constat/plan d'époque, ne décrit PAS l'état courant du code.
> Conservé pour l'historique du raisonnement. Ne JAMAIS s'appuyer dessus pour juger l'architecture ou l'état actuel.

# Audit « POC → produit » des modules récents (Phase 0 — 2026-06-11)

Recette navigateur (Playwright headless + `window.__wfrp`, dev server, hard-reload avant chaque
module) sur les scénarios de test dédiés. Sévérités : **B** bloquant (injouable), **M** majeur
(friction forte / incohérence), **m** mineur. Chaque défaut B/M est coché quand corrigé, ou
explicitement reporté avec justification.

## Synthèse

| Module | Verdict | Défauts B | Défauts M |
|---|---|---|---|
| Interlude/Activités | **POC — injouable en partie** → corrigé Lot 1 | 3 | 3 |
| Voyage & Carte du monde | Produit proche — restitution faible → corrigé Lot 2 | 0 | 2 |
| Marchand | **Produit** (responsive 360 vérifié) | 0 | 0 |
| Magie en combat (zones/ciblage) | Produit proche | 0 | 1 |
| Corruption/mutations | Produit proche | 0 | 1 |
| Sauvegarde/Chargement | **Produit** (aller-retour vérifié) | 0 | 0 |
| Coop × nouveaux flux | Handshake/miroir OK — propriété non gérée hors combat → corrigé Lot 4 (+B4 général) | 1 | 2 |
| Éditeur (effets récents/Monde) | Champs à id libre incohérents avec l'existant → corrigé Lot 5 | 0 | 1 |

0 erreur console sur TOUS les parcours déroulés (menu, interlude, voyage+embuscade+reprise,
marchand, combat magie, corruption, mutations, save/load, coop 2 clients, éditeur).

## Interlude / Activités (`16-interlude`)

Parcours : cercle → bourse +30 CO → événements d100 par héros → écran.

- [x] **B1 — Artisanat à saisie texte libre du nom EXACT.** *(corrigé Lot 1 : sélecteur catalogue `craftCatalog`)* « épée » ET « Épée » → « Équipement
  inconnu » (l'objet n'existe pas sous ce nom : la base dit « Arme simple », « Épée bâtarde »…).
  Sans la base sous les yeux, l'Activité est inutilisable. → sélecteur catalogue (filtré par la
  Compétence Métier, coût matériaux ¼ affiché AVANT, atouts/défauts expliqués).
- [x] **B2 — Apprentissage particulier idem** *(corrigé Lot 1 : `learnableTalents`)* : « chanceux » → « Talent inconnu » (`findTalent`
  est sensible à la casse, et il faut connaître les 175 libellés). → sélecteur de talents hors
  carrière avec coût PX + fourchette tuteur visibles.
- [x] **B3 — Passer commande idem** *(corrigé Lot 1 : `orderCatalog`)* (libellé exact d'un objet Exotique à deviner). → catalogue
  restreint Exotique/ND avec prix.
- [x] **M1 — Aucune phase « Événements »** *(corrigé Lot 1 : phase d'intro racontée)* : les d100 sont appliqués en silence à l'ouverture
  (seul le journal en garde trace) ; l'écran affiche le résultat sans le raconter. → séquencer
  (révélation par héros → activités → clôture récapitulative).
- [x] **M2 — Banque opaque** *(corrigé Lot 1 : volet Banque avec ¼/½/Tout + préviews)* : montant en pistoles dans un input nu, gains/risques en tooltip
  seulement, dépôts listés comme boutons bruts. → panneau par héros (bourse visible, ¼/½/tout,
  aperçu intérêts/risque).
- [x] **M3 — Clôture sèche** *(corrigé Lot 1 : modale récapitulative confirmée)* : « Clore l'interlude » dilapide TOUTE la bourse sans confirmation
  ni récapitulatif (argent perdu / Revenus crédités / commandes en cours).
- [x] m — Écran « Chargement… » nu pendant le lazy-load du chunk (transition brute). *(corrigé
  Lot 1 : fallback de chargement charté `.lazy-fallback` dans App.tsx)*

Moteur `state/interludeFlow.ts` : conforme à sa spec (RAW LDB 22-23 cité), conservé.

## Voyage & Carte du monde (`16-voyage`)

Parcours : carte → Federholz à pied (24 km) → péripétie d'auteur (90 %) → embuscade gobeline →
victoire → carte « attention » → Reprendre → arrivée. Tout fonctionne, 0 erreur.

- [x] **M4 — Restitution du trajet quasi nulle** *(corrigé Lot 2 : `TravelRecap` + modale jour par jour à l'arrivée/interruption/surcharge)* : « Partir » téléporte (la journée de 6 h est
  résolue en synchrone) ; fatigue, faim, péripéties, nuits ne sont visibles que dans le tiroir
  journal. À l'interruption, on apparaît au milieu d'un sous-bois sans bandeau de contexte. →
  récapitulatif de voyage (jour par jour) à l'arrivée ET à l'interruption.
- [x] **M5 — Pas d'enchaînement multi-étapes** *(corrigé Lot 2 : « Continuer le voyage » ré-ouvre la carte à l'arrivée)* : la carte explique « voyagez d'étape en étape »
  mais n'offre ni file de routes ni ré-ouverture à l'étape. → ré-ouvrir la carte à l'arrivée
  (option « continuer vers… »).
- [x] m — L'estimation n'affiche les rations que si days > 1 — correct (les nuits mangent) mais
  un trajet d'un jour plein mérite l'info « arrivée à la nuit ». *(couvert par le récapitulatif
  M4 : la ligne d'arrivée porte l'heure via l'horloge.)*

`WorldMapView` (parchemin, médaillons, routes courbes) : qualité produit, conservé tel quel.

## Marchand (`10-marchand`) — RAS

Tabs Acheter/Vendre/Réparer, familles, dispo ×N, stats comparées, prix barrés au Marchandage,
« Ajouter » désactivé si bourse insuffisante, **360px nickel**. Aucune action.

## Magie en combat (`14-magie-jalon2`)

Liste de sorts riche (NI, portée, durée, cible), ciblage ZdE par case (gabarit de portée),
modale d'incantation opposée complète. Peur multi-sources (2 zombies) : tests étendus par
source conformes, PAS de soft-lock (le « Fin du tour » sans avoir agi exige 2 clics — voulu).

- [x] **M6 — Modale Corruption sans pré-jet** *(corrigé Lot 1 : pré-jet réel sur Corruption ET Activité — même défaut)* : « Test de Résistance **0 = 0** » avant le jet
  (`pc.target` n'existe qu'après `resolve`). Le pré-jet (parité des 11 flux, commit 0718b2f)
  n'a pas été branché sur ce flux. → afficher `testValue(hero, pc.skill)` avant le jet.

## Corruption / mutations (`17-mutations`)

Influence corruptrice (zone) → modale → gain de Points : OK. 19 mutations visibles aux rigs
des 4 héros : OK. Cf. M6 (pré-jet).

## Sauvegarde / Chargement (Arène) — RAS

3 slots + export/import, save en exploration seulement (voulu), aller-retour vérifié
(bourse/horloge/scène restaurées, l'état postérieur à la save bien écarté). Le snapshot
zéro-maintenance couvre les clés récentes (`travelPlan`, `interlude`, `bank`, `pendingOrders`)
par construction.

## Coop × nouveaux flux (2 clients)

Handshake par codes : OK. Composition partagée (slot attribué à l'invité, il le remplit,
4/4, lancement) : OK. Interlude démarré chez l'hôte → l'invité bascule et voit tout : OK.

- [x] **M7 — Aucune propriété sur l'écran d'interlude** *(corrigé Lot 4 : possession par héros — `INTERLUDE_INTENTS` + `intentAllowedFor` par heroId/dépôt, UI verrouillée 🎮, clôture hôte seul)* : l'invité voit TOUTES les activités de
  TOUS les héros actives, ET « Clore l'interlude ». → griser les activités des héros qu'on ne
  possède pas (`net.ownership`, même règle que les modales de combat) ; « Clore » = hôte seul.
- [x] **M8 — `pendingActivity` absent de l'arbitre de modales** *(corrigé Lot 4 : entrée `activity` au registre + ActiveModal dans l'écran — le propriétaire joue, les autres voient « X joue… »)* (`modalArbiter.MODAL_DEFS`) :
  la modale de jet d'Activité s'affiche chez TOUS les clients sans propriétaire (double-roll
  possible). → l'ajouter avec `owner = heroId` (comme `psych`).
- [x] m — `worldMapOpen`/voyage : le bouton 🗺️ est rendu chez l'invité ; départ de voyage non
  gaté. *(corrigé Lot 4 : carte en lecture seule chez l'invité — « L'hôte décide des départs ».)*

- [x] **B4 — (découvert au Lot 4) Tout « Appliquer » d'invité était MUET** : `onClick={onConfirm}`
  (RollFlowShell) passait l'événement React en argument ; côté invité l'intent est sérialisé en
  JSON → structure circulaire → l'intent était PERDU sans erreur. Touchait TOUTES les modales de
  jet coop, pas que l'interlude. *(corrigé : `() => onConfirm()` + `sanitizeIntentArgs` à la
  frontière réseau — défense en profondeur testée.)*

## Éditeur — effets récents & Monde

Onglet Monde présent (lieux/routes), modale « Enregistrer » (bibliothèque + publication).

- [x] **M9 — Champs à id libre incohérents** *(corrigé Lot 5 : selects guidés — sorts en optgroups, scènes du projet + points d'entrée, entités marchandes de la scène ; `effectCtxOf` plombé dans Triggers/Dialogues/Rencontres/Inspecteur/Monde ; `heroId` optionnel reste libre — la composition du groupe n'est connue qu'au lancement)* : `learnSpell` (« Libellé exact du sort
  (spells.json) » !), `heroId` (×3 effets), `openMerchant.entityId`, `transition.scene` sont des
  inputs texte, alors que `startCombat`/`startDialogue` ont déjà des selects alimentés par le
  contexte. → selects (sorts de la base, héros du groupe-type, entités marchandes de la scène,
  scènes du projet).

## Hors défauts — décisions d'audit

- La Peur par source (re-tests par Round, cumul DR par source) est conforme au module
  Psychologie audité au Jalon 1.8 — pas touché.
- Le double-clic « Finir quand même ? » (Action non dépensée) est une affordance voulue — pas touché.
