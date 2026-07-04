# Unification « postes / activités / événements de bataille » — conception phasée

> Statut : **conception** (pré-exécution). Fait suite au chantier minimap/`TopoScene` (P1-P4 livrés :
> `Station` + `TopoScene` + `PosteSheet` unifié navire+siège). Ce doc cadre l'unification PLUS PROFONDE
> demandée : partager la colonne vertébrale entre postes, activités et événements de combat de masse.

## 1. Contexte & principe

Trois « choses auxquelles on affecte un héros et qui se résolvent par un Test » :

| | Poste (canon/affût) | Activité (interlude/voyage/mer) | Événement de bataille (masse) |
|---|---|---|---|
| Position | sur la coque/le rempart | **aucune scène** | sur le champ (à spatialiser) |
| Affectation | N héros → 1 slot | 1 héros → 1 action | N héros → 1 scène (test/tenue, Soutien) · groupe (combat) |
| Test | tir (arme) | compétence | compétence (+ combiné/caract, Soutien LDB 12) |
| Issue | dégâts | `GameOp`/`stageOutcome` | **Puissance d'armée** |

**Ce qui est commun = le Test + l'affectation + (pour poste/bataille) la position.** Ce qui diverge = **l'issue**
et la **topologie** (N:1 poste/scène vs 1:1 activité). Deux constats qui pilotent le design :

- **La Puissance N'EST PAS un effet `GameOp` — c'est une carac TESTABLE.** *(Piste initiale « armée = Combatant,
  Puissance = PV, deltas = GameOp » ÉCARTÉE après revue adversariale + vérification directe — cf. §7bis.)*
  Vérifié : `rollMightTest(might)` = `rollTest(might, …)` → **d100 ≤ Puissance courante** (`massBattle.ts` l.219-223) ;
  `resolveClash` réduit l'adverse de `mightReduction(sl)=max(5,10+sl)` — logique **calculée** (`10+DR`, plancher 5),
  pas un montant plat qu'un `GameOp wounds` pourrait porter (ADE II ch.8 l.120, non opposé, simultané). La Puissance
  est donc une **stat d'armée abstraite qu'on TESTE**, pas une ressource de créature → le garde-fou « `GameOp` =
  langue des EFFETS » **ne s'applique pas** ici. Le modèle plat `MassBattleArmy{might,startMight}` + moteur pur EST
  correct ; on ne le migre PAS.
- **`bestForSkills` (auto-choix du meilleur héros) en masse est une aberration** : le jeu joue à la place du
  joueur. L'affectation doit être **explicite** (comme un poste). `bestForSkills` ne survit qu'en *suggestion*
  par défaut, jamais comme mécanisme.

**Découverte (mapping UI) : les activités ne sont PAS spatialisables.** L'interlude se passe « entre deux
aventures » — **pas de scène**. Les 3 UI (`InterludeScreen`, `TravelRolesPanel`, `SeaActivitiesModal`) sont
**par-héros** (1 héros → 1 action), sans plan ni `PortraitPicker`. Forcer l'interlude sur un `TopoScene` serait
une abstraction fuyante. → **On NE fusionne PAS les activités dans la surface spatiale.**

## 2. Architecture cible — 3 couches (le partage est dans le MOTEUR, pas dans une UI unique forcée)

| Couche | Partagée par | Contenu |
|---|---|---|
| **A. Moteur** | postes + activités + bataille | `TestSpec` unique · « meilleur héros » partagé · affectation explicite. **(PAS de migration Puissance→GameOp — cf. §7bis.)** |
| **B. Surface Station SPATIALE** (plan + affectation) | postes + événements de bataille | `StationSheet` générique (ex-`PosteSheet`) + registre de kinds |
| **C. Composant d'affectation d'ACTIVITÉ** (par-héros, sans plan) | interlude + voyage + mer | dédup des 3 pickers, réutilise `TestSpec` + rendu de détail |

### A. Couche moteur (le vrai « ils partagent beaucoup »)

- **`TestSpec` partagé** (`{ skills?: SkillRef[]; char?: CharKey; difficulty?: Difficulty; combined?: boolean }`) —
  aujourd'hui **triplé** dans `ActivityDef` (sans `char`/`combined`), `BattleActivityDef`, `BattleSceneDef`.
  → un seul type, référencé par les trois. `ActivityDef` gagne `char`/`combined` (extension inoffensive :
  `resolveTravelActivity`→`resolveSkillBest` les ignore).
