# Atlas RAW — Réconciliation CODE ↔ ATLAS

> Déterministe (`node scripts/raw/reconcile.mjs`). **Sens A** = règles que l'app applique
> (réfs `LDB NN l.X` dans `src/`) absentes de l'Atlas. **Sens B** = règles que l'Atlas décrit
> hors du code. Tolérance ligne = ±20.

**Sens A — code → Atlas** : 0 chapitre(s) cités par le code & absents de l'Atlas · 2 chapitre(s) couverts avec des lignes non pinées.
**Sens B — Atlas → code** : 117 marqueur(s) « (non implémenté) » · 33 chapitre(s) LDB cités par l'Atlas jamais référencés dans le code.

## A1 — Chapitres appelés par le CODE, ABSENTS de l'Atlas (trous durs)

_Aucun. Tout chapitre LDB référencé dans le code est cité par au moins une fiche._

## A2 — Lignes appelées par le CODE non pinées par l'Atlas (chapitre couvert, règle peut-être survolée)

### LDB 10 — 5/16 ligne(s) code hors couverture (propriétaire : docs\raw\tests.md)
- l.310 — `src/engine/types.ts:412` — /** Aura magique DÉTECTÉE (Talent Détection d'artefact, LDB 10 l.310-312 : « vous sentez que
- l.365 — `src/state/medicFlow.ts:149` — *  (LDB 10 l.365). Patient à 0 PB → opération interrompue. */
- l.569 — `src/engine/grimoire.ts:11` — *    inclusives — aucun sort inclus au Talent, LDB 10 l.569).
- l.859 — `src/engine/combatFeatures/dispatch.ts:52` — /** Sans peur (LDB 10 l.859) : `c` ignore la Peur/Terreur que `foe` inspire — talent possédé
- l.864 — `src/engine/combat.ts:260` — // Haine (du groupe, LDB 21 l.41) / Amour → immunité Peur. Sans Peur (LDB 10 l.864) ne donne PAS

### LDB 11 — 2/2 ligne(s) code hors couverture (propriétaire : docs\raw\equipement.md)
- l.143 — `src/state/vision.ts:11` — * Lanterne 20 m — `LDB 74 l.72`, `LDB 75 l.15`) et la Vision nocturne (20 m/niv — `LDB 11 l.143-147`)
- l.147 — `src/data/index.ts:348` — /** Portée de vision dans le noir, en cases (Vision nocturne 20 m/niv = 10 — `LDB 11 l.147` ;

## B1 — Règles décrites par l'Atlas marquées « (non implémenté) »

- **docs\raw\activites.md** L254 — **Implémente :** non implémenté comme Activité discrète dans le flux — la consultation experte est laissée au MJ (pas de Test automatique dans `src/state/interludeFlow.ts`).
- **docs\raw\activites.md** L264 — **Implémente :** non implémenté.
- **docs\raw\activites.md** L278 — **Implémente :** non implémenté comme Activité distincte de l'Avancement (les Tests de Caractéristiques hors carrière ne sont pas séparés dans le flux actuel).
- **docs\raw\activites.md** L296 — **Implémente :** non implémenté (système de PNJ/MJ — pas de données structurées dans le store actuel).
- **docs\raw\activites.md** L312 — **Implémente :** non implémenté.
- **docs\raw\activites.md** L398 — **Implémente :** non implémenté.
- **docs\raw\activites.md** L412 — **Implémente :** non implémenté.
- **docs\raw\activites.md** L427 — **Implémente :** non implémenté.
- **docs\raw\activites.md** L442 — **Implémente :** non implémenté.
- **docs\raw\activites.md** L459 — **Implémente :** non implémenté.
- **docs\raw\activites.md** L483 — **Implémente :** non implémenté.
- **docs\raw\activites.md** L502 — **Implémente :** non implémenté.
- **docs\raw\activites.md** L528 — **Implémente :** non implémenté.
- **docs\raw\activites.md** L611 — | Consulter un Expert | — | Non implémenté |
- **docs\raw\activites.md** L612 — | Dressage (Activité) | — | Non implémenté |
- **docs\raw\activites.md** L613 — | Entraînement (hors-Carrière coûts) | — | Non implémenté séparément de l'avancement |
- **docs\raw\activites.md** L614 — | Invention ! | — | Non implémenté |
- **docs\raw\activites.md** L615 — | Réputation | — | Non implémenté |
- **docs\raw\activites.md** L616 — | Semer la Dissension | — | Non implémenté |
- **docs\raw\activites.md** L617 — | Dernières Nouvelles | — | Non implémenté |
- **docs\raw\activites.md** L618 — | Entraînement au Combat | — | Non implémenté |
- **docs\raw\activites.md** L619 — | Observer une Cible | — | Non implémenté |
- **docs\raw\activites.md** L620 — | Recherche de Savoir | — | Non implémenté |
- **docs\raw\activites.md** L621 — | Convalescence (ADE II) | — | Non implémenté (suppression Trait Psychologique) |
- **docs\raw\activites.md** L622 — | Activités de Guerrier (AA) | — | Non implémenté |
- **docs\raw\activites.md** L623 — | Activités de Bataille (ADE II) | — | Non implémenté |
- **docs\raw\activites.md** L625 — | Faveurs (Mineure/Majeure/Importante) | — | Non implémenté |
- **docs\raw\avancement.md** L300 — **Implémente** : non implémenté (attribution de PX = décision MJ dans le store via `xp(n)` dans `src/state/devtools.ts` et `partyFlow.ts`).
- **docs\raw\code-map.md** L46 — | `NON IMPLÉMENTÉ` | empoignade, poursuite-ldb, aa-systeme-blessures-alternatif, aa-structures-sieges, aa-rupture-poursuites, aa-armes-poudre-munitions-tables, ade-ii-combat-de-masse-puissance-de-bata
- **docs\raw\combat.md** L138 — - `initiativeOrder` (`src/engine/combat.ts`) — tri par Initiative décroissante puis départage par Agilité (`LDB 13 l.31`, 1er niveau). Le **2e niveau de départage (Test opposé d'Agilité)** n'est `(non
- **docs\raw\combat.md** L139 — - `rollInitiative` (`src/state/combatSetup.ts`) + règle maison `combat-init-method` (`src/engine/policy.ts`, label « Méthode d'Initiative », `ref: 'LDB 13 l.37'`) — implémente les variantes de tirage 
- **docs\raw\combat.md** L141 — - Système de Round (début/fin, frontières, pré-emption) : `resolveRoundBoundary`, `roundHooks.ts`, `turnHooks.ts`, `pendingRoundStart` / `confirmRoundStart` (`src/state/combatSlice.ts`, `src/state/com
- **docs\raw\combat.md** L709 — - *Aux Armes* « +10 par Blessure au-delà de 0 » et tables alternatives `(non implémenté)`.
- **docs\raw\combat.md** L966 — - `(non implémenté)` — l'**Option : Tirer Dans Un Combat au Corps À Corps** (`LDB 14 l.126-129`, pénalité −20 puis redirection du tir vers un adversaire au hasard de la cible) n'est pas modélisée comm
- **docs\raw\combat.md** L1079 — - `src/engine/types.ts` — `Difficulty` / `DIFFICULTY_MODIFIERS` / `DIFFICULTY_LABELS` couvrent les 7 bandes Très Facile +60 → Très Difficile −30. Les paliers extrêmes EDO **Presque Impossible (−40)** 
- **docs\raw\combat.md** L1191 — - **Empoignade** (option déclarée à mains nues, brisure/Test de Force, dommages PA-ignorés) : `(non implémenté)` — seul l'État `empetre` et sa récupération existent (`src/state/combatSlice.ts battleRe
- **docs\raw\combat.md** L1192 — - **Dispersion** (1d10 → direction/2d10 m / à vos pieds / aux pieds de la cible sur échec de Lancer) : `(non implémenté)`.
- **docs\raw\combat.md** L1193 — - Effet spécial du **Gantelet verrouillé** (conserve l'objet, −20 transitoire au lieu de lâcher) : `(non implémenté)` — l'objet existe comme donnée mais sa règle anti-lâcher n'est pas câblée.
- **docs\raw\combat.md** L1271 — **Implemente** : sous-système Empoignade `(non implémenté)` — il n'existe ni flux ni manœuvre « grapple/Empoignade » (rien dans `src/state/rollFlows.ts`, `src/data/maneuvers.json`, ni `src/engine/ops.
- **docs\raw\combat.md** L1427 — - Trait **Redoutable** : présent en **donnée** (`src/data/frenchy-traits.json` id `redoutable`, description verbatim ; assigné à de nombreuses créatures de `creatures.json`) mais **le minimum d'Avanta
- **docs\raw\combat.md** L1655 — - Escalade : `(non implémenté)` — aucune mécanique de grimpe (½ vitesse / Test Escalade) dans `src/`.
- **docs\raw\combat.md** L1657 — - Chute : `src/state/combatEffects.ts` (effet `fall`) — `3 * m + d10() − BonusEndurance`, plancher 0, PA ignorés ; `loseWounds` ; `addCondition(c, 'a-terre')` si `lost > be`. Réduction de chute volont
- **docs\raw\combat.md** L1747 — **Implemente** : `(non implémenté)` — la procédure de Poursuite de LDB 15 (Distance abstraite, comparaison DR le plus faible des fuyards vs DR le plus haut des poursuivants, modificateur de M en DR bo
- **docs\raw\combat.md** L1823 — **Implemente** : `src/engine/encumbrance.ts` (`encumbrancePenalties` — paliers tier 0–3 : −1 M / min 3 / −10 Ag / +1 Fat ; −2 M / min 2 / −20 Ag / +2 Fat ; immobilisé au-delà de ×3 ; `effectiveMovemen
- **docs\raw\combat.md** L2022 — - `src/data/trappings.json` — fiches d'armes (`subType` = id de Groupe, `damage`, `reach`, `enc`, `availability`, `qualities`, `price`) ; ex. `lance-de-cavalerie` porte la `desc` « Arme improvisée hor
- **docs\raw\combat.md** L2024 — - Règle Cavalerie « (2M) → Deux Mains à pied », règle Fléau « sans compétence → Dangereuse + Atouts perdus », et lance-de-cavalerie « improvisée hors charge » au *runtime* `(non implémenté)` — seuleme
- **docs\raw\combat.md** L2025 — - Profil du **Duel Judiciaire** (seuil « premier sang > 3 Blessures », fin à 0 Blessure, projectiles interdits) `(non implémenté)` — contenu de scénario/narration, sans support de moteur ; relèverait 
- **docs\raw\combat.md** L2212 — **Implémenté** : `src/data/weaponGroups.json` (les 8 groupes à distance : `arbalete`, `arc`, `entraves`, `explosifs`, `fronde`, `lancer`, `ingenierie`, `poudre-noire`, + famille de munitions `poudre-n
- **docs\raw\combat.md** L2314 — - Option « Longueur d'arme » (-10) : `weaponReachPenalty` (`src/engine/combat.ts`, règle optionnelle `combat-weapon-reach`). Le sous-système « Au Contact » (Test opposé pour entrer dans l'allonge) `(n
- **docs\raw\combat.md** L2317 — - Réparation : `repairCostBrass` (`src/engine/repair.ts`) couvre l'**armure** (LDB 63, 10 %/PA, 30 % si brisée). Le coût de réparation d'**arme** (10 % du prix / point, LDB 62) `(non implémenté)` — `w
- **docs\raw\combat.md** L2498 — **Implémente** : `src/data/qualities.json` (donnée RAW de chaque Atout/Défaut : `passive: GameOp[]` + `capabilities` + `effects` Flow, taggée à sa source ; y compris la qualité générique `magique` `ca
- **docs\raw\combat.md** L2627 — - Écailles Épineuses (PA naturel non déviable) : donnée `src/data/mutations.json` ; PA naturels additifs appliqués dans `src/engine/items.ts` (`recomputeLoadout`, l.372-374). Le verrou « ce PA ne peut
- **docs\raw\combat.md** L2704 — **Implémente** : `src/engine/combat.ts` — `reverseRoll` (inversion du dé), `hitLocation` (tableau humanoïde), `hitLocationByShape(reversed, shape)` (serpent : ≤19 Tête sinon Corps ; araignée : ≤9 Tête
- **docs\raw\combat.md** L3014 — - `src/data/traits.json` — registre des **101 Traits** (id stable, `label`, `prefix`/`suffix`, `desc`, `source`, `capabilities`/`effects`/`passive`/`grantsManeuvers`), dont **15** marqués `"standard":
- **docs\raw\combat.md** L3142 — **Implémente** : Données — `src/data/traits.json` (entrées `arme`, `a-distance`, `morsure`, `cornes`, `attaque-caudale`, `langue-prehensile`, `tentacules`, `constricteur`, `toile`, `venin`, `vampiriqu
- **docs\raw\combat.md** L3343 — - **Infecté / Increvable / Amorphe** : Infecté = contraction post-combat (`src/engine/disease.ts` — Blessure Purulente, hors boucle de Round) ; **Increvable** = résurrection post-combat NON câblée en 
- **docs\raw\combat.md** L3344 — - **Redoutable (ZI)** : regain d'Avantage début de tour `(non implémenté en règle moteur)` — Trait présent en donnée/statbloc, desc verbatim affichée, pas de hook de regain d'Avantage confirmé.
- **docs\raw\combat.md** L3666 — **Implémente** : `src/data/traits.json` (entrées `bond`/`foulee`/`vol`/`grimpant`/`rapide`/`brutal`/`coriace`/`elite`/`endurant`/`grand`/`se-cabrer`/`fabrique` — descriptions verbatim ; modificateurs 
- **docs\raw\combat.md** L4058 — **Implemente** : `(non implémenté)`. Le jeu utilise le système de Critiques/Mort **du Livre de base**, pas l'alternative d'*Aux Armes*. Les déclencheurs AA (Critique sur double, table relancée non inv
- **docs\raw\combat.md** L4361 — **Implémente** : `src/data/trappings.json` — les armes de mêlée AA sont des objets app-owned tagués `source.book: "AA"` (hallebarde, marteau-à-bec-de-corbin, épée bâtarde, fleuret, rapière, fleau/flea
- **docs\raw\combat.md** L4484 — - **Non câblés** (donnée présente, effet moteur dédié absent) : le **bonus +10 de la cartouche en papier au rechargement** `(non implémenté)` (seul `reloadBonusSL` en DR existe, pas un +10 conféré par
- **docs\raw\combat.md** L4627 — **Implémente** : appairage cavalier↔monture et flux Monter/Descendre — `src/state/mount.ts` (`isRider`/`isMount`/`mountOf`/`riderOf`, `canMount`/`mountUp`/`dismount`). Mouvement emprunté à la monture 
- **docs\raw\combat.md** L4857 — **Implémente** : `src/engine/combat.ts` (`attackModifiers`, ligne 274-276) câble l'**Atout Salve** (pénalité −10 cumulative par tir supplémentaire via `attacker.shotsThisTurn`, `Combatant.shotsThisTur
- **docs\raw\combat.md** L5013 — **Implémente** : le **désengagement** est implémenté d'après le LDB (pas le résumé AA) — `src/engine/engagement.ts` (`isEngaged`/`engage`/`disengageFrom`/`decayEngagement`, désengagement gratuit du pl
- **docs\raw\combat.md** L5125 — **Implemente** : `(non implémenté)` — le code n'a que le système d'Avantage **individuel** du LDB : `src/engine/advantage.ts` (`gainAdvantage`, `advantageCap`, `advantageCapFor`) écrit dans `Combatant
- **docs\raw\combat.md** L5254 — **Implémente** : `src/data/talents.json` (entrées `artilleur`, `battement`, `cavalier-emerite`, `commandant-d-equipe`, `coude-a-coude`, `distraire`, `frappe-blessante`, `fuite`, `impitoyable`, `porte-
- **docs\raw\combat.md** L5445 — **Implemente** : `(non implémenté)` — aucune des cinq Activités de guerrier n'est câblée. Le système d'interlude `src/state/interludeFlow.ts` (+ `src/engine/activities.ts`) ne couvre que les Activités
- **docs\raw\combat.md** L5663 — **Implemente** : `(non implémenté)` — aucun système de combat de masse / Puissance de Bataille dans `src/` (les machines de guerre présentes dans `src/data/trappings.json`, ex. `baliste`/`mortier`/`ba
- **docs\raw\combat.md** L5779 — **Implemente** : Les Atouts/Défauts cités sont tous présents en donnée (`src/data/qualities.json` : `assommante`, `dangereuse`, `defensive`, `devastatrice`, `empaleuse`, `impenetrable`, `percutante`, 
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
- **docs\raw\corruption.md** L582 — | Absolution (perte narrative de PC) | **(Non implémenté)** — pas de `giveCorruption(-n)` ou équivalent |
- **docs\raw\deplacement.md** L540 — | Endurance monture (allures) | EDOC ch.4 : BE heures au trot, ½ BE au galop | Non implémenté (combat uniquement) | Hors périmètre actuel. |
- **docs\raw\deplacement.md** L541 — | Tableau Incidents de Monte | EDOC ch.4 | Non implémenté | Hors périmètre actuel. |
- **docs\raw\deplacement.md** L542 — | Véhicules (Problèmes de Véhicule) | EDOC ch.4 | Non implémenté | Hors périmètre actuel. |
- **docs\raw\etats.md** L384 — - Le +1 Avantage pour l'attaquant ciblant un Sonné : **(non implémenté dans `conditions.ts`)** — à vérifier dans le flux d'attaque (`combatFlow.ts`)
- **docs\raw\etats.md** L446 — **Implémente** : `src/engine/conditions.ts` — module principal (tous les États sauf cas notés `(non implémenté)`)
- **docs\raw\etats.md** L639 — **Implémente** : `src/engine/combat.ts` — `assommanteCheck` pour l'Atout Assommante (à vérifier). L'Empêtré FM et la mécanique de filet (DR non cumulatifs) ne sont pas implémentés en variante. L'État 
- **docs\raw\etats.md** L673 — Points **(non implémentés)** identifiés :
- **docs\raw\etats.md** L679 — 6. **Variante Hémorragique AA** : non implémentée (règle optionnelle — LDB 16 est conforme).
- **docs\raw\etats.md** L681 — 8. **Filets ZI** : mécanique Empêtré avec DR non cumulatifs — non implémentée (seul Test de Force opposé générique est implémenté).
- **docs\raw\magie.md** L501 — **Implémente :** `domainOnHitEffects()` — `DomainData.effects` (condition `relation: hostile` + `not has Magie des Arcanes (Feu)` pour le rider `+1 Enflammé`). Le bonus `+10` par état voisin est **non
- **docs\raw\magie.md** L562 — **Implémente :** `domainOnHitEffects()` — `DomainData.effects` (deux `TriggeredEffect` : purge états sur cibles vivantes ; frappe supplémentaire sur Mort-vivants). Le bonus `+10` en environnement rura
- **docs\raw\magie.md** L704 — | Attributs de Domaine — Feu (Enflammé + bonus si états proches) | LDB 48 l.201 | Partiel — rider OK ; bonus +10 par état voisin non implémenté |
- **docs\raw\magie.md** L709 — | Attributs de Domaine — Vie (purge états + frappe Mort-vivants + +10 rural) | LDB 48 l.679 | Partiel — purge+frappe OK ; +10 rural non implémenté |
- **docs\raw\magie.md** L728 — 1. **Influences Malfaisantes (le « 8 »)** : non implémenté en runtime — la détection du chiffre 8 au dé des unités n'est pas branchée dans `resolveCasting` / `resolveFocus`. À brancher si cette règle 
- **docs\raw\magie.md** L733 — 6. **Attribut Feu — bonus +10 par état Enflammé voisin** (LDB 48 l.201) : non implémenté — nécessiterait un scan de la scène à chaque incantation pour compter les états actifs à ≤ BFM mètres.
- **docs\raw\magie.md** L734 — 7. **Attribut Vie — +10 en environnement rural/sauvage** (LDB 48 l.679) : non implémenté — pas de classification rurale/urbaine des scènes dans le moteur.
- **docs\raw\maladies.md** L497 — **Implémente** : non implémenté — parasite hors cycle maladie standard (progression en phases distinctes, pas de `tickDisease` générique applicable).
- **docs\raw\maladies.md** L515 — **Implémente** : non implémenté dans `maladies.json`.
- **docs\raw\maladies.md** L539 — **Implémente** : non implémenté dans `maladies.json`.
- **docs\raw\maladies.md** L557 — **Implémente** : symptôme non implémenté (absent des 12 kinds LDB).
- **docs\raw\maladies.md** L588 — **Implémente** : non implémenté (aucune herbe n'est modélisée dans le système de maladies).
- **docs\raw\maladies.md** L602 — **Implémente** : non implémenté.
- **docs\raw\maladies.md** L620 — **Implémente** : non implémenté.
- **docs\raw\maladies.md** L677 — | Résistance (Maladie) Talent | Non implémenté — le reroll Talent est générique (1×/séance auto-succès) | |
- **docs\raw\maladies.md** L678 — | Symptômes EDO (Délire, Gonflement) | **Non implémentés** — Fièvre Cérébrale Pourpre absente de `maladies.json` | À ajouter si EDO joué |
- **docs\raw\maladies.md** L679 — | Trait Contagieux (EDO) | **Non implémenté** | |
- **docs\raw\maladies.md** L680 — | **T2C ch.14 — Tableaux d'exposition aquatique** | **Non implémenté** — ingestion/immersion dans rivière sale (T2C 16 l.10-49) | |
- **docs\raw\maladies.md** L681 — | **T2C ch.14 — Colique** | **Non implémenté** — absente de `maladies.json` | |
- **docs\raw\maladies.md** L682 — | **T2C ch.14 — Vers de Carie** | **Non implémenté** — cycle en 3 phases hors modèle générique | |
- **docs\raw\maladies.md** L683 — | **T2C ch.14 — Vers du Reik** | **Non implémenté** — absents de `maladies.json` (incubation 85+1d10 j) | |
- **docs\raw\maladies.md** L684 — | **T2C ch.14 — Symptôme Crampes Abdominales** | **Non implémenté** — absent des 12 kinds LDB | |
- **docs\raw\maladies.md** L685 — | **T2C ch.2 — Herbes médicinales (Gesundheit, Racine des Tombes, Rouille Mouchetée)** | **Non implémenté** — aucune herbe modélisée dans le moteur de maladies | |
- **docs\raw\talents.md** L1583 — - `commandant-d-equipe` (AA) : logique score Projectiles partagé non implémentée (donnée présente, logique absente)
- **docs\raw\talents.md** L1585 — - Mises à jour AA (Battement -1 si 6 DR, Cavalier émérite Taille monture, Porte-Bouclier 2 Avantages/2m, Renversement prendre 1 seul Avantage) : le code suit la version LDB — divergences AA non implém
- **docs\raw\tests.md** L324 — **Implémente** : (non implémenté dans `src/engine/` — le bonus de soutien de +10 par participant est une logique à gérer côté état/UI)

## B2 — Chapitres LDB cités par l'Atlas, jamais référencés dans le code

LDB 06 · LDB 6 · LDB 7 · LDB 8 · LDB 24 · LDB 25 · LDB 26 · LDB 27 · LDB 28 · LDB 29 · LDB 30 · LDB 31 · LDB 32 · LDB 33 · LDB 34 · LDB 35 · LDB 36 · LDB 37 · LDB 38 · LDB 39 · LDB 43 · LDB 44 · LDB 49 · LDB 50 · LDB 64 · LDB 65 · LDB 66 · LDB 67 · LDB 68 · LDB 69 · LDB 70 · LDB 71 · LDB 80

## Autres livres

Code : ADE II, ADE2
Atlas : AA, ADE I, ADE II, EDO, EDOC, NADAJ, NADJ, T2C, T3, Ubersreik, ZI
