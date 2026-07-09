# Pilotage — attendu naval #211 vs code réel (2026-07-09 soir, HEAD ~8f1ef63c)

> Rapport daté (politique docs/plans). Triple jointure attendu ↔ issues ↔ code, vérifiée au code
> (pas au grand livre seul). Document de pilotage des rondes restantes du programme. Sera supprimé
> une fois le programme exécuté (git porte l'historique).

## Constat de cadrage
Le moteur naval est massivement livré (boucle de jours complète, CampaignVessel exhaustif, modales
de combat canoniques). **Le trou résiduel est l'EXPÉRIENCE/UI** — périmètre exact des tickets
#227/#228/#229/#232 — plus 3 résidus moteur nommés et un lot de curation.

## Verdicts B (combat) — synthèse
FAIT : B.4 (équipage/postes en combat), B.5 (Test d'équipage primitive), B.6 (bordée/recharge/arcs),
B.9 (collision/abordage moteur), B.10 (arbitre/reddition #215).
PARTIEL : B.1 (données ok, silhouette à localisations ABSENTE), B.7 (météo moteur ok, rose des
vents absente), B.8 (urgences moteur ok, poste-urgence sans surface), B-bis (traits ok #221,
bestiaire MDG 16 non curé).
ARBITRAGE USER : B.2/B.3 (ruban de Distance + horloge ×10 vs grille iso actuelle — LE nœud carte
de combat).

## Verdicts C (hors combat) — synthèse
FAIT (moteur) : C.3, C.4, C.9, C.11, C.14 ; C.7/C.10 (Moral/paie/équipage — données/mécanique).
PARTIEL : C.2 (journal recyclé du terrestre), C.5 (Humeur SANS AUCUNE surface), C.6, C.8 (manifeste
partiel — l'avitaillement #241 livré, couchettes/passagers/paliers absents), C.12 (#228), C.13
(Marchandage non branché au négoce naval), C.15 (quarts invisibles), C.17 (constructeur absent).
À FAIRE : C.1 (#227 — AUCUN trou moteur, pur écran), C.16 (voyage rapide 1-jet MDG 15 l.21-37 —
INEXISTANT), C.18 (services d'escale), C.19 (naufrage/survie), C.20 (magie des mers — données),
C.21 (contenu régional), C.22 (⚠ `route.perils` JAMAIS lu en mer — seul `ambush` l'est).

## Ordre de marche (lots)
1. **Widgets partagés** : jauge à crans (Moral/Humeur/surcharge/voie d'eau), rose des vents.
   [Silhouette à localisations = ARBITRAGE USER avec #224.]
2. **Écrans** : #227 dossier navire (ShipStateBlock dé-gaté de battle + jauges + historique Humeur
   `manann.applied`) → #229 équipage (onglet du dossier, PostesRoster/AssignRow réutilisés) →
   #228 escale-hub (agrégation PortView + ShoreLeave/Manann/recrutement + 5 indices) →
   #232 traversée (écran voyage dédié remplaçant le recap terrestre en mode mer, rose + jauges +
   journal qui défile ; + voyage rapide C.16).
3. **Moteur résiduel** (// possible) : voyage rapide 1-jet ; lecture `perils` en mer (patron
   terrestre) ; séquence naufrage C.19.
4. **Données/curation** : bestiaire MDG 16, sorts navals C.20, services de port C.18/C.21,
   consommation eau/vivres de l'ÉQUIPAGE salarié (constat #241 : seuls les héros consomment).

## Arbitrages USER (liste fermée — ne pas traiter sans lui)
1. B.2/B.3 représentation de la carte de combat naval (ruban vs grille) + #224 art/échelle.
2. Forme de la silhouette à localisations.
3. Forme visuelle des 4 écrans (les INFOS sont validées, « pas fan » de la forme des maquettes).

## Caducs / rectifiés
- « Cogue rompt à mi-Blessures » : citation RAW erronée (règle de sabotage) — seuil = maison
  éditable (woundsThreshold), aucune prétention RAW.
- Verdict K (Proue-idole « renoncée ») : caduc — livrée #221.
- P0 traversée : caduc — corrigé c706cf9d.
- Poison JSDoc types.ts signalé par la distillation : FAUX POSITIF (vérifié à la lecture directe).
