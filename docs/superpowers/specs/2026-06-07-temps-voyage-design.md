# Temps & Voyage — Spec de cadrage (sous-projet #T)

*Date : 2026-06-07. Statut : design #T1 validé ; #T2/#T3 esquissés ; Marchand v1 en pause (annexe).*

## 1. Contexte

Jalon 1.6 re-séquencé en cours de session. Le sous-projet **#1 Qualité d'objet est LIVRÉ** (Phase 0+A+B+C1+C2, ~1118 tests verts, poussé). L'utilisateur veut bâtir un système **Temps & Voyage AVANT le Marchand**, car le re-stock de Disponibilité, la Fatigue de voyage, la guérison naturelle, la progression des maladies/Corruption — tout cela dépend du passage du temps.

**Greenfield** : aucune horloge/date dans le moteur ni le store. Ce qui existe : les **transitions de scène** (`store.transitionTo`, Effect `transition`, `previousScene`) — se déplacer d'un lieu à l'autre marche, **mais sans coût en temps** ; la campagne est une **liste plate de scènes** (`scenes/campaign.ts`, pas de graphe de lieux ni de distances) ; `encumbrance.ts:travelFatigue` est calculé mais jamais appliqué.

## 2. Décomposition de Temps & Voyage

| | Pièce | Rôle | Dépend de |
|---|---|---|---|
| **#T1** | **Horloge & Calendrier impérial** (CETTE SPEC) | état date+heure, API `advanceTime`, coûts-temps des actions, affichage | — (fondation) |
| **#T2** | **Voyage** | graphe de lieux + distances, coût-temps (vitesse = Mouvement, RAW Déplacement), rencontres de voyage, repos | #T1 |
| **#T3** | **Cascade temporelle RAW** | ce que le passage du temps déclenche : guérison naturelle (LDB 18), Fatigue/Exténué (surcharge + voyage), maladies/infections (LDB 20), Corruption, **re-stock marchand** (Disponibilité) | #T1 |

Chaque pièce aura **son propre spec → plan → implémentation**. Cette spec ne couvre que **#T1**.

## 3. #T1 — Décisions arrêtées (cette session)

- **Granularité** : **date impériale + heures** (le plus précis). Base interne = **minutes** depuis une époque.
- **Consommateurs** : **« tout est horodaté »** — chaque point d'action fait avancer l'horloge (combat, scène, dialogue, voyage, repos, activités). Implication assumée : il faut brancher `advanceTime` à *chaque* action, et toute action future devra déclarer son coût.
- **Date de départ** : la date canonique d'ouverture de la campagne (EiS, Tome 1) — extraite de la source (§6).
- **Calendrier** : le calendrier **impérial** canon — extrait+vérifié de la source FR (§6).
- **« Ne rien inventer »** : les coûts-temps RAW (voyage, repos, activités) sont cités ; les coûts à l'échelle d'une scène (déplacement de case, fouille, dialogue) sont **muets dans le canon → paramétrables**.

## 4. #T1 — Architecture

