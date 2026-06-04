# Spec — Rig squelettique SVG & apparence composable (sous-projet A)

*Date : 2026-06-04 · Projet : RPG WFRP4 web (`Foundry/Game`) · Branche : `feat/wfrp4-rpg-foundation`*

## 1. Contexte & objectif

L'utilisateur veut un système visuel de personnage riche : sprite distinct par race,
variante mâle/femelle, morphologie paramétrable, têtes multiples, armures multiples,
animations d'action (sort / distance / mêlée / esquive / parade / défense / prise de
coup) et postures d'état (à terre, sonné, etc.).

L'existant (`src/gameIso/`) est **surtout un proof-of-concept** : on a la licence de
l'améliorer franchement, pas seulement d'empiler par-dessus. État réel constaté :

- **Primitive de composition saine mais sous-exploitée.** `appearance.ts`
  (`composeAppearance(name, seed, pins)`) tire 1 variante par calque via RNG seedable
  et concatène des fragments SVG. Slots = chaînes libres. Testé.
- **Les héros n'utilisent PAS cette primitive.** `heroSprite(c)` (`sprites.ts:142-157`)
  branche sur 5 fonctions JS monolithiques (`soldier/slayer/sorcier/halfling/witchHunter`),
  switch sur carrière puis espèce.
- **Aucun** champ sexe/genre sur `Combatant`, aucune morphologie paramétrable, aucun slot
  tête/armure, aucune animation d'action (seules keyframes d'ambiance dans `anim.css`),
  aucune pose d'état (juste `opacity 0.4` si hors-combat).
- **Le moteur fournit déjà les signaux logiques** : actions mêlée/distance/sort/focus,
  modes de défense parade/esquive (`combat.ts`), conditions `À Terre`/`Sonné`/`Assourdi`/
  `Étourdi`/`Hémorragique`/`Inconscient` (`conditions.ts`), bus `ANIM_ATTACK`/`ANIM_MOVE`/
  `SCENE_DIRTY` (`bus.ts`).
- **Rendu = injection de string SVG** via `dangerouslySetInnerHTML` dans un `<g>` par token
  (`IsoStage.tsx:130`), re-stringifiée à chaque rendu. Fragile pour animer un os isolé.

La liste de besoins recouvre 4 sous-projets indépendants :

- **A — Apparence composable généralisée** *(ce spec, fondation)*
- **B — Équipement visible** (`ItemInstance` → calques) — dépend de A
- **C — Animations d'action** (couche timeline abonnée au bus) — dépend de A + events moteur
- **D — Postures & états visuels** (condition → pose + FX) — dépend de A

**Objectif de ce spec (A complet) :** runtime de rig squelettique + modèle `Appearance` +
remplacement des 5 sprites héros joués en M/F + UI créateur/éditeur pour régler l'apparence.

## 2. Décision de socle

