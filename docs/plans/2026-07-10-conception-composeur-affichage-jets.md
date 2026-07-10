# Conception — Composeur d'affichage de jet (#295, programme #276)

> **Artefact DATÉ** (`docs/plans/`) — à supprimer une fois #295 exécuté. Le code fait foi.
> Date : 2026-07-10. Mandat user (verbatim) : « reprendre la main sur ce qu'on affiche pour que cela
> suive toujours les mêmes règles et qu'on puisse juste modifier certains paramètres » + « le pire
> c'est les résultats qui remettent le résultat du jet visible juste au-dessus ». Principe retenu :
> INVERSION DE CONTRÔLE — les flux émettent de la STRUCTURE, jamais une chaîne ; un moteur de rendu
> par surface compose ; gabarits au catalogue i18n (patron `fr.ts`, namespace `out.*`).

**FOYER = `src/state/rollSeam.ts`** (la porte du seam, déjà en place). AUCUN 2e module. Deux fonctions pures + un flip de type.

## 1a. Titre — `rollTitle` = promotion de `composeRollLabel`
```ts
export function rollTitle(get: Get, req: RollRequest): string   // = composeRollLabel wrappé (get, req)
```
Dérive TOUT des ids : acteur (`resolveMonoSide`), compétence (`findSkillById(test.skill)?.label`) / carac (`CHAR_LABELS[test.char]`), difficulté (`DIFFICULTY_LABELS`). Le seam l'appelle déjà (`buildMonoStep` écrit `step.label`). → les modales cessent de composer : elles affichent `pending.label`/`step.label`. L'icône reste un slot à part ; le TEXTE du titre ne vient QUE de `rollTitle`. Incohérence à corriger : `startCascade` pose `title: req.test.label` nu alors que `step.label` est composé → unifier `pending.title = rollTitle(get, req)` pour le mono.

## 1b. Dénouement — `resultLine` (signature qui rend la duplication INEXPRIMABLE)
```ts
export type Consequence =
  | { ops: GameOp[] }                       // effet appliqué → montant RÉEL (Blessures, État, Corruption…)
  | { say: OutKey; vars?: OutVars<OutKey> } // conséquence narrative, clé i18n `out.*` SANS placeholder de jet
export function resultLine(cons: Consequence[]): string
```
`resultLine` ne reçoit **ni roll, ni target, ni sl, ni success/won** → `` `${roll}/${target}` `` et « réussi (DR X) » sont **non-écrivables**. `cons` vide ⇒ `''` : la rangée (`RollLine`, ✓/✗ ±DR) porte seule le verdict — ce qui supprime le fallback « X réussit »/« X échoue » (CascadeModal:90,232) et les prologues « Réussite — »/« Échec — » (HandGate:70, Cast:101). L'issue mécanique se rend depuis le `GameOp` DÉJÀ appliqué (montant réel), jamais depuis le jet.

