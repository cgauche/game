# Atlas RAW — Réconciliation CODE ↔ ATLAS

> Déterministe (`node scripts/raw/reconcile.mjs`). **Sens A** = règles que l'app applique
> (réfs `LDB NN l.X` dans `src/`, et pour les 14 autres livres `<ABRÉV> NN l.X`) absentes de
> l'Atlas. **Sens B** = règles que l'Atlas décrit hors du code (borné au LDB).
> Tolérance ligne = ±20.

**Sens A — code → Atlas (LDB)** : 0 chapitre(s) cités par le code & absents de l'Atlas · 2 chapitre(s) couverts avec des lignes non pinées.
**Sens A — code → Atlas (14 autres livres)** : 2 chapitre(s)-livre cités par le code & absents de l'Atlas · 5 chapitre(s)-livre couverts avec des lignes non pinées · 65 réf(s) sans chapitre (non réconciliables par cette mesure).
**Sens B — Atlas → code (LDB)** : 3 marqueur(s) « (non implémenté) » · 4 chapitre(s) LDB cités par l'Atlas jamais référencés dans le code (avant crédit folio : 20 · 16 crédités par une source folio de `src/data`).

## A1 — Chapitres appelés par le CODE (LDB), ABSENTS de l'Atlas (trous durs)

_Aucun. Tout chapitre LDB référencé dans le code est cité par au moins une fiche._

## A2 — Lignes appelées par le CODE (LDB) non pinées par l'Atlas (chapitre couvert, règle peut-être survolée)

### LDB 10 — 6/26 ligne(s) code hors couverture (propriétaire : docs\raw\tests.md)
- l.310 — `src/engine/types.ts:886` — /** Aura magique DÉTECTÉE (Talent Détection d'artefact, LDB 10 l.310-312 : « vous sentez que
- l.364 — `src/engine/types.ts:1425` — /** Distraire (LDB 10 l.364 / AA 13 l.51) : distrait par un adversaire → ne peut gagner AUCUN Avantage
- l.365 — `src/state/combatFlow.ts:4580` — *  Réutilisé par la Chirurgie (infection post-opératoire, LDB 10 l.365) : Chance/Résilience + auto-succès
- l.680 — `src/engine/grimoire.ts:11` — *    inclusives — aucun sort inclus au Talent, LDB 10 l.680-686).
- l.859 — `src/state/granted-traits.test.ts:122` — it('Sans Peur POSSÉDÉ ciblé (LDB 10 l.859) : immunise vs l’Ennemi spécifié seulement', async () => {
- l.864 — `src/engine/psychology.ts:75` — *  NB : « Sans Peur (Ennemi) » (LDB 10 l.864) ne supprime PLUS la source ici (ce n'était pas RAW : le

### LDB 46 — 3/37 ligne(s) code hors couverture (propriétaire : docs\raw\magie.md)
- l.183 — `src/data/index.ts:1730` — /** Tableau des Vents Tourbillonnants (LDB 46 l.183-190, option `vents-tourbillonnants`) — tirage 1d10
- l.185 — `src/state/combatSlice.ts:3098` — // Focalisation CRITIQUE (LDB 46 l.185-186) : le sort est lançable au prochain Round
- l.188 — `src/data/index.ts:594` — *  (Chamon/Azyr ignorent le métal, Ghur le cuir, LDB 46 l.188). Remplace la devinette par regex sur le nom. */

## A-AUTRES 0 — Résumé Sens A par livre (14 livres hors LDB)

| Livre | Trous durs (chapitres) | Chapitres à lignes non pinées | Réfs sans chapitre |
|---|---|---|---|
| ADE I | 0 | 1 | 0 |
| ADE II | 0 | 1 | 13 |
| EDOC | 1 | 1 | 29 |
| MDG | 1 | 1 | 6 |
| T2C | 0 | 1 | 17 |

## A1-AUTRES — Chapitres appelés par le CODE (autres livres), ABSENTS de l'Atlas (trous durs)

