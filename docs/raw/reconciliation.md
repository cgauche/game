# Atlas RAW — Réconciliation CODE ↔ ATLAS

> Déterministe (`node scripts/raw/reconcile.mjs`). **Sens A** = règles que l'app applique
> (réfs `LDB NN l.X` dans `src/`, et pour les 14 autres livres `<ABRÉV> NN l.X`) absentes de
> l'Atlas. **Sens B** = règles que l'Atlas décrit hors du code (borné au LDB).
> Tolérance ligne = ±20.

**Sens A — code → Atlas (LDB)** : 0 chapitre(s) cités par le code & absents de l'Atlas · 4 chapitre(s) couverts avec des lignes non pinées.
**Sens A — code → Atlas (14 autres livres)** : 3 chapitre(s)-livre cités par le code & absents de l'Atlas · 8 chapitre(s)-livre couverts avec des lignes non pinées · 64 réf(s) sans chapitre (non réconciliables par cette mesure).
**Sens B — Atlas → code (LDB)** : 10 marqueur(s) « (non implémenté) » · 4 chapitre(s) LDB cités par l'Atlas jamais référencés dans le code (avant crédit folio : 20 · 16 crédités par une source folio de `src/data`).

## A1 — Chapitres appelés par le CODE (LDB), ABSENTS de l'Atlas (trous durs)

_Aucun. Tout chapitre LDB référencé dans le code est cité par au moins une fiche._

## A2 — Lignes appelées par le CODE (LDB) non pinées par l'Atlas (chapitre couvert, règle peut-être survolée)