## 1c. Flip de type au choke-point (migration forcée par le compilateur)
- `CascadeApplier` : `{journal?: string[]}` → **`{consequences?: Consequence[]}`** (cascade.ts:39). Le canal string libre disparaît du type.
- **Supprimer** `CascadeDescriber = (success, name) => string` (cascade.ts:44) — il reçoit le verdict ; remplacé par `resultLine([])` (rien à dire) ou `Consequence[]` typé.
- `commitStep` (cascade.ts:110) appelle `resultLine(out.consequences)` → `step.outcome`. `CascadeStep.outcome: string[]` reste (c'est le rendu) mais n'est **écrit QUE** par `commitStep`.
- `flowOutcomes.describeX(pending)` (reçoit le pending → roll/success) : chaque `describeX` devient un producteur de `Consequence[]` (ou disparaît quand la conséquence est un `GameOp` déjà appliqué). `describeTest` → `[]` (Test nu = rien à re-dire).

## Lots de migration (par surface, ordre)

| Lot | Surface | Sites | Détail |
|---|---|---|---|
| **0** substrat | rollSeam + cascade + pendings + flowOutcomes | ~4 fichiers | `rollTitle`/`resultLine`/`Consequence`, flip `CascadeApplier`, suppr. `CascadeDescriber`, `commitStep` re-câblé. Aucun call-site cassé encore (fallback typé transitoire). |
| **1** cascade appliers | river/travel/travelPostes/sea/shipwreck/pursuit/combatFlow/roundHooks/turnHooks/triggeredTest + rest/embrigadement | **~51 appliers** | Bulk de la fuite d'outcome. river ~13, travel 5, postes ~4, sea 4 (⚠ re-confronter à HEAD post-Ronde 1), shipwreck 1, pursuit 1, combatFlow 3, roundHooks 2, turnHooks 2, triggeredTest 1, rest ~13 (conversion mécanique), embrigadement 2. + les 8 kinds sans `describe` (fallback) absorbés. |
| **2** modales inline | Maneuver:92, HandGate:70, Cast:101, Dispel:75, useExtendedTest:70, + extra par-rangée Crew:101/ShipManeuver:81/ForceDoor:58 | **~8** | Remplacer chaîne ad hoc par `resultLine(...)`. La rangée-participant a besoin de `resultLine` aussi (source unique de l'« issue par PJ »). |
| **3** titres modales | CrewTest, ShipBattery, Maneuver, Cast, Bargain, Reload, Appraise, Corruption, Heal, Cascade, useAttack… | **~19** | Consommer `pending.label` = `rollTitle`. Ceux passés au seam l'obtiennent gratis ; les autres gardent un littéral jusqu'à leur passage au seam. |
| **4** journal/PV | MultiRollList `text`, log() adjacents (portFlow:198/201, corruptionFlow:75/84/113, store:2055/2067, seaActivities:114/137/147/154, shipwreck:111 inline) | **~14** | Si adjacent à une `RollLine` visible → `resultLine` ; sinon `log()` narratif hors périmètre (documenter). |

## Verrous (signature primaire, cliquets en ceinture)
- **(b) dénouement × outcome → SIGNATURE** : `CascadeApplier`/`resultLine` ne portent pas roll/target/sl/success — erreur de compilation, pas un lint. Ceintures : garde i18n (aucune clé `out.*` avec `{roll}`/`{target}`/`{sl}`/`{drow}` — casse `cf.corruptionExposure` fr.ts:576, à sortir du namespace) + grep-cliquet sur `state/*Flow.ts`/appliers : motifs `\$\{[^}]*\.(roll|target|sl)\b` et `\b(réussi|raté|réussit|échoue)\b` dans les littéraux `outcome:`/`journal:` (couvre le canal `log()`).
- **(a) titre par site → cliquet** : extension de `component-conformance.test.ts` — un titre de modale de jet en template literal avec `${` et (`—` ou token compétence/carac) = échec ; formes légales : littéral nu, `pending.label`, `rollTitle(...)`.

## Légitimement HORS composeur
- **`res.log` du moteur** (`engine/combat.ts`, ex. « X manque Y ») — ligne autorée par le moteur, EST le contenu de la rangée de combat ; la faire transiter par `resultLine` la dupliquerait.
- **`RollLine`/`RollPanel`/`RollBreakdown`** — ILS SONT le rendu de l'outcome (référent ✓/✗ ±DR).
- **Narration de combat scénarisée** (`combatNarration.ts`/`CombatBanner`/`NarratedLine`) — mise en scène keyée par événements moteur, sans re-print de jet.
- **`VsHeader`** — en-tête A→B, aucun résultat.

⚠ Réserve : `seaVoyageFlow.ts` lu en working-tree (WIP Ronde 1) — re-confronter les sites à l'état post-Ronde 1 avant le Lot 1.

## Séquencement
Lot 0 touche `rollSeam`/`cascade`/`pendings` = fichiers de la Ronde 1 → part APRÈS son atterrissage. Puis Lots 1-4, verrous en queue de leur lot. Coordination Ronde 2 (remplacement FSM mer) : ses appliers naissent DIRECTEMENT en `Consequence[]`.
