# Spec — Rig squelettique SVG & apparence composable, pilotée par l'équipement (sous-projet A)

*Date : 2026-06-04 · Projet : RPG WFRP4 web (`Foundry/Game`) · Branche : `feat/wfrp4-rpg-foundation`*

## 1. Contexte & objectif

L'utilisateur veut un système visuel de personnage riche : sprite distinct par race,
variante mâle/femelle, morphologie paramétrable, têtes multiples, armures multiples,
animations d'action (sort / distance / mêlée / esquive / parade / défense / prise de
coup) et postures d'état (à terre, sonné, etc.). **Le sprite doit refléter l'équipement
réellement porté** (armes, bouclier, armure par emplacement), la carrière fournissant la
tenue par défaut là où aucune armure n'est portée.

L'existant (`src/gameIso/`) est **surtout un proof-of-concept** : on a la licence de
l'améliorer franchement, pas seulement d'empiler par-dessus. `heroSprite` (les 5 fonctions
JS `soldier/slayer/sorcier/halfling/witchHunter`) était un **stopgap « en attendant ce
dev »** → son art est récupéré comme parts puis les fonctions sont **supprimées**.

État réel constaté :

- **Primitive de composition saine mais sous-exploitée.** `appearance.ts`
  (`composeAppearance(name, seed, pins)`) tire 1 variante par calque via RNG seedable et
  concatène des fragments SVG ; slots = chaînes libres ; testé. **Les héros ne l'utilisent
  pas** (`heroSprite` branche sur 5 fonctions monolithiques, `sprites.ts:142-157`).
- **Aucun** champ sexe/genre sur `Combatant`, aucune morphologie paramétrable, aucun slot
  tête/armure, **équipement non reflété visuellement** (`recomputeLoadout` = stats seules :
  `Combatant.weapons` actives + `Combatant.armour` en PA par localisation).
- **Le moteur fournit déjà les signaux logiques** pour la suite : actions mêlée/distance/
  sort/focus, défense parade/esquive (`combat.ts`), conditions `À Terre`/`Sonné`/… 
  (`conditions.ts`), bus `ANIM_ATTACK`/`ANIM_MOVE`/`SCENE_DIRTY` (`bus.ts`).
- **Rendu = injection de string SVG** via `dangerouslySetInnerHTML` par token
  (`IsoStage.tsx:130`), re-stringifiée à chaque rendu → fragile pour animer un os isolé.

La liste de besoins recouvre **3 sous-projets** (l'« équipement visible » est fusionné
dans A car l'apparence EST l'équipement + la carrière) :

- **A — Apparence composable pilotée par équipement + carrière** *(ce spec, fondation)*
- **C — Animations d'action** (couche timeline abonnée au bus) — dépend de A + events moteur
- **D — Postures & états visuels** (condition → pose + FX) — dépend de A

**Objectif de ce spec (A complet) :** runtime de rig squelettique + modèle `Appearance` +
**résolution des parts pilotée par l'équipement porté** (armes/bouclier/armure par
emplacement, défaut carrière) + remplacement intégral du rendu héros pour **toutes les
espèces jouables** en M/F + UI créateur/éditeur.

## 2. Décision de socle

