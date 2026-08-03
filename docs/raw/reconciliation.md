# Atlas RAW — Réconciliation CODE ↔ ATLAS

> Déterministe (`node scripts/raw/reconcile.mjs`). **Sens A** = règles que l'app applique
> (réfs `LDB NN l.X` dans `src/`, et pour les 14 autres livres `<ABRÉV> NN l.X`) absentes de
> l'Atlas. **Sens B** = règles que l'Atlas décrit hors du code (borné au LDB).
> Tolérance ligne = ±20.

**Sens A — code → Atlas (LDB)** : 0 chapitre(s) cités par le code & absents de l'Atlas · 0 chapitre(s) couverts avec des lignes non pinées. Réfs folio (`ABBR NN p.X`, #606) côté Atlas : 3 ignorée(s) proprement (ancre absente/ambiguë/hors-chapitre).
**Sens A — code → Atlas (14 autres livres)** : 1 chapitre(s)-livre cités par le code & absents de l'Atlas · 6 chapitre(s)-livre couverts avec des lignes non pinées · 0 réf(s) sans chapitre (non réconciliables par cette mesure).
**Sens B — Atlas → code (LDB)** : 3 marqueur(s) « (non implémenté) » · 1 chapitre(s) LDB cités par l'Atlas jamais référencés dans le code (avant crédit folio : 12 · 11 crédités par une source folio de `src/data`).

## A1 — Chapitres appelés par le CODE (LDB), ABSENTS de l'Atlas (trous durs)

_Aucun. Tout chapitre LDB référencé dans le code est cité par au moins une fiche._

## A2 — Lignes appelées par le CODE (LDB) non pinées par l'Atlas (chapitre couvert, règle peut-être survolée)

_Aucune._

## A-AUTRES 0 — Résumé Sens A par livre (14 livres hors LDB)

| Livre | Trous durs (chapitres) | Chapitres à lignes non pinées | Réfs sans chapitre |
|---|---|---|---|
| ADE I | 0 | 1 | 0 |
| ADE II | 0 | 1 | 0 |
| EDOC | 0 | 1 | 0 |
| MDG | 1 | 1 | 0 |
| MSRC | 0 | 1 | 0 |
| VDM | 0 | 1 | 0 |

## A1-AUTRES — Chapitres appelés par le CODE (autres livres), ABSENTS de l'Atlas (trous durs)

### MDG 3 — 5 réf(s) code, 0 dans l'Atlas
- `src/state/restFlow.ts:66` (l.71) — /** À bord du navire de campagne (hamacs/quartiers, MDG 03 l.71 · 09 l.87) — couchage ABRITÉ (pas
- `src/state/restFlow.ts:587` (l.71) — if (places.bord) out.push('bord'); // à bord = hamacs (MDG 03 l.71) ; par défaut si offert
- `src/state/riverVoyageFlow.ts:858` (l.71) — // Sur la rivière on peut mouiller le long de la berge : coucher À BORD (hamacs, MDG 03 l.71) offert
- `src/state/seaActivities.ts:234` (l.71) — // dort à bord (hamacs, MDG 03 l.71) : couchage unique et abrité.

## A2-AUTRES — Lignes appelées par le CODE (autres livres) non pinées par l'Atlas

### MSRC 12 — 5/11 ligne(s) code hors couverture
- l.85 — `src/data/index.ts:1707` — *  = `totale` (MDG 12 l.364 / MSRC 12 l.85), Plat-bord = `moyenne` (MSRC 12 l.111). Géométrie de Pont,
- l.107 — `src/engine/naval-traits.test.ts:297` — it('Plat-bord : palier de LONGUEUR (grande barge ~30 m, bande ouverte au-delà de 20 m) → 45 CO / 60 Enc (MSRC 12 l.107/109)', () => {
- l.111 — `src/data/index.ts:1707` — *  = `totale` (MDG 12 l.364 / MSRC 12 l.85), Plat-bord = `moyenne` (MSRC 12 l.111). Géométrie de Pont,
- l.117 — `src/engine/naval-traits.test.ts:300` — it('Allégement : ALLÈGE la coque — weightEnc NÉGATIF (grande barge → −80 Enc, MSRC 12 l.117)', () => {
- l.137 — `src/data/schemas/defs/sea-weather.ts:106` — /** Gréement de course (MSRC 12 l.137) : DELTA de % voiles ajouté au tableau standard par aspect de vent. */

