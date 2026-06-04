# Apparences de créatures par calques + décors d'ambush — design

*Date : 2026-06-04 — branche `feat/wfrp4-rpg-foundation`*

## Contexte et objectif

`public/ambush.html` est une **illustration concept-art animée faite main** (embuscade
en forêt) qui sert de cap visuel. L'éditeur de niveau sait déjà poser la structure de
cette scène (terrains herbe/route iso, décor `arbre` — c'est exactement le même path
SVG, entités ennemies/héros, `charrette`), mais il lui manque deux choses pour viser ce
niveau d'illustration :

1. **Plusieurs apparences par créature.** Aujourd'hui `creatureSprites.json` est un
   `Record<string, string>` : un nom → **un** SVG figé. Deux humains (ou deux mutants)
   posés dans une scène sont visuellement identiques. On veut que **toute créature**
   puisse avoir plusieurs apparences ; dans `ambush` les mutants à eux seuls ont 4 corps
   distincts (hache, homme-chien, lézard arbalétrier, charognard).
2. **Les décors « ADN » d'ambush** absents du catalogue : cadavre, mare de sang, cheval
   mort, épave de carrosse.

But : enrichir les **catalogues data-driven** (pas de scène codée en dur) pour que
l'éditeur puisse reconstituer une scène d'embuscade fidèle, cohérente avec la direction
visuelle « isométrique SVG dessiné main, jamais de carrés ».

## Décisions prises (brainstorming)

- **Portée** : le système d'apparences vaut pour **toutes** les créatures, pas seulement
  les mutants.
- **Choix de l'apparence** : **auto-variée au seed** (déterministe, stable par token) +
  **override éditeur** possible.
- **Composition** : **modèle par calques unifié** — une apparence = liste de calques,
  chaque calque a N variantes tirées au seed. Le « pool discret » est le cas particulier
  à 1 calque ; le monolithique actuel est le cas à 1 calque / 1 variante. Évolutif :
  on enrichit créature par créature.

## Architecture

### Modèle de données (`src/gameIso/appearance.ts`, nouveau)

```ts
interface AppearanceLayer {
  slot: string;        // 'pose' | 'peau' | 'tete' | 'gear' … (chaîne libre)
  variants: string[];  // chaque variant = un fragment SVG en boîte locale 120×150,
                       // pieds en (60,150) — même convention que sprites.ts / token()
}
interface CreatureAppearance {
  id: string;          // clé = nom de créature, ex. 'Mutant'
  layers: AppearanceLayer[];
}

type AppearancePins = Record<string, number>;  // slot → index de variante forcé

function composeAppearance(name: string, seed: number, pins?: AppearancePins): string;
```

Comportement de `composeAppearance` :

1. Cherche la `CreatureAppearance` enregistrée pour `name`.
   - **Absente** → fallback : renvoie `creatureSprites.json[name]` (string monolithique),
     ou `mutantStand()` si le nom est inconnu (comportement actuel de `enemySprite`).
2. Présente → pour chaque calque dans l'ordre : si `pins[slot]` défini, prend
   `variants[pins[slot]]` ; sinon tire `variants[rng() % variants.length]` via un RNG
   seedé dérivé de `seed` + index de calque. Concatène les fragments choisis.