### LDB 46 — 10/37 ligne(s) code hors couverture (propriétaire : docs\raw\magie.md)
- l.185 — `src/state/combatSlice.ts:3055` — // Focalisation CRITIQUE (LDB 46 l.185-186) : le sort est lançable au prochain Round
- l.188 — `src/data/index.ts:577` — *  (Chamon/Azyr ignorent le métal, Ghur le cuir, LDB 46 l.188). Remplace la devinette par regex sur le nom. */
- l.193 — `src/state/combatFlow.ts:2021` — // Interruption de Focalisation (LDB 46 l.193-194) : Dégâts subis pendant qu'on focalise
- l.194 — `src/engine/ops.ts:626` — /** Marqueur IMPUR de la branche d'ÉCHEC du Test de Calme d'interruption de Focalisation (LDB 46 l.194) :
- l.199 — `src/engine/magic.ts:165` — * « Repousser les Vents » (LDB 46 l.199) : −1 DR aux Tests d'Incantation et de
- l.201 — `src/engine/engine.test.ts:699` — it('Dissipation (LDB 46 l.201-202) : Test opposé — gagné → dissipé ; perdu → le Sort garde le DR NET', () => {
- l.202 — `src/engine/magic.ts:547` — *  Contre-sort (LDB 46 l.202 : « le lanceur tient le rôle attaquant »). Source unique. */
- l.204 — `src/engine/conditions.ts:471` — *  DISSIPATION (LDB 46 l.204-207, `engine/dispel`). Renvoie les effets retirés (pour le journal). */
- l.205 — `src/state/extended-test.test.ts:53` — it('Dissipation (LDB 46 l.205) : DR cumulé atteignant le NI retire les effets du sort de ses porteurs', () => {
- l.207 — `src/engine/tests.ts:218` — *  œuvre de concert (Test étendu, Tests de groupe hors combat, Dissipation à plusieurs LDB 46 l.207…). */

### LDB 10 — 6/22 ligne(s) code hors couverture (propriétaire : docs\raw\tests.md)
- l.310 — `src/engine/types.ts:858` — /** Aura magique DÉTECTÉE (Talent Détection d'artefact, LDB 10 l.310-312 : « vous sentez que
- l.364 — `src/engine/types.ts:1390` — /** Distraire (LDB 10 l.364 / AA 13 l.51) : distrait par un adversaire → ne peut gagner AUCUN Avantage
- l.365 — `src/state/combatFlow.ts:4529` — *  Réutilisé par la Chirurgie (infection post-opératoire, LDB 10 l.365) : Chance/Résilience + auto-succès
- l.569 — `src/engine/grimoire.ts:11` — *    inclusives — aucun sort inclus au Talent, LDB 10 l.569).
- l.859 — `src/state/granted-traits.test.ts:122` — it('Sans Peur POSSÉDÉ ciblé (LDB 10 l.859) : immunise vs l’Ennemi spécifié seulement', async () => {
- l.864 — `src/engine/psychology.ts:75` — *  NB : « Sans Peur (Ennemi) » (LDB 10 l.864) ne supprime PLUS la source ici (ce n'était pas RAW : le

### LDB 15 — 4/32 ligne(s) code hors couverture (propriétaire : docs\raw\combat.md)
- l.500 — `src/state/pursuitFlow.ts:39` — /** Distance de départ (LDB 15 l.500-504 : 1 = presque à portée … 8 = presque hors de portée). */
- l.512 — `src/state/pursuitFlow.ts:12` — * adversaires (PNJ) roulent en clôture de manche. On compare (LDB 15 l.512-515) le DR le plus BAS des
- l.518 — `src/scenes/test-scenarios/95-poursuite-terrestre.ts:44` — // Secours si rattrapés (Distance ≤ 0, LDB 15 l.518) — mêmes brigands, cachés tant que la fuite tient.
- l.520 — `src/state/pursuitFlow.ts:150` — get().log(p.partyRole === 'fleeing' ? 'Le groupe a semé ses poursuivants — fuite réussie (LDB 15 l.520).' : 'La proie s\'est échappée — la poursuite est perdue 

### LDB 12 — 1/30 ligne(s) code hors couverture (propriétaire : docs\raw\tests.md)
- l.229 — `src/engine/activities.ts:229` — /** Test COMBINÉ (LDB 12 l.229) : UN jet confronté aux DEUX premières `skills` (Infiltration Discrétion+

## A-AUTRES 0 — Résumé Sens A par livre (14 livres hors LDB)

| Livre | Trous durs (chapitres) | Chapitres à lignes non pinées | Réfs sans chapitre |
|---|---|---|---|
| ADE I | 0 | 1 | 0 |
| ADE II | 0 | 1 | 12 |
| EDOC | 1 | 3 | 29 |
| MDG | 1 | 1 | 6 |
| T2C | 1 | 2 | 17 |

## A1-AUTRES — Chapitres appelés par le CODE (autres livres), ABSENTS de l'Atlas (trous durs)

### EDOC 13 — 15 réf(s) code, 0 dans l'Atlas
- `src/engine/combatFeatures/dispatch.ts:47` (l.264) — *  Chaos → undefined (un Sort d'Arcanes du Chaos est réservé aux porteurs du Talent, EDOC 13 l.264-266). */
- `src/engine/corruption.ts:167` (l.276) — *  Sort », EDOC 13 l.276-277) ; le chemin CORRUPTION (corruptionFlow → `attachMutation` direct, sans effet
- `src/engine/ops.ts:670` (l.230) — *  à l'axe Durée (`ctx.overcastDurationSteps`, LDB 47 l.13-17 / EDOC 13 l.230+270-276 : « pour chaque +2 DR
- `src/engine/ops.ts:678` (l.276) — *  `grantTrait` (EDOC 13 l.276-277 « appliquez […] pour toute la durée du Sort ») : durée du contexte

### MDG 3 — 5 réf(s) code, 0 dans l'Atlas
- `src/state/restFlow.ts:65` (l.71) — /** À bord du navire de campagne (hamacs/quartiers, MDG 03 l.71 · 09 l.87) — couchage ABRITÉ (pas
- `src/state/restFlow.ts:581` (l.71) — if (places.bord) out.push('bord'); // à bord = hamacs (MDG 03 l.71) ; par défaut si offert
- `src/state/riverVoyageFlow.ts:857` (l.71) — // Sur la rivière on peut mouiller le long de la berge : coucher À BORD (hamacs, MDG 03 l.71) offert
- `src/state/seaActivities.ts:233` (l.71) — // dort à bord (hamacs, MDG 03 l.71) : couchage unique et abrité.

### T2C 10 — 41 réf(s) code, 0 dans l'Atlas
- `src/data/index.ts:1445` (l.54) — /** Palier de LONGUEUR d'un tarif d'installation (#277 : T2C ch.10 l.54-135 tarife par TYPE de navire à
- `src/data/index.ts:1453` (l.1) — *  Amélioration, l.195-364 ; T2C ch.10 l.1-140) — VERBATIM structuré par paliers de LONGUEUR. `per: '5m'` =
- `src/data/index.ts:1481` (l.85) — *  = `totale` (MDG ch.12 l.364 / T2C ch.10 l.85), Plat-bord = `moyenne` (T2C ch.10 l.111). Géométrie de Pont,
- `src/data/index.ts:1481` (l.111) — *  = `totale` (MDG ch.12 l.364 / T2C ch.10 l.85), Plat-bord = `moyenne` (T2C ch.10 l.111). Géométrie de Pont,

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
- l.11 — `src/ui/compendium/codex-exposure-guard.test.ts:164` — 'river-navigation.json': "AUDIT : à exposer -> ticket — table de vent/navigation fluviale (T2C ch.5 l.11-41), consommée par `engine/riverNavigation.ts`, aucune 
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

### MDG 15 — 8/33 ligne(s) code hors couverture
- l.243 — `src/state/seaVoyageFlow.ts:2355` — *  mentionnent pas la relâche à terre — vérifié entrée par entrée (MDG 15 l.243-263) — donc non gatées. */
- l.245 — `src/scenes/test-scenarios/14-voyage-maritime.test.ts:55` — if (get().pendingShoreLeave) { get().resolveShoreLeave(true); continue; } // accoste : relâche accordée par défaut (MDG 15 l.245)
- l.439 — `src/data/index.ts:1497` — /** Index des ports de la Mer des Griffes (#217, MDG ch.15 l.439-506) — catalogue app-owned éditable au
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

### EDOC 9 — 1/2 ligne(s) code hors couverture
- l.137 — `src/data/index.ts:399` — *  permission du MJ », EDOC ch.9 l.137 ; lignage Éonir Harioth hors espèces jouables, ADE1 ch.6 l.185).

## A3-AUTRES — Réfs de CODE sans chapitre (`<ABRÉV> l.X`, pas d'unité chapitre à couvrir)

### ADE II — 12 réf(s) sans chapitre
- `src/data/index.ts:1235` (l.62) — /** L'Étoile du Sorcier (ADE2 l.62) : fourchette du 1d10 interne `[min, max]` parmi les variantes
- `src/data/schemas/defs/stars.ts:24` (l.62) — /** Étoile du Sorcier (ADE2 l.62) : fourchette 1d10 interne `[min, max]` — tuple STRICT (2 éléments,
- `src/engine/combat-breakdown.test.ts:135` (l.228) — it('De plaies atroces (qualité magique ADE2 l.228) = Dévastatrice : max(DR, dé des unités)', () => {
- `src/engine/creation.test.ts:57` (l.62) — it('l\'Étoile du Sorcier : le 1d10 interne produit les 4 variantes (ADE2 l.62)', () => {
- … +8 autres

### EDOC — 29 réf(s) sans chapitre
- `src/engine/activities.ts:201` (l.172) — /** Compétence LIBRE choisie par le joueur (Pratiquer une Compétence, EDOC l.172). */
- `src/engine/activities.ts:203` (l.161) — /** Test ÉTENDU (LDB 12) : DR requis = `drPerStage` × nombre d'Étapes (Établir des cartes, EDOC l.161). */
- `src/engine/activities.ts:205` (l.133) — /** RAW EDOC l.133 : échouer le Test d'une Activité octroie un État Exténué. */
- `src/engine/activities.ts:208` (l.106) — *  en dur) : Plein air « -10 par degré de temps éloigné de Beau temps » (EDOC l.106), Approvisionnement
- … +25 autres

### MDG — 6 réf(s) sans chapitre
- `src/engine/cargo.ts:22` (l.402) — *  MDG l.402-418). PUR. Repli sur la dernière entrée si aucune plage ne matche (tableaux exhaustifs 01-00). */
- `src/engine/warMachineCrew.ts:23` (l.3900) — *  (headcount brut — le RAW ne pose ICI aucune exigence de Compétence, à la différence d'AA/MDG l.3900),
- `src/state/combatFlow.ts:266` (l.3900) — // ICI aucune exigence de Compétence pour compter dans l'Équipe (≠ AA/MDG l.3900 ci-dessus) — 3ᵉ courbe,
- `src/state/combatSlice.ts:1784` (l.464) — // DISTINCT du Défaut Arme d'équipe (MDG l.464, `crewedFireWeapon`/`exposedCrew` ci-dessus — headcount
- … +2 autres

### T2C — 17 réf(s) sans chapitre
- `src/engine/cargo.ts:21` (l.71) — /** Cargaison ALÉATOIRE de la saison : d100 dans la colonne saisonnière du tableau fourni (T2C l.71-78,
- `src/engine/cargo.ts:28` (l.80) — /** Prix de BASE d'une cargaison (CO par 10 points d'Encombrement) pour la saison (T2C l.80-90, MDG
- `src/engine/cargo.ts:35` (l.127) — /** Ampleur du Marchandage (LDB p.291, cité T2C l.127 & MDG) : le prix bouge de ±10 %, ou ±20 % si le
- `src/engine/land-cargo.test.ts:16` (l.164) — // Exemples canoniques de l'Index géographique du Reikland (T2C l.164-174).
- … +13 autres

## B1 — Règles décrites par l'Atlas marquées « (non implémenté) » (LDB)

- **docs\raw\00-index.md** L16 — le code mort détecté, `(non implémenté)` sinon. Source éditoriale (dettes/blocages) :
- **docs\raw\00-index.md** L69 — - **[`reconciliation.md`](reconciliation.md)** (`node scripts/raw/reconcile.mjs`) — code ↔ Atlas. **Sens A : zéro trou dur toléré** (chapitre cité par le code absent de l'Atlas = trou à ticketer ; non
- **docs\raw\activites.md** L441 — **Implémente :** (non implémenté)
- **docs\raw\activites.md** L457 — **Implémente :** (non implémenté)
- **docs\raw\activites.md** L473 — **Implémente :** (non implémenté)
- **docs\raw\activites.md** L491 — **Implémente :** (non implémenté)
- **docs\raw\activites.md** L537 — **Implémente :** (non implémenté)
- **docs\raw\bestiaire.md** L314 — **Implémente :** (non implémenté)
- **docs\raw\bestiaire.md** L384 — **Implémente :** (non implémenté)
- **docs\raw\competences.md** L1037 — **Implémente :** (non implémenté)

## B2 — Chapitres LDB cités par l'Atlas, jamais référencés dans le code

_Avant crédit folio (20)_ : LDB 6 · LDB 26 · LDB 27 · LDB 28 · LDB 29 · LDB 30 · LDB 31 · LDB 32 · LDB 33 · LDB 34 · LDB 35 · LDB 38 · LDB 39 · LDB 44 · LDB 50 · LDB 66 · LDB 68 · LDB 69 · LDB 70 · LDB 80

_Crédités par une source folio de `src/data/*.json` (16, donnée référencée sans réf de ligne)_ : LDB 26 · LDB 27 · LDB 28 · LDB 29 · LDB 30 · LDB 31 · LDB 32 · LDB 33 · LDB 34 · LDB 35 · LDB 39 · LDB 50 · LDB 66 · LDB 68 · LDB 70 · LDB 80

**VRAIS hors-code (après crédit folio) :**
LDB 6 · LDB 38 · LDB 44 · LDB 69

## Autres livres

Code : AA, ADE I, ADE II, EDOC, MDG, NADAJ, T2C, T3
Atlas : AA, ADE I, ADE II, Altdorf, EDO, EDOC, MDG, Middenheim, NADAJ, T2, T2C, T3, Ubersreik, ZI