**Rig squelettique SVG, rendu en arbre de composants React** (validé). Un personnage =
arbre d'os nommés ; chaque os porte 1 part SVG (« slot »). Tout reste du SVG dessiné-main
(direction visuelle : isométrique « à la Baldur's Gate », jamais de carrés).

Pourquoi le rig : **toutes** les demandes en découlent d'un seul modèle — anim =
interpolation d'angles d'os ; posture = preset d'angles ; morpho = longueur/épaisseur d'os ;
M/F = jeu de proportions ; **armure/arme = part résolue sur un os** ; facing = miroir.

**Amélioration vs le POC** : rig rendu en **composant React SVG** (`<RigSprite>`), pas en
string injectée. Chaque os = `<g data-bone>` réel, transformable individuellement → C
(anim) et D (postures) propres, sans re-générer de string. Le chemin **créatures**
monolithe reste en `innerHTML` : seam propre, zéro régression bestiaire. Les **héros**
n'ont plus de chemin JS : ils passent toujours par le rig (fallback générique interne).

Alternatives écartées : *calques SVG figés* (morpho/anim trop grossières) ; *sprite sheets
raster* (contre la direction visuelle, tue la morpho paramétrable, pipeline lourd).

## 3. Modèle de données

### 3.1 Os & slots

```
bassin ─ torse ─ cou ─ tete
       ├─ epauleG ─ avantBrasG ─ (mainG | arme)
       ├─ epauleD ─ avantBrasD ─ (mainD | bouclier)
       ├─ cuisseG ─ tibiaG ─ piedG
       └─ cuisseD ─ tibiaD ─ piedD
```

```ts
// src/gameIso/rig/bones.ts — couche de RENDU (n'est jamais importée par src/engine : règle #3 ;
// l'inverse est permis : le rendu lit les TYPES purs de l'engine).
export type BoneId =
  | 'bassin' | 'torse' | 'cou' | 'tete'
  | 'epauleG' | 'avantBrasG' | 'mainG'
  | 'epauleD' | 'avantBrasD' | 'mainD'
  | 'cuisseG' | 'tibiaG' | 'piedG'
  | 'cuisseD' | 'tibiaD' | 'piedD'
  | 'arme' | 'bouclier';

export interface Bone {
  id: BoneId;
  parent: BoneId | null;
  pivot: { x: number; y: number };   // attache dans le repère LOCAL du parent (boîte 120×150)
  length: number; thickness: number;  // géométrie morphologique
  angle: number;                      // angle au repos (deg), surchargé par la Pose
  z: number;                          // tri intra-sprite (avant/arrière)
}

/**
 * Slots = parts visuelles. Trois familles :
 *  - COSMÉTIQUE (toujours, espèce×sexe)      : visage, cheveux
 *  - CORPS (équipement→sinon carrière)        : tete, bras, torse, jambes
 *  - MAIN (équipement)                        : arme, bouclier
 * `tete` = couvre-chef/casque (sinon rien : on voit visage+cheveux).
 */
export type Slot =
  | 'visage' | 'cheveux'
  | 'tete' | 'bras' | 'torse' | 'jambes'
  | 'arme' | 'bouclier';

/** Os porteur(s) de chaque slot (parts symétriques bras/jambes dessinées une fois, mirroir G/D). */
export const SLOT_BONES: Record<Slot, BoneId[]> = {
  visage: ['tete'], cheveux: ['tete'], tete: ['tete'],
  torse: ['torse'],
  bras: ['epauleG', 'epauleD'],
  jambes: ['cuisseG', 'cuisseD'],
  arme: ['arme'], bouclier: ['bouclier'],
};
```

### 3.2 Squelette de base (presets espèce × sexe) + morphologie

```ts
// src/gameIso/rig/skeletons.ts
export type Skeleton = Record<BoneId, Bone>;

/** Presets de proportions par espèce et sexe — COUVRE TOUTES les espèces jouables. */
export function baseSkeleton(species: string, sex: 'M' | 'F'): Skeleton;
//  Toutes les espèces de src/data/species.json (« autant que possible ») :
//    Humain · Halfling (petit, rond) · Nain (trapu, jambes courtes, torse large) ·
//    Gnome (très petit, grande tête) · Ogre (massif, jambes courtes) ·
//    Haut-Elfe (grand, élancé) · Elfe sylvain (élancé, plus léger)
//  Variantes régionales (Reiklander, clans…) → HÉRITENT via baseSpeciesOf(species).
//  F vs M : proportions épaules/hanches — AUCUNE différence de stats (WFRP4).

/** « Humains (Reiklander) », « Nains (Norse) »… → espèce de base normalisée. */
export function baseSpeciesOf(species: string): string;

/** Morphologie continue `build` (0..1 frêle→corpulent) → échelle thickness (+ légèrement
 *  length) ; pur, sans mutation de l'entrée. */
export function applyBuild(sk: Skeleton, build: number): Skeleton;
```

### 3.3 Pose

```ts
// src/gameIso/rig/poses.ts
export type Pose = Partial<Record<BoneId, number>>;  // override d'angles → cible anim (C) / posture (D)
export const POSE_REPOS: Pose;                        // pose neutre rendue par A
// (poses d'action/état ajoutées par C/D — A ne livre que le repos + le type)
```

### 3.4 Résolution des parts — **pilotée par l'équipement** (cœur de A)

C'est la pièce maîtresse demandée. Une part par slot est choisie par **priorité
décroissante** :

1. **Override éditeur** : `appearance.parts[slot]` si défini (pin manuel — prime sur tout).
2. **Équipement porté** (lu sur le `Combatant`) :
   - `arme` ← arme active équipée (famille inférée du nom/qualités) ;
   - `bouclier` ← bouclier équipé (qualité « Bouclier »/nom) — sinon vide ;
   - `tete`/`bras`/`torse`/`jambes` ← **pièce d'armure équipée couvrant cet emplacement**
     (`item.kind==='armor' && item.equipped && item.locs ⊇ loc`), variante par matériau/type
     (cuir / maille / plaque / rembourré, inféré du nom ou du palier `pa`).
3. **Carrière** : si **aucune armure** sur cet emplacement → la pièce de **tenue par défaut
   de la classe de carrière** (`torse`/`jambes`/`bras`) ; `tete` non couverte → rien
   (on voit `visage`+`cheveux`), sauf couvre-chef de classe (ex. chapeau de Sorcier).
4. **Générique** : fallback rig si rien d'autre (le rig rend TOUJOURS quelque chose).

`visage` et `cheveux` sont **toujours** résolus (espèce×sexe, variante via `parts`/seed) ;
`cheveux` est masqué si le couvre-chef `tete` ferme la tête (heaume).

Mapping emplacement WFRP4 → slot de corps :
`tete→tete` · `brasG`/`brasD`→`bras` · `corps→torse` · `jambeG`/`jambeD`→`jambes`.

```ts
// src/gameIso/rig/parts/  — bibliothèques + résolveur
export interface Part { svg: string; }            // dessiné dans le repère LOCAL de son os

// Bibliothèques de variantes (data-driven) :
export function armourPart(item: ItemInstance, slot: Slot): Part | null; // par matériau/type
export function weaponPart(w: Weapon): Part;                              // famille d'arme
export function shieldPart(item: ItemInstance | Weapon): Part;
export function careerTenue(careerClass: string): Partial<Record<'torse'|'jambes'|'bras'|'tete', Part>>;
export function cosmeticPart(slot: 'visage'|'cheveux', species: string, sex: 'M'|'F', idx: number): Part;

/** Contexte d'équipement extrait d'un Combatant (rendu lit l'engine — direction permise). */
export interface EquipCtx {
  weapons: Weapon[];                 // armes actives
  armour: ItemInstance[];            // pièces d'armure équipées (locs renseignés)
  shield?: ItemInstance | Weapon;
}
export function equipFromCombatant(c: Combatant): EquipCtx;

/** Applique la priorité override→équipement→carrière→générique. PUR. */
export function resolveParts(
  species: string, sex: 'M'|'F', career: string | undefined,
  equip: EquipCtx, overrides: Partial<Record<Slot, number>>, seed: number,
): Record<Slot, Part | null>;

/** Classe d'une carrière (careers.json, champ `class`) → pilote la tenue. 8 classes :
 *  Citadins, Courtisans, Guerriers, Itinérants, Lettrés, Riverains, Roublards, Ruraux. */
export function careerClass(career: string): string;
```

### 3.5 Descripteur d'apparence (cosmétique, découplé du moteur)

```ts
// src/gameIso/rig/appearance.ts  (type PUR)
export interface Appearance {
  species: string;   // pour les héros, reflète Combatant.species (fixé à la création)
  sex: 'M' | 'F';
  build: number;     // 0..1 morpho continue
  /** Overrides éditeur par slot (priment) ; absents → équipement→carrière→seed. */
  parts?: Partial<Record<Slot, number>>;
  seed?: number;     // auto-variété cosmétique (visage/cheveux) si non épinglé
}
```

`appearance?: Appearance` est ajouté sur `Combatant` **comme champ de données pur**
(`src/engine/types.ts`) — l'engine ne le lit jamais. L'**équipement** (lui aussi sur le
`Combatant` : `weapons`/`items`/`armour`) est lu par le rendu via `equipFromCombatant`.

## 4. Composition & rendu

```ts
// src/gameIso/rig/composeRig.tsx
export function resolveRig(
  appearance: Appearance, equip: EquipCtx, pose: Pose,
): ResolvedBone[];
//  1. sk = applyBuild(baseSkeleton(species, sex), build)
//  2. FK : transform monde de chaque os (pivot + angle de pose, composé parent→enfant)
//  3. parts = resolveParts(species, sex, career, equip, overrides, seed)  ← pilotage équipement
//  4. attache chaque part à son/ses os (SLOT_BONES, miroir G/D), tri par bone.z

export function RigSprite(props: {
  appearance: Appearance; equip: EquipCtx; pose?: Pose;
}): JSX.Element;
//  émet un <g data-bone="…" transform="translate(x,y) rotate(deg)"> …part SVG… </g> par os
```

`resolveRig`/`resolveParts` **purs et déterministes** (mêmes entrées → même sortie) →
testables sans DOM.

## 5. Intégration rendu

- **Héros = toujours rig.** À la frontière de rendu, on construit
  `appearance = c.appearance ?? defaultAppearance(c)` (dérivé de `species`+`sex`+`hashSeed`)
  et `equip = equipFromCombatant(c)`, puis on rend `<RigSprite appearance equip />`. Les 5
  fonctions JS de `heroSprite` sont **supprimées** (leur art migré en parts).
- `IsoStage.tsx` : le token héros (`:141`, `:152`) rend `<RigSprite>`. On ajoute une
  **variante de `token()` acceptant des enfants React** (même ombre, anneau, `translate/
  scale`) à côté du chemin `innerHTML`.
- **Créatures** (`enemySprite`/monolithe) et **props** : inchangées (`innerHTML`).
- `<defs>` (DEFS) reste injecté une fois au stage (`IsoStage.tsx:230`) ; les parts
  réutilisent les gradients partagés (`g_steel`, `g_flesh`, `g_cloak`…) + nouveaux gradients
  matériaux (cuir, maille, plaque).

## 6. Contenu à produire (data-driven, tractable)

- **Squelettes** : 7 espèces × 2 sexes = 14 presets de proportions (`baseSkeleton`).
- **Cosmétique** : `visage` + `cheveux/barbe`, plusieurs variantes par espèce×sexe.
- **Armure par emplacement × matériau** : `tete/bras/torse/jambes` × {rembourré, cuir,
  maille, plaque} ≈ 16 parts (+ casques/heaumes). Mappées depuis `item.locs`+nom/`pa`.
- **Armes** : par famille (épée, hache, masse/marteau, dague, lance/hallebarde, fléau, arc,
  arbalète, bâton…) ≈ 10-12 parts. **Boucliers** : 1-3.
- **Tenues de carrière** : 8 classes (`careers.json`) → look `torse/jambes/bras` par défaut ;
  surcharge pour carrières visuellement distinctives (Répurgateur, Tueur, Sorcier).

**De-risk authoring :** on **découpe les 5 SVG héros existants** (`sprites.ts:51-114`) comme
bibliothèque de départ (soldat→tenue Guerriers + épée + casque ; sorcier→tenue Lettrés +
bâton + chapeau ; tueur→torse nu + haches ; etc.). Enrichissement par **lots best-of-2 par
planches** (barre qualité bestiaire), réfs `art-ref/ldb/mapping.json`. **Poste d'effort
principal et risque n°1.** Tout slot non encore dessiné → part générique (le rig rend
toujours).

## 7. UI (créateur + éditeur)

- **Panneau d'apparence héros** réutilisable (créateur + éditeur) : sexe (M/F), slider
  morphologie (`build`), aperçu live `<RigSprite>`, bouton 🎲 (reroll seed cosmétique).
- **Cosmétique éditable** : variantes `visage`/`cheveux`.
- **Corps/arme/bouclier = reflet de l'équipement** (lecture seule par défaut, l'apparence
  suit l'inventaire) avec **override manuel optionnel** par slot (pin éditeur, comme
  `Editor.tsx:588-617` pour les entités de scène).
