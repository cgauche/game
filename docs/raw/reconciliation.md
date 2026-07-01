# Atlas RAW — Réconciliation CODE ↔ ATLAS

> Déterministe (`node scripts/raw/reconcile.mjs`). **Sens A** = règles que l'app applique
> (réfs `LDB NN l.X` dans `src/`) absentes de l'Atlas. **Sens B** = règles que l'Atlas décrit
> hors du code. Tolérance ligne = ±20.

**Sens A — code → Atlas** : 0 chapitre(s) cités par le code & absents de l'Atlas · 4 chapitre(s) couverts avec des lignes non pinées.
**Sens B — Atlas → code** : 164 marqueur(s) « (non implémenté) » · 31 chapitre(s) LDB cités par l'Atlas jamais référencés dans le code.

## A1 — Chapitres appelés par le CODE, ABSENTS de l'Atlas (trous durs)

_Aucun. Tout chapitre LDB référencé dans le code est cité par au moins une fiche._

## A2 — Lignes appelées par le CODE non pinées par l'Atlas (chapitre couvert, règle peut-être survolée)

### LDB 46 — 10/28 ligne(s) code hors couverture (propriétaire : docs\raw\magie.md)
- l.185 — `src/state/combatSlice.ts:2470` — // Focalisation CRITIQUE (LDB 46 l.185-186) : le sort est lançable au prochain Round
- l.188 — `src/data/index.ts:317` — *  (Chamon/Azyr ignorent le métal, Ghur le cuir, LDB 46 l.188). Remplace la devinette par regex sur le nom. */
- l.193 — `src/state/combatFlow.ts:1776` — // Interruption de Focalisation (LDB 46 l.193-194) : Dégâts subis pendant qu'on focalise
- l.194 — `src/engine/ops.ts:456` — /** Marqueur IMPUR de la branche d'ÉCHEC du Test de Calme d'interruption de Focalisation (LDB 46 l.194) :
- l.199 — `src/engine/magic.ts:144` — * « Repousser les Vents » (LDB 46 l.199) : −1 DR aux Tests d'Incantation et de
- l.201 — `src/engine/engine.test.ts:699` — it('Dissipation (LDB 46 l.201-202) : Test opposé — gagné → dissipé ; perdu → le Sort garde le DR NET', () => {
- l.202 — `src/engine/magic.ts:490` — *  Contre-sort (LDB 46 l.202 : « le lanceur tient le rôle attaquant »). Source unique. */
- l.204 — `src/engine/conditions.ts:303` — *  DISSIPATION (LDB 46 l.204-207, `engine/dispel`). Renvoie les effets retirés (pour le journal). */
- l.205 — `src/state/combatSlice.ts:2531` — // Réussite (DR cumulé ≥ NI, LDB 46 l.205) : retire les effets du sort de tous ses porteurs.
- l.207 — `src/engine/tests.ts:183` — *  œuvre de concert (Test étendu, Tests de groupe hors combat, Dissipation à plusieurs LDB 46 l.207…). */

