---
name: game-repos-infirmerie-modales
description: "Infirmerie (soins persistante) + modale de Repos (nuit unifiée, multi-jets) LIVRÉES 2026-06-12 — arbitrages + architecture + reste recette"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2f265bd5-1a77-44c8-8e11-cfad57e904d5
---

Deux refontes « POC → produit » livrées 2026-06-12 (suite verte 3047) :

**INFIRMERIE (9a68414)** — `state/medicFlow.ts` + `MedicModal` : UNE modale persistante (patients en tuiles full → dossier d'actes → zone de jet `RollFlowShell embedded`). Chirurgie « ARMÉE » sur `medic.surgery` (soigneur figé, passes instantanées DrBar) ; Bander/Hémorragie = actes normaux à jet complet entre les passes (le verrou 1/rencontre s'applique désormais — RAW). Effet `medicalAid` étendu : `acts[{act, cost}]` tarifés À L'ACTE (LDB 75), débit au clic, remboursé si annulé avant le jet (`pendingHeal.paidCost`) ; legacy `act` simple ≡ liste à 1. `healAlly`/`healSetTarget`/`surgery*` SUPPRIMÉS ; fiche = un bouton « 🩺 Soins ». Combat inchangé (ActionBar). Garde-fou « un jet = une modale » scanne AUSSI medicFlow (`moduleActions`).

**REPOS (11f1c2d)** — `state/restFlow.ts` + `RestModal` : nuit en 2 phases — réglages PAR HÉROS (couchage × pitance ORTHOGONAUX : manger à l'auberge et dormir dehors OK ; coût RAW ch.66 p.304 : commune 10 sc, privée 10 pa pour 2 regroupées auto, repas 1 pa ; piètre = ½ + Courante 10 %), puis BILAN globalisé via **`MultiRollList`** (brique multi-jets RÉUTILISABLE — l'utilisateur veut la même pour les fins de Round) + temps écoulé affiché. `sleepParty` = SOURCE UNIQUE de la nuit (restPartyOvernight SUPPRIMÉ ; interlude/triche/voyage dessus). Exposition (`engine/exposure.ts`, LDB 18 l.408-415) : météo de scène → sévérité (pluie/neige=difficile 2 Tests, tempête=extrême 4) ; Tente OU Test de Survie = abri ; sans Manteau/Cape −10 (application déclarée). VOYAGE : chaque nuit = HALTE modale (auberge si `MapRoute.inns`), « Continuer » reprend (`continueTravelAfterNight`, récap via `travelPlan.recapDays`). Offre PARAMÉTRABLE PAR ZONE : `Scene.rest` + `Scene.restZones[]` (rect prioritaire), bouton 🌙 d'exploration (`restPlacesHere`). Brouet OK (auto via dailyFoodUpkeep).

**Arbitrages utilisateur** : bilan = modale globalisée multi-jets (PAS une modale par jet, pas de Chance dessus) ; camp libre avec temps visible + zones éditeur ; piètre inclus ; coop chacun-ses-héros + ready-check ; veille médicale = abstraction (RAW l.239 « journée complète aux bons soins » — AUCUNE contrainte de couchage commun, rien d'inventé).

**Reste** : recette navigateur (HUD + infirmerie + repos + voyage), bug rapporté « bouton diligence jamais cliquable » NON reproduit au moteur (test vert) — title des raisons ajouté, à re-tester en jeu ; arène : auberge encore en effet legacy (rest sans lodging) ; exposition pendant le VOYAGE utilise la météo de la scène de départ (approximation).