### EDOC 13 — 25 réf(s) code, 0 dans l'Atlas
- `src/engine/combatFeatures/dispatch.ts:47` (l.264) — *  Chaos → undefined (un Sort d'Arcanes du Chaos est réservé aux porteurs du Talent, EDOC 13 l.264-266). */
- `src/engine/corruption.ts:174` (l.276) — *  Sort », EDOC 13 l.276-277) ; le chemin CORRUPTION (corruptionFlow → `attachMutation` direct, sans effet
- `src/engine/ops.ts:686` (l.276) — *  `grantTrait` (EDOC 13 l.276-277 « appliquez […] pour toute la durée du Sort ») : durée du contexte
- `src/engine/ops.ts:981` (l.230) — *  `rollTable.extraRollsPerStep` (LDB 47 l.13-17, EDOC 13 l.230+270-276). */

### MDG 3 — 5 réf(s) code, 0 dans l'Atlas
- `src/state/restFlow.ts:65` (l.71) — /** À bord du navire de campagne (hamacs/quartiers, MDG 03 l.71 · 09 l.87) — couchage ABRITÉ (pas
- `src/state/restFlow.ts:581` (l.71) — if (places.bord) out.push('bord'); // à bord = hamacs (MDG 03 l.71) ; par défaut si offert
- `src/state/riverVoyageFlow.ts:857` (l.71) — // Sur la rivière on peut mouiller le long de la berge : coucher À BORD (hamacs, MDG 03 l.71) offert
- `src/state/seaActivities.ts:233` (l.71) — // dort à bord (hamacs, MDG 03 l.71) : couchage unique et abrité.

## A2-AUTRES — Lignes appelées par le CODE (autres livres) non pinées par l'Atlas

### MDG 15 — 8/33 ligne(s) code hors couverture
- l.243 — `src/state/seaVoyageFlow.ts:2367` — *  mentionnent pas la relâche à terre — vérifié entrée par entrée (MDG 15 l.243-263) — donc non gatées. */
- l.245 — `src/scenes/test-scenarios/14-voyage-maritime.test.ts:55` — if (get().pendingShoreLeave) { get().resolveShoreLeave(true); continue; } // accoste : relâche accordée par défaut (MDG 15 l.245)
- l.439 — `src/data/index.ts:1535` — /** Index des ports de la Mer des Griffes (#217, MDG ch.15 l.439-506) — catalogue app-owned éditable au
- l.452 — `src/data/naval-ports.test.ts:37` — it('Salzenmund : Taille 4, Richesse 4, Surplus produits-de-luxe +1, Demande armes+céréales +1 (MDG 15 l.452, folio 138)', () => {
- l.456 — `src/data/naval-ports.test.ts:59` — it('Norden : Surplus poisson-salé +1, Demande armes +2/bois/métaux/pièces-détachées-de-navire +1 (MDG 15 l.456, folio 138)', () => {
- l.461 — `src/data/naval-ports.test.ts:45` — it('Erengrad : Taille 4, Richesse 4, Surplus pièces-détachées-de-navire +1, Demande laine +1 (MDG 15 l.461-462, folio 138)', () => {
- l.468 — `src/data/naval-ports.test.ts:65` — it('Kirkjugarður Langskipa : production armes/produits-de-luxe, sans surplus ni demande (MDG 15 l.468-469, folio 138)', () => {
- l.474 — `src/data/naval-ports.test.ts:72` — it('Fjirgard : production produits-de-luxe, Demande armes +1, sans surplus (MDG 15 l.474, folio 138)', () => {

### T2C 12 — 6/8 ligne(s) code hors couverture
- l.54 — `src/data/index.ts:1483` — /** Palier de LONGUEUR d'un tarif d'installation (#277 : T2C ch.12 l.54-135 tarife par TYPE de navire à
- l.62 — `src/engine/naval-traits.test.ts:191` — // Grande barge (~25 m, bande ouverte) : Bouteur 120 CO / 95 Enc ; Murs blindés 300 CO / 160 Enc (T2C ch.12 l.62/64, l.80/82).
- l.66 — `src/data/index.ts:1522` — /** Modificateur (points) au Test de Navigation POUR DIRIGER le bateau — Bouteur +20 (T2C ch.12 l.66),
- l.85 — `src/data/index.ts:1519` — *  = `totale` (MDG ch.12 l.364 / T2C ch.12 l.85), Plat-bord = `moyenne` (T2C ch.12 l.111). Géométrie de Pont,
- l.111 — `src/data/index.ts:1519` — *  = `totale` (MDG ch.12 l.364 / T2C ch.12 l.85), Plat-bord = `moyenne` (T2C ch.12 l.111). Géométrie de Pont,
- l.137 — `src/data/schemas/defs/sea-weather.ts:106` — /** Gréement de course (T2C ch.12 l.137) : DELTA de % voiles ajouté au tableau standard par aspect de vent. */

### ADE I 6 — 1/1 ligne(s) code hors couverture
- l.185 — `src/data/index.ts:407` — *  permission du MJ », EDOC ch.9 l.137 ; lignage Éonir Harioth hors espèces jouables, ADE1 ch.6 l.185).

