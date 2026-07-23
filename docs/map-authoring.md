# Authoring d'une map : le format `MapSpec`

> **Pour l'IA (et l'humain) : c'est LE seul chemin pour construire une carte.**
> Tu décris une map en objet déclaratif `MapSpec` ; `buildScene(spec)` la compile en `Scene`.

- Type + compilateur : [`src/state/mapSpec.ts`](../src/state/mapSpec.ts)
- **Spec exécutable (exemples courts, à jour)** : [`src/state/mapSpec.test.ts`](../src/state/mapSpec.test.ts) — chaque `describe` verrouille une section.
- **Exemples VIVANTS** (scénarios réels) : voir le tableau « Où voir quoi » en bas.

`buildScene` est **PUR** et **Node-safe** (zéro import `ui/`/`gameIso/`) : le générateur d'arène l'exécute via `tsx`.
Il ne fait que **rejouer les primitives pures de l'éditeur** (`src/state/sceneEdit.ts`) dans un **ordre figé** — donc
tout ce que le format exprime est, par construction, reproductible à la main dans l'éditeur (règle #2). Si un besoin
ne s'exprime pas proprement, on **étend une primitive** (avec un golden), on ne bricole jamais le scénario.

## Démarrage — le cas trivial est une ligne

```ts
import { buildScene } from '../../state/mapSpec';
const scene = buildScene({ id: 'test-x', nom: 'Bac à sable', size: [16, 10], heroStart: [2, 5] });
// → plateau plat 16×10 d'herbe + 1 départ héros. `arena(...)` est un preset de ceci.
```

## Champs (référence compacte)

