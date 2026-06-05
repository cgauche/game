# Finir la profondeur combat — Chance (relance/+1 DR), Détermination, Ramasser

- **Date** : 2026-06-05
- **Jalon** : 1 (profondeur des règles de combat) — clôture de la dette « combat — reste »
- **Statut** : design validé, en attente de relecture spec
- **Principe directeur** : *rien d'inventé* — toute règle est sourcée du Livre de base FR
  (`Source/Warhammer v4 - Livre de base version corrigée/`). Le moteur reste pur + testé.

## Contexte

Bug rapporté par le MJ + dette ROADMAP « Dépense de Chance en jeu […]. Reste : Détermination,
ajout direct de DR » et « action “ramasser” en plein combat ». L'exploration (workflow
`explore-combat-depth-debt`) a verrouillé le canon et cartographié le code.

État actuel du code :
- 5 actions de relance dans `src/state/store.ts` (`testReroll` l.1004, `attackReroll` l.794,
  `defenseReroll` l.835, `castReroll` l.668, `disengageReroll` l.913), **toutes** gardées par le
  seul `(fortune ?? 0) <= 0`. **Aucun** flag « déjà relancé » → relances multiples possibles.
  **Jamais** gaté sur l'échec → relance offerte même sur un succès.
- `Combatant.resolve?: number` (Détermination) déclaré (`src/engine/types.ts` l.145) mais
  **jamais consommé**. `fortune`/`fate`/`resilience` l.142-144.
- Aucune notion d'objet au sol *en combat* : `loot`/`search` (SceneEntity) ne sont consommés
  que par `interactEntity` en **exploration** (`store.ts` l.496-526). Économie du tour =
  `BattleState.moved`/`acted` (l.169-170), reset par `advanceTurn` (l.1599).
- Cas concret existant : `corps-cocher2` (`src/scenes/tome1-route.ts` l.101-111),
  `kind:'objet'` avec `search:[journal, giveTrapping 'Chemise de mailles', giveTrapping 'Tromblon']`.

## Décisions de fidélité (sources)

