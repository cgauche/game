# Unification « postes / activités / événements de bataille » — conception phasée

> Statut : **conception** (pré-exécution). Fait suite au chantier minimap/`TopoScene` (P1-P4 livrés :
> `Station` + `TopoScene` + `PosteSheet` unifié navire+siège). Ce doc cadre l'unification PLUS PROFONDE
> demandée : partager la colonne vertébrale entre postes, activités et événements de combat de masse.

## 1. Contexte & principe

Trois « choses auxquelles on affecte un héros et qui se résolvent par un Test » :

| | Poste (canon/affût) | Activité (interlude/voyage/mer) | Événement de bataille (masse) |
|---|---|---|---|
| Position | sur la coque/le rempart | **aucune scène** | sur le champ (à spatialiser) |
| Affectation | N héros → 1 slot | 1 héros → 1 action | 1 héros → 1 scène |
| Test | tir (arme) | compétence | compétence (+ combiné/caract) |
| Issue | dégâts | `GameOp`/`stageOutcome` | **Puissance d'armée** |

**Ce qui est commun = le Test + l'affectation + (pour poste/bataille) la position.** Ce qui diverge = **l'issue**
et la **topologie** (N:1 vs 1:1). Deux constats vérifiés qui pilotent le design :

- **Les issues de masse DOIVENT être des `GameOp`.** `CLAUDE.md` : « `GameOp` = langue UNIQUE de tout effet ;
  avant tout type ad hoc → l'exprimer en `GameOp[]` ». Or `ActivityOutcome {target:'allyMight',amount}`
  (`massBattle.ts`) est précisément un type d'effet ad hoc. Un `GameOp` cible un `Combatant` ; une **coque
  de navire** et une **structure de siège** SONT déjà des `Combatant` (via `inanimateCombatant`). → **une armée
  doit être un `Combatant`** dont la Puissance est une ressource (PV). Vérifié : `ops.ts` a `wounds`/`heal`
  (montant `Formula`, `ignoreTB/ignoreAP`) → un « −10 Puissance ennemie » = `{op:'wounds',
  amount:{flat:10}, ignoreTB:true, ignoreAP:true}` sur l'armée-Combatant ; ralliement = `heal`. **Aucun op
  nouveau nécessaire.**
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
| **A. Moteur** | postes + activités + bataille | `TestSpec` unique · issues `GameOp` (armée=`Combatant`) · affectation explicite |
| **B. Surface Station SPATIALE** (plan + affectation) | postes + événements de bataille | `StationSheet` générique (ex-`PosteSheet`) + registre de kinds |
| **C. Composant d'affectation d'ACTIVITÉ** (par-héros, sans plan) | interlude + voyage + mer | dédup des 3 pickers, réutilise `TestSpec` + rendu de détail |

### A. Couche moteur (le vrai « ils partagent beaucoup »)

- **`TestSpec` partagé** (`{ skills?: SkillRef[]; char?: CharKey; difficulty?: Difficulty; combined?: boolean }`) —
  aujourd'hui **triplé** dans `ActivityDef` (sans `char`/`combined`), `BattleActivityDef`, `BattleSceneDef`.
  → un seul type, référencé par les trois. `ActivityDef` gagne `char`/`combined` (extension inoffensive).
- **« meilleur héros pour un `TestSpec` »** — `bestForSkills` (`massBattleFlow`) et le chemin `partyBest`
  (`resolveSkillBest`, `activities`) se recoupent → **une primitive unique** (avec variante combiné :
  maximise le plus faible des deux, `bestForCombined`).
- **Armée = `Combatant`** — `MassBattleArmy { name, might, startMight }` (objet plat) → construit via
  `inanimateCombatant` (MÊME builder que coque/structure) avec `wounds = { current: might, max: startMight }`.
  Le clash / la normalisation / le Point de rupture (Hold) opèrent sur ses `wounds`. **Valeurs & seuils RAW
  restent en donnée** (ADE II ch.8) ; seule la **représentation** change (ressource + `GameOp`).
- **Issues → `GameOp[]`** — `ActivityOutcome`/`BattleSceneEffect` (deltas de Puissance) ré-exprimés en
  `GameOp[]` appliqués par `applyOps(armée, ops)`. `firstRoundBonus`/`planningBonus`/`allyTestMod` (modifs de
  Test, pas de la Puissance) : soit `charMod`/`testMod` sur l'armée-Combatant, soit un petit champ d'état de
  bataille — **à trancher en E2** (préférer `GameOp` si exprimable).
- **Affectation explicite** — un enregistrement `Record<heroId, actionId>` (comme `StagePosting` /
  `poste.crewIds`) ; la résolution prend le héros AFFECTÉ. `bestForSkills` → défaut proposé, pas imposé.

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