- Onglets si le panneau dépasse ~2 sections (règle UI #4).

## 8. Périmètre — ce que A fait / ne fait PAS

**Dans A** : rig + morpho + M/F + toutes espèces + têtes/cheveux + **équipement visible
(armes/bouclier/armure par emplacement) + tenue de carrière** + UI. Pose de **repos** rendue.

**Hors A** :
- **Animations d'action = C** (A ne livre que le type `Pose` + `POSE_REPOS` ; le `.bob`
  respirant CSS reste).
- **Postures d'état = D** (condition → pose).
- **Facing combat** (orientation → C ; rig structuré pour le miroir G/D).
- **Migration des créatures vers le rig** (restent monolithiques).
- **Modification du moteur de combat** (les manques relevés — advantage non consommé,
  `À Terre` non retiré, qualités d'arme — hors sujet).

## 9. Tests & recette

- `src/gameIso/rig/rig.test.ts` (Vitest) :
  - `resolveRig`/`resolveParts` **déterministes**.
  - **Priorité de résolution** : armure équipée sur un emplacement prime sur la carrière ;
    sans armure → part de carrière ; override `parts[slot]` prime sur les deux ; arme/
    bouclier suivent l'équipement.
  - proportions distinctes par espèce et par sexe ; `build` monotone sur thickness/length.
  - FK : transform monde d'un os enfant = composition du parent ; miroir G/D des parts
    symétriques.
- `npm run typecheck` + `npm test` verts.
- Recette navigateur (Playwright MCP) : créateur → régler sexe/morpho/cheveux ; **équiper
  une arme puis une pièce d'armure et vérifier que le sprite change** in-game (bouton
  « 🧪 Test rapide ») → screenshot, **0 erreur console**. (Piège : séparer le clic qui
  change l'état et l'action en deux `evaluate`.)