| Règle | Source LDB | Décision |
|---|---|---|
| Relance = **1×/Test** (pas de relance d'une relance) | ch.12 « Tests » l.56 | flag `rerolled` par `pending*` |
| Échec d'un Test = **ton d100 > cible** | ch.12 l.29-31 | gate de relance sur le **succès du d100 du lanceur**, **indépendant** de `hit`/issue opposée (ch.12 l.185) |
| Chance : **+1 DR** après le jet | ch.17 « Destin et Résistance » l.26 | usage distinct, **cumulable** (RAW pur) tant qu'il reste de la Chance ; jamais gaté sur l'échec |
| Détermination : **retirer un État** (+1 PB si À Terre) | ch.17 l.62-66 (usage #3) | seul usage branché ; **ne consomme pas l'Action** |
| Détermination #1 (immunité Psychologie) / #2 (ignorer modifs de Critique) | ch.17 l.62-66 | **non branchés** — subsystèmes non modélisés → laissés au MJ |
| Ramasser un objet au sol | ch.13 « Combat » l.115-116 (MJ décide ; si Test → Action) | **consomme l'Action** ; **un objet à la fois** ; **pas d'auto-équipe** |
| Source des objets au sol | — | éditeur/scène uniquement (`objet` + `loot`/`search`) ; **pas de drop auto** (Maladresses/critiques = laissés au MJ) |
| Recharge Chance/Détermination | ch.17 l.46-47, l.57 | **hors périmètre** (persistance Jalon 5) — on ne modélise pas le rechargement de session ici |
| IA | — | ne dépense **ni** Chance **ni** Détermination (simplification assumée, comme l'existant) |

Citations clés (verbatim) :
- ch.17 l.22-28 : « Relancer un Test qui s'est conclu par un échec. — Ajouter +1 DR à un Test
  après qu'il a été effectué. — Au début du Round, choisissez le moment où vous allez agir […]. »
- ch.12 l.56 : « Une fois qu'une relance a été effectuée sur un Test, il n'est plus possible de le
  relancer de nouveau, sauf circonstances exceptionnelles. »
- ch.12 l.29-31 : « Si le résultat de votre lancer est supérieur à la Compétence ou la
  Caractéristique, le Test est un échec […]. »
- ch.17 l.62-66 : « Retirez un État : si vous retirez l'État à Terre, regagnez 1 Point de Blessure
  lorsque vous vous mettez debout. »

## Architecture (moteur pur → store → UI)

### A. Moteur pur + testé — `src/engine/fortune.ts` (nouveau) + extensions

Responsabilité unique : la logique *pure* de dépense de ressource (sans état React/store).

- `canReroll(ownRollFailed: boolean, alreadyRerolled: boolean): boolean`
  → `ownRollFailed && !alreadyRerolled`.
- `applyBonusSL(result, bonus)` : renvoie un résultat re-dérivé avec `sl += bonus` et
  succès/seuil recalculés, **sans nouveau d100**.
- Recomputes d'issue à partir d'un **jet figé + bonus de DR** (extensions pures dans
  `combat.ts` / `magic.ts` / `tests.ts`) :
  - attaque & défense & désengagement (opposés) : on n'augmente **que** le DR du **joueur** ;
    le jet adverse reste **figé** (cohérent avec l'existant : `defenseReroll`/`disengageReroll`
    ne re-roulent que la moitié joueur).
  - incantation : `sl += bonus` peut franchir le seuil DR ≥ NI ; impacte les dégâts du
    Projectile magique.
  - dégâts de mêlée : re-dérivés du DR net augmenté.
- Détermination : la suppression d'État existe déjà (`conditions.ts`) ; seul ajout = **+1 PB**
  si l'État retiré est *À Terre* (helper pur, borné aux Blessures max).

**Dépendances** : `tests.ts` (TestResult), `combat.ts`/`magic.ts` (recomputes). Aucune dépendance
au store ni à React.

### B. Store — `src/state/store.ts`

**B1. Correctifs des 5 relances.** Ajouter `rerolled?: boolean` sur chaque `pending*`
(`store.ts` l.97-158). Chaque `*Reroll` :
1. gate `canReroll(ownRollFailed, pending.rerolled)` — sinon `return` (rien dépensé) ;
2. décrémente `fortune` **uniquement** si la relance a lieu ;
3. relance le jet (existant) ; pose `rerolled:true`.

> Pré-requis d'implémentation : chaque résultat figé doit exposer le **succès du d100 propre**
> de l'acteur (distinct de `hit`/issue opposée). À vérifier/surface par modale :
> attaque (succès du jet de l'attaquant), défense (succès du jet du défenseur),
> incantation (`res.cast`), test (`res.success`), désengagement (succès de l'Esquive du mover).

**B2. +1 DR.** Une action générique `spendFortuneSL(kind)` (ou 5 miroirs) :
décrémente `fortune`, `pending.bonusSL = (pending.bonusSL ?? 0) + 1`, re-dérive le résultat via
les helpers purs (A). Cumulable. La relance, si elle survient après, repart d'un d100 neuf en
**conservant** le `bonusSL` déjà acheté (DR payés indépendants du jet).

**B3. Détermination.** `spendDetermination(combatantId, conditionId)` :
décrémente `resolve`, retire l'État via `conditions.ts`, +1 PB si *À Terre*, **sync `party` +
clone `battle`**, **ne pose pas** `acted`.

**B4. Ramasser.** `battlePickup(entityId, itemKey)` calqué sur `battleUseItem` (l.626-654) :
- garde `!battle.acted && canTakeAction(active)` + entité `objet` avec items ramassables
  **adjacente/sur** la case de l'actif (distance ≤ 1, réutiliser la logique de voisinage) ;
- **un seul** `itemKey` consommé ; applique le `giveTrapping`/`loot` correspondant au
  **combattant actif** (pas party-best) ; **persiste dans `party` ET le clone `battle`**
  (piège : les clones ne sont jamais resync → écrire les deux), `recomputeLoadout(both)` ;
  **pas d'auto-équipe** (va dans `items[]` non équipé) ;
- marque l'item consommé (flag, voir D) ; pose `acted:true, action:null`.

### C. UI — `src/ui/*`

**C1. Modales (5).** `RollModal` / `DefenseModal` / `CastModal` / `TestModal` / `DisengageModal`,
bloc `.modal-actions` de phase résultat :
- « 🍀 Chance (relance) » : **masquée** sauf `ownRollFailed && !rerolled` (aujourd'hui : toujours
  affichée si `fortune>0`).
- « ➕ +1 DR » : nouveau bouton, gaté `fortune>0`, appelle B2 ; le DR/dégâts affichés
  (`RollLine`) se rafraîchissent.

**C2. Hotbar** `ActionBar.tsx` (`.ab-slots`, avant « Fin du tour » l.189) :
- « ✊ Détermination » : gaté `resolve>0 && (états de l'actif).length>0` → sélecteur d'État →
  `spendDetermination`.
- « ✋ Ramasser » : gaté présence d'un `objet` ramassable adjacent → si ≥2 items restants,
  sélecteur d'objet (un seul) → `battlePickup`.

`BattlePanel.tsx` reste inchangé (pas d'actions de combat dedans, par design).

### D. Données / scène — consommation « un objet à la fois »

Les objets ramassables d'une entité = ses `loot: string[]` + les `giveTrapping` de son
`search: Effect[]`. Pour permettre la prise **individuelle** :
- suivre les items consommés par **flags** narratifs (ex. `objet:<id>:pris` → liste de clés),
  comme `__fouille_<id>` existant ;
- `battlePickup` consomme **une** clé ; la fouille d'exploration (`interactEntity`) puise dans
  le **même** pool restant (n'accorde pas un item déjà ramassé en combat) ;
- effets non-objet du `search` (ex. `journal`) : appliqués une fois (première interaction,
  combat ou exploration), pas re-déclenchés par item.

Aucun nouveau champ de schéma de Scène : on réutilise `objet`/`loot`/`search` (donc reste
éditable). `corps-cocher2` devient l'exemple jouable : ramasser le **Tromblon** seul, en combat.

## Tests (TDD — écrits avant l'implémentation)

`src/engine/fortune.test.ts` :
- `canReroll` : 4 combinaisons (raté/réussi × déjà/pas relancé).
- `applyBonusSL` : franchit `requireSL` ; fait basculer une touche d'attaque ; n'altère pas le
  jet adverse figé.
- +1 PB sur retrait d'À Terre (borné aux Blessures max).

`src/state/*.test.ts` (store) :
- **régression** : relance plafonnée à 1× ; relance refusée quand le d100 propre est réussi
  (indépendamment de l'issue opposée).
- +1 DR cumulable décrémente `fortune` à chaque clic et re-dérive l'issue.
- `spendDetermination` retire l'État, +1 PB si À Terre, sync `party`, ne consomme pas l'Action.
- `battlePickup` : prend **un** objet, persiste dans `party` après `battle:null`, ne consomme
  pas un item déjà ramassé via exploration et inversement, consomme l'Action.

## Hors périmètre / simplifications assumées (à documenter dans le code + ROADMAP)

- Pas de **drop auto** d'arme (Maladresses/critiques restent au MJ).
- Détermination #1/#2 non branchés (pas de subsystème Psychologie/Critique modélisé).
- Ramasser **n'auto-équipe pas** ; **un objet à la fois**.
- Recharge des Points (session) : Jalon 5 (persistance).
- L'IA ne dépense ni Chance ni Détermination.

## Recette navigateur (Playwright)

Scène **Chapitre 2 (ambuscade)** (`tome1-route`) :
1. Un héros adjacent à `corps-cocher2` → **Ramasser** → choisit **Tromblon** (seul) → l'Action
   est consommée ; le Tromblon est dans son inventaire (non équipé). La Chemise de mailles
   reste ramassable.
2. Relance : impossible une 2e fois ; absente quand le d100 propre est réussi.
3. **+1 DR** : fait basculer une touche / franchir le NI d'un sort, dégâts mis à jour.
4. **Détermination** : retire « À Terre » sur un héros → +1 PB.

## Fichiers touchés (prévision)

- `src/engine/fortune.ts` (nouveau) + `fortune.test.ts` (nouveau)
- `src/engine/tests.ts`, `src/engine/combat.ts`, `src/engine/magic.ts` (helpers de recompute purs)
- `src/engine/characteristics.ts` ou `conditions.ts` (helper +1 PB À Terre)
- `src/state/store.ts` (5 fixes relance + +1 DR + `spendDetermination` + `battlePickup` + flags
  de consommation par item) + tests store
- `src/ui/RollModal.tsx`, `DefenseModal.tsx`, `CastModal.tsx`, `TestModal.tsx`,
  `DisengageModal.tsx`, `ActionBar.tsx` + CSS éventuel
- `ROADMAP.md` (cocher la dette traitée)