Registre des apparences enrichies : `src/gameIso/creatureAppearances.ts` (objets TS, pas
JSON, car ce sont des fonctions/fragments d'art lisibles et diffables). `creatureSprites.json`
**reste inchangé** comme couche de fallback.

### Seed et override

- **Seed par défaut** = hash entier de l'`id` de l'entité (explore/édition) ou de l'`id`
  du combattant (combat). Stable → une foule paraît variée sans travail manuel.
- **Override** : champ optionnel sur `SceneEntity` :
  ```ts
  appearance?: { seed?: number; pins?: AppearancePins }
  ```
  Optionnel → **aucune migration**, les scènes existantes restent valides.
- Le RNG est `makeRNG` (déjà seedable, utilisé par les tests déterministes).

### Câblage rendu (`src/gameIso/sprites.ts`, `IsoStage.tsx`)

- `enemySprite(name)` délègue à `composeAppearance(name, seed, pins)`. On garde la
  signature historique en wrapper si besoin, ou on met à jour les **2 points d'appel** de
  `IsoStage.tsx` :
  - explore/édition : `enemySprite(ent.ref ?? '')` → seed = hash(`ent.id`), pins =
    `ent.appearance?.pins`.
  - combat : `enemySprite(c.name)` → seed = hash(`c.id`).
- `DEFS` (dans `sprites.ts`) reçoit les gradients manquants utilisés par les fragments
  portés d'ambush : `blood`, `horse`, `coach` (+ tout gradient propre aux poses mutant).

**Limite v1 assumée** : en combat les `pins` ne sont pas propagés depuis l'entité source
via `spawn` → seed seul. La variété fonctionne, mais une pose épinglée dans l'éditeur se
re-tire au lancement du combat. Extension future : porter `appearance` jusqu'au
`Combatant` (via `EncounterDef`/`spawn`) sans polluer le moteur pur (table latérale
`id → pins` côté store/rendu).

### Éditeur (`src/ui/editor/`)

Section « Apparence » dans l'inspecteur d'une entité ennemie :
- pour chaque calque de la `CreatureAppearance` correspondante : un menu
  *« Aléatoire » + une option par variante* (écrit/efface `appearance.pins[slot]`),
- bouton **🎲 Relancer** : incrémente `appearance.seed`.
- Si la créature n'a pas d'apparence enrichie (fallback monolithique), la section ne
  montre rien d'éditable (ou un libellé « apparence unique »).

### Décors (`src/gameIso/catalog/decor.ts`)

Nouveaux `PROPS`, portés d'`ambush.html`, normalisés en boîte 120×150 / pieds (60,150) :
- `cadavre` — corps au sol + crâne (variante neutre générique)
- `mare-sang` — flaque (ellipses gradient `blood`)
- `cheval-mort` — cheval couché (variante morte de l'art ambush)
- `epave-carrosse` — carrosse renversé simplifié dans la boîte

Ils apparaissent **automatiquement** dans la palette décor (catalogue-driven). Les
gradients référencés vont dans `DEFS`. Animations gore optionnelles (`gush`, `fly`) :
keyframes à ajouter à `anim.css` seulement si on veut le sang qui gicle / les mouches ;
sinon décors statiques pour la v1.

### Animations (`src/gameIso/anim.css`)

`anim.css` contient déjà `breathe / warm(flicker) / glow / sway / smoke`. À ajouter pour
les poses mutant animées : `chop`, `howl`, `feed` (et `kick` si cheval mort animé). Pour
les décors gore : `gush`, `fly`. Portage direct des `@keyframes` d'`ambush.html`.

## Contenu de la v1

- **Mutant** : calque `pose` à 4 variantes (hache/`chop`, homme-chien/`howl`,
  lézard-arbalète, charognard/`feed`) + calque `peau` (2-3 teintes).
- **Humain** : 2-3 variantes (tête/vêtement) pour casser l'uniformité.
- Reste du bestiaire : fallback monolithique inchangé.

## Plan de livraison (3 phases indépendantes)

- **Phase A — moteur d'apparence.** `appearance.ts` + `composeAppearance` + seed +
  fallback monolithique + câblage des 2 points d'appel IsoStage + champ schéma optionnel.
  *Résultat visible* : les humains posés en multiple paraissent variés ; rien ne casse.
- **Phase B — enrichissement Mutant/Humain.** `creatureAppearances.ts` + keyframes
  d'`anim.css` + section « Apparence » de l'inspecteur éditeur.
- **Phase C — décors d'ambush.** 4 nouveaux `PROPS` + gradients `DEFS` + keyframes gore.

## Fichiers touchés

| Fichier | Nature | Phase |
|---|---|---|
| `src/gameIso/appearance.ts` | **nouveau** — types + `composeAppearance` | A |
| `src/gameIso/creatureAppearances.ts` | **nouveau** — specs calques enrichis | B |
| `src/gameIso/sprites.ts` | `enemySprite` délègue ; gradients `DEFS` | A/C |
| `src/gameIso/IsoStage.tsx` | seed + pins aux 2 points d'appel | A |
| `src/state/scene.ts` | `SceneEntity.appearance?` (optionnel) | A |
| `src/gameIso/catalog/decor.ts` | 4 nouveaux `PROPS` | C |
| `src/gameIso/anim.css` | keyframes `chop/howl/feed` (+ `gush/fly`) | B/C |
| `src/ui/editor/` (inspecteur) | section « Apparence » | B |
| `src/gameIso/appearance.test.ts` | **nouveau** — tests déterminisme/variété/fallback/pins | A |
| `src/gameIso/catalog/decor.test.ts` | extension — nouveaux props rendent du SVG | C |

## Tests / vérification

- `appearance.test.ts` : même seed → même sortie ; seeds différents → tirages différents
  sur une créature multi-variantes ; nom inconnu/non enrichi → fallback monolithique
  exact ; `pins` force la variante attendue.
- `decor.test.ts` : chaque nouveau `PROP` rend une chaîne SVG non vide bien formée.
- Le moteur `src/engine` **reste pur et non touché**.
- Validation navigateur (Playwright MCP) après Phase B/C : charger une scène d'embuscade,
  vérifier variété visuelle + 0 erreur console + screenshot.

## Hors périmètre (YAGNI)

- Paramétrique complet sur les 57 créatures du bestiaire (seulement Mutant + Humain en v1).
- Propagation des `pins` jusqu'au combat (seed seul en combat pour la v1).
- Système de mutations génératives (choix tête/membre/peau combinatoire avancé).