## 10. Fichiers ajoutés / modifiés

**Ajoutés** (`src/gameIso/rig/`) :
- `bones.ts` — `BoneId`, `Bone`, `Slot`, `SLOT_BONES`.
- `skeletons.ts` — `baseSkeleton`, `baseSpeciesOf`, `applyBuild`.
- `poses.ts` — `Pose`, `POSE_REPOS`.
- `appearance.ts` — type `Appearance` (pur), `defaultAppearance(c)`.
- `parts/` — `armourPart`, `weaponPart`, `shieldPart`, `careerTenue`, `cosmeticPart`,
  `careerClass`, `equipFromCombatant`, `resolveParts` + les bibliothèques SVG.
- `composeRig.tsx` — `resolveRig` (pur) + `RigSprite` (React).
- `rig.test.ts`.

**Modifiés :**
- `src/engine/types.ts` — `Combatant.appearance?: Appearance` (donnée pure).
- `src/gameIso/sprites.ts` — **suppression** des 5 fonctions JS héros + `HERO_BY_CAREER` ;
  `heroSprite` retiré au profit du rendu rig (l'art migre dans `rig/parts/`).
- `src/gameIso/IsoStage.tsx` — token héros via `<RigSprite>` + variante `token()` à enfants
  React.
- UI créateur + `src/ui/editor/Editor.tsx` — panneau d'apparence héros partagé.
- `src/data/pregens.ts` — `appearance` par défaut sur les pré-tirés (démo M/F + équipement).

## 11. Risques & mitigations

| Risque | Mitigation |
|---|---|
| **Authoring SVG = gros volume** (espèces×sexe + armures×matériau + armes + tenues) | Démarrer en découpant les 5 SVG héros ; lots best-of-2 ; part générique par slot tant que non dessiné ; `log`/noter les stubs restants |
| Mapping item→part imprécis (pas de champ « famille d'arme » / « matériau ») | Inférence nom + `qualities` + palier `pa` ; table explicite extensible ; défaut générique sûr |
| Suppression de `heroSprite` casse un appelant | Recenser les appelants avant suppression ; le rig couvre tous les cas via fallback générique ; typecheck |
| Hit-locations L/R (brasG/D, jambeG/D) → slot unique `bras`/`jambes` | Part dessinée une fois, miroir G/D ; si armure couvre un seul bras, on couvre les deux visuellement (cosmétique, pas gameplay) |
| Morpho visuelle ≠ hitbox (1 case) | `build` borné ; cosmétique pur, aucun impact gameplay |
| FK SVG (transforms imbriqués) bugs visuels | Pose de repos d'abord ; test FK + miroir ; recette navigateur avant C |

## 12. Ce que A débloque pour la suite

- **C** : os nommés (`<g data-bone>`) + type `Pose` → cibles d'animation prêtes (tween
  d'angles) ; nécessitera 1-2 enrichissements d'events moteur (ex. `defenseMode` dans
  `ANIM_ATTACK`, un `CONDITION_CHANGED`) — spécifiés dans le spec C.
- **D** : `POSE_*` presets (à terre, sonné…) consommés depuis `Combatant.conditions`.
- *(L'« équipement visible », initialement prévu en sous-projet B, est livré dans A.)*