- **« meilleur héros pour un `TestSpec` »** — `bestForSkills` (`massBattleFlow`) et `partyBest`/`resolveSkillBest`
  (`activities`/`skills`) se recoupent → **une FAMILLE de primitives** (3 formes réelles : meilleur ACTEUR du
  groupe vs meilleure COMPÉTENCE d'un acteur × simple vs combiné). Mutualiser sans sur-vendre « 1 primitive ».
- **Affectation explicite** — un enregistrement `Record<heroId, actionId>` (comme `StagePosting` /
  `poste.crewIds`) ; la résolution prend le héros AFFECTÉ. `bestForSkills` → défaut proposé, pas imposé.
- **Puissance/issues de masse : INCHANGÉES** — le moteur pur (`resolveClash`/`mightReduction`/`normalizeMights`/
  Hold/hasards/machines) reste tel quel ; il n'entre PAS dans le vocabulaire `GameOp` (§7bis). Les `GameOp`
  restent la langue des effets sur les **héros** (une scène de combat/ralliement soigne/blesse un héros = déjà
  des `GameOp` par les chemins normaux) — pas de la Puissance d'armée.

### B. Surface Station spatiale (postes + bataille)

Généraliser `PosteSheet` → **`StationSheet`** kind-agnostique piloté par un **registre `StationKind`**. Chaque
kind fournit EN DONNÉE : (1) son **panneau de détail** (poste : arc/munition/équipage ; scène : desc/effets),
(2) son **handler d'affectation** (poste : `serveAtPoste`/`leaveChef` ; scène : l'enregistrement d'affectation),
(3) son **déclencheur de résolution** (poste : tir ; scène : `openMassBattleScene` avec le héros affecté).
La coquille (plan `TopoScene` + puces + détail + sélection, déjà faite) reste partagée. `MassBattleView` embarque
`StationSheet` sur une **scène dédiée** (`Scene.stations` = anchors authorés + `battleScenesToStations`),
remplaçant la liste de boutons plats.

### C. Composant d'affectation d'activité (interlude/voyage/mer)

UN composant par-héros (picker d'activité + détail `<Prose>` + prérequis), réutilisé par les 3 contextes
(`activitiesFor(ctx)`), remplaçant les 3 UI actuelles divergentes. Réutilise `TestSpec` + le rendu de détail
+ `ActivityModal`/`RollFlowShell` (déjà partagé côté interlude). **Sans plan.** Optionnel : exposer enfin la
`StagePosting` de voyage par-étape (aujourd'hui initialisée en silence, jamais éditable).

## 3. Phases (chacune laisse la suite verte — pas de dette intermédiaire)

- **E1 — `TestSpec` + « meilleur héros » partagés (pur, testé).** Extraire le type + la famille de primitives ;
  refactorer les 3 defs. Aucune UI. Golden inchangés. Faible risque.
- ~~**E2 — Armée-`Combatant` + issues `GameOp`**~~ — **SUPPRIMÉ** (erreur de catégorie, §7bis). Le modèle plat
  `MassBattleArmy` + moteur pur reste. **N'était PAS une vraie dépendance de S2.**
- **E3 — Affectation explicite (moteur/state).** Enregistrement `Record<heroId, actionId>` + résolution par le
  héros affecté ; `bestForSkills` → suggestion. Tests de flux. **Ne dépend PAS d'E2.**
- **S1 — `StationSheet` générique + registre de kinds.** Généraliser `PosteSheet` (poste = 1er kind,
  comportement CONSTANT). Vérif navire+siège inchangés (navigateur).
- **S2 — kind `battleScene`.** `Scene.stations` + `battleScenesToStations` + embed dans `MassBattleView` +
  affectation explicite (via E3), **sur le modèle plat existant**. Remplace la liste plate. Vérif navigateur
  (`bataille-de-masse`).
- ~~**C1 — Composant d'affectation d'activité (fusion des 3 pickers)**~~ — **RAMENÉ À NÉANT** (mirage, §7ter).
  L'unification était DÉJÀ livrée par E1 (`activitiesFor(ctx)` + `TestSpec`) ; les 3 surfaces sont
  légitimement divergentes par CADENCE (interlude = panneaux bespoke + `CatalogPane` à jet immédiat ;
  mer = batch hebdo `<Prose>`+mise ; voyage = rôle PERSISTANT engine-résolu par Étape, EDOC ch.5). Rien à fusionner.

Ordre : **E1 → E3 → S1 → S2 → C1** (E3 pur remonté ; S1+S2 gardés ADJACENTS pour que `battleScene` façonne le
registre `StationKind` en même temps que `poste`, évitant une abstraction spéculative à un seul implémenteur —
§7 Q2). Dépendances : S1 ⇐ E1 ; S2 ⇐ E3+S1 ; C1 ⇐ E1. Plus de phase RAW-critique : le moteur de masse n'est pas touché.

## 4. Ce qui est SUPPRIMÉ (nettoyage POC, zéro dette)

- `bestForSkills` comme MÉCANISME → défaut seulement (E3).
- Liste de scènes/activités en boutons plats de `MassBattleView` → `StationSheet` (S2).
- ~~Les 3 pickers d'activité divergents → 1 composant (C1)~~ — **abandonné** (mirage, §7ter) : déjà unifié en E1.
- Triplication du descripteur de Test → `TestSpec` (E1).
- ⚠ *Séparé, NON bundlé* : `BattleTestModal` (`openBattleTest`) parallèle à `RollFlowShell` — dedup candidate
  à évaluer APRÈS (l'exprimer en flux de jet partagé), hors de ce chantier.

## 7bis. Pourquoi E2 (Puissance→`GameOp`) a été ÉCARTÉ (revue adversariale + vérif directe)

Piste initiale : « armée = `Combatant`, Puissance = `wounds`, deltas de Puissance = `GameOp` ». **Erreur de
catégorie**, prouvée dans le code :

- **La Puissance est une CIBLE DE TEST**, pas un pool de PV : `rollMightTest(might)` = `rollTest(might, …)` →
  d100 ≤ Puissance courante (`massBattle.ts` l.219-223 ; ADE II ch.8 l.120). Le Test de tenue (Hold) utilise
  même la Puissance ENNEMIE comme valeur-cible d'un d100 (`massBattleFlow.ts` ~l.417). `wounds` n'est jamais
  une cible de jet ici. Modéliser Puissance en `wounds` la dédoublerait (wounds + carac testable synchronisés).
- **Le clash est du calcul, pas un montant** : `mightReduction(sl)=max(5,10+sl)` (non opposé, simultané) vit
  dans `resolveClash` ; `applyOps` prend un montant PRÉ-calculé → ne peut pas héberger « jette, prends le DR,
  10+DR planché à 5 ». La seule logique intéressante ne devient pas `GameOp`, elle se relocalise.
- **`normalizeMights`** (−10 aux DEUX armées jusqu'à [0,100]) et **`decided`** (écart brut >100) sont des
  opérations CROSS-armées sur des nombres bruts — pas un `GameOp` par-cible.
- **`startMight` MUTE en cours** (Rassembler/Sabotage, `massBattleFlow.ts` l.645/651) → il faudrait RELEVER
  `wounds.max` ; **aucun op ne le fait** (`heal` plafonne à max, ne l'élève pas) → contredit « aucun op nouveau ».
- **`firstRoundBonus`/`planningBonus`/`allyTestMod`** sont des modifs de TEST (de l'armée ou d'un HÉROS), lues
  par `resolveClash`/les jets de héros — PAS par `testValue` de l'armée (qui ne s'auto-teste pas via ce chemin) →
  un `testMod`/`charMod` sur l'armée serait **lu par personne**. Ils RESTENT des scalaires d'état de bataille.
- **`wounds`/`loseWounds` fuient** des sémantiques de créature (armure/TB, À Terre à 0, remise à zéro de
  l'Avantage) sur une abstraction qui n'en a pas.

Conclusion : le garde-fou « `GameOp` = langue des EFFETS » **ne s'applique pas** à une carac d'armée testable.
Le modèle plat + moteur pur EST correct. **E2 supprimé ; S2/E3 n'en dépendaient pas.** *(Les `GameOp` restent
pertinents pour les effets sur les HÉROS d'une scène — soin de ralliement, dégâts d'un combat tactique — déjà
couverts par les chemins normaux.)*

## 7ter. Pourquoi C1 (fusion des 3 pickers d'activité) a été RAMENÉ À NÉANT (vérif directe du code)

Prémisse initiale : « 3 pickers d'activité divergents (interlude/voyage/mer) → 1 composant ». **Mirage**, prouvé
en lisant les trois UI :

- **L'unification utile est DÉJÀ faite (E1).** Le catalogue est UNIQUE : `activitiesFor(ctx)` (`engine/activities`) ;
  `interludeCatalog` = `activitiesFor('interlude')` + gate géo, `seaActivitiesCatalog` = `activitiesFor('mer')`
  (alias trivial). `TestSpec` (E1) partage déjà le descripteur de Test. Il ne reste RIEN à mutualiser au niveau
  catalogue/moteur.
- **Les 3 UI divergent par CADENCE, pas par duplication.** *Interlude* (`InterludeScreen`) = 6 panneaux BESPOKE
  codés (Revenus/Artisanat/Apprentissage/Commande/Banque/Identifier) + un `CatalogPane` riche par résolveur
  (masterWeapon/identify/memorize, pré-jet, **jet immédiat** via `interludeActivity`). *Mer* (`SeaActivitiesModal`)
  = batch hebdo (l.268), cartes par héros, `<Prose>` + mise, résolu au **confirm de fin de semaine**. *Voyage*
  (`TravelRolesPanel`) = grille `OptionChooser` de **rôle PERSISTANT** (`travelRole`, EDOC ch.5 « les mêmes tiennent
  toujours le même poste »), **engine-résolu par Étape** (`stageAssignmentFromRoles`→`resolveStageActivities`) — le
  picker AFFECTE un rôle, il n'EXÉCUTE rien, donc ni détail ni jet au clic (correct, pas un manque accidentel).
- **Aucune surface partagée au-delà de `<Prose>`** (déjà une primitive). `CatalogPane` (interlude, jet immédiat +
  ciblage par résolveur) et le détail de `SeaActivitiesModal` (Prose + mise, batch) ne partagent que `<Prose md=…>`.
  Extraire un « composant commun » fabriquerait une fausse communauté à branches de cadence — l'anti-pattern que
  le garde-fou §3bis (orchestrateur/machinerie) proscrit.

Conclusion : **la « colonne vertébrale » des activités est déjà partagée (E1) ; les 3 surfaces sont légitimement
distinctes par cadence** (une-passe/jet immédiat · batch hebdo · rôle persistant). C1 ne construit rien — le
forcer serait de la sur-ingénierie. Chantier livré = **E1 + E3 + S1 + S2**.

## 5. Ancrages RAW & garde-fous

- **NE PAS fondre les modèles d'activité** : `BattleActivityDef` garde `combined`/`char`/`requires`/`grantsFlag`
  (ADE II ch.8, absents du voyage). On partage `TestSpec` + primitives, PAS le modèle d'issue. Cf. mémoire
  `game-massbattle-activities-distinct`.
- Le moteur de domaine masse (clash, normalisation, Hold, hasards, machines de guerre — ADE II ch.8 l.13-321)
  garde ses FORMULES **et sa représentation** (modèle plat `MassBattleArmy` + moteur pur) — **INCHANGÉ** (§7bis).
- Aucune donnée de règles touchée par ce chantier (E1 = types ; S2 `Scene.stations` = contenu de scène).

## 6. Vérification (par phase)

- Moteur (Vitest) : golden-values de Puissance identiques (moteur de masse intouché) ; `TestSpec`/« meilleur
  héros » purs (E1) ; affectation → héros correct (E3).
- Navigateur (preview) : `combat-naval`/`siege-enceinte` inchangés (S1) ; `bataille-de-masse` — scènes sur le
  plan + affectation explicite (S2) ; interlude + mer (C1). Piège preview : viewport se ré-réduit ;
  `preview_click` ne déclenche pas React → `b.click()` via eval, 2 appels séparés (closure-sync).

## 7. Risques / questions ouvertes

1. *(ex-« E2 est le point dur » — RÉSOLU par suppression d'E2, cf. §7bis.)* Reste : la scène-minimap de masse ne
   montre QUE les stations d'action (les armées restent des abstractions à barre de Puissance, non rendues). À
   confirmer en S2.
2. **Registre `StationKind` (S1)** : bien séparer les 3 responsabilités par kind (détail / affectation /
   résolution) sans que la coquille connaisse un kind en dur. Risque de sur-généralisation → garder le poste
   comme test de non-régression.
3. Portée de C1 : réutilise-t-on la MÊME UI par-héros pour les 3 contextes malgré leurs cadences différentes
   (interlude = séquentiel/modale ; voyage = rôle persistant ; mer = batch hebdo) ? Le picker+détail se
   partage ; la CADENCE (quand ça se résout) reste propre au contexte.