### ADE II 4 — 1/1 ligne(s) code hors couverture
- l.46 — `src/state/interlude-activities.test.ts:181` — // ── Identifier un artefact magique (ADE2 ch.4 l.46-59) ─────────────────────────────────────

### EDOC 9 — 1/2 ligne(s) code hors couverture
- l.137 — `src/data/index.ts:407` — *  permission du MJ », EDOC ch.9 l.137 ; lignage Éonir Harioth hors espèces jouables, ADE1 ch.6 l.185).

## A3-AUTRES — Réfs de CODE sans chapitre (`<ABRÉV> l.X`, pas d'unité chapitre à couvrir)

### ADE II — 13 réf(s) sans chapitre
- `src/data/index.ts:1273` (l.62) — /** L'Étoile du Sorcier (ADE2 l.62) : fourchette du 1d10 interne `[min, max]` parmi les variantes
- `src/data/schemas/defs/stars.ts:24` (l.62) — /** Étoile du Sorcier (ADE2 l.62) : fourchette 1d10 interne `[min, max]` — tuple STRICT (2 éléments,
- `src/engine/combat-breakdown.test.ts:135` (l.228) — it('De plaies atroces (qualité magique ADE2 l.228) = Dévastatrice : max(DR, dé des unités)', () => {
- `src/engine/combatFeatures/encumbrance-factor.test.ts:6` (l.708) — * DISTINCT (choix de Taille), pas le porteur de la règle inconditionnelle ADE II l.708. `maxEncumbrance`
- … +9 autres

### EDOC — 29 réf(s) sans chapitre
- `src/engine/activities.ts:204` (l.172) — /** Compétence LIBRE choisie par le joueur (Pratiquer une Compétence, EDOC l.172). */
- `src/engine/activities.ts:206` (l.161) — /** Test ÉTENDU (LDB 12) : DR requis = `drPerStage` × nombre d'Étapes (Établir des cartes, EDOC l.161). */
- `src/engine/activities.ts:208` (l.133) — /** RAW EDOC l.133 : échouer le Test d'une Activité octroie un État Exténué. */
- `src/engine/activities.ts:211` (l.106) — *  en dur) : Plein air « -10 par degré de temps éloigné de Beau temps » (EDOC l.106), Approvisionnement
- … +25 autres

### MDG — 6 réf(s) sans chapitre
- `src/engine/cargo.ts:22` (l.402) — *  MDG l.402-418). PUR. Repli sur la dernière entrée si aucune plage ne matche (tableaux exhaustifs 01-00). */
- `src/engine/warMachineCrew.ts:23` (l.3900) — *  (headcount brut — le RAW ne pose ICI aucune exigence de Compétence, à la différence d'AA/MDG l.3900),
- `src/state/combatFlow.ts:274` (l.3900) — // ICI aucune exigence de Compétence pour compter dans l'Équipe (≠ AA/MDG l.3900 ci-dessus) — 3ᵉ courbe,
- `src/state/combatSlice.ts:1790` (l.464) — // DISTINCT du Défaut Arme d'équipe (MDG l.464, `crewedFireWeapon`/`exposedCrew` ci-dessus — headcount
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
- **docs\raw\bestiaire.md** L382 — **Implémente :** (non implémenté)

## B2 — Chapitres LDB cités par l'Atlas, jamais référencés dans le code

_Avant crédit folio (20)_ : LDB 6 · LDB 26 · LDB 27 · LDB 28 · LDB 29 · LDB 30 · LDB 31 · LDB 32 · LDB 33 · LDB 34 · LDB 35 · LDB 38 · LDB 39 · LDB 44 · LDB 50 · LDB 66 · LDB 68 · LDB 69 · LDB 70 · LDB 80

_Crédités par une source folio de `src/data/*.json` (16, donnée référencée sans réf de ligne)_ : LDB 26 · LDB 27 · LDB 28 · LDB 29 · LDB 30 · LDB 31 · LDB 32 · LDB 33 · LDB 34 · LDB 35 · LDB 39 · LDB 50 · LDB 66 · LDB 68 · LDB 70 · LDB 80

**VRAIS hors-code (après crédit folio) :**
LDB 6 · LDB 38 · LDB 44 · LDB 69

## Autres livres

Code : AA, ACE, ADE I, ADE II, EDOC, MDG, Middenheim, NADAJ, T2C, T3
Atlas : AA, ACE, ADE I, ADE II, EDO, EDOC, MDG, Middenheim, NADAJ, T2, T2C, T3, Ubersreik, ZI