| Champ | Rôle |
|---|---|
| `size: [w,h]`, `id`, `nom`, `description?` | identité + dimensions |
| `ambiance?` `weather?` `ambientLight?` `metresPerTile?` `music?` `startMessage?` `rest?` `flags?` | scalaires de scène (`metresPerTile≥4` = échelle MER) |
| `terrain?` | remplissage plat (z0), défaut `'herbe'` |
| `legend?: {char→Terrain}` | légende ASCII (`.`/espace = base ; base z0 = `terrain`, z>0 = `'vide'`) |
| `levels?: {z0, z1, …}` | UNE grille ASCII par étage (terrain **+ marqueurs** de `bind`) |
| `walled?: {z0, z1, …}` | UNE grille **box-drawing** par étage (arêtes DANS l'ASCII, `parseWalledAscii` (2W+1)×(2H+1)) → tuiles **+ murs d'arête/portes**. Vocabulaire d'arête : `\|`/`-` mur, `:` porte, `o` **fenêtre** (mur plein serti d'une vitre, décoratif — ne change pas le combat ; remplace le recours à `walls:[{window:true}]` en coordonnées), `+` jonction, ` ` ouvert. Coexiste avec `levels` (étages ≠) ; `wallStructures?: {char→id}` pose une structure brèchable sur une arête |
| `markerFill?: {char→char}` | char de LÉGENDE laissé SOUS un marqueur nettoyé (ex. `{B:'W'}` : poser une pièce SUR le chemin de ronde sans y percer un trou) |
| `relief?` | hauteurs **métriques** : `{rect:[x0,y0,x1,y1],height,z?}` / `{cell:[x,y],height,z?}` / `{ramp:[x0,y0,x1,y1],from,to,z?}` |
| `walls?: WallSpec[]` | murs d'**arête** : `{x,y,side:'N'|'E'|'S'|'O'|'\\'|'/', z?, door?, structure?, window?, climb?}` (`climb` = arête escaladable, LDB 15 l.52-57). Diagonale (`side:'\\'/'/'`) = arête PUREMENT VISUELLE (mouvement/vision/grimpe restent orthogonaux) : `window` (décoratif) s'y propage, `climb`/`structure`/`door` y font échouer `buildScene` (#554). Le pan diagonal biseaute deux coins opposés (`\`→NO/SE, `/`→NE/SO) et n'est légal que s'il adosse au moins un de ces deux coins ORTHOGONALEMENT MURÉ (ses deux arêtes cardinales en état `'wall'`) — sinon `buildScene` échoue : un pan flottant, sans mur qu'il adoucit, ferait croire à une séparation qui n'existe pas (#781) |
| `rooms?: RoomSpec[]` | bâtiment composé : `{foot:[x,y,w,h], style, door?:{x,y,side}, floor?, wallStructure?, z?}` → toit + périmètre de murs + porte + sol |
| `cells?: {char→CellRecipe}` | recette par LETTRE de CASE COMPLÈTE : `wall` (enceinte pleine), `gate` (tunnel brèchable), `hero` (départ), `stair` (volée d'escalier, #780 — voir ci-dessous) |
| `bind?: {char→BindSpec}` | ce que devient chaque marqueur ASCII (voir ci-dessous) |
| `entities?: SceneEntity[]` | entités BRUTES (ids **conservés** — utile quand un `member`/`crew` réfère un id fixe) |
| `heroStart?` | `[x,y]` ou `{x,y,z}` |
| `entryPoints?: {name:[x,y]}` `restZones?` `effectZones?` `triggers?` `dialogues?` | zones & logique |
| `encounters?: EncounterSpec[]` | `{id, enemies?, members?, surprise?, onVictory?}` |

### `bind` — un marqueur ASCII → une pose
- `'heroStart'` — départ du groupe.
- `{ entry: 'nom' }` — point d'entrée nommé.
- `{ emplacement: 'canon-petit', crew?: 'id', side?: FireArc, facing?: Dir8, member?: {enc,side?,ai?} }` — affût de siège (hérite du `z` de l'étage du marqueur).
- `{ entity: {…Partial<SceneEntity>…}, member?: {enc,side?,ai?} }` — pose une entité-modèle À CHAQUE marqueur, et l'enrôle éventuellement dans une rencontre.
- `{ …Partial<SceneEntity>… }` — idem sans enrôlement (forme courte).

### `encounters` — deux façons, fusionnées
- `enemies: AuthoredEnemy[]` — forme **terse** (`{ref|statblock, pos, side?, ai?, skills?, postes?, crewIds?, upgrades?, hidden?, …}`) → entités FRAÎCHES + members. Ids déterministes `enemy-<id>-<i>`.
- `members: EncounterMember[]` — enrôle des entités **déjà posées** (`entities`/`bind`) par leur id (PNJ visibles, alliés-IA, affûts inertes).
- `bind … member` — enrôle une entité posée à un marqueur (son id est GÉNÉRÉ → seul moyen de l'ajouter au roster).

## Ordre de compilation (figé — cf. header de `mapSpec.ts`)
`base+scalaires → terrain/scan-marqueurs → relief → murs → rooms → entités+heroStart+bind → zones → encounters`.

## Pièges
- **Deux modèles de mur** : une tuile `'mur'` (terrain, via `legend`) = bloc PLEIN opaque ; un `WallSeg` d'**arête** (`walls`/`rooms`) = cloison fine qui peut porter `door`/`structure` (brèchable). Choisis exprès. Portes & structures ⇒ arêtes.
- **Marqueurs** : les chars de `bind` sont scannés PUIS nettoyés avant le parse terrain. Sur un terrain non-base (chemin de ronde), utilise `markerFill` pour ne pas laisser un trou `'vide'`.
- **Verticalité** = `relief` (mètres). La connexité verticale reste TOUJOURS DÉRIVÉE des hauteurs par `surfaceLink` (rampe `Δ≤1 m` / falaise) — aucun escalier au pathfinding. Un rempart = une couche `z1` à 4 m. Un ESCALIER se déclare via `cells.stair: {to, style?}` (#780) : la volée est la FILE de cases `stair` peinte dans la grille de l'étage BAS, `to` nomme l'étage cible (`'z1'`, …) ; `buildScene` compile la file en rampe interpolée (contremarches ≤1 m) entre le sol du run et le plancher de `to`, valide que la case de `to` juste au-dessus de chaque marche reste vide (trémie non bouchée) et pose l'habillage `style` (id de prop) case par case. Une volée doit être une file LINÉAIRE (jamais ramifiée/cyclique) et ses cages d'escalier servent d'ANCRES de recalage inter-étages : `buildScene` échoue si les grilles `z0`/`to` sont décalées (aucune extrémité — ou les deux — n'atteint le plancher de `to`).
- **Logique** (`triggers`/`dialogues` `flow`, `encounters.onVictory`) : recopie les `Flow`/`Condition` TELS QUELS, ne les réécris pas.

## Où voir quoi (exemples vivants)

| Pour… | Regarde |
|---|---|
| Cas trivial + encounters | `src/scenes/test-scenarios/bestiaire.ts`, `magie.ts` |
| Relief pur (2 couches, rampes, falaise) | `src/scenes/test-scenarios/pont-vitrine.ts` |
| Multi-niveaux + logique (triggers/delayedEffect/dialogues gatés) | `src/scenes/test-scenarios/opera.ts` |
| Box-drawing multi-étages (`walled`) + relief (grande carte détaillée) | `src/scenes/opera/floorplan.ts` |
| Siège complet : relief + enceinte/porte brèchable + parapet + bind emplacement/équipage/membre | `src/scenes/test-scenarios/siege-enceinte.ts` |
| Naval (coque/postes/équipage via `AuthoredEnemy`) | `src/scenes/test-scenarios/combat-naval.ts` |
| Murs-en-tuiles + Condition (herse) | `src/scenes/test-scenarios/piege-caveau.ts` |
| Multi-scènes + worldMap | `src/scenes/test-scenarios/voyage.ts` |
