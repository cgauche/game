# Atlas RAW — Réconciliation CODE ↔ ATLAS

> Déterministe (`node scripts/raw/reconcile.mjs`). **Sens A** = règles que l'app applique
> (réfs `LDB NN l.X` dans `src/`, et pour les 14 autres livres `<ABRÉV> NN l.X`) absentes de
> l'Atlas. **Sens B** = règles que l'Atlas décrit hors du code (borné au LDB).
> Tolérance ligne = ±20.

**Sens A — code → Atlas (LDB)** : 0 chapitre(s) cités par le code & absents de l'Atlas · 6 chapitre(s) couverts avec des lignes non pinées.
**Sens A — code → Atlas (14 autres livres)** : 2 chapitre(s)-livre cités par le code & absents de l'Atlas · 9 chapitre(s)-livre couverts avec des lignes non pinées · 254 réf(s) sans chapitre (non réconciliables par cette mesure).
**Sens B — Atlas → code (LDB)** : 157 marqueur(s) « (non implémenté) » · 23 chapitre(s) LDB cités par l'Atlas jamais référencés dans le code.

## A1 — Chapitres appelés par le CODE (LDB), ABSENTS de l'Atlas (trous durs)

_Aucun. Tout chapitre LDB référencé dans le code est cité par au moins une fiche._

## A2 — Lignes appelées par le CODE (LDB) non pinées par l'Atlas (chapitre couvert, règle peut-être survolée)

### LDB 46 — 10/30 ligne(s) code hors couverture (propriétaire : docs\raw\magie.md)
- l.185 — `src/state/combatSlice.ts:3024` — // Focalisation CRITIQUE (LDB 46 l.185-186) : le sort est lançable au prochain Round
- l.188 — `src/data/index.ts:566` — *  (Chamon/Azyr ignorent le métal, Ghur le cuir, LDB 46 l.188). Remplace la devinette par regex sur le nom. */
- l.193 — `src/state/combatFlow.ts:1988` — // Interruption de Focalisation (LDB 46 l.193-194) : Dégâts subis pendant qu'on focalise
- l.194 — `src/engine/ops.ts:604` — /** Marqueur IMPUR de la branche d'ÉCHEC du Test de Calme d'interruption de Focalisation (LDB 46 l.194) :
- l.199 — `src/engine/magic.ts:165` — * « Repousser les Vents » (LDB 46 l.199) : −1 DR aux Tests d'Incantation et de
- l.201 — `src/engine/engine.test.ts:699` — it('Dissipation (LDB 46 l.201-202) : Test opposé — gagné → dissipé ; perdu → le Sort garde le DR NET', () => {
- l.202 — `src/engine/magic.ts:547` — *  Contre-sort (LDB 46 l.202 : « le lanceur tient le rôle attaquant »). Source unique. */
- l.204 — `src/engine/conditions.ts:464` — *  DISSIPATION (LDB 46 l.204-207, `engine/dispel`). Renvoie les effets retirés (pour le journal). */
- l.205 — `src/state/combatSlice.ts:3092` — // Réussite (DR cumulé ≥ NI, LDB 46 l.205) : retire les effets du sort de tous ses porteurs.
- l.207 — `src/engine/tests.ts:218` — *  œuvre de concert (Test étendu, Tests de groupe hors combat, Dissipation à plusieurs LDB 46 l.207…). */