**Rig squelettique SVG, rendu en arbre de composants React** (décision validée avec
l'utilisateur). Un personnage = arbre d'os nommés ; chaque os porte 1 part SVG (« slot »).
Tout reste du SVG dessiné-main (conforme à la direction visuelle : isométrique « à la
Baldur's Gate », jamais de carrés).

Pourquoi le rig : **toutes** les demandes en découlent d'un seul modèle —
anim = interpolation d'angles d'os ; posture = preset d'angles ; morpho = longueur/
épaisseur d'os ; M/F = jeu de proportions ; armure = part remplacée sur un os ;
facing = miroir + sous-poses.

**Amélioration de socle vs le POC** : on rend le rig en **composant React SVG**
(`<RigSprite>`), pas en string injectée. Chaque os devient un `<g>` réel, nommé et
transformable individuellement — ce qui rend l'animation (C) et les postures (D)
propres et bon marché, sans re-générer de string. Le chemin créatures monolithe reste
en `innerHTML` : **seam propre, zéro régression bestiaire**.

Alternatives écartées : *calques SVG figés* (morpho/anim trop grossières) ;
*sprite sheets raster* (contre la direction visuelle, tue la morpho paramétrable,
pipeline d'assets lourd).

## 3. Modèle de données

### 3.1 Os & registre de slots (enum typé)

Fini les chaînes libres : un enum `BoneId` sert à la fois d'identité d'os et de registre
de slots (supprime la dette « typos de slot »). Rig pragmatique ~14 os :

```
bassin ─ torse ─ cou ─ tete
       ├─ epauleG ─ avantBrasG ─ (mainG | arme)
       ├─ epauleD ─ avantBrasD ─ (mainD | bouclier)
       ├─ cuisseG ─ tibiaG ─ piedG
       └─ cuisseD ─ tibiaD ─ piedD
```

```ts
// src/gameIso/rig/bones.ts — couche de RENDU (jamais importée par src/engine : règle #3)
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
  /** point d'attache dans le repère LOCAL du parent (boîte 120×150). */
  pivot: { x: number; y: number };
  /** géométrie morphologique. */
  length: number;
  thickness: number;
  /** angle au repos (degrés) ; surchargé par la Pose. */
  angle: number;
  /** ordre de tri intra-sprite (bras avant vs arrière, arme devant/derrière). */
  z: number;
}

/**
 * Slot = part visuelle interchangeable. PAS 1:1 avec les os : un slot s'attache à
 * un (ou des) os via SLOT_BONE. Ex. `cheveux`/`casque` → os `tete` ; `torse`+`jambes`
 * (regroupés sous le label « Tenue » en UI) → os `torse`/`cuisseG`/`cuisseD`.
 */
export type Slot =
  | 'tete' | 'cheveux' | 'casque'
  | 'torse' | 'jambes'
  | 'arme' | 'bouclier';

/** Os porteur de chaque slot (pour le placement FK des parts). */
export const SLOT_BONE: Record<Slot, BoneId> = {
  tete: 'tete', cheveux: 'tete', casque: 'tete',
  torse: 'torse', jambes: 'bassin',
  arme: 'arme', bouclier: 'bouclier',
};
```

### 3.2 Squelette de base (presets espèce × sexe) + morphologie

```ts
// src/gameIso/rig/skeletons.ts
export type Skeleton = Record<BoneId, Bone>;

/** Presets de proportions par espèce jouable et sexe. */
export function baseSkeleton(species: string, sex: 'M' | 'F'): Skeleton;
//  Humain  : référence
//  Nain    : trapu, jambes courtes, torse large
//  Halfling: petit, rond
//  Elfe    : élancé, membres longs
//  F vs M  : épaules plus étroites, proportions ajustées (pas de différence de stats — WFRP4)

/** Applique la morphologie continue `build` (0..1 frêle→corpulent) au squelette. */
export function applyBuild(sk: Skeleton, build: number): Skeleton;
//  échelle thickness (et légèrement length) ; pur, sans mutation de l'entrée.
```

### 3.3 Pose

```ts
// src/gameIso/rig/poses.ts
/** Override d'angles d'os → cible d'animation (C) et de posture (D). */
export type Pose = Partial<Record<BoneId, number>>;
export const POSE_REPOS: Pose;   // pose neutre rendue par A
// (les poses d'action/état seront ajoutées par C/D — A ne livre que le repos + le type)
```

### 3.4 Bibliothèque de parts

```ts
// src/gameIso/rig/parts/index.ts
/** Une part = fragment SVG dessiné dans le repère LOCAL de son os (pivot à l'origine). */
export interface Part { svg: string; }
/** Variantes par slot, indexées (parts[slot] = index). */
export type PartLibrary = Record<Slot, Part[]>;
export function partsFor(species: string, sex: 'M' | 'F', career?: string): PartLibrary;
//  fournit les variantes disponibles + le set par défaut (carrière → tenue/arme).
```

### 3.5 Descripteur d'apparence (découplé du moteur)

L'apparence est **cosmétique** → type de données pur, l'engine l'ignore et ne l'importe
pas (dépendance à sens unique préservée, règle #3).

```ts
// src/gameIso/rig/appearance.ts  (type pur ; ré-exporté pour usage UI/scene)
export interface Appearance {
  species: string;              // déjà présent sur Combatant (pilote les proportions de base)
  sex: 'M' | 'F';
  build: number;                // 0..1 morpho continue
  parts: Partial<Record<Slot, number>>;  // index de variante par slot ; absent → tiré au seed
  seed?: number;                // auto-variété (réutilise hashSeed) si parts absent
}
```

Attache : on ajoute `appearance?: Appearance` sur `Combatant` **comme champ de données
pur** (`src/engine/types.ts`) — l'engine ne le lit jamais, seul le rendu l'utilise.
Les `SceneEntity` conservent `EntityAppearance {seed, pins}` ; la migration des entités
de scène vers le rig est hors périmètre A.

## 4. Composition & rendu

```ts
// src/gameIso/rig/composeRig.tsx
/** Pur : (apparence, pose) → squelette résolu + parts choisies, prêt à rendre. */
export function resolveRig(appearance: Appearance, pose: Pose): ResolvedBone[];
//  1. sk = applyBuild(baseSkeleton(species, sex), build)
//  2. FK : transform monde de chaque os (pivot + angle de pose, composé parent→enfant)
//  3. part de chaque slot = parts[slot] ?? tirage(seed)
//  4. tri par bone.z

/** Composant React : émet un <g data-bone> par os, transformable individuellement. */
export function RigSprite(props: { appearance: Appearance; pose?: Pose }): JSX.Element;
//  <g data-bone="avantBrasD" transform="translate(x,y) rotate(deg)"> …part SVG… </g>
```

`resolveRig` est **pur et déterministe** (même `(appearance, pose)` → même sortie) →
testable sans DOM.

## 5. Intégration rendu

- `heroSprite` devient un aiguillage : si `c.appearance` présent → on rend `<RigSprite>` ;
  sinon → fallback vers les 5 fonctions JS monolithiques actuelles (conservées).
  *Conséquence :* `heroSprite` ne renvoie plus seulement une string. On introduit un
  `heroSpriteNode(c): ReactNode` pour le chemin riggé ; l'ancien `heroSprite(c): string`
  reste pour le fallback. (Détail d'API à finaliser au plan — l'important est le seam.)
- `IsoStage.tsx` : le token héros (`:141`, `:152`) rend `<RigSprite>` quand l'apparence
  existe. On ajoute une **variante de `token()` acceptant des enfants React** (même
  ellipse d'ombre, anneau de sélection, `translate/scale`) en plus du chemin `innerHTML`.
- Les créatures (`enemySprite` / monolithe) et les props **restent en `innerHTML`** :
  aucune modification, aucune régression.
- `<defs>` (DEFS) reste injecté une seule fois au niveau du stage (`IsoStage.tsx:230`) —
  les parts du rig réutilisent les gradients partagés (`g_steel`, `g_flesh`, `g_cloak`…).

## 6. Contenu à produire (matrice pilotée par données)

- **Espèces jouables riggées** : Humain, Nain, Halfling, Elfe (sylvain). Chacune = un
  preset de proportions dans `baseSkeleton`.
- **Sexe** : M/F par espèce (proportions + parts par défaut).
- **Carrières** (sets de parts par défaut : tenue + arme) : Soldat, Tueur, Sorcier,
  Voleur, Répurgateur.
- **Parts interchangeables** (slots) : `tete`, `cheveux`, `casque`, `torse`, `jambes`,
  `arme`, `bouclier` (cf. `SLOT_BONE`). En UI, `torse`+`jambes` sont groupés sous le
  label « Tenue ».

**De-risk authoring :** on **découpe les 5 SVG héros existants** (`soldier/slayer/sorcier/
halfling/witchHunter` dans `sprites.ts:51-114`) en parts d'os comme bibliothèque de départ —
l'art validé existe déjà. L'enrichissement (têtes/tenues/armures supplémentaires) suit la
**méthode best-of-2 par planches** (barre qualité bestiaire), réfs dans
`art-ref/ldb/mapping.json`. C'est le poste d'effort principal et le risque n°1 de A.

## 7. UI (créateur + éditeur)

- L'éditeur a déjà un bloc « Variante d'apparence » (pins par slot + 🎲 reroll seed,
  `Editor.tsx:588-617`) pour les entités de scène. On crée un **panneau d'apparence héros**
  réutilisable (composant partagé) avec : sélecteur **sexe** (M/F), slider **morphologie**
  (`build` 0..1), sélecteurs de **parts** (tête / cheveux / tenue / casque / arme /
  bouclier), aperçu live `<RigSprite>`, bouton 🎲.
- Réutilisé dans le **créateur de personnage** (au moment du choix espèce/carrière).
- Onglet si le panneau dépasse ~2 sections (règle UI #4).

## 8. Périmètre — ce que A NE fait PAS

- A rend la **pose de repos** uniquement (le `.bob` respirant CSS reste). Les
  **animations d'action = C** ; A ne livre que le type `Pose` + `POSE_REPOS`.
- **Postures d'état = D** (condition → pose). A ne mappe pas les conditions.
- **Équipement visible piloté par l'inventaire = B**. A expose le slot `tenue`/`arme`/
  `casque` mais ne les dérive pas encore de `Combatant.items`.
- **Facing combat = hors A** (orientation → C). Le rig est structuré pour le miroir G/D.
- **Migration des créatures vers le rig = hors A** (elles restent monolithiques).
- **Pas de modification du moteur de combat** (les bugs/manques relevés — advantage non
  consommé, `À Terre` non retiré, qualités d'arme — sont hors sujet de A).

## 9. Tests & recette

- `src/gameIso/rig/rig.test.ts` (Vitest) :
  - `resolveRig` **déterministe** : même `(appearance, pose)` → même sortie.
  - proportions distinctes par espèce et par sexe (asserts sur longueurs/épaisseurs d'os).
  - `parts` override le tirage au seed ; index hors-bornes ignoré proprement.
  - `build` modifie `thickness`/`length` de façon monotone.
  - FK : transform monde d'un os enfant = composition du parent (cas simple vérifiable).
- `npm run typecheck` + `npm test` verts.
- Recette navigateur (Playwright MCP) : créateur → régler sexe / morpho / tête / armure →
  vérifier le rendu live in-game (bouton « 🧪 Test rapide ») → screenshot, **0 erreur
  console**. (Piège connu : séparer clic-qui-change-l'état et action en deux `evaluate`.)

## 10. Fichiers ajoutés / modifiés

**Ajoutés** (`src/gameIso/rig/`) :
- `bones.ts` — `BoneId`, `Bone`, `Slot`.
- `skeletons.ts` — `baseSkeleton(species, sex)`, `applyBuild`.
- `poses.ts` — `Pose`, `POSE_REPOS`.
- `parts/` — bibliothèque SVG par slot (départ : découpe des 5 héros) + `partsFor()`.
- `appearance.ts` — type `Appearance` (pur).
- `composeRig.tsx` — `resolveRig` (pur) + `RigSprite` (React).
- `rig.test.ts`.

**Modifiés :**
- `src/engine/types.ts` — `Combatant.appearance?: Appearance` (champ de données pur).
- `src/gameIso/sprites.ts` — `heroSprite` aiguille vers le rig (fallback conservé) ;
  `heroSpriteNode`.
- `src/gameIso/IsoStage.tsx` — token héros via `<RigSprite>` + variante `token()` à
  enfants React.
- UI créateur + `src/ui/editor/Editor.tsx` — panneau d'apparence héros partagé.
- `src/data/pregens.ts` — doter les pré-tirés d'une `appearance` par défaut (démo M/F).

## 11. Risques & mitigations

| Risque | Mitigation |
|---|---|
| **Authoring SVG = gros volume** (espèce×sexe×carrière×slots) | Démarrer en découpant les 5 SVG héros existants ; enrichir par lots best-of-2 ; ne pas tout couvrir d'un coup, `log`/noter ce qui reste en stub |
| Deux chemins de rendu (React rig vs innerHTML créatures) | Seam explicite et documenté ; créatures intouchées ; tests sur les deux |
| Morpho visuelle ≠ hitbox (1 case) | A reste cosmétique ; pas d'impact gameplay ; `build` borné pour rester lisible sur 1 tuile |
| Stabilité du seed (id change à l'import/export) | `parts` explicites priment sur le seed ; les héros joués reçoivent une `appearance` explicite dans `pregens`/création |
| FK SVG (transforms imbriqués) source de bugs visuels | Pose de repos d'abord ; test FK ; recette navigateur avant d'enchaîner sur C |

## 12. Ce que A débloque pour la suite

- **B** : le slot `tenue`/`casque`/`arme` existe → mapper `Combatant.items` (équipé) vers
  `appearance.parts`.
- **C** : os nommés (`<g data-bone>`) + type `Pose` → cibles d'animation prêtes (tween
  d'angles) ; nécessitera 1-2 enrichissements d'events moteur (ex. `defenseMode` dans
  `ANIM_ATTACK`, un `CONDITION_CHANGED`) — spécifiés dans le spec C.
- **D** : `POSE_*` presets (à terre, sonné…) consommés depuis `Combatant.conditions`.