### LDB 10 — 5/16 ligne(s) code hors couverture (propriétaire : docs\raw\tests.md)
- l.310 — `src/engine/types.ts:650` — /** Aura magique DÉTECTÉE (Talent Détection d'artefact, LDB 10 l.310-312 : « vous sentez que
- l.365 — `src/state/medicFlow.ts:173` — *  (LDB 10 l.365) RÉVÉLÉ témoin (jet SUBI, pas influençable — comme toute contraction de maladie). Patient
- l.569 — `src/engine/grimoire.ts:11` — *    inclusives — aucun sort inclus au Talent, LDB 10 l.569).
- l.859 — `src/engine/combatFeatures/dispatch.ts:53` — /** Sans peur (LDB 10 l.859) : `c` ignore la Peur/Terreur que `foe` inspire — talent possédé
- l.864 — `src/engine/psychology.ts:73` — *  NB : « Sans Peur (Ennemi) » (LDB 10 l.864) ne supprime PLUS la source ici (ce n'était pas RAW : le

### LDB 11 — 2/2 ligne(s) code hors couverture (propriétaire : docs\raw\equipement.md)
- l.143 — `src/state/vision.ts:11` — * Lanterne 20 m — `LDB 74 l.72`, `LDB 75 l.15`) et la Vision nocturne (20 m/niv — `LDB 11 l.143-147`)
- l.147 — `src/data/index.ts:587` — /** Portée de vision dans le noir, en cases (Vision nocturne 20 m/niv = 10 — `LDB 11 l.147` ;

### LDB 12 — 1/19 ligne(s) code hors couverture (propriétaire : docs\raw\tests.md)
- l.229 — `src/engine/tests.test.ts:64` — describe('evaluateCombinedTest — Test Combiné (LDB 12 l.229) : un jet vs DEUX valeurs', () => {

## B1 — Règles décrites par l'Atlas marquées « (non implémenté) »

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
- **docs\raw\bestiaire.md** L437 — - `(non implémenté en règle moteur)` — Trait à porter en donnée dans `traits.json` (id type `creature-marine`), `passive: GameOp[]` pour le malus hors-eau (M→1, −2 DR) conditionné à l'environnement. L
- **docs\raw\bestiaire.md** L460 — - `(non implémenté en règle moteur)` — cf. `combat.md` : Trait présent en donnée (`src/data/frenchy-traits.json` id `redoutable`, desc verbatim) mais le **regain d'Avantage début de tour n'est PAS câb
- **docs\raw\carrieres.md** L485 — **Implémente** : `src/data/careerLevels.json`, `src/data/classes.json` (Classe Côtier) — données app-owned (non implémenté à ce jour pour MDG)
- **docs\raw\carrieres.md** L507 — **Implémente** : `src/data/talents.json` (TalentData.passive/effects) — `src/engine/talentEffects.ts` (non implémenté pour MDG)
- **docs\raw\carrieres.md** L531 — **Implémente** : `src/data/talents.json` (variantes Chanson de marin) — `src/engine/ops.ts` (GameOp) (non implémenté)
- **docs\raw\carrieres.md** L587 — **Implémente** : `src/data/classes.json` (table de tirage norse) — `src/engine/creation.ts` (d100 espèce/carrière) (non implémenté pour MDG)
- **docs\raw\carrieres.md** L609 — **Implémente** : `src/data/races.json` / `src/engine/character.ts` (espèce + augmentations de création) (non implémenté pour MDG)
- **docs\raw\carrieres.md** L625 — **Implémente** : `src/data/creatures.json` (TraitData.passive → grantTalent) — `src/engine/trauma.ts` (collecteur passiveMods) (non implémenté pour MDG)
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
- **docs\raw\combat.md** L1662 — - Escalade : `(non implémenté)` — aucune mécanique de grimpe (½ vitesse / Test Escalade) dans `src/`.
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
- **docs\raw\competences.md** L1036 — **Implémente** : `(non implémenté)` — aucune mécanique d'hypnose dans `src/engine` (Compétence de table/MJ).
- **docs\raw\corruption.md** L568 — ### Non implémenté / delta code↔RAW
- **docs\raw\corruption.md** L572 — | Tables EDOC étendues par dieu (Khorne/Nurgle/Slaanesh/Tzeentch) | **Non implémenté** — `mutationTables.json` ne contient que les 2 tables LDB 19 génériques ; les 3 tables EDOC (physique étendue, Têt
- **docs\raw\corruption.md** L573 — | Talent Résistance (Mutation) — réussite auto 1×/séance | **Non implémenté** — non géré dans `corruptionThresholdExceeded` |
- **docs\raw\corruption.md** L574 — | Mauvais œil (mutation EDOC) — sort lancé sans test | **Non implémenté** — cette entrée EDOC n'est pas dans `mutations.json` |
- **docs\raw\corruption.md** L575 — | Malefrénésie (mutation EDOC) — mutation temporaire en Frénésie | **Non implémenté** |
- **docs\raw\corruption.md** L576 — | Corruption sublime (mutation mentale EDOC) — État Exténué hebdomadaire si pas de gain de Corruption | **Non implémenté** |
- **docs\raw\corruption.md** L577 — | Esprit anéanti (mutation mentale EDOC) | **Non implémenté** |
- **docs\raw\corruption.md** L578 — | Masochisme pressant (mutation mentale EDOC) | **Non implémenté** |
- **docs\raw\corruption.md** L579 — | Haine sporadique + Tableau des Obsessions (EDOC) | **Non implémenté** |
- **docs\raw\corruption.md** L580 — | Mutations spécifiques EDO App.2 (Chair Nécrosée, Crétin, Écailles épineuses EDO, Pattes Chèvre, Tête Pointue EDO) | **Non implémenté** dans mutations.json — ces entrées ne sont pas présentes |
- **docs\raw\corruption.md** L581 — | Sombres Murmures (perdre 1 PC en commettant un acte répréhensible MJ) | **(Non implémenté)** — pas de mécanique store pour cette perte narrative |
- **docs\raw\corruption.md** L582 — | Absolution (perte narrative de PC) | **(Non implémenté)** — pas de `{ op: 'corruption', amount: -n }` ou équivalent |
- **docs\raw\deplacement.md** L588 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L614 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L634 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L658 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L680 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L698 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L723 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L747 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L765 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L781 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L799 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L821 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L835 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L853 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L869 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L887 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L901 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L917 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L935 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L953 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L965 — **Implémente :** (non implémenté)
- **docs\raw\deplacement.md** L985 — **Implémente :** (non implémenté)
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
- **docs\raw\maladies.md** L503 — **Implémente** : non implémenté — parasite hors cycle maladie standard (progression en phases distinctes, pas de `tickDisease` générique applicable).
- **docs\raw\maladies.md** L521 — **Implémente** : non implémenté dans `maladies.json`.
- **docs\raw\maladies.md** L545 — **Implémente** : non implémenté dans `maladies.json`.
- **docs\raw\maladies.md** L563 — **Implémente** : symptôme non implémenté (absent des 12 kinds LDB).
- **docs\raw\maladies.md** L594 — **Implémente** : non implémenté (aucune herbe n'est modélisée dans le système de maladies).
- **docs\raw\maladies.md** L608 — **Implémente** : non implémenté.
- **docs\raw\maladies.md** L626 — **Implémente** : non implémenté.
- **docs\raw\maladies.md** L683 — | Résistance (Maladie) Talent | Non implémenté — le reroll Talent est générique (1×/séance auto-succès) | |
- **docs\raw\maladies.md** L684 — | Symptômes EDO (Délire, Gonflement) | **Non implémentés** — Fièvre Cérébrale Pourpre absente de `maladies.json` | À ajouter si EDO joué |
- **docs\raw\maladies.md** L685 — | Trait Contagieux (EDO) | **Non implémenté** | |
- **docs\raw\maladies.md** L686 — | **T2C ch.14 — Tableaux d'exposition aquatique** | **Non implémenté** — ingestion/immersion dans rivière sale (T2C 16 l.10-49) | |
- **docs\raw\maladies.md** L687 — | **T2C ch.14 — Colique** | **Non implémenté** — absente de `maladies.json` | |
- **docs\raw\maladies.md** L688 — | **T2C ch.14 — Vers de Carie** | **Non implémenté** — cycle en 3 phases hors modèle générique | |
- **docs\raw\maladies.md** L689 — | **T2C ch.14 — Vers du Reik** | **Non implémenté** — absents de `maladies.json` (incubation 85+1d10 j) | |
- **docs\raw\maladies.md** L690 — | **T2C ch.14 — Symptôme Crampes Abdominales** | **Non implémenté** — absent des 12 kinds LDB | |
- **docs\raw\maladies.md** L691 — | **T2C ch.2 — Herbes médicinales (Gesundheit, Racine des Tombes, Rouille Mouchetée)** | **Non implémenté** — aucune herbe modélisée dans le moteur de maladies | |
- **docs\raw\maladies.md** L725 — **Implémente** : (non implémenté) — contagion « à bord » et contamination de tonneau spécifiques à la vie en mer ; le cycle de maladie générique vit dans `src/engine/disease.ts` (`contagiousDiseases`,
- **docs\raw\maladies.md** L755 — **Implémente** : (non implémenté) — maladie absente de `maladies.json` ; symptômes *malaise* / *nausée* déjà modélisés (`src/engine/disease.ts` · `diseaseCharPenalties`, `combatFlow.ts`). À ajouter si
- **docs\raw\maladies.md** L779 — **Implémente** : (non implémenté) — maladie absente de `maladies.json`. Spécificités à modéliser : Contraction mensuelle liée au régime, mitigation +40 par soupe de chou fermenté, durée gelée tant que
- **docs\raw\maladies.md** L813 — **Implémente** : (non implémenté pour le contexte maritime) — règle de Faim/rations générique dans `src/engine/provisions.ts` (consommation/jour, Tests, malus). Spécificités MDG à ajouter si un voyage
- **docs\raw\religion.md** L44 — - **Implémenté vs non implémenté** — effets purement navals (Humeur de Manann, Indice M, Indice de Voie d'eau, vent, IC, ne-peut-couler) hors moteur actuel → (non implémenté) ; effets sur personnages/
- **docs\raw\talents.md** L1583 — - `commandant-d-equipe` (AA) : logique score Projectiles partagé non implémentée (donnée présente, logique absente)
- **docs\raw\talents.md** L1585 — - Mises à jour AA (Battement -1 si 6 DR, Cavalier émérite Taille monture, Porte-Bouclier 2 Avantages/2m, Renversement prendre 1 seul Avantage) : le code suit la version LDB — divergences AA non implém
- **docs\raw\tests.md** L324 — **Implémente** : (non implémenté dans `src/engine/` — le bonus de soutien de +10 par participant est une logique à gérer côté état/UI)

## B2 — Chapitres LDB cités par l'Atlas, jamais référencés dans le code

LDB 06 · LDB 6 · LDB 7 · LDB 8 · LDB 24 · LDB 25 · LDB 26 · LDB 27 · LDB 28 · LDB 29 · LDB 30 · LDB 31 · LDB 32 · LDB 33 · LDB 34 · LDB 35 · LDB 36 · LDB 37 · LDB 38 · LDB 39 · LDB 43 · LDB 44 · LDB 49 · LDB 50 · LDB 65 · LDB 66 · LDB 68 · LDB 69 · LDB 70 · LDB 71 · LDB 80

## Autres livres

Code : AA, ADE II, ADE2, EDOC
Atlas : AA, ADE I, ADE II, EDO, EDOC, NADAJ, NADJ, T2C, T3, Ubersreik, ZI