- **`src/engine/clock.ts`** (PUR, testé) : le modèle du **calendrier impérial** (mois, jours/mois, jours intercalaires, jours de la semaine) + conversions **minutes ↔ `{année, mois, jour, heure, minute}`** + `advanceTime(t, minutes)` + `formatImperial(t)` (« 17 Brauzeit 2512 CI · 14:30 »). Aucune dépendance store/UI.
- **Store** : champ d'état `gameTime: number` (minutes depuis l'époque = date de départ) + action `advanceTime(minutes)` qui le pousse et émet un événement (pour que #T3 branche plus tard ses déclencheurs sur les franchissements de jour/semaine).
- **`TIME_COST`** : table pure des coûts par catégorie d'action (RAW où cité, **paramétrable** sinon — cf. §5).
- **HUD** : un petit afficheur date+heure dans `CampaignView` (près de la Bourse).
- **Branchement** : chaque point d'action **existant** du store appelle `advanceTime(coût)` — résolution de combat (par Round), déplacement de scène, fouille (`search`), dialogue, transition de scène. (Le voyage long et les activités = #T2/#T3.)

## 5. #T1 — Coûts-temps (« tout horodaté »)

| Catégorie d'action | Coût-temps | Statut RAW |
|---|---|---|
| Round de combat | ~quelques secondes / Round (cumul arrondi à la minute) | assumé (un Round WFRP = « quelques secondes ») |
| Déplacement de scène (1 case) | **paramétrable** (défaut faible) | canon muet à cette échelle |
| Fouille / interaction d'objet | **paramétrable** | canon muet |
| Dialogue | **paramétrable** | canon muet |
| Transition de scène (porte/zone) | **paramétrable** (≈ 0 pour un intérieur) | canon muet |
| Voyage entre lieux | distance ÷ vitesse (Mouvement) | **RAW Déplacement** (détaillé #T2) |
| Repos | heures | RAW (#T3) |
| Activité de temps mort (Artisanat/Recherche/Soins) | jours | RAW Activités (#T3) |

Les coûts « paramétrables » seront des constantes ajustables (et potentiellement éditables plus tard) — on ne fixe pas une valeur canon qui n'existe pas.

## 6. Tâches de données (vérifiées — « ne rien inventer »)

Ces deux extractions sont des **tâches du plan #T1**, avec vérification adversariale (les .md source sont OCRisés) :

1. **Calendrier impérial** : mois (ordre + nombre de jours chacun), **jours intercalaires** (Hexenstag, Mitterfrühl, Sonnstill, Geheimnistag, Mondstille…), **jours de la semaine** (Wellentag, Aubentag, Marktag, Bäckertag, Bezahltag, Könistag, Angestag, Festag), longueur de l'année. *Candidats source FR* : LDB (intro/Empire/Statut), « Nuits agitées & dures journées » (aventure de Mondstille), suppléments « jours saints ». Croiser FR↔EN si besoin.
2. **Date de départ canonique** : date d'ouverture de l'EiS (Tome 1, la diligence). *Candidat* : EiS FR « L'ennemi dans l'Ombre », intro/chapitre 1.

## 7. Tests (#T1)

- `clock.test.ts` (pur) : round-trip minutes↔date sur des franchissements (fin de mois, jour intercalaire, fin d'année) ; `advanceTime` ; `formatImperial` ; cohérence des longueurs de mois extraites.
- Store : `advanceTime` pousse `gameTime` + émet l'événement ; un point d'action (ex. fin de combat) avance bien l'horloge.

## 8. Hors périmètre #T1

#T2 (voyage, graphe de lieux), #T3 (cascade RAW), et le Marchand. #T1 expose seulement l'horloge + l'API + les coûts des actions existantes.

---

## Annexe A — Marchand v1 (EN PAUSE — décisions à ne pas perdre)

Cadré cette session, mis en pause au profit de Temps & Voyage. À reprendre après (le Marchand est conçu **time-ready**).

- **Périmètre v1** : transactionnel = #2a (économie en jeu) + #2b (marchand + UI achat/vente) + #2f (éditeur). Marchandage (#2c), Réparation (#2d), Évaluation (#2e) = lots suivants.
- **Prix de rachat** : **aucune règle RAW** (LDB 59 : « les règles d'achat/vente sont optionnelles »). Donc **paramétré** : `resaleRate` défaut **10 %** de la valeur craftEconomy, **override par archétype/entité**.
- **Stock = Disponibilité RAW complète** : Commune (en stock) / Limitée-Rare (Test de Disponibilité % selon agglo) / Exotique (non, sauf curaté) ; quantités Village 1 / Ville 1d10 / Cité ; ×2 Commune, ÷2 Rare. RNG seedable, Tests **montrés en révélation**. Le re-test hebdomadaire devient légitime **une fois #T (temps) en place** → la Disponibilité expose un point d'entrée *« temps écoulé / changement d'agglo → re-test »* (seam time-ready).
- **Taille d'agglomération** : champ **sur l'entité marchand** (Village/Ville/Cité), paramétrable, défaut hérité de l'archétype.
- **Scope par catégorie** : un archétype définit **quelles familles de marchandises** il vend (par `type`/`subType` de trapping) — « un herboriste ne vend pas d'arquebuses ».
- **Archétype** = 6ᵉ famille du registre `defs/` : `category`, `settlement` défaut, `resaleRate` défaut, `stock` curaté optionnel (objets garantis, qualités comprises). Référencé + overridé par l'entité de scène.
- **Monnaie (#2a)** : réconcilier `price.bronze` (data) ↔ `Money.brass` (store) = même pièce ; conversions RAW 1 CO = 20 SC = 240 PA, 1 SC = 12 PA ; util pur `money.ts` ; prix affiché = catalogue × facteur `craftEconomy`.
- **UI** : panneau ouvert en cliquant le PNJ marchand (stock en vente | inventaire du groupe, prix, Bourse, sélecteur de héros receveur, [Acheter]/[Vendre], rachat affiché). Pas de Marchandage en v1.