### LDB 10 — 6/21 ligne(s) code hors couverture (propriétaire : docs\raw\tests.md)
- l.310 — `src/engine/types.ts:844` — /** Aura magique DÉTECTÉE (Talent Détection d'artefact, LDB 10 l.310-312 : « vous sentez que
- l.364 — `src/engine/types.ts:1366` — /** Distraire (LDB 10 l.364 / AA l.4395) : distrait par un adversaire → ne peut gagner AUCUN Avantage
- l.365 — `src/state/combatFlow.ts:4445` — *  Réutilisé par la Chirurgie (infection post-opératoire, LDB 10 l.365) : Chance/Résilience + auto-succès
- l.569 — `src/engine/grimoire.ts:11` — *    inclusives — aucun sort inclus au Talent, LDB 10 l.569).
- l.859 — `src/state/granted-traits.test.ts:122` — it('Sans Peur POSSÉDÉ ciblé (LDB 10 l.859) : immunise vs l’Ennemi spécifié seulement', async () => {
- l.864 — `src/engine/psychology.ts:74` — *  NB : « Sans Peur (Ennemi) » (LDB 10 l.864) ne supprime PLUS la source ici (ce n'était pas RAW : le

### LDB 15 — 4/20 ligne(s) code hors couverture (propriétaire : docs\raw\combat.md)
- l.500 — `src/state/pursuitFlow.ts:39` — /** Distance de départ (LDB 15 l.500-504 : 1 = presque à portée … 8 = presque hors de portée). */
- l.512 — `src/state/pursuitFlow.ts:12` — * adversaires (PNJ) roulent en clôture de manche. On compare (LDB 15 l.512-515) le DR le plus BAS des
- l.518 — `src/scenes/test-scenarios/95-poursuite-terrestre.ts:44` — // Secours si rattrapés (Distance ≤ 0, LDB 15 l.518) — mêmes brigands, cachés tant que la fuite tient.
- l.520 — `src/state/pursuitFlow.ts:150` — get().log(p.partyRole === 'fleeing' ? 'Le groupe a semé ses poursuivants — fuite réussie (LDB 15 l.520).' : 'La proie s\'est échappée — la poursuite est perdue 

### LDB 11 — 2/2 ligne(s) code hors couverture (propriétaire : docs\raw\equipement.md)
- l.143 — `src/state/vision.ts:11` — * Lanterne 20 m — `LDB 74 l.72`, `LDB 75 l.15`) et la Vision nocturne (20 m/niv — `LDB 11 l.143-147`)
- l.147 — `src/data/index.ts:880` — /** Portée de vision dans le noir, en cases (Vision nocturne 20 m/niv = 10 — `LDB 11 l.147` ;

### LDB 05 — 1/35 ligne(s) code hors couverture (propriétaire : docs\raw\creation.md)
- l.288 — `src/ui/creator/CharacterCreator.test.tsx:174` — it('bug utilisateur 2026-07-15 — le qualificatif « un au choix » (LDB 05 l.288) ne vaut QUE pour le Niveau de départ, jamais un rang exploré supérieur', () => {

### LDB 12 — 1/25 ligne(s) code hors couverture (propriétaire : docs\raw\tests.md)
- l.229 — `src/engine/activities.ts:229` — /** Test COMBINÉ (LDB 12 l.229) : UN jet confronté aux DEUX premières `skills` (Infiltration Discrétion+

## A-AUTRES 0 — Résumé Sens A par livre (14 livres hors LDB)

| Livre | Trous durs (chapitres) | Chapitres à lignes non pinées | Réfs sans chapitre |
|---|---|---|---|
| AA | 0 | 0 | 179 |
| ADE I | 0 | 1 | 0 |
| ADE II | 0 | 1 | 24 |
| EDOC | 0 | 4 | 29 |
| MDG | 1 | 1 | 5 |
| T2C | 1 | 2 | 17 |

## A1-AUTRES — Chapitres appelés par le CODE (autres livres), ABSENTS de l'Atlas (trous durs)

### MDG 3 — 5 réf(s) code, 0 dans l'Atlas
- `src/state/restFlow.ts:65` (l.71) — /** À bord du navire de campagne (hamacs/quartiers, MDG 03 l.71 · 09 l.87) — couchage ABRITÉ (pas
- `src/state/restFlow.ts:579` (l.71) — if (places.bord) out.push('bord'); // à bord = hamacs (MDG 03 l.71) ; par défaut si offert
- `src/state/riverVoyageFlow.ts:857` (l.71) — // Sur la rivière on peut mouiller le long de la berge : coucher À BORD (hamacs, MDG 03 l.71) offert
- `src/state/seaActivities.ts:233` (l.71) — // dort à bord (hamacs, MDG 03 l.71) : couchage unique et abrité.

### T2C 10 — 41 réf(s) code, 0 dans l'Atlas
- `src/data/index.ts:1389` (l.54) — /** Palier de LONGUEUR d'un tarif d'installation (#277 : T2C ch.10 l.54-135 tarife par TYPE de navire à
- `src/data/index.ts:1397` (l.1) — *  Amélioration, l.195-364 ; T2C ch.10 l.1-140) — VERBATIM structuré par paliers de LONGUEUR. `per: '5m'` =
- `src/data/index.ts:1425` (l.85) — *  = `totale` (MDG ch.12 l.364 / T2C ch.10 l.85), Plat-bord = `moyenne` (T2C ch.10 l.111). Géométrie de Pont,
- `src/data/index.ts:1425` (l.111) — *  = `totale` (MDG ch.12 l.364 / T2C ch.10 l.85), Plat-bord = `moyenne` (T2C ch.10 l.111). Géométrie de Pont,

## A2-AUTRES — Lignes appelées par le CODE (autres livres) non pinées par l'Atlas

### EDOC 5 — 12/14 ligne(s) code hors couverture
- l.25 — `src/engine/policy.ts:562` — ref: 'EDOC ch.5 l.25 — MJ décide, valeur maison',
- l.29 — `src/engine/policy.ts:541` — ref: 'EDOC ch.5 l.29',
- l.34 — `src/engine/policy.ts:550` — ref: 'EDOC ch.5 l.34',
- l.42 — `src/engine/travelStages.ts:86` — /** Jet de Météo d'une Étape (EDOC ch.5 l.42) : d100 sur la table de la saison. */
- l.44 — `src/engine/travelStages.test.ts:43` — describe('table de Météo VERBATIM (EDOC ch.5 l.44-51)', () => {
- l.52 — `src/data/weather.json:31` — "note": "Tableau Météo par saison, EDOC ch.5 l.52-59"
- l.73 — `src/engine/policy.ts:621` — ref: 'EDOC ch.5 l.73',
- l.131 — `src/engine/activities.test.ts:201` — describe('resolveTravelActivity — résolveur PUR par POSTE (un héros désigné, EDOC ch.5 l.131)', () => {
- l.133 — `src/engine/activities.ts:291` — /** Échec du Test d'Activité → État Exténué pour CET acteur (EDOC ch.5 l.133). */
- l.151 — `src/engine/policy.ts:430` — // #352 — EDOC ch.5 l.151-153 chiffre le Test (Ragot Intermédiaire) mais jamais de durée à
- l.182 — `src/engine/travelEncounter.ts:2` — * Rencontres de voyage (EDOC ch.5 l.182-233) — DÉCLENCHEUR par la qualité des Tests d'Activité de
- l.186 — `src/engine/travelTables.test.ts:45` — it('Rencontres : 3 tables d100 contiguës (EDOC ch.5 l.186-233)', () => {

### T2C 11 — 12/12 ligne(s) code hors couverture
- l.22 — `src/ui/LandMarketView.tsx:87` — {market.offers.length === 0 && <p className="port-hint">Aucun marchand n’a de cargaison à céder ici (disponibilité T2C ch.11 l.22-42).</p>}
- l.44 — `src/ui/editor/WorldMapEditor.tsx:22` — /** Libellés des Tailles de communauté (T2C ch.11 l.44-50, indices 1-4). */
- l.71 — `src/engine/landCargo.ts:41` — /** Catalogue des cargaisons terrestres (Tableau des cargaisons, T2C ch.11 l.71-90) — source UNIQUE pour
- l.95 — `src/ui/LandMarketView.tsx:98` — : <> <button type="button" className="btn small ghost" disabled={isGuest} title="Test d’Évaluation pour révéler la qualité secrète du vin (T2C ch.11 l.95)" onCl
- l.131 — `src/state/landMarketFlow.ts:226` — if (want < minCargoEnc) { log(get, set, [`Les marchands ne cèdent pas de lot de moins de ${minCargoEnc} Points d'Encombrement (T2C ch.11 l.131).`]); return; }
- l.133 — `src/ui/LandMarketView.tsx:155` — <button type="button" className="btn small" disabled={isGuest} title="Trouver un acheteur puis marchander (T2C ch.11 l.133-160)" onClick={() => sell(r.carrierId
- l.150 — `src/engine/landCargo.ts:44` — /** Échelons de Richesse et leur Mise à prix (T2C ch.11 l.150-156) — source des libellés (1 Misérable …
- l.160 — `src/state/landMarketFlow.ts:328` — if (pct == null) { log(get, set, [`${label} : ce lieu ne brade pas les cargaisons (pas de Commerce en Produits, T2C ch.11 l.160).`]); return; }
- l.176 — `src/state/landMarketFlow.ts:113` — // Rumeurs commerciales (T2C ch.11 l.176-180) : Test de Ragot Complexe (−10) au marché ; sur un succès, on
- l.180 — `src/engine/landCargo.ts:208` — /** Rumeur commerciale PERSISTANTE (T2C ch.11 l.180) : à l'Emplacement `placeId` (un AUTRE Lieu, tiré via
- l.183 — `src/state/worldMap.ts:41` — /** Indices de COMMERCE TERRESTRE/FLUVIAL (Index géographique, T2C ch.11 l.183-278) — présent = ce Lieu
- l.185 — `src/scenes/test-scenarios/15-commerce-fluvial.ts:15` — * (Index géographique, T2C ch.11 l.185-270 — cf. `_reik-index.ts`), chacune un Lieu de la carte du monde

### T2C 5 — 11/11 ligne(s) code hors couverture
- l.11 — `src/ui/compendium/codex-exposure-guard.test.ts:161` — 'river-navigation.json': "AUDIT : à exposer -> ticket — table de vent/navigation fluviale (T2C ch.5 l.11-41), consommée par `engine/riverNavigation.ts`, aucune 
- l.21 — `src/engine/river-navigation.test.ts:22` — describe('Table des vents (T2C ch.5 l.21-33)', () => {
- l.25 — `src/engine/riverNavigation.ts:40` — /** Direction du vent RELATIVE au bateau (T2C ch.5 l.25-33) — pas une direction cardinale (≠ mer). */
- l.40 — `src/state/riverVoyageFlow.ts:484` — if (r.sank) { sinkBoat(get, set, (l) => j.push(...l), `Le bateau n'est pas redressé et coule en ${be} tours (T2C ch.5 l.40).`); return { consequences: freeCons(
- l.101 — `src/engine/cargo.ts:81` — *  T2C ch.5 l.101 / MDG ; pillage partiel ; vol gradué) — arrondi à l'entier, lots vidés éliminés.
- l.103 — `src/state/riverVoyageFlow.ts:599` — sinkBoat(get, set, (l) => j.push(...l), 'La coque prend l\'eau plus vite qu\'on ne la vide — le bateau sombre (T2C ch.5 l.103).');
- l.119 — `src/data/schemas/defs/river-perils.ts:2` — * Schéma de `river-perils.json` — Dangers fluviaux (T2C ch.5 l.119-166 : Débris/Barrage/Rochers/Eaux
- l.123 — `src/data/river-perils.json:11` — "ref": "T2C ch.5 l.123-125",
- l.128 — `src/data/river-perils.json:33` — "ref": "T2C ch.5 l.128",
- l.130 — `src/data/river-perils.json:49` — "ref": "T2C ch.5 l.130-140",
- l.142 — `src/data/river-perils.json:64` — "ref": "T2C ch.5 l.142-144",

### MDG 15 — 8/32 ligne(s) code hors couverture
- l.243 — `src/state/seaVoyageFlow.ts:2060` — *  mentionnent pas la relâche à terre — vérifié entrée par entrée (MDG 15 l.243-263) — donc non gatées. */
- l.245 — `src/scenes/test-scenarios/14-voyage-maritime.test.ts:55` — if (get().pendingShoreLeave) { get().resolveShoreLeave(true); continue; } // accoste : relâche accordée par défaut (MDG 15 l.245)
- l.439 — `src/data/index.ts:1441` — /** Index des ports de la Mer des Griffes (#217, MDG ch.15 l.439-506) — catalogue app-owned éditable au
- l.452 — `src/data/naval-ports.test.ts:37` — it('Salzenmund : Taille 4, Richesse 4, Surplus produits-de-luxe +1, Demande armes+céréales +1 (MDG 15 l.452, folio 138)', () => {
- l.456 — `src/data/naval-ports.test.ts:59` — it('Norden : Surplus poisson-salé +1, Demande armes +2/bois/métaux/pièces-détachées-de-navire +1 (MDG 15 l.456, folio 138)', () => {
- l.461 — `src/data/naval-ports.test.ts:45` — it('Erengrad : Taille 4, Richesse 4, Surplus pièces-détachées-de-navire +1, Demande laine +1 (MDG 15 l.461-462, folio 138)', () => {
- l.468 — `src/data/naval-ports.test.ts:65` — it('Kirkjugarður Langskipa : production armes/produits-de-luxe, sans surplus ni demande (MDG 15 l.468-469, folio 138)', () => {
- l.474 — `src/data/naval-ports.test.ts:72` — it('Fjirgard : production produits-de-luxe, Demande armes +1, sans surplus (MDG 15 l.474, folio 138)', () => {

### EDOC 4 — 5/5 ligne(s) code hors couverture
- l.140 — `src/engine/policy.ts:573` — ref: 'EDOC ch.4 l.140-146',
- l.150 — `src/engine/travelTables.test.ts:18` — it('Incidents de monte : table d100 contiguë (EDOC ch.4 l.150-155)', () => {
- l.259 — `src/engine/travelTables.test.ts:28` — it('Problèmes de véhicule : table d100 contiguë + Dégâts au véhicule (EDOC ch.4 l.259-264)', () => {
- l.285 — `src/engine/mountTravel.ts:50` — /** Charge portée en Points d'Enc (colonne « Enc portée », EDOC ch.4 l.285-295) — capacité de bât
- l.309 — `src/engine/types.ts:135` — /** Chargement (EDOC ch.4 l.309-321) : Points d'Enc que la section bagages contient — véhicules

### ADE I 6 — 1/1 ligne(s) code hors couverture
- l.185 — `src/data/index.ts:399` — *  permission du MJ », EDOC ch.9 l.137 ; lignage Éonir Harioth hors espèces jouables, ADE1 ch.6 l.185).

### ADE II 4 — 1/1 ligne(s) code hors couverture
- l.46 — `src/state/interlude-activities.test.ts:181` — // ── Identifier un artefact magique (ADE2 ch.4 l.46-59) ─────────────────────────────────────

### EDOC 8 — 1/1 ligne(s) code hors couverture
- l.170 — `src/data/obsessions.json:6` — "ref": "EDOC ch.8 l.170",

### EDOC 9 — 1/2 ligne(s) code hors couverture
- l.137 — `src/data/index.ts:399` — *  permission du MJ », EDOC ch.9 l.137 ; lignage Éonir Harioth hors espèces jouables, ADE1 ch.6 l.185).

## A3-AUTRES — Réfs de CODE sans chapitre (`<ABRÉV> l.X`, pas d'unité chapitre à couvrir)

### AA — 179 réf(s) sans chapitre
- `src/data/criticals.ts:74` (l.125) — /** « Épaule luxée » (AA l.125 / LDB l.120) / « Genou démis » (AA l.179 / LDB l.179) : le membre est
- `src/data/criticals.ts:74` (l.179) — /** « Épaule luxée » (AA l.125 / LDB l.120) / « Genou démis » (AA l.179 / LDB l.179) : le membre est
- `src/data/schemas/defs/structure-criticals.ts:4` (l.3690) — * (Structure/Véhicule/Navire, AA l.3690).
- `src/data/structureCriticals.ts:7` (l.3690) — * Navire suivent le MÊME patron Endurance/Blessures + table de Critiques (AA l.3690).
- … +175 autres

### ADE II — 24 réf(s) sans chapitre
- `src/data/index.ts:1068` (l.653) — *  carac par défaut (ADE II l.653 : la Magie de la Gueule, réservée aux ogres, se lance sur l'Endurance).
- `src/data/index.ts:1182` (l.62) — /** L'Étoile du Sorcier (ADE2 l.62) : fourchette du 1d10 interne `[min, max]` parmi les variantes
- `src/data/schemas/defs/stars.ts:24` (l.62) — /** Étoile du Sorcier (ADE2 l.62) : fourchette 1d10 interne `[min, max]` — tuple STRICT (2 éléments,
- `src/engine/casting-char.test.ts:23` (l.653) — it('carac alternative PORTÉE PAR LA DONNÉE : l’instance sur Endurance → Endurance (ex. lanceur ogre, ADE II l.653)', () => {
- … +20 autres

### EDOC — 29 réf(s) sans chapitre
- `src/engine/activities.ts:201` (l.172) — /** Compétence LIBRE choisie par le joueur (Pratiquer une Compétence, EDOC l.172). */
- `src/engine/activities.ts:203` (l.161) — /** Test ÉTENDU (LDB 12) : DR requis = `drPerStage` × nombre d'Étapes (Établir des cartes, EDOC l.161). */
- `src/engine/activities.ts:205` (l.133) — /** RAW EDOC l.133 : échouer le Test d'une Activité octroie un État Exténué. */
- `src/engine/activities.ts:208` (l.106) — *  en dur) : Plein air « -10 par degré de temps éloigné de Beau temps » (EDOC l.106), Approvisionnement
- … +25 autres

### MDG — 5 réf(s) sans chapitre
- `src/engine/cargo.ts:22` (l.402) — *  MDG l.402-418). PUR. Repli sur la dernière entrée si aucune plage ne matche (tableaux exhaustifs 01-00). */
- `src/engine/warMachineCrew.ts:23` (l.3900) — *  (headcount brut — le RAW ne pose ICI aucune exigence de Compétence, à la différence d'AA/MDG l.3900),
- `src/state/combatFlow.ts:263` (l.3900) — // ICI aucune exigence de Compétence pour compter dans l'Équipe (≠ AA/MDG l.3900 ci-dessus) — 3ᵉ courbe,
- `src/state/ship-maneuver.test.ts:298` (l.304) — it('réussite du VIRAGE = réussite du d100 (RAW MDG l.304), JAMAIS dr≥0 — le Man (−1 DR cogue) n’inverse pas le Test', () => {
- … +1 autres

### T2C — 17 réf(s) sans chapitre
- `src/engine/cargo.ts:21` (l.71) — /** Cargaison ALÉATOIRE de la saison : d100 dans la colonne saisonnière du tableau fourni (T2C l.71-78,
- `src/engine/cargo.ts:28` (l.80) — /** Prix de BASE d'une cargaison (CO par 10 points d'Encombrement) pour la saison (T2C l.80-90, MDG
- `src/engine/cargo.ts:35` (l.127) — /** Ampleur du Marchandage (LDB p.291, cité T2C l.127 & MDG) : le prix bouge de ±10 %, ou ±20 % si le
- `src/engine/land-cargo.test.ts:16` (l.164) — // Exemples canoniques de l'Index géographique du Reikland (T2C l.164-174).
- … +13 autres

## B1 — Règles décrites par l'Atlas marquées « (non implémenté) » (LDB)

- **docs\raw\activites.md** L261 — **Implémente :** non implémenté comme Activité discrète dans le flux — la consultation experte est laissée au MJ (pas de Test automatique dans `src/state/interludeFlow.ts`).
- **docs\raw\activites.md** L271 — **Implémente :** non implémenté.
- **docs\raw\activites.md** L285 — **Implémente :** non implémenté comme Activité distincte de l'Avancement (les Tests de Caractéristiques hors carrière ne sont pas séparés dans le flux actuel).
- **docs\raw\activites.md** L303 — **Implémente :** non implémenté (système de PNJ/MJ — pas de données structurées dans le store actuel).
- **docs\raw\activites.md** L319 — **Implémente :** non implémenté.
- **docs\raw\activites.md** L405 — **Implémente :** non implémenté.
- **docs\raw\activites.md** L419 — **Implémente :** non implémenté.
- **docs\raw\activites.md** L434 — **Implémente :** non implémenté.
- **docs\raw\activites.md** L449 — **Implémente :** non implémenté.
- **docs\raw\activites.md** L466 — **Implémente :** non implémenté.
- **docs\raw\activites.md** L490 — **Implémente :** non implémenté.
- **docs\raw\activites.md** L509 — **Implémente :** non implémenté.
- **docs\raw\activites.md** L535 — **Implémente :** non implémenté.
- **docs\raw\activites.md** L618 — | Consulter un Expert | — | Non implémenté |
- **docs\raw\activites.md** L619 — | Dressage (Activité) | — | Non implémenté |
- **docs\raw\activites.md** L620 — | Entraînement (hors-Carrière coûts) | — | Non implémenté séparément de l'avancement |
- **docs\raw\activites.md** L621 — | Invention ! | — | Non implémenté |
- **docs\raw\activites.md** L622 — | Réputation | — | Non implémenté |
- **docs\raw\activites.md** L623 — | Semer la Dissension | — | Non implémenté |
- **docs\raw\activites.md** L624 — | Dernières Nouvelles | — | Non implémenté |
- **docs\raw\activites.md** L625 — | Entraînement au Combat | — | Non implémenté |
- **docs\raw\activites.md** L626 — | Observer une Cible | — | Non implémenté |
- **docs\raw\activites.md** L627 — | Recherche de Savoir | — | Non implémenté |
- **docs\raw\activites.md** L628 — | Convalescence (ADE II) | — | Non implémenté (suppression Trait Psychologique) |
- **docs\raw\activites.md** L629 — | Activités de Guerrier (AA) | — | Non implémenté |
- **docs\raw\activites.md** L630 — | Activités de Bataille (ADE II) | — | Non implémenté |
- **docs\raw\activites.md** L632 — | Faveurs (Mineure/Majeure/Importante) | — | Non implémenté |
- **docs\raw\activites.md** L662 — **Implémente** : (non implémenté) — voyage maritime longue durée et Activités à bord absents de `src/state/travelFlow.ts` (voyage terrestre jour par jour uniquement).
- **docs\raw\activites.md** L685 — **Implémente** : (non implémenté).
- **docs\raw\activites.md** L703 — **Implémente** : (non implémenté).
- **docs\raw\activites.md** L721 — **Implémente** : (non implémenté).
- **docs\raw\activites.md** L745 — **Implémente** : (non implémenté).
- **docs\raw\avancement.md** L300 — **Implémente** : non implémenté (attribution de PX = décision MJ dans le store via `xp(n)` dans `src/state/devtools.ts` et `partyFlow.ts`).
- **docs\raw\bestiaire.md** L437 — - `src/data/traits.json` (`creature-marine`, desc verbatim ; `aquatique` T2C p.90 également porté). Le malus hors-eau (M→1, −2 DR) et la suffocation restent (non implémenté) : pas de notion d'environn
- **docs\raw\bestiaire.md** L460 — - `src/data/traits.json` (`redoutable`, desc verbatim — la clause AA l.13 y est appendue) : le regain d'Avantage début de tour EST câblé (`effects` `onTurnStart` → op `gainAdvantage`, gardé Empêtré/Su
- **docs\raw\carrieres.md** L507 — **Implémente** : `src/data/talents.json` (`chanson-de-marin`, `commandant-emerite` — Maxi/Tests/desc ; `commandant-d-equipe` = réimpression du talent AA existant). Flux d'activation du chant + bonus D
- **docs\raw\carrieres.md** L531 — **Implémente** : `src/data/sea-shanties.json` (7 chansons, desc verbatim ; `crewOps` GameOp pour les 3 exprimables, `pending` pour les 4 autres). Application à l'équipage (non implémenté — lot système
- **docs\raw\carrieres.md** L625 — **Implémente** : `src/data/traits.json` (`marque-de-khorne` — desc verbatim). Effets mécaniques (Frénésie/Animosité/interdits/achats hors carrière) (non implémenté — même canal que `marque-de-tzeentch
- **docs\raw\code-map.md** L46 — | `NON IMPLÉMENTÉ` | empoignade, poursuite-ldb, aa-systeme-blessures-alternatif, aa-structures-sieges, aa-rupture-poursuites, aa-armes-poudre-munitions-tables, ade-ii-combat-de-masse-puissance-de-bata
- **docs\raw\combat.md** L145 — - `initiativeOrder` (`src/engine/combat.ts`) — tri par Initiative décroissante puis départage par Agilité (`LDB 13 l.31`, 1er niveau). Le **2e niveau de départage (Test opposé d'Agilité)** n'est `(non
- **docs\raw\combat.md** L146 — - `rollInitiative` (`src/state/combatSetup.ts`) + règle maison `combat-init-method` (`src/engine/policy.ts`, label « Méthode d'Initiative », `ref: 'LDB 13 l.37'`) — implémente les variantes de tirage 
- **docs\raw\combat.md** L148 — - Système de Round (début/fin, frontières, pré-emption) : `resolveRoundBoundary`, `roundHooks.ts`, `turnHooks.ts`, `pendingRoundStart` / `confirmRoundStart` (`src/state/combatSlice.ts`, `src/state/com
- **docs\raw\combat.md** L716 — - *Aux Armes* « +10 par Blessure au-delà de 0 » et tables alternatives `(non implémenté)`.
- **docs\raw\combat.md** L973 — - `(non implémenté)` — l'**Option : Tirer Dans Un Combat au Corps À Corps** (`LDB 14 l.126-129`, pénalité −20 puis redirection du tir vers un adversaire au hasard de la cible) n'est pas modélisée comm
- **docs\raw\combat.md** L1086 — - `src/engine/types.ts` — `Difficulty` / `DIFFICULTY_MODIFIERS` / `DIFFICULTY_LABELS` couvrent les 7 bandes Très Facile +60 → Très Difficile −30. Les paliers extrêmes EDO **Presque Impossible (−40)** 
- **docs\raw\combat.md** L1198 — - **Empoignade** (option déclarée à mains nues, brisure/Test de Force, dommages PA-ignorés) : `(non implémenté)` — seul l'État `empetre` et sa récupération existent (`src/state/combatSlice.ts battleRe
- **docs\raw\combat.md** L1199 — - **Dispersion** (1d10 → direction/2d10 m / à vos pieds / aux pieds de la cible sur échec de Lancer) : `(non implémenté)`.
- **docs\raw\combat.md** L1200 — - Effet spécial du **Gantelet verrouillé** (conserve l'objet, −20 transitoire au lieu de lâcher) : `(non implémenté)` — l'objet existe comme donnée mais sa règle anti-lâcher n'est pas câblée.
- **docs\raw\combat.md** L1278 — **Implemente** : sous-système Empoignade `(non implémenté)` — il n'existe ni flux ni manœuvre « grapple/Empoignade » (rien dans `src/state/rollFlows.ts`, `src/data/maneuvers.json`, ni `src/engine/ops.
- **docs\raw\combat.md** L1434 — - Trait **Redoutable** : présent en **donnée** (`src/data/frenchy-traits.json` id `redoutable`, description verbatim ; assigné à de nombreuses créatures de `creatures.json`) mais **le minimum d'Avanta
- **docs\raw\combat.md** L1664 — - Chute : `src/state/combatEffects.ts` (effet `fall`) — `3 * m + d10() − BonusEndurance`, plancher 0, PA ignorés ; `loseWounds` ; `addCondition(c, 'a-terre')` si `lost > be`. Réduction de chute volont
- **docs\raw\combat.md** L1754 — **Implemente** : `(non implémenté)` — la procédure de Poursuite de LDB 15 (Distance abstraite, comparaison DR le plus faible des fuyards vs DR le plus haut des poursuivants, modificateur de M en DR bo
- **docs\raw\combat.md** L1830 — **Implemente** : `src/engine/encumbrance.ts` (`encumbrancePenalties` — paliers tier 0–3 : −1 M / min 3 / −10 Ag / +1 Fat ; −2 M / min 2 / −20 Ag / +2 Fat ; immobilisé au-delà de ×3 ; `effectiveMovemen
- **docs\raw\combat.md** L2029 — - `src/data/trappings.json` — fiches d'armes (`subType` = id de Groupe, `damage`, `reach`, `enc`, `availability`, `qualities`, `price`) ; ex. `lance-de-cavalerie` porte la `desc` « Arme improvisée hor
- **docs\raw\combat.md** L2031 — - Règle Cavalerie « (2M) → Deux Mains à pied », règle Fléau « sans compétence → Dangereuse + Atouts perdus », et lance-de-cavalerie « improvisée hors charge » au *runtime* `(non implémenté)` — seuleme
- **docs\raw\combat.md** L2032 — - Profil du **Duel Judiciaire** (seuil « premier sang > 3 Blessures », fin à 0 Blessure, projectiles interdits) `(non implémenté)` — contenu de scénario/narration, sans support de moteur ; relèverait 
- **docs\raw\combat.md** L2219 — **Implémenté** : `src/data/weaponGroups.json` (les 8 groupes à distance : `arbalete`, `arc`, `entraves`, `explosifs`, `fronde`, `lancer`, `ingenierie`, `poudre-noire`, + famille de munitions `poudre-n
- **docs\raw\combat.md** L2321 — - Option « Longueur d'arme » (-10) : `weaponReachPenalty` (`src/engine/combat.ts`, règle optionnelle `combat-weapon-reach`). Le sous-système « Au Contact » (Test opposé pour entrer dans l'allonge) `(n
- **docs\raw\combat.md** L2324 — - Réparation : `repairCostBrass` (`src/engine/repair.ts`) couvre l'**armure** (LDB 63, 10 %/PA, 30 % si brisée). Le coût de réparation d'**arme** (10 % du prix / point, LDB 62) `(non implémenté)` — `w
- **docs\raw\combat.md** L2505 — **Implémente** : `src/data/qualities.json` (donnée RAW de chaque Atout/Défaut : `passive: GameOp[]` + `capabilities` + `effects` Flow, taggée à sa source ; y compris la qualité générique `magique` `ca
- **docs\raw\combat.md** L2634 — - Écailles Épineuses (PA naturel non déviable) : donnée `src/data/mutations.json` ; PA naturels additifs appliqués dans `src/engine/items.ts` (`recomputeLoadout`, l.372-374). Le verrou « ce PA ne peut
- **docs\raw\combat.md** L2711 — **Implémente** : `src/engine/combat.ts` — `reverseRoll` (inversion du dé), `hitLocation` (tableau humanoïde), `hitLocationByShape(reversed, shape)` (serpent : ≤19 Tête sinon Corps ; araignée : ≤9 Tête
- **docs\raw\combat.md** L3021 — - `src/data/traits.json` — registre des **101 Traits** (id stable, `label`, `prefix`/`suffix`, `desc`, `source`, `capabilities`/`effects`/`passive`/`grantsManeuvers`), dont **15** marqués `"standard":
- **docs\raw\combat.md** L3149 — **Implémente** : Données — `src/data/traits.json` (entrées `arme`, `a-distance`, `morsure`, `cornes`, `attaque-caudale`, `langue-prehensile`, `tentacules`, `constricteur`, `toile`, `venin`, `vampiriqu
- **docs\raw\combat.md** L3350 — - **Infecté / Increvable / Amorphe** : Infecté = contraction post-combat (`src/engine/disease.ts` — Blessure Purulente, hors boucle de Round) ; **Increvable** = résurrection post-combat NON câblée en 
- **docs\raw\combat.md** L3351 — - **Redoutable (ZI)** : regain d'Avantage début de tour `(non implémenté en règle moteur)` — Trait présent en donnée/statbloc, desc verbatim affichée, pas de hook de regain d'Avantage confirmé.
- **docs\raw\combat.md** L3673 — **Implémente** : `src/data/traits.json` (entrées `bond`/`foulee`/`vol`/`grimpant`/`rapide`/`brutal`/`coriace`/`elite`/`endurant`/`grand`/`se-cabrer`/`fabrique` — descriptions verbatim ; modificateurs 
- **docs\raw\combat.md** L4065 — **Implemente** : `(non implémenté)`. Le jeu utilise le système de Critiques/Mort **du Livre de base**, pas l'alternative d'*Aux Armes*. Les déclencheurs AA (Critique sur double, table relancée non inv
- **docs\raw\combat.md** L4368 — **Implémente** : `src/data/trappings.json` — les armes de mêlée AA sont des objets app-owned tagués `source.book: "AA"` (hallebarde, marteau-à-bec-de-corbin, épée bâtarde, fleuret, rapière, fleau/flea
- **docs\raw\combat.md** L4491 — - **Non câblés** (donnée présente, effet moteur dédié absent) : le **bonus +10 de la cartouche en papier au rechargement** `(non implémenté)` (seul `reloadBonusSL` en DR existe, pas un +10 conféré par
- **docs\raw\combat.md** L4634 — **Implémente** : appairage cavalier↔monture et flux Monter/Descendre — `src/state/mount.ts` (`isRider`/`isMount`/`mountOf`/`riderOf`, `canMount`/`mountUp`/`dismount`). Mouvement emprunté à la monture 
- **docs\raw\combat.md** L4864 — **Implémente** : `src/engine/combat.ts` (`attackModifiers`, ligne 274-276) câble l'**Atout Salve** (pénalité −10 cumulative par tir supplémentaire via `attacker.shotsThisTurn`, `Combatant.shotsThisTur
- **docs\raw\combat.md** L5020 — **Implémente** : le **désengagement** est implémenté d'après le LDB (pas le résumé AA) — `src/engine/engagement.ts` (`isEngaged`/`engage`/`disengageFrom`/`decayEngagement`, désengagement gratuit du pl
- **docs\raw\combat.md** L5132 — **Implemente** : `(non implémenté)` — le code n'a que le système d'Avantage **individuel** du LDB : `src/engine/advantage.ts` (`gainAdvantage`, `advantageCap`, `advantageCapFor`) écrit dans `Combatant
- **docs\raw\combat.md** L5261 — **Implémente** : `src/data/talents.json` (entrées `artilleur`, `battement`, `cavalier-emerite`, `commandant-d-equipe`, `coude-a-coude`, `distraire`, `frappe-blessante`, `fuite`, `impitoyable`, `porte-
- **docs\raw\combat.md** L5452 — **Implemente** : `(non implémenté)` — aucune des cinq Activités de guerrier n'est câblée. Le système d'interlude `src/state/interludeFlow.ts` (+ `src/engine/activities.ts`) ne couvre que les Activités
- **docs\raw\combat.md** L5670 — **Implemente** : `(non implémenté)` — aucun système de combat de masse / Puissance de Bataille dans `src/` (les machines de guerre présentes dans `src/data/trappings.json`, ex. `baliste`/`mortier`/`ba
- **docs\raw\combat.md** L5786 — **Implemente** : Les Atouts/Défauts cités sont tous présents en donnée (`src/data/qualities.json` : `assommante`, `dangereuse`, `defensive`, `devastatrice`, `empaleuse`, `impenetrable`, `percutante`, 
- **docs\raw\combat.md** L5869 — **Implémente** : `(non implémenté)` — aucun sous-système de Caractéristiques de navire (E/BE/B/BB), de Localisation de bateau, ni de combat naval dans `src/engine`. La résolution d'attaque (`src/engin
- **docs\raw\combat.md** L5953 — **Implémente** : `(non implémenté)` — pas de table de Critiques de navire ni d'effets *Voie d'eau* / *Éclats* / propagation d'incendie de bateau dans `src/engine`. Les tables de Critiques existantes (
- **docs\raw\combat.md** L6019 — **Implémente** : `(non implémenté)` — pas de modèle de collision navale ni d'Indice de Collision dans `src/engine`. La Charge en combat (`src/state/combatFlow.ts`) ne couvre que des combattants indivi
- **docs\raw\combat.md** L6084 — **Implémente** : `(non implémenté)` — l'artillerie navale n'est pas modélisée séparément. Les Atouts/Défauts partagés (Recharge, Dangereuse, Explosion, Empaleuse, Perforante, Pointue, Tir de zone) son
- **docs\raw\combat.md** L6131 — **Implémente** : Atout **Tir de zone** reconnu en donnée (`capabilities.areaFire`, `src/data/index.ts`) et porté par les armes à poudre/artillerie (`src/data/trappings.json`). Défaut **Arme d'équipe**
- **docs\raw\competences.md** L1037 — **Implémente** : `(non implémenté)` — aucune mécanique d'hypnose dans `src/engine` (Compétence de table/MJ).
- **docs\raw\corruption.md** L570 — ### Non implémenté / delta code↔RAW
- **docs\raw\corruption.md** L574 — | Tables EDOC étendues par dieu (Khorne/Nurgle/Slaanesh/Tzeentch) | **Non implémenté** — `mutationTables.json` ne contient que les 2 tables LDB 19 génériques ; les 3 tables EDOC (physique étendue, Têt
- **docs\raw\corruption.md** L575 — | Talent Résistance (Mutation) — réussite auto 1×/séance | **Non implémenté** — non géré dans `corruptionThresholdExceeded` |
- **docs\raw\corruption.md** L576 — | Mauvais œil (mutation EDOC) — sort lancé sans test | **Non implémenté** — cette entrée EDOC n'est pas dans `mutations.json` |
- **docs\raw\corruption.md** L577 — | Malefrénésie (mutation EDOC) — mutation temporaire en Frénésie | **Non implémenté** |
- **docs\raw\corruption.md** L578 — | Corruption sublime (mutation mentale EDOC) — État Exténué hebdomadaire si pas de gain de Corruption | **Non implémenté** |
- **docs\raw\corruption.md** L579 — | Esprit anéanti (mutation mentale EDOC) | **Non implémenté** |
- **docs\raw\corruption.md** L580 — | Masochisme pressant (mutation mentale EDOC) | **Non implémenté** |
- **docs\raw\corruption.md** L581 — | Haine sporadique + Tableau des Obsessions (EDOC) | **Non implémenté** |
- **docs\raw\corruption.md** L582 — | Mutations spécifiques EDO App.2 (Chair Nécrosée, Crétin, Écailles épineuses EDO, Pattes Chèvre, Tête Pointue EDO) | **Non implémenté** dans mutations.json — ces entrées ne sont pas présentes |
- **docs\raw\deplacement.md** L610 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L636 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L656 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L680 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L702 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L720 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L745 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L769 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L803 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L821 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L843 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L857 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L875 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L891 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L909 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L923 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L939 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L957 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L975 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L987 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L1007 — **Implémente :** (non implémenté)
- **docs\raw\equipement.md** L578 — **Implémente :** (non implémenté) — schéma de navire (profil E/BE, B/BB, Contenance, Man, Voiles/Avirons) absent du moteur ; à modéliser comme entité combattante distincte si le combat naval est joué.
- **docs\raw\equipement.md** L616 — **Implémente :** (non implémenté) — calcul de coût/profil par assemblage Taille→propulsion→Man→vitesse non modélisé.
- **docs\raw\equipement.md** L638 — **Implémente :** (non implémenté) — modificateurs de Trait de navire (E, B, Contenance, DR aux Tests d'équipage) non modélisés.
- **docs\raw\equipement.md** L687 — **Implémente :** (non implémenté) — Améliorations de navire (PA Bélier/Blindage, M +1 Lissage, M 4 vapeur, couvert Sabord, bonus Tests) non modélisées.
- **docs\raw\equipement.md** L727 — **Implémente :** (non implémenté) — artillerie navale (Arme d'équipe, Tir de zone, munitions spéciales, Recharge longue) non modélisée ; à rapprocher des armes de siège AA si le combat naval est joué.
- **docs\raw\etats.md** L384 — - Le +1 Avantage pour l'attaquant ciblant un Sonné : **(non implémenté dans `conditions.ts`)** — à vérifier dans le flux d'attaque (`combatFlow.ts`)
- **docs\raw\etats.md** L446 — **Implémente** : `src/engine/conditions.ts` — module principal (tous les États sauf cas notés `(non implémenté)`)
- **docs\raw\etats.md** L639 — **Implémente** : `src/engine/combat.ts` — `assommanteCheck` pour l'Atout Assommante (à vérifier). L'Empêtré FM et la mécanique de filet (DR non cumulatifs) ne sont pas implémentés en variante. L'État 
- **docs\raw\etats.md** L673 — Points **(non implémentés)** identifiés :
- **docs\raw\etats.md** L679 — 6. **Variante Hémorragique AA** : non implémentée (règle optionnelle — LDB 16 est conforme).
- **docs\raw\etats.md** L681 — 8. **Filets ZI** : mécanique Empêtré avec DR non cumulatifs — non implémentée (seul Test de Force opposé générique est implémenté).
- **docs\raw\magie.md** L538 — **Implémente :** `domainOnHitEffects()` — `DomainData.effects` (condition `relation: hostile` + `not has Magie des Arcanes (Feu)` pour le rider `+1 Enflammé`). Le bonus `+10` par état voisin est **non
- **docs\raw\magie.md** L599 — **Implémente :** `domainOnHitEffects()` — `DomainData.effects` (deux `TriggeredEffect` : purge états sur cibles vivantes ; frappe supplémentaire sur Mort-vivants). Le bonus `+10` en environnement rura
- **docs\raw\magie.md** L790 — | Attributs de Domaine — Feu (Enflammé + bonus si états proches) | LDB 48 l.201 | Partiel — rider OK ; bonus +10 par état voisin non implémenté |
- **docs\raw\magie.md** L795 — | Attributs de Domaine — Vie (purge états + frappe Mort-vivants + +10 rural) | LDB 48 l.679 | Partiel — purge+frappe OK ; +10 rural non implémenté |
- **docs\raw\magie.md** L817 — 1. **Influences Malfaisantes (le « 8 »)** : non implémenté en runtime — la détection du chiffre 8 au dé des unités n'est pas branchée dans `resolveCasting` / `resolveFocus`. À brancher si cette règle 
- **docs\raw\magie.md** L822 — 6. **Attribut Feu — bonus +10 par état Enflammé voisin** (LDB 48 l.201) : non implémenté — nécessiterait un scan de la scène à chaque incantation pour compter les états actifs à ≤ BFM mètres.
- **docs\raw\magie.md** L823 — 7. **Attribut Vie — +10 en environnement rural/sauvage** (LDB 48 l.679) : non implémenté — pas de classification rurale/urbaine des scènes dans le moteur.
- **docs\raw\maladies.md** L507 — **Implémente** : non implémenté — parasite hors cycle maladie standard (progression en phases distinctes, pas de `tickDisease` générique applicable).
- **docs\raw\maladies.md** L525 — **Implémente** : non implémenté dans `maladies.json`.
- **docs\raw\maladies.md** L549 — **Implémente** : non implémenté dans `maladies.json`.
- **docs\raw\maladies.md** L567 — **Implémente** : symptôme non implémenté (absent des 12 kinds LDB).
- **docs\raw\maladies.md** L598 — **Implémente** : non implémenté (aucune herbe n'est modélisée dans le système de maladies).
- **docs\raw\maladies.md** L612 — **Implémente** : non implémenté.
- **docs\raw\maladies.md** L630 — **Implémente** : non implémenté.
- **docs\raw\maladies.md** L687 — | Résistance (Maladie) Talent | Non implémenté — le reroll Talent est générique (1×/séance auto-succès) | |
- **docs\raw\maladies.md** L688 — | Symptômes EDO (Délire, Gonflement) | **Non implémentés** — Fièvre Cérébrale Pourpre absente de `maladies.json` | À ajouter si EDO joué |
- **docs\raw\maladies.md** L689 — | Trait Contagieux (EDO) | **Non implémenté** | |
- **docs\raw\maladies.md** L690 — | **T2C ch.14 — Tableaux d'exposition aquatique** | **Non implémenté** — ingestion/immersion dans rivière sale (T2C 16 l.10-49) | |
- **docs\raw\maladies.md** L691 — | **T2C ch.14 — Colique** | **Non implémenté** — absente de `maladies.json` | |
- **docs\raw\maladies.md** L692 — | **T2C ch.14 — Vers de Carie** | **Non implémenté** — cycle en 3 phases hors modèle générique | |
- **docs\raw\maladies.md** L693 — | **T2C ch.14 — Vers du Reik** | **Non implémenté** — absents de `maladies.json` (incubation 85+1d10 j) | |
- **docs\raw\maladies.md** L694 — | **T2C ch.14 — Symptôme Crampes Abdominales** | **Non implémenté** — absent des 12 kinds LDB | |
- **docs\raw\maladies.md** L695 — | **T2C ch.2 — Herbes médicinales (Gesundheit, Racine des Tombes, Rouille Mouchetée)** | **Non implémenté** — aucune herbe modélisée dans le moteur de maladies | |
- **docs\raw\maladies.md** L729 — **Implémente** : (non implémenté) — contagion « à bord » et contamination de tonneau spécifiques à la vie en mer ; le cycle de maladie générique vit dans `src/engine/disease.ts` (`contagiousDiseases`,
- **docs\raw\maladies.md** L759 — **Implémente** : (non implémenté) — maladie absente de `maladies.json` ; symptômes *malaise* / *nausée* déjà modélisés (`src/engine/disease.ts` · `diseaseCharPenalties`, `combatFlow.ts`). À ajouter si
- **docs\raw\maladies.md** L783 — **Implémente** : (non implémenté) — maladie absente de `maladies.json`. Spécificités à modéliser : Contraction mensuelle liée au régime, mitigation +40 par soupe de chou fermenté, durée gelée tant que
- **docs\raw\maladies.md** L817 — **Implémente** : (non implémenté pour le contexte maritime) — règle de Faim/rations générique dans `src/engine/provisions.ts` (consommation/jour, Tests, malus). Spécificités MDG à ajouter si un voyage
- **docs\raw\religion.md** L44 — - **Implémenté vs non implémenté** — effets purement navals (Humeur de Manann, Indice M, Indice de Voie d'eau, vent, IC, ne-peut-couler) hors moteur actuel → (non implémenté) ; effets sur personnages/
- **docs\raw\talents.md** L1583 — - `commandant-d-equipe` (AA) : logique score Projectiles partagé non implémentée (donnée présente, logique absente)
- **docs\raw\talents.md** L1585 — - Mises à jour AA (Battement -1 si 6 DR, Cavalier émérite Taille monture, Porte-Bouclier 2 Avantages/2m, Renversement prendre 1 seul Avantage) : le code suit la version LDB — divergences AA non implém
- **docs\raw\tests.md** L358 — **Implémente** : (non implémenté dans `src/engine/` — le bonus de soutien de +10 par participant est une logique à gérer côté état/UI)

## B2 — Chapitres LDB cités par l'Atlas, jamais référencés dans le code

LDB 06 · LDB 6 · LDB 7 · LDB 8 · LDB 26 · LDB 27 · LDB 28 · LDB 29 · LDB 30 · LDB 31 · LDB 32 · LDB 33 · LDB 34 · LDB 35 · LDB 38 · LDB 39 · LDB 44 · LDB 50 · LDB 66 · LDB 68 · LDB 69 · LDB 70 · LDB 80

## Autres livres

Code : AA, ADE I, ADE II, EDOC, MDG, NADAJ, T2C
Atlas : AA, ADE I, ADE II, Altdorf, EDO, EDOC, MDG, Middenheim, NADAJ, T2, T2C, T3, Ubersreik, ZI