### ADE II 4 — 4/5 ligne(s) code hors couverture
- l.41 — `src/state/interlude-activities.test.ts:316` — it('Identifier : exige Savoir (Magie) acquis (« Pour d’autres sorciers », ADE II 4 l.41)', () => {
- l.43 — `src/state/interlude-activities.test.ts:334` — // ADE II 4 l.43-52 — table de DR complète (le POC collapsait ≥+4/≤+3 et IGNORAIT la ligne « 0 à +1 »).
- l.46 — `src/state/interlude-activities.test.ts:300` — // ── Identifier un artefact magique (ADE II 4 l.46-59) ─────────────────────────────────────
- l.50 — `src/state/interlude-activities.test.ts:359` — it('Identifier : Échec (−2 à −3) → confond avec un objet similaire, AUCUNE fausse Particularité (ADE II 4 l.50)', () => {

### MDG 15 — 3/35 ligne(s) code hors couverture
- l.461 — `src/data/naval-ports.test.ts:45` — it('Erengrad : Taille 4, Richesse 4, Surplus pièces-détachées-de-navire +1, Demande laine +1 (MDG 15 l.461-462, folio 138)', () => {
- l.468 — `src/data/naval-ports.test.ts:65` — it('Kirkjugarður Langskipa : production armes/produits-de-luxe, sans surplus ni demande (MDG 15 l.468-469, folio 138)', () => {
- l.474 — `src/data/naval-ports.test.ts:72` — it('Fjirgard : production produits-de-luxe, Demande armes +1, sans surplus (MDG 15 l.474, folio 138)', () => {

### VDM 14 — 3/7 ligne(s) code hors couverture
- l.353 — `src/data/arcanePhenomena.ts:77` — /** Modificateurs de NIVEAU D'INCANTATION apportés par le lieu (`VDM 14 l.353`, l.437, l.489) —
- l.437 — `src/engine/castingNumber.test.ts:28` — it('Caverne de l’Attache : moitié ARRONDIE À L’INFÉRIEUR, Sorts de la Bête (VDM 14 l.437)', () => {
- l.489 — `src/data/index.ts:1334` — *  deux natures (`VDM 12 l.646-647`, `VDM 14 l.489`). */

### EDOC 13 — 2/7 ligne(s) code hors couverture
- l.137 — `src/data/index.ts:437` — *  permission du MJ », EDOC 13 l.137 ; lignage Éonir Harioth hors espèces jouables, ADE I 6 l.185).
- l.522 — `src/data/index.ts:930` — /** Tirage PLURIEL et ALTERNÉ de Mutations au spawn (Marque de Tzeentch, EDOC 13 l.522-524 : « gagne

### ADE I 6 — 1/1 ligne(s) code hors couverture
- l.185 — `src/data/index.ts:437` — *  permission du MJ », EDOC 13 l.137 ; lignage Éonir Harioth hors espèces jouables, ADE I 6 l.185).

## A3-AUTRES — Réfs de CODE sans chapitre (`<ABRÉV> l.X`, pas d'unité chapitre à couvrir)

_Aucune._

## B1 — Règles décrites par l'Atlas marquées « (non implémenté) » (LDB)

- **docs\raw\00-index.md** L16 — le code mort détecté, `(non implémenté)` sinon. Source éditoriale (dettes/blocages) :
- **docs\raw\00-index.md** L69 — - **[`reconciliation.md`](reconciliation.md)** (`node scripts/raw/reconcile.mjs`) — code ↔ Atlas. **Sens A : zéro trou dur toléré** (chapitre cité par le code absent de l'Atlas = trou à ticketer ; non
- **docs\raw\bestiaire.md** L382 — **Implémente :** (non implémenté)

## B2 — Chapitres LDB cités par l'Atlas, jamais référencés dans le code

_Avant crédit folio (12)_ : LDB 26 · LDB 27 · LDB 28 · LDB 29 · LDB 30 · LDB 31 · LDB 32 · LDB 33 · LDB 34 · LDB 35 · LDB 38 · LDB 39

_Crédités par une source folio de `src/data/*.json` (11, donnée référencée sans réf de ligne)_ : LDB 26 · LDB 27 · LDB 28 · LDB 29 · LDB 30 · LDB 31 · LDB 32 · LDB 33 · LDB 34 · LDB 35 · LDB 39

**VRAIS hors-code (après crédit folio) :**
LDB 38

## Autres livres

Code : AA, ACE, ADE I, ADE II, EDOC, MCLB, MDG, MSRC, NADJ, PDT, VDM
Atlas : AA, ACE, ADE I, ADE II, AU1, EDO, EDOC, MCLB, MDG, MSR, MSRC, NADJ, PDT, VDM, ZI
