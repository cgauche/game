# Moteur de séquence de conséquences généralisé — Design (P0)

*2026-06-15. Tranche P0 d'un chantier en plusieurs phases.*

## Vision (l'épopée, pour le contexte)

Aujourd'hui chaque modale de jet (attaque, défense, incantation) n'affiche **qu'une**
ligne d'issue (`RollFlowShell.outcome`). Toutes les autres conséquences du jet partent
**ailleurs** : critique, maladresse (oups), colère des dieux / imparfaite et Assommante
**popent une `RevealModal` séparée** (qui gèle l'IA) ; d'autres (Immobilisante, effets de
sort, enchantements sur touche) sont **muettes — journal seul**. Certaines exigent même un
**choix** du joueur (dévier un critique → `pendingDeviation`, piège-lame → `pendingBladeTrap`,
localisation d'un critique forcé → picker), via encore d'autres modales.

La **cascade de nuit/voyage** (`src/state/cascade.ts`) vient de prouver le motif inverse : une
**séquence de conséquences** rendue **inline, multiligne, dans la même modale**, chaque étape
gardant son jet ET sa conséquence, finissant en **bilan**. L'épopée : faire de cette cascade le
**moteur de séquence générique** que **tout jet de combat** alimente — l'après-coup d'un jet
(critique → dévier ? → localisation → état ; ou sort → imparfaite → ops) est *une autre
instance* de la même séquence d'étapes mixtes (**jet** influençable / **choix** / **affichage**).

Découpage validé (chaque tranche = son spec → plan → implémentation) :

- **P0 (CE spec)** — généraliser le moteur de séquence en couche **pure + testée**, **zéro combat**.
- **P1** — brancher le **lancer de sort** (imparfaite/colère + effets inline).
- **P2** — **attaque, affichage** (critique/Assommante/états inline, remplace les `RevealModal`).
- **P3** — **attaque, choix** (dévier / piège-lame / localisation forcée comme étapes).
- **P4** — **défense** (réactive, IA suspendue) — le plus délicat, en dernier.

## P0 — périmètre

Généraliser le moteur cascade pour qu'une séquence porte **trois types d'interaction d'étape** :

- **jet** — un Test influençable (Chance / Détermination / Pacte / Résilience) : comportement actuel ;
- **choix** — le joueur prend une option (`options[]`) ; l'option retenue pilote la conséquence/branche ;
- **affichage** — conséquence pure à montrer (aucune entrée) ; « Continuer » l'acquitte.

Le moteur enchaîne ces étapes mixtes, **insère** des suites (déjà : abri→exposition), accumule les
notes de conséquence, finit en **bilan** (déjà construit). La **cascade de nuit migre dessus sans
changement visible** (régression verte). Les étapes choix/affichage sont prouvées par des **tests
unitaires** (étapes synthétiques au niveau store).

### Non-goals (P0)

- **Aucun branchement combat** : on ne touche ni `combatFlow.ts`, ni `applyAttackResult`, ni `miscast.ts`,
  ni `RevealModal`/`pendingReveals`. Ces flux restent strictement inchangés.
- **Aucun rendu** des étapes choix/affichage dans `CascadeModal` : le rendu (OptionChooser pour le
  choix, lignes + « Continuer » pour l'affichage) arrive avec le **premier consommateur réel** (P1/P2).
  La cascade de nuit (jets only) reste rendue à l'identique.
- **Pas de renommage** : « cascade » reste le nom du moteur générique (il convient aussi au combat ;
  renommer = churn/risque inutile en P0).
- `describe` (issue courte de modale) **inchangé** : orienté jet `(success, name)`. Les étapes
  choix/affichage de P0 s'appuient sur `outcome` (lignes de l'applier) pour leurs notes de test —
  pas besoin de `describe` tant qu'il n'y a pas d'UI.

## Modèle d'étape

Type d'interaction **inféré des champs** (zéro migration des étapes-jet existantes) :

| Interaction | Condition | Prêt à valider quand |
|---|---|---|
| `jet` | `target != null` | `result != null` |
| `choix` | `target == null && options != null` | `chosen != null` |
| `affichage` | ni `target` ni `options` | toujours |

Helpers purs dans `cascade.ts` : `stepInteraction(step): 'jet' | 'choix' | 'affichage'` et
`stepReady(step): boolean`.

Ajouts à `CascadeStep` (`src/state/pendings.ts`), tous optionnels (sérialisables — coop) :

```ts
options?: { key: string; label: string; detail?: string }[]; // étape « choix »
chosen?: string;        // option retenue (clé) — analogue de `result` pour un jet
defaultChoice?: string; // clé choisie d'office par « Tout lancer » / résolution immédiate (déf. = options[0])
```

On garde `result` (jet), `outcome` (lignes de conséquence appliquées), `committed`.

## Moteur (`src/state/cascade.ts`)

- **Garde « étape prête » généralisée** : `advanceCascade` n'avance plus que si `stepReady(cur)`
  (jet→`result`, choix→`chosen`, affichage→toujours). Sinon no-op (la modale force d'abord la
  résolution, comme le jet aujourd'hui).
- `commitStep` **inchangé en signature** : l'applier reçoit `step` et lit `step.result` **ou**
  `step.chosen` selon le type. Insertions et `outcome` identiques.
- `resolveRemainingCascade` (« Tout lancer ») et `runCascadeImmediate` (multi-jours / reprise auto /
  triche) **généralisés** : pour chaque étape restante non résolue — jet → `rollTest` ; choix →
  `chosen = step.defaultChoice ?? step.options[0].key` ; affichage → rien — puis `commitStep`.
- **Nouvelle action** `cascadeChoose(stepId, key)` (store — nommage `cascadeX` comme les autres) :
  pose `chosen` sur l'étape « choix » courante (valide que `key ∈ options`). Analogue strict de
  `cascadeRoll`. Délègue à une fonction pure `setCascadeChoice(get, set, stepId, key)` dans `cascade.ts`.
- `FLOWS.cascade` (jet influençable) **inchangé** : il ne s'applique qu'aux étapes `jet` ; les
  étapes choix/affichage ne passent pas par lui.

## Appliers

`cascadeAppliers[kind] = { apply, describe? }` **inchangé**. `apply(get, set, step, hero, ctx)` lit
désormais `step.result` (jet) ou `step.chosen` (choix), renvoie `{ journal?, insert? }` comme
aujourd'hui. C'est ce qui permet à un applier de **brancher** (ex. choix « dévier » → insère une
étape « localisation », choix « subir » → insère l'étape « critique appliqué »).

## Migration de la cascade de nuit

Les étapes de nuit portent toutes `target` → inférées `jet` → comportement **identique**. Aucune
modification de `restFlow.ts`, `CascadeModal.tsx`, ni des appliers de nuit. La régression est
garantie par les suites existantes (`cascade.test.ts`, `rest-flow.test.ts`, `upkeep-cascade.test.ts`,
`roll-modal-invariant.test.ts`).

## State / coop

- `store.ts` : ajoute l'action `cascadeChoose` (interface + impl) à côté de `cascadeRoll`/`cascadeNext`.
- `net/intents.ts` : ajoute `'cascadeChoose'` à `COMBAT_INTENTS` (un invité peut faire un choix de
  séquence — cohérent avec `cascadeRoll`). `intents.test.ts` vérifie l'existence du nom dans le store.

## Tests (`src/state/cascade.test.ts`)

Étapes **synthétiques** (kinds de test, comme `'tally'`/`'shelter'` déjà présents) :

1. **Étape choix** : `options:[{key:'a'},{key:'b'}]` ; applier qui branche sur `step.chosen` et
   **insère** une étape selon l'option → `cascadeChoose(id,'a')` puis `cascadeNext` ; vérifie que
   l'applier a vu `'a'` et inséré la bonne suite.
2. **Étape affichage** : ni `target` ni `options` ; `cascadeNext` l'**acquitte** sans jet ni choix ;
   l'applier a tourné, `outcome` posé.
3. **Séquence mixte** : jet → choix → affichage ; avance pas-à-pas ; chaque étape figée garde sa note.
4. **`resolveRemainingCascade` mixte** : choix non résolu → `defaultChoice` (ou 1ʳᵉ option) ;
   affichage acquitté ; jet roulé ; **bilan** (curseur en fin) avec toutes les conséquences.
5. **Garde** : `cascadeNext` est un no-op sur une étape choix sans `chosen` (parité avec le jet non lancé).
6. **Régression** : les 5 tests cascade existants + nuit restent verts.

`typecheck` propre, suites concernées vertes.

## Décisions (tranchées)

- **Interaction inférée des champs** (pas de discriminant explicite) → zéro migration des jets existants.
- **Pas de renommage** « cascade » → « séquence » (churn/risque).
- **Rendu choix/affichage déféré** au 1er consommateur (P1/P2) — P0 = moteur + state + tests.
- `describe` inchangé (jet) ; choix/affichage s'appuient sur `outcome`.

## Risques

- **Faible.** Couche additive : nouveaux champs optionnels, gardes généralisées en surensemble du
  comportement actuel. Le risque principal serait une régression de la cascade de nuit — couvert par
  les suites existantes (à garder vertes). Aucun fichier combat touché.