- **E1 — `TestSpec` + « meilleur héros » partagés (pur, testé).** Extraire le type + la primitive ; refactorer
  les 3 defs. Aucune UI. Golden inchangés. Faible risque.
- **E2 — Armée-`Combatant` + issues `GameOp` (⚠ RAW-critique).** Migrer `MassBattleArmy` en `Combatant`
  (wounds=Puissance) ; ré-exprimer les deltas en `GameOp` ; clash/hold/hasards/machines opèrent sur les wounds.
  **Golden-values** : Puissances finales identiques à l'ancien code. Re-lire ADE II ch.8 AVANT. Isolée, la plus
  délicate.
- **E3 — Affectation explicite (moteur/state).** Enregistrement d'affectation + résolution par le héros affecté ;
  `bestForSkills` → suggestion. Tests de flux.
- **S1 — `StationSheet` générique + registre de kinds.** Généraliser `PosteSheet` (poste = 1er kind,
  comportement CONSTANT). Vérif navire+siège inchangés (navigateur).
- **S2 — kind `battleScene`.** `Scene.stations` + `battleScenesToStations` + embed dans `MassBattleView` +
  affectation explicite (via E3). Remplace la liste plate. Vérif navigateur (`bataille-de-masse`).
- **C1 — Composant d'affectation d'activité.** Dédup interlude/voyage/mer. Vérif navigateur (interlude + mer).

Ordre : **E1 → S1 → E2 → E3 → S2 → C1** (S1 ne dépend que d'E1 ; S2 dépend d'E2+E3+S1).

## 4. Ce qui est SUPPRIMÉ (nettoyage POC, zéro dette)

- `ActivityOutcome`/`BattleSceneEffect` ad hoc → `GameOp[]` (E2).
- `MassBattleArmy` plat → `Combatant` (E2).
- `bestForSkills` comme MÉCANISME → défaut seulement (E3).
- Liste de scènes/activités en boutons plats de `MassBattleView` → `StationSheet` (S2).
- Les 3 pickers d'activité divergents → 1 composant (C1).
- Triplication du descripteur de Test → `TestSpec` (E1).
- ⚠ *Séparé, NON bundlé* : `BattleTestModal` (`openBattleTest`) parallèle à `RollFlowShell` — dedup candidate
  à évaluer APRÈS (l'exprimer en flux de jet partagé), hors de ce chantier.

## 5. Ancrages RAW & garde-fous

- **NE PAS fondre les modèles d'activité** : `BattleActivityDef` garde `combined`/`char`/`requires`/`grantsFlag`
  (ADE II ch.8, absents du voyage). On partage `TestSpec` + primitives, PAS le modèle d'issue. Cf. mémoire
  `game-massbattle-activities-distinct`.
- Le moteur de domaine masse (clash, normalisation, Hold, hasards, machines de guerre — ADE II ch.8 l.13-321)
  garde ses FORMULES ; seule sa REPRÉSENTATION passe en `Combatant`/`GameOp`.
- Gardes RAW après E2 : `node scripts/raw/coverage.mjs` + `reconcile.mjs`, + golden-values de Puissance.

## 6. Vérification (par phase)

- Moteur (Vitest) : golden-values de Puissance identiques (E2) ; `TestSpec`/« meilleur héros » purs (E1) ;
  affectation → héros correct (E3).
- Navigateur (preview) : `combat-naval`/`siege-enceinte` inchangés (S1) ; `bataille-de-masse` — scènes sur le
  plan + affectation explicite (S2) ; interlude + mer (C1). Piège preview : viewport se ré-réduit ;
  `preview_click` ne déclenche pas React → `b.click()` via eval, 2 appels séparés (closure-sync).

## 7. Risques / questions ouvertes

1. **E2 est le point dur.** `firstRoundBonus`/`planningBonus`/`allyTestMod` sont des modifs de TEST, pas de
   Puissance — exprimables en `GameOp` (`testMod`/`charMod` sur l'armée-Combatant) ? Sinon petit état de
   bataille. À trancher en lisant le RAW l.75-106.
2. L'armée-`Combatant` a-t-elle une position/rendu (jeton) sur la scène-minimap dédiée, ou reste-t-elle une
   abstraction (barre de Puissance) ? — probablement une entité non-rendue, la scène ne montre que les
   stations d'action. À confirmer en S2.
3. Portée de C1 : réutilise-t-on la MÊME UI par-héros pour les 3 contextes malgré leurs cadences différentes
   (interlude = séquentiel/modale ; voyage = rôle persistant ; mer = batch hebdo) ? Le picker+détail se
   partage ; la CADENCE (quand ça se résout) reste propre au contexte.
