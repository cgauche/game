# Mobilier volumique et assise de La Diligence — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer cinq meubles data-driven réellement volumétriques, dix-huit places assises utilisables et l’implantation fidèle des quinze ancres de la salle principale de La Diligence, sans altérer sa topologie architecturale.

**Architecture:** `PropData` porte l’unique recette locale, ses matériaux et ses slots ; un builder pur compile les primitives en `Face[]` camera-free, puis le backend WebGL les cuit dans le monde commun et exclut ces refs de la voie billboard. `Scene.seatAssignments` porte l’occupation normalisée ; `src/state/seating.ts` est l’unique couture de résolution et de mutation, consommée par la persistance, l’interaction, le rig, l’éditeur et `MapSpec` sans dépendance `state → gameIso`.

**Tech Stack:** TypeScript, React, Zustand, Zod, Three.js via le backend WebGL existant, Vitest, JSON app-owned, SVG limité aux vignettes de palette, Playwright/`scripts/qc/capture-jeu.mjs` pour la recette réelle.

**Spec:** `docs/plans/2026-08-20-mobilier-volumique-assise-diligence.md`

## Global Constraints

- Exécuter ce plan avec `superpowers:subagent-driven-development`, une tâche à la fois, avec revue de conformité puis revue qualité avant la suivante.
- Le JSON `src/scenes/diligence/diligence-projet.json` reste la source éditable de La Diligence ; `MapSpec` et l’éditeur produisent le même schéma `Scene`.
- Les cinq ids restent des `SceneEntity kind:'prop'` ordinaires ; aucun `kind:'furniture'`, second catalogue, id de rendu ou branche renderer par label/ref.
- Les recettes et slots vivent dans des types neutres importables par `src/state` ; aucun import `state → gameIso`.
- La géométrie monde passe par `Face[]` et le backend commun ; aucun `THREE.Mesh` particulier, glTF ou `THREE` direct dans un builder.
- Le SVG des cinq refs est une vignette de palette/fallback seulement ; une recette valide produit au moins une face et zéro billboard monde.
- `PropData` reste l’unique vérité de dimensions, empreinte, solidité, recette, matériaux et slots ; `SceneEntity.foot` est purgé et `PropEl` ne redéclare aucune dimension concurrente.
- L’orientation vient uniquement de `SceneEntity.facing`, avec défaut canonique `S`, et transforme exactement une fois volumes, slots, caps et approches.
- Les braises sont non émissives ; la lumière de cheminée passe uniquement par `SceneEntity.light`/`PropData.light` existant.
- Aucun `mountId`, `riderId`, faux combattant-monture, règle équestre, IA sociale ou rendu simultané de plusieurs corps du groupe.
- Seul `party[0]`, meneur corporel actuel du code vivant, peut occuper une place `kind:'party'` ; un PNJ ne s’assoit que par authoring.
- Les mutations coop sont host-authoritative et revalidées atomiquement au moment de l’écriture ; jamais de transaction optimiste durable chez l’invité.
- Les quinze ancres du §9 de la spec sont exactes ; aucun mur, porte, fenêtre, escalier, terrain ou zone n’est ajouté, supprimé, déplacé ou réorienté.
- Toute étape inclut la mise aux normes du périmètre touché : schéma strict, ids stables, messages français, zéro commentaire-excuse/paraphrase/pierre tombale.
- Toute commande est exécutée en PowerShell dans `C:\Users\gauch\PhpstormProjects\Foundry\Game` ; aucun git destructif.

## Contrats partagés figés

Ces signatures sont définies une fois ici et reprises sans variation dans les sept tâches :

```ts
// src/data/props.types.ts
export type PropMaterialId = string;
export type PropPrimitive =
  | { kind: 'box'; center: PropPoint3; size: PropSize3; material: PropMaterialId }
  | { kind: 'cylinder'; center: PropPoint3; radius: number; heightM: number; sides: 8 | 12 | 16; material: PropMaterialId }
  | { kind: 'prism'; center: PropPoint3; size: PropSize3; slope: 'x+' | 'x-' | 'y+' | 'y-'; material: PropMaterialId };
export interface PropPoint3 { x: number; y: number; h: number }
export interface PropSize3 { x: number; y: number; h: number }
export interface PropVolumeRecipe { primitives: PropPrimitive[] }
export interface PropSeatSlot { id: string; anchor: PropPoint3; facing: Dir8; approach: { x: number; y: number } }
export interface PropMaterialData { id: string; color: string; roughness: number; metalness: number }

// src/gameIso/builders/propVolumes.ts
export function buildPropVolumes(ent: SceneEntity, prop: PropData, groundHeightM: number): Face[];

// src/state/seating.ts
export interface ResolvedSeatSlot {
  propId: string;
  slotId: string;
  anchor: { x: number; y: number; h: number };
  facing: Dir8;
  approach: Pt;
}
export interface SeatPose extends ResolvedSeatSlot { occupant: SeatOccupant }
export type SeatAssignmentResult =
  | { ok: true; scene: Scene; pose: SeatPose }
  | { ok: false; scene: Scene; reason: 'prop-absent' | 'slot-absent' | 'occupant-absent' | 'occupant-assis' | 'slot-occupe' | 'approche-invalide' };
export function seatSlotsOf(scene: Scene, propId: string): ResolvedSeatSlot[];
export function seatPoseOf(scene: Scene, occupant: SeatOccupant): SeatPose | null;
export function assignSeat(scene: Scene, propId: string, slotId: string, occupant: SeatOccupant, partyHeroIds: ReadonlySet<string>): SeatAssignmentResult;
export function releaseSeat(scene: Scene, occupant: SeatOccupant): Scene;
export function pruneSeatAssignments(scene: Scene, partyHeroIds: ReadonlySet<string>): SeatAssignments;
```

---

### Task 1: Contrats neutres de `PropData`, matériaux, recettes et slots

**Files:**
- Create: `src/data/props.types.ts`
- Create: `src/data/propMaterials.json`
- Create: `src/data/schemas/defs/propMaterials.ts`
- Create: `src/data/props-integrity.test.ts`
- Create: `src/data/prop-foot-migration.test.ts`
- Create: `src/gameIso/catalog/decor/defs/table-2x1.ts`
- Create: `src/gameIso/catalog/decor/defs/bureau-2x1.ts`
- Create: `src/gameIso/catalog/decor/defs/etabli-2x1.ts`
- Modify: `src/data/index.ts`
- Modify: `src/data/props.json`
- Modify: `src/data/donnees.manifest.json`
- Modify: `src/data/schemas/defs/props.ts`
- Modify: `src/data/schemas/_registry.generated.ts`
- Modify: `src/data/schema-contract.test.ts`
- Modify: `src/state/scene.ts`
- Modify: `src/state/scene.test.ts`
- Modify: `src/state/sceneRules.ts`
- Modify: `src/state/sceneRules.test.ts`
- Modify: `src/state/lineOfSight.ts`
- Modify: `src/state/lineOfSight.test.ts`
- Modify: `src/state/vision.ts`
- Modify: `src/state/vision.test.ts`
- Modify: `src/state/footprint.ts`
- Modify: `src/state/footprint.test.ts`
- Modify: `src/state/z-separation.test.ts`
- Modify: `src/gameIso/catalog/types.ts`
- Modify: `src/gameIso/catalog/decor/_registry.generated.ts`
- Modify: `src/gameIso/catalog/decor.test.ts`
- Modify: `src/gameIso/catalog/decor/defs/abreuvoir.ts`
- Modify: `src/gameIso/catalog/decor/defs/balustrade-bois.ts`
- Modify: `src/gameIso/catalog/decor/defs/balustrade-loge.ts`
- Modify: `src/gameIso/catalog/decor/defs/barque.ts`
- Modify: `src/gameIso/catalog/decor/defs/canon-de-pont.ts`
- Modify: `src/gameIso/catalog/decor/defs/charrette.ts`
- Modify: `src/gameIso/catalog/decor/defs/cheval-mort.ts`
- Modify: `src/gameIso/catalog/decor/defs/cuve-brasserie.ts`
- Modify: `src/gameIso/catalog/decor/defs/ecoutille.ts`
- Modify: `src/gameIso/catalog/decor/defs/enclume.ts`
- Modify: `src/gameIso/catalog/decor/defs/epave-carrosse.ts`
- Modify: `src/gameIso/catalog/decor/defs/escalier-bois.ts`
- Modify: `src/gameIso/catalog/decor/defs/escalier-loge.ts`
- Modify: `src/gameIso/catalog/decor/defs/foyer-de-forge.ts`
- Modify: `src/gameIso/catalog/decor/defs/idole-chaos.ts`
- Modify: `src/gameIso/catalog/decor/defs/lit.ts`
- Modify: `src/gameIso/catalog/decor/defs/passerelle-d-embarquement.ts`
- Modify: `src/gameIso/catalog/decor/defs/rangee-sieges.ts`
- Modify: `src/gameIso/catalog/decor/defs/rideau-scene.ts`
- Modify: `src/gameIso/catalog/decor/defs/rouleau-de-cordage.ts`
- Modify: `src/gameIso/catalog/decor/defs/stalle-ecurie.ts`
- Modify: `src/gameIso/catalog/decor/defs/tente.ts`
- Modify: `src/gameIso/catalog/decor/defs/tribune.ts`
- Modify: `src/ui/editor/propDefaults.ts`
- Modify: `src/ui/editor/propDefaults.test.ts`
- Modify: `src/ui/editor/Palette.tsx`
- Modify: `src/ui/editor/Inspector.tsx`
- Modify: `src/ui/editor/Inspector.test.tsx`
- Modify: `src/gameIso/builders/props.ts`
- Modify: `src/gameIso/builders/props.test.ts`
- Modify: `src/scenes/arene/arene-projet.json`
- Modify: `src/scenes/arene/arene-projet.test.ts`
- Modify: `src/scenes/opera/furnished.ts`
- Modify: `docs/donnees.md`
- Modify: `docs/consommateurs-de-champs.md`

**Interfaces:**
- Consumes: `Dir8` de `src/state/dir8.ts`, `PropData` et le chargeur app-owned de `src/data/index.ts`, validation Zod stricte par basename.
- Produces: les types du bloc « Contrats partagés figés », `PropData.foot?: { w: number; h: number }`, `PropData.volume?: PropVolumeRecipe`, `PropData.seatSlots?: PropSeatSlot[]`, `propMaterials: PropMaterialData[]`, `findPropMaterialById(id: string): PropMaterialData | undefined`; `SceneEntity.foot` disparaît et tous les consommateurs dérivent l'empreinte par `findPropById(ent.ref)?.foot ?? {w:1,h:1}`.

- [ ] **Step 1: Écrire les tests RED des formes strictes et des invariants de données**

```ts
it('refuse une primitive inconnue et un matériau absent', () => {
  expect(() => propsSchema.parse([{ id: 'x', volume: { primitives: [{ kind: 'sphere' }] } }])).toThrow();
  expect(validatePropCatalog(
    [{ id: 'x', volume: { primitives: [{ kind: 'box', center: { x: 0, y: 0, h: 0.5 }, size: { x: 1, y: 1, h: 1 }, material: 'absent' }] } }],
    [{ id: 'bois-chene', color: '#5b3a22', roughness: 0.82, metalness: 0 }],
  )).toContain('x: matériau inconnu « absent »');
});

it('refuse dimensions non positives, nombres non finis et slots ambigus', () => {
  const bad = propFixture({
    volume: { primitives: [{ kind: 'box', center: { x: 0, y: 0, h: 0 }, size: { x: 0, y: 1, h: 1 }, material: 'bois-chene' }] },
    seatSlots: [
      { id: 'nord', anchor: { x: 0, y: -0.35, h: 0.48 }, facing: 'S', approach: { x: 0, y: 1 } },
      { id: 'nord', anchor: { x: 0.3, y: 0, h: 0.48 }, facing: 'O', approach: { x: 0, y: 1 } },
    ],
  });
  expect(validatePropCatalog([bad], PROP_MATERIALS)).toEqual(expect.arrayContaining([
    expect.stringContaining('dimension non positive'),
    expect.stringContaining('slot dupliqué « nord »'),
    expect.stringContaining('approche dupliquée (0,1)'),
  ]));
});

it('migre sans dérive les empreintes de type et purge le legacy d’instance', () => {
  expect(propFootTable()).toEqual(LEGACY_PROP_FOOT_TABLE);
  const legacy = normalizeScene(sceneWithEntity({ id: 'c', kind: 'prop', ref: 'charrette', foot: { w: 9, h: 9 } } as never));
  expect(legacy.entities[0]).not.toHaveProperty('foot');
  expect(entityBlockedAt(legacy, legacy.entities[0].pos.x + 1, legacy.entities[0].pos.y, 0)).toBe(true);
  expect(entityBlockedAt(legacy, legacy.entities[0].pos.x + 2, legacy.entities[0].pos.y, 0)).toBe(false);
});

it('conserve l’empreinte effective de chaque instance authorée', () => {
  expect(authoredPropFootTable()).toEqual([
    ['arene-hub', 'p8', 'tente', 2, 2],
    ['arene-zone5', 'p9', 'abreuvoir', 2, 1],
    ['arene-zone6', 'p16', 'cheval-mort', 2, 1],
    ['arene-zone6', 'p17', 'barque', 2, 1],
    ['arene-zone11', 'p0', 'idole-chaos', 2, 2],
    ['arene-exp-foret', 'p13', 'tente', 2, 2],
    ['arene-exp-foret', 'p16', 'charrette', 2, 1],
    ['arene-exp-marais', 'p12', 'barque', 2, 1],
    ['arene-exp-village', 'p1', 'abreuvoir', 2, 1],
    ['arene-exp-village', 'p2', 'charrette', 2, 1],
    ['arene-route-embuscade', 'p0', 'epave-carrosse', 2, 2],
    ['opera/furnished', 'rideau-0', 'rideau-scene', 3, 1],
    ['opera/furnished', 'rideau-1', 'rideau-scene', 3, 1],
    ['opera/furnished', 'rideau-2', 'rideau-scene', 3, 1],
    ['opera/furnished', 'rideau-3', 'rideau-scene', 3, 1],
    ['opera/furnished', 'rideau-4', 'rideau-scene', 3, 1],
    ['opera/furnished', 'rideau-5', 'rideau-scene', 3, 1],
    ['opera/furnished', 'sv-table', 'table-2x1', 2, 1],
    ['opera/furnished', 'reg15-bureau', 'bureau-2x1', 2, 1],
    ['opera/furnished', 'b22-bureau', 'bureau-2x1', 2, 1],
    ['opera/furnished', 'b23-bureau', 'bureau-2x1', 2, 1],
    ['opera/furnished', 'c25-table-1', 'table-2x1', 2, 1],
    ['opera/furnished', 'c25-table-2', 'table-2x1', 2, 1],
    ['opera/furnished', 'c26-etabli', 'etabli-2x1', 2, 1],
  ]);
  expect(authoredPropFoot('opera/furnished', 'salon-d-table')).toEqual(['table', 1, 1]);
  expect(authoredPropFoot('opera/furnished', 'salon-s-table')).toEqual(['table', 1, 1]);
});
```

- [ ] **Step 2: Lancer le RED et constater l’absence des contrats**

Run: `npx vitest run src/data/props-integrity.test.ts src/data/prop-foot-migration.test.ts src/data/schema-contract.test.ts src/state/scene.test.ts src/state/sceneRules.test.ts src/state/z-separation.test.ts src/gameIso/catalog/decor.test.ts`

Expected: FAIL avec import introuvable `./props.types`, dataset `propMaterials.json` non déclaré et champs `volume`/`seatSlots` rejetés.

- [ ] **Step 3: Implémenter les types neutres, les deux schémas stricts et le garde d’intégrité minimal**

```ts
export interface PropData {
  id: string;
  solid?: boolean;
  opaque?: boolean;
  cover?: 'imparfaite' | 'moyenne' | 'totale';
  light?: { radiusTiles: number; tone?: string };
  foot?: { w: number; h: number };
  volume?: PropVolumeRecipe;
  seatSlots?: PropSeatSlot[];
}

export function validatePropCatalog(entries: readonly PropData[], materials: readonly PropMaterialData[]): string[] {
  const known = new Set(materials.map((m) => m.id));
  const errors: string[] = [];
  for (const prop of entries) {
    const slots = new Set<string>();
    const approaches = new Set<string>();
    for (const primitive of prop.volume?.primitives ?? []) {
      if (!known.has(primitive.material)) errors.push(`${prop.id}: matériau inconnu « ${primitive.material} »`);
      const values = primitive.kind === 'cylinder'
        ? [primitive.center.x, primitive.center.y, primitive.center.h, primitive.radius, primitive.heightM]
        : [primitive.center.x, primitive.center.y, primitive.center.h, primitive.size.x, primitive.size.y, primitive.size.h];
      if (values.some((n) => !Number.isFinite(n))) errors.push(`${prop.id}: coordonnée non finie`);
    }
    for (const slot of prop.seatSlots ?? []) {
      if (!slot.id.trim() || slots.has(slot.id)) errors.push(`${prop.id}: slot dupliqué « ${slot.id} »`);
      slots.add(slot.id);
      const key = `${slot.approach.x},${slot.approach.y}`;
      if (approaches.has(key)) errors.push(`${prop.id}: approche dupliquée (${key})`);
      approaches.add(key);
    }
  }
  return errors;
}
```

Ajouter les quatre matériaux exacts `bois-chene`, `pierre-atre`, `fer-noirci`, `braises` avec couleurs hexadécimales, `roughness` dans `[0,1]`, `metalness` dans `[0,1]`, sans champ d’émission. Pour un prop `solid`, faire échouer le test d’intégrité si une approche tombe dans l’empreinte locale dérivée de `PropData.foot ?? {w:1,h:1}`, soit `x ∈ [-0.5,w-0.5]` et `y ∈ [-0.5,h-0.5]`; ajouter un cas 2×1 où l’approche `(1,0)` est refusée, afin de ne jamais replier la validation sur `[-0.5,0.5]²`.

Migrer les 23 empreintes actuellement portées par `PropViz.foot` vers les entrées de mêmes ids dans `props.json`, retirer `foot` de `PropViz` et de ces 23 defs. Supprimer aussi `SceneEntity.foot` de `scene.ts`, les deux champs Largeur/Hauteur de l'inspecteur et l'écriture de `foot` dans `propRefPatch`; `Palette`, `props.ts`, `sceneRules.ts`, `lineOfSight.ts` et `vision.ts` lisent exclusivement `findPropById(ent.ref)?.foot`. `decorFootGeometry` reste la primitive géométrique pure mais son contrat devient `PropData.foot`, jamais un override d'instance.

L'inventaire mécanique `rg -n "foot:\\s*\\{\\s*w:" src --glob '*.ts' --glob '*.tsx'` complété par le parcours JSON de tous les `src/scenes/**/*.json` trouve vingt-quatre instances authorées : onze dans `arene-projet.json` et treize dans `opera/furnished.ts` (six rideaux, trois tables 2×1, trois bureaux 2×1, un établi 2×1). Les onze refs Arène et `rideau-scene` portent déjà une empreinte de type identique : supprimer seulement leur propriété d'instance. Pour les sept variantes Opéra dont la ref historique reste 1×1 ailleurs, créer les ids stables `table-2x1`, `bureau-2x1`, `etabli-2x1` dans `PropData`, chacun avec `foot:{w:2,h:1}`, et migrer uniquement `sv-table`, `c25-table-1`, `c25-table-2`, `reg15-bureau`, `b22-bureau`, `b23-bureau`, `c26-etabli`. Les refs `salon-d-table` et `salon-s-table` restent explicitement `table` 1×1.

Les trois nouvelles defs de vignette réexportent le rendu de leur base (`table`, `bureau`, `etabli`) avec un id/label distinct, sans champ `foot`; `npm run gen` les inscrit dans le registre décor. `normalizeScene` dépouille également un `foot` legacy inconnu du type TypeScript lors du chargement d'un ancien projet, sans le recopier ni l'interpréter : la physique vient du catalogue courant. `prop-foot-migration.test.ts` verrouille la table exhaustive avant/après `{scene,id,ref,foot effectif}` des vingt-quatre instances et les deux tables Opéra demeurées 1×1. Les autres tests verrouillent walkability, opacité/LdV et span de rendu pour `charrette` 2×1, `tente` 2×2, `rideau-scene` 3×1 et les trois variantes 2×1; l'inspecteur ne rend plus de contrôle d'empreinte et un changement de ref actualise immédiatement collision et span depuis `PropData`.

```json
[
  { "id": "table-2x1", "solid": true, "foot": { "w": 2, "h": 1 } },
  { "id": "bureau-2x1", "solid": true, "foot": { "w": 2, "h": 1 } },
  { "id": "etabli-2x1", "solid": true, "foot": { "w": 2, "h": 1 } }
]
```

```ts
import type { PropViz } from '../../types';
import { prop as table } from './table';
export const prop: PropViz = { ...table, id: 'table-2x1', label: 'Table longue' };
```

Dans `z-separation.test.ts`, remplacer la fausse ref `x` et son `foot:{w:2,h:2}` par `ref:'tente'`; le test continue de prouver les quatre cases bloquées à `z0` et libres aux mêmes coordonnées à `z1`, désormais depuis le catalogue. Réécrire dans `gameIso/catalog/decor.test.ts` les assertions `PROPS[id].foot` contre `findPropById(id)?.foot`, ajouter les trois variantes et garder les preuves SVG ; ce test appartient à Task 1 afin que la suppression de `PropViz.foot` soit verte avant Task 3.

Déclarer `propMaterials.json` avec `props.json` dans la rubrique éditoriale `Rendu / apparence / décor (NON-règles)` de `src/data/donnees.manifest.json`, sous l'entrée « Props de décor et leurs matériaux ». Ne pas éditer `docs/donnees.md` à la main : il est uniquement la sortie de `npm run docs:donnees`.

- [ ] **Step 4: Régénérer le registre de schémas avant toute preuve GREEN**

Run: `npm run gen`

Expected: `src/data/schemas/_registry.generated.ts` importe `./defs/propMaterials` et enregistre `propMaterials.json`; `src/gameIso/catalog/decor/_registry.generated.ts` enregistre exactement `table-2x1`, `bureau-2x1`, `etabli-2x1`; aucun autre registre généré ne change.

- [ ] **Step 5: Lancer le GREEN des contrats puis régénérer les références vivantes**

Run: `npx vitest run src/data/props-integrity.test.ts src/data/prop-foot-migration.test.ts src/data/schema-contract.test.ts src/data/serialize.test.ts src/state/scene.test.ts src/state/sceneRules.test.ts src/state/lineOfSight.test.ts src/state/vision.test.ts src/state/footprint.test.ts src/state/z-separation.test.ts src/gameIso/builders/props.test.ts src/gameIso/catalog/decor.test.ts src/ui/editor/propDefaults.test.ts src/ui/editor/Inspector.test.tsx src/scenes/arene/arene-projet.test.ts`

Expected: PASS.

Run: `npm run docs:donnees`

Expected: `docs/donnees.md` est régénéré depuis `src/data/donnees.manifest.json`, cartographie `propMaterials.json` avec son schéma et passe `npm run docs:check`.

Run: `npm run docs:field-consumers`

Expected: `docs/consommateurs-de-champs.md` nomme `volume`, `seatSlots`, `primitives`, `material`, `anchor`, `approach`.

Run: `npm run docs:check`

Expected: PASS avec le manifeste, l'atlas, le registre de schémas et les consommateurs synchronisés.

- [ ] **Step 6: Commit de la tâche 1**

```powershell
git add -- 'src/data/props.types.ts' 'src/data/propMaterials.json' 'src/data/schemas/defs/propMaterials.ts' 'src/data/props-integrity.test.ts' 'src/data/prop-foot-migration.test.ts' 'src/data/index.ts' 'src/data/props.json' 'src/data/donnees.manifest.json' 'src/data/schemas/defs/props.ts' 'src/data/schemas/_registry.generated.ts' 'src/data/schema-contract.test.ts' 'src/state/scene.ts' 'src/state/scene.test.ts' 'src/state/sceneRules.ts' 'src/state/sceneRules.test.ts' 'src/state/lineOfSight.ts' 'src/state/lineOfSight.test.ts' 'src/state/vision.ts' 'src/state/vision.test.ts' 'src/state/footprint.ts' 'src/state/footprint.test.ts' 'src/state/z-separation.test.ts' 'src/gameIso/catalog/types.ts' 'src/gameIso/catalog/decor/_registry.generated.ts' 'src/gameIso/catalog/decor.test.ts' 'src/gameIso/catalog/decor/defs/table-2x1.ts' 'src/gameIso/catalog/decor/defs/bureau-2x1.ts' 'src/gameIso/catalog/decor/defs/etabli-2x1.ts' 'src/gameIso/catalog/decor/defs/abreuvoir.ts' 'src/gameIso/catalog/decor/defs/balustrade-bois.ts' 'src/gameIso/catalog/decor/defs/balustrade-loge.ts' 'src/gameIso/catalog/decor/defs/barque.ts' 'src/gameIso/catalog/decor/defs/canon-de-pont.ts' 'src/gameIso/catalog/decor/defs/charrette.ts' 'src/gameIso/catalog/decor/defs/cheval-mort.ts' 'src/gameIso/catalog/decor/defs/cuve-brasserie.ts' 'src/gameIso/catalog/decor/defs/ecoutille.ts' 'src/gameIso/catalog/decor/defs/enclume.ts' 'src/gameIso/catalog/decor/defs/epave-carrosse.ts' 'src/gameIso/catalog/decor/defs/escalier-bois.ts' 'src/gameIso/catalog/decor/defs/escalier-loge.ts' 'src/gameIso/catalog/decor/defs/foyer-de-forge.ts' 'src/gameIso/catalog/decor/defs/idole-chaos.ts' 'src/gameIso/catalog/decor/defs/lit.ts' 'src/gameIso/catalog/decor/defs/passerelle-d-embarquement.ts' 'src/gameIso/catalog/decor/defs/rangee-sieges.ts' 'src/gameIso/catalog/decor/defs/rideau-scene.ts' 'src/gameIso/catalog/decor/defs/rouleau-de-cordage.ts' 'src/gameIso/catalog/decor/defs/stalle-ecurie.ts' 'src/gameIso/catalog/decor/defs/tente.ts' 'src/gameIso/catalog/decor/defs/tribune.ts' 'src/ui/editor/propDefaults.ts' 'src/ui/editor/propDefaults.test.ts' 'src/ui/editor/Palette.tsx' 'src/ui/editor/Inspector.tsx' 'src/ui/editor/Inspector.test.tsx' 'src/gameIso/builders/props.ts' 'src/gameIso/builders/props.test.ts' 'src/scenes/arene/arene-projet.json' 'src/scenes/arene/arene-projet.test.ts' 'src/scenes/opera/furnished.ts' 'docs/donnees.md' 'docs/consommateurs-de-champs.md'
git commit -m "feat(donnees): définit les recettes volumiques de props"
```

### Task 2: Compilation volumique pure, cuisson WebGL et picking par `entId`

**Files:**
- Create: `src/gameIso/builders/propVolumes.ts`
- Create: `src/gameIso/builders/propVolumes.test.ts`
- Create: `src/gameIso/backends/webgl/prop-picking.test.ts`
- Modify: `src/gameIso/builders/types.ts`
- Modify: `src/gameIso/builders/props.ts`
- Modify: `src/gameIso/builders/props.test.ts`
- Modify: `src/gameIso/backends/webgl/faceColors.ts`
- Modify: `src/gameIso/backends/webgl/faceColors.test.ts`
- Modify: `src/gameIso/backends/webgl/faceRelief.ts`
- Modify: `src/gameIso/backends/webgl/sceneMeshes.ts`
- Modify: `src/gameIso/backends/webgl/sceneMeshes.test.ts`
- Modify: `src/gameIso/backends/webgl/worldMaterials.ts`
- Modify: `src/gameIso/backends/webgl/worldMaterials.test.ts`
- Modify: `src/gameIso/backends/webgl/spriteRaycast.ts`
- Modify: `src/gameIso/backends/webgl/spriteRaycast.test.ts`
- Modify: `src/gameIso/stage/GameStage3D.tsx`
- Modify: `src/gameIso/stage/spritePicker.ts`
- Modify: `src/gameIso/stage/useStagePointer.ts`
- Modify: `src/gameIso/stage/useStagePointer.test.tsx`

**Interfaces:**
- Consumes: `PropData.volume`, `findPropMaterialById`, `SceneEntity.facing ?? 'S'`, `facesGeometry`, la cuisson groupée de `sceneMeshes` et `buildPropVolumes(ent, prop, groundHeightM): Face[]` ; `buildProps` calcule `groundHeightM` une seule fois par entité via `heightAt(scene, ent.pos.x, ent.pos.y, ent.z ?? 0)`.
- Produces: `MaterialRef.domain: 'prop'`, `Face.entId?: string`, union `PropEl` billboard/volume, `WorldGeometry.userData.propVertexRanges` où plusieurs plages disjointes peuvent répéter le même `entId`, `PickResult = {kind:'combatant';id:string}|{kind:'entity';id:string}|null`, `targetUnderPointer(clientX: number, clientY: number): PickResult`.

- [ ] **Step 1: Écrire les goldens RED boîte/cylindre/prisme aux huit caps**

```ts
it.each<Dir8>(['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'])('compile les trois primitives au cap %s', (facing) => {
  const ent = propEntity({ id: `meuble-${facing}`, pos: { x: 4, y: 6 }, facing });
  const faces = buildPropVolumes(ent, PROP_TROIS_PRIMITIVES, 0);
  expect(faces.length).toBe(6 + 10 + 5);
  expect(faces.every((f) => f.entId === ent.id && f.material.domain === 'prop')).toBe(true);
  expect(snapshotFaces(faces)).toMatchSnapshot();
});

it('pose le volume à la hauteur métrique fournie par le relief et la couche', () => {
  const scene = sceneWithReliefAndUpperLayer({ x: 4, y: 6, z: 1, heightM: 7.25 });
  const ent = propEntity({ id: 'meuble-haut', pos: { x: 4, y: 6 }, z: 1, facing: 'S' });
  const [el] = buildProps({ ...scene, entities: [ent] });
  expect(Math.min(...el.faces.map((face) => Math.min(...face.poly.map((p) => p.h))))).toBeCloseTo(7.25);
});
```

Le cylindre `sides:8` produit 8 faces latérales + dessus + dessous ; le prisme produit exactement 5 faces triangulées/quadrangulées non dégénérées ; chaque polygone est orienté vers l’extérieur selon `polyNormal`.

- [ ] **Step 2: Écrire le RED d’exclusion billboard et de picking**

```ts
it('cuit un prop volumique une fois, sans sujet billboard, et conserve son id de picking', () => {
  const scene = sceneWith(volumeEntity('table-1'), legacyEntity('tonneau-1'));
  const els = wholeSceneBillboardEls(scene);
  expect(els.props.map((p) => p.entId)).toEqual(['tonneau-1']);
  const world = buildWorldGeometry(scene, 2, () => 1);
  expect(world.userData.propVertexRanges).toEqual(expect.arrayContaining([
    expect.objectContaining({ entId: 'table-1', vertexStart: expect.any(Number), vertexCount: expect.any(Number) }),
  ]));
  expect(world.userData.propVertexRanges.filter((r) => r.entId === 'table-1').length).toBeGreaterThan(1);
  for (const face of bakedPropFaces(world, 'table-1')) {
    expect(propEntityAtHit(world.userData.propVertexRanges, face)).toBe('table-1');
  }
  expect(worldBakeDeps(scene, 2)).toEqual(expect.arrayContaining([findPropById('table-ronde-4-tabourets')!.volume]));
});

it('worldBakeDeps invalide la cuisson pour add/remove/pos/ref/facing d’un prop', () => {
  const base = sceneWith(volumeEntity('table-1'));
  for (const changed of [
    { ...base, entities: [] },
    { ...base, entities: [...base.entities, volumeEntity('table-2')] },
    patchEntity(base, 'table-1', { pos: { x: 3, y: 4 } }),
    patchEntity(base, 'table-1', { ref: 'comptoir-droit' }),
    patchEntity(base, 'table-1', { facing: 'E' }),
  ]) expect(worldBakeDeps(changed, 2)).not.toEqual(worldBakeDeps(base, 2));
});

it('un cutaway placé avant le prop conserve le picking par sommets originaux', () => {
  const { mesh, propRange } = worldMeshWithCutawayBeforeProp();
  const hit = raycastProp(mesh, propRange);
  expect(hit.face && [hit.face.a, hit.face.b, hit.face.c].every((i) => i >= propRange.vertexStart && i < propRange.vertexStart + propRange.vertexCount)).toBe(true);
  expect(pickNearestTarget(CAMERA, BILLBOARDS, mesh, NDC)).toEqual({ kind: 'entity', id: 'table-1' });
});

it('arbitre combattants et faces de prop par distance globale', () => {
  expect(pickNearestTarget(CAMERA, [combatantBehindProp()], WORLD_MESH, NDC)).toEqual({ kind: 'entity', id: 'table-1' });
  expect(pickNearestTarget(CAMERA, [combatantBeforeProp()], WORLD_MESH, NDC)).toEqual({ kind: 'combatant', id: 'hero-1' });
});

it('ignore une face monde non-prop et conserve le clic acteur derrière le mur', () => {
  const wallFirst = worldMeshWithNonPropWallBefore(combatantBillboard('hero-1'));
  expect(propEntityAtHit(wallFirst.userData.propVertexRanges, wallFirst.wallHit.face!)).toBeNull();
  expect(pickNearestTarget(CAMERA, [combatantBillboard('hero-1')], wallFirst, NDC)).toEqual({ kind: 'combatant', id: 'hero-1' });
});
```

- [ ] **Step 3: Lancer le RED**

Run: `npx vitest run src/gameIso/builders/propVolumes.test.ts src/gameIso/builders/props.test.ts src/gameIso/backends/webgl/prop-picking.test.ts`

Expected: FAIL avec `buildPropVolumes` absent, domaine `prop` impossible et prop volumique encore collecté comme billboard.

- [ ] **Step 4: Implémenter la rotation locale unique et l’union de `PropEl`**

```ts
export type PropEl = BillboardPropEl | VolumePropEl;
export interface VolumePropEl extends ElBase {
  kind: 'prop';
  source: 'entity';
  ref: string;
  entId: string;
  facing: Dir8;
  interact: boolean;
  faces: Face[];
}

const rotateLocal = (x: number, y: number, facing: Dir8): [number, number] => {
  const a = DIR8_ORDER.indexOf(facing) * Math.PI / 4;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
};
```

Construire les boîtes, cylindres et prismes avec `center.h`/`size.h` en mètres et `x/y` en unités de grille. `buildProps` calcule une seule fois `const groundHeightM = heightAt(scene, ent.pos.x, ent.pos.y, z)` puis le passe à `buildPropVolumes(ent, prop, groundHeightM)` ; `propVolumes.ts` additionne ce troisième paramètre à chaque hauteur locale et n’importe jamais scène, caméra, React, store ou Three.js.

- [ ] **Step 5: Étendre la cuisson et le picking sans maillage spécial**

Ajouter le domaine `prop` à `MaterialRef`, résoudre sa teinte/roughness/metalness via `findPropMaterialById`, injecter les faces volumiques dans `worldFaces`, et inclure `scene.entities` ainsi que les recettes/matériaux lus dans `worldBakeDeps`. Enregistrer pour chaque lot contigu de `Face.entId` une plage de sommets **originaux** avant indexation/cutaway. La cuisson groupe par matériau : un même `entId` peut donc apparaître dans plusieurs `PropVertexRange`, sans fusionner les intervalles séparés. Ne jamais utiliser `triangleStart` contre `Intersection.faceIndex` : le cutaway réécrit l’index buffer. Résoudre l’id seulement si `hit.face.a`, `.b` et `.c` appartiennent à une même plage ; toute intersection monde sans plage prop est ignorée par le picking d'entités.

```ts
export interface PropVertexRange { entId: string; vertexStart: number; vertexCount: number }

export function propEntityAtHit(ranges: readonly PropVertexRange[], face: { a: number; b: number; c: number }): string | null {
  return ranges.find((r) => [face.a, face.b, face.c].every((i) => i >= r.vertexStart && i < r.vertexStart + r.vertexCount))?.entId ?? null;
}
```

Étendre `spriteRaycast.ts` avec `pickNearestTarget`: une seule passe compare par distance les intersections des billboards et les seules intersections du `worldMeshRef` que `propEntityAtHit` résout. Un mur, sol ou toit sans `PropVertexRange` n'entre jamais dans les candidats et ne masque pas le comportement historique #1297 d'un acteur cliquable derrière la géométrie non-prop. Le résultat est discriminé `combatant`/`entity`; aucun ordre « token d’abord » n’est autorisé. `GameStage3D.tsx` fournit le maillage monde vivant et les boards au picker installé ; `spritePicker.ts` transporte le résultat discriminé ; `useStagePointer` route `combatant` au combat et `entity` à l’interaction d’exploration.

- [ ] **Step 6: Lancer le GREEN géométrie/backend/picking**

Run: `npx vitest run src/gameIso/builders/propVolumes.test.ts src/gameIso/builders/props.test.ts src/gameIso/backends/webgl/prop-picking.test.ts src/gameIso/backends/webgl/sceneMeshes.test.ts src/gameIso/backends/webgl/worldTris.test.ts src/gameIso/backends/webgl/worldMaterials.test.ts src/gameIso/backends/webgl/spriteRaycast.test.ts src/gameIso/stage/GameStage3D.test.tsx src/gameIso/stage/useStagePointer.test.tsx`

Expected: PASS ; zéro paire coplanaire après biais canonique, faces non dégénérées, prop legacy inchangé, chaque face multi-matériau → id exact et géométrie monde non-prop transparente au picking #1297.

- [ ] **Step 7: Commit de la tâche 2**

```powershell
git add -- 'src/gameIso/builders/propVolumes.ts' 'src/gameIso/builders/propVolumes.test.ts' 'src/gameIso/backends/webgl/prop-picking.test.ts' 'src/gameIso/builders/types.ts' 'src/gameIso/builders/props.ts' 'src/gameIso/builders/props.test.ts' 'src/gameIso/backends/webgl/faceColors.ts' 'src/gameIso/backends/webgl/faceColors.test.ts' 'src/gameIso/backends/webgl/faceRelief.ts' 'src/gameIso/backends/webgl/sceneMeshes.ts' 'src/gameIso/backends/webgl/sceneMeshes.test.ts' 'src/gameIso/backends/webgl/worldMaterials.ts' 'src/gameIso/backends/webgl/worldMaterials.test.ts' 'src/gameIso/backends/webgl/spriteRaycast.ts' 'src/gameIso/backends/webgl/spriteRaycast.test.ts' 'src/gameIso/stage/GameStage3D.tsx' 'src/gameIso/stage/spritePicker.ts' 'src/gameIso/stage/useStagePointer.ts' 'src/gameIso/stage/useStagePointer.test.tsx'
git commit -m "feat(rendu): compile les props en volumes pickables"
```

### Task 3: Cinq recettes, vignettes et QC de catalogue

**Files:**
- Create: `src/gameIso/catalog/decor/defs/cheminee-interieure.ts`
- Create: `src/gameIso/catalog/decor/defs/comptoir-droit.ts`
- Create: `src/gameIso/catalog/decor/defs/comptoir-angle.ts`
- Create: `src/gameIso/catalog/decor/defs/table-ronde-4-tabourets.ts`
- Create: `src/gameIso/catalog/decor/defs/table-murale-2-tabourets.ts`
- Create: `scripts/qc/render-props-volumiques.mts`
- Create: `src/gameIso/catalog/props-volumiques.test.ts`
- Modify: `src/data/props.json`
- Modify: `src/gameIso/catalog/decor/_registry.generated.ts`
- Modify: `scripts/gen-galleries.mjs`

**Interfaces:**
- Consumes: recettes validées Task 1, `buildPropVolumes` Task 2, `PropViz`/`propSvg` et registre généré existants.
- Produces: les cinq ids de la spec, leurs vignettes SVG et une galerie qui rend les volumes monde aux quatre rotations plus vue de dessus.

- [ ] **Step 1: Écrire le RED des cinq identités et de la voie monde exclusive**

```ts
const IDS = ['cheminee-interieure', 'comptoir-droit', 'comptoir-angle', 'table-ronde-4-tabourets', 'table-murale-2-tabourets'] as const;

it.each(IDS)('%s possède vignette et volume monde, jamais billboard monde', (id) => {
  expect(propSvg(id).length).toBeGreaterThan(120);
  const prop = findPropById(id)!;
  expect(prop.volume!.primitives.length).toBeGreaterThan(0);
  const scene = sceneWith(propEntity({ id: `e-${id}`, ref: id, pos: { x: 2, y: 2 }, facing: 'S' }));
  expect(buildProps(scene)[0]).toMatchObject({ entId: `e-${id}`, faces: expect.any(Array) });
  const els = wholeSceneBillboardEls(scene);
  expect(collectBillboards(scene, 2, els).some((b) => b.key.includes(`e-${id}`))).toBe(false);
});
```

- [ ] **Step 2: Lancer le RED catalogue**

Run: `npx vitest run src/gameIso/catalog/props-volumiques.test.ts`

Expected: FAIL car les cinq refs, vignettes et recettes n’existent pas.

- [ ] **Step 3: Authorer les recettes concrètes et les dix slots de type**

La cheminée compose socle, deux jambages, manteau, fond, deux chenets et lit de braises ; le comptoir droit compose caisson, quatre panneaux, plateau et plinthe ; l’angle raccorde deux caissons et deux plateaux sans fente ; la table ronde compose plateau cylindrique, pied central et quatre tabourets ; la table murale compose plateau boîte, deux consoles prismatiques et deux tabourets.

```json
{
  "id": "table-ronde-4-tabourets",
  "solid": true,
  "volume": {
    "primitives": [
      { "kind": "cylinder", "center": { "x": 0, "y": 0, "h": 0.78 }, "radius": 0.31, "heightM": 0.08, "sides": 16, "material": "bois-chene" },
      { "kind": "cylinder", "center": { "x": 0, "y": 0, "h": 0.39 }, "radius": 0.09, "heightM": 0.78, "sides": 12, "material": "fer-noirci" }
    ]
  },
  "seatSlots": [
    { "id": "nord", "anchor": { "x": 0, "y": -0.43, "h": 0.49 }, "facing": "S", "approach": { "x": 0, "y": -1 } },
    { "id": "est", "anchor": { "x": 0.43, "y": 0, "h": 0.49 }, "facing": "O", "approach": { "x": 1, "y": 0 } },
    { "id": "sud", "anchor": { "x": 0, "y": 0.43, "h": 0.49 }, "facing": "N", "approach": { "x": 0, "y": 1 } },
    { "id": "ouest", "anchor": { "x": -0.43, "y": 0, "h": 0.49 }, "facing": "E", "approach": { "x": -1, "y": 0 } }
  ]
}
```

La table murale déclare `gauche`/`droite`, ancres `(-0.22,0.34,0.49)` et `(0.22,0.34,0.49)`, caps `N`, approches `(-1,1)` et `(1,1)` dans son repère canonique. Les dimensions finales doivent faire réussir la sonde frontière de Task 7 ; si elles ne tiennent pas aux coordonnées validées, arrêter l’exécution pour revalidation au lieu de déplacer les ancres.

- [ ] **Step 4: Générer le registre et la galerie volumique**

Run: `npm run gen`

Expected: les cinq defs apparaissent une fois dans `_registry.generated.ts`.

Le script QC importe les recettes et appelle `buildPropVolumes(ent, prop, 0)`, projette leurs vraies `Face[]` dans cinq colonnes (`rot0..rot3`, `top`) et écrit `public/props-volumiques.html`; il n’appelle `propSvg` que dans une colonne distincte « vignette palette ».

- [ ] **Step 5: Lancer le GREEN catalogue/QC**

Run: `npx vitest run src/gameIso/catalog/props-volumiques.test.ts src/data/props-integrity.test.ts src/gameIso/renderer-no-hardcoded-color.test.ts`

Expected: PASS, quatre slots exacts pour la table ronde, deux pour la murale, zéro slot sur cheminée/comptoirs.

Run: `npx tsx scripts/qc/render-props-volumiques.mts`

Expected: `public/props-volumiques.html` contient 5 lignes × 6 vues et aucune vue monde vide.

- [ ] **Step 6: Commit de la tâche 3**

```powershell
git add -- 'src/gameIso/catalog/decor/defs/cheminee-interieure.ts' 'src/gameIso/catalog/decor/defs/comptoir-droit.ts' 'src/gameIso/catalog/decor/defs/comptoir-angle.ts' 'src/gameIso/catalog/decor/defs/table-ronde-4-tabourets.ts' 'src/gameIso/catalog/decor/defs/table-murale-2-tabourets.ts' 'scripts/qc/render-props-volumiques.mts' 'src/gameIso/catalog/props-volumiques.test.ts' 'src/data/props.json' 'src/gameIso/catalog/decor/_registry.generated.ts' 'scripts/gen-galleries.mjs'
git commit -m "feat(catalogue): ajoute le mobilier volumique de taverne"
```

### Task 4: `seatAssignments`, module pur, persistance et PNJ authorés

**Files:**
- Create: `src/state/seating.ts`
- Create: `src/state/seating.test.ts`
- Create: `src/state/seating-persistence.test.ts`
- Modify: `src/state/scene.ts`
- Modify: `src/state/sceneInstance.ts`
- Modify: `src/state/sceneInstance.test.ts`
- Modify: `src/state/validateScene.ts`
- Modify: `src/state/validateScene.test.ts`
- Modify: `src/state/saves.ts`
- Modify: `src/state/saves-flow.test.ts`
- Modify: `src/state/combatFlow.ts`
- Modify: `src/state/combatGeometry.ts`
- Modify: `src/state/combat-entity-reconcile.test.ts`
- Modify: `src/gameIso/rig/mountedRig.ts`
- Modify: `src/gameIso/rig/mounted-harnais.test.ts`
- Modify: `src/gameIso/rig/anim/weaponClips.ts`
- Modify: `src/gameIso/builders/tokens.ts`
- Modify: `src/gameIso/builders/tokens.test.ts`

**Interfaces:**
- Consumes: `PropSeatSlot`, `findPropById`, `SceneEntity`, `Dir8`, `Pt`, six fonctions du contrat `seating.ts`.
- Produces: `SeatOccupant`, `SeatAssignments`, `Scene.seatAssignments?`, override complet `SceneMutation.seatAssignments?`, pose `TokenSubjectEl` assise non montée pour PNJ authoré, pruning aux suppressions/chargements/combat, y compris le funnel `combatGeometry.removeEntities`.

- [ ] **Step 1: Écrire le RED des transformations et exclusivités**

```ts
it.each<Dir8>(['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'])('résout slots, cap et approche en %s', (facing) => {
  const scene = seatingScene({ propFacing: facing });
  expect(seatSlotsOf(scene, 'table-1')).toMatchSnapshot();
});

it('assigne une seule place par occupant et un seul occupant par slot', () => {
  const first = assignSeat(scene, 'table-1', 'nord', PARTY, new Set(['hero-1']));
  expect(first.ok).toBe(true);
  const sameOccupant = assignSeat(first.scene, 'table-1', 'est', PARTY, new Set(['hero-1']));
  const sameSlot = assignSeat(first.scene, 'table-1', 'nord', NPC, new Set(['hero-1']));
  expect(sameOccupant).toMatchObject({ ok: false, reason: 'occupant-assis' });
  expect(sameSlot).toMatchObject({ ok: false, reason: 'slot-occupe' });
});
```

- [ ] **Step 2: Écrire le RED mutation complète, `{}` explicite et revisite après combat**

```ts
it('round-trip un effacement complet sans ressusciter l’assise authorée', () => {
  const authored = sceneWithAssignments(AUTHORED_NPC_SEAT);
  const current = { ...authored, seatAssignments: {} };
  const mutation = captureMutation(current, authored);
  expect(mutation?.seatAssignments).toEqual({});
  expect(applyMutation(structuredClone(authored), mutation).seatAssignments).toEqual({});
});
```

- [ ] **Step 3: Lancer le RED assise/persistance**

Run: `npx vitest run src/state/seating.test.ts src/state/seating-persistence.test.ts src/state/sceneInstance.test.ts src/state/validateScene.test.ts`

Expected: FAIL avec types/fonctions absents et mutation incapable de distinguer absence d’override de `{}`.

- [ ] **Step 4: Implémenter la forme imbriquée et la source unique pure**

```ts
export type SeatOccupant =
  | { kind: 'party'; heroId: string }
  | { kind: 'entity'; entityId: string };
export type SeatAssignments = Record<string, Record<string, SeatOccupant>>;
```

`seatSlotsOf` résout `prop.ref`, applique `facing ?? 'S'`, conserve l’ordre JSON et place `approach` en case monde. `assignSeat` clone les deux niveaux, revalide prop/slot/occupant/approche et retourne une raison stable ; `releaseSeat` supprime l’occupant puis les objets vides ; `pruneSeatAssignments` parcourt dans l’ordre `scene.entities`, puis slots déclarés, et garde le premier siège d’un occupant.

- [ ] **Step 5: Brancher validation authoring, mutation et save**

Ajouter `seatAssignments?: SeatAssignments` à `Scene`; `validateScene` émet une erreur comportant `propId`, `slotId`, id occupant pour prop/slot/occupant/position PNJ invalides. `SceneMutation.seatAssignments?: SeatAssignments` remplace le champ complet dans `applyMutation`; `captureMutation` compare structurellement les formes normalisées. Bumper `SAVE_VERSION` de `27` à `28` et mettre à jour le golden de rejet de versions antérieures.

- [ ] **Step 6: Rendre le PNJ assis sans chemin de monture et libérer au combat**

Extraire de `mountedRig.ts` une primitive neutre `seatedBodyPose()` réutilisant bassin/jambes fléchis ; `weaponClips.ts` impose le clip de repos/rangement. `buildTokens` associe `seatPoseOf(scene,{kind:'entity',entityId})` au figurant et expose ancre/cap sans `mountId`. À l’ouverture/réconciliation du combat, appeler `releaseSeat` pour chaque `entityId` enrôlé, supprimé, mort ou indisponible avant capture de mutation. Brancher aussi `pruneSeatAssignments` dans `combatGeometry.removeEntities`, source partagée de suppression par lot, et verrouiller qu’une suppression de prop ou de PNJ nettoie l’assignment dans la même écriture de scène.

- [ ] **Step 7: Lancer le GREEN Task 4**

Run: `npx vitest run src/state/seating.test.ts src/state/seating-persistence.test.ts src/state/sceneInstance.test.ts src/state/validateScene.test.ts src/state/saves-flow.test.ts src/state/combat-entity-reconcile.test.ts src/gameIso/builders/tokens.test.ts src/gameIso/rig/mounted-harnais.test.ts`

Expected: PASS, dont PNJ authoré assis → combat → capture → revisite toujours relevé.

- [ ] **Step 8: Commit de la tâche 4**

```powershell
git add -- 'src/state/seating.ts' 'src/state/seating.test.ts' 'src/state/seating-persistence.test.ts' 'src/state/scene.ts' 'src/state/sceneInstance.ts' 'src/state/sceneInstance.test.ts' 'src/state/validateScene.ts' 'src/state/validateScene.test.ts' 'src/state/saves.ts' 'src/state/saves-flow.test.ts' 'src/state/combatFlow.ts' 'src/state/combatGeometry.ts' 'src/state/combat-entity-reconcile.test.ts' 'src/gameIso/rig/mountedRig.ts' 'src/gameIso/rig/mounted-harnais.test.ts' 'src/gameIso/rig/anim/weaponClips.ts' 'src/gameIso/builders/tokens.ts' 'src/gameIso/builders/tokens.test.ts'
git commit -m "feat(scene): persiste les places assises authorées"
```

### Task 5: Interaction du meneur, transaction coop et pose cohérente dans toutes les vues

**Files:**
- Create: `src/state/seating-interaction.test.ts`
- Create: `src/state/seating-lifecycle.test.ts`
- Create: `src/state/seating-coop.test.ts`
- Create: `src/gameIso/stage/seated-pose.test.tsx`
- Create: `src/ui/SeatedLeaderActions.tsx`
- Create: `src/ui/SeatedLeaderActions.test.tsx`
- Modify: `src/state/store.ts`
- Modify: `src/state/netOwnership.ts`
- Modify: `src/state/netOwnership.test.ts`
- Modify: `src/state/partyFlow.ts`
- Modify: `src/state/stateFields.ts`
- Modify: `src/state/exploreNav.ts`
- Modify: `src/state/exploreNav.test.ts`
- Modify: `src/i18n/messages/fr.ts`
- Modify: `src/gameIso/builders/interactHalos.ts`
- Modify: `src/gameIso/builders/interactHalos.test.ts`
- Modify: `src/gameIso/builders/tokenChrome.ts`
- Modify: `src/gameIso/stage/chrome-jeton.test.tsx`
- Modify: `src/gameIso/stage/VolumetricWorld.tsx`
- Modify: `src/gameIso/stage/MondeDeCampagne.tsx`
- Modify: `src/gameIso/stage/useStagePointer.ts`
- Modify: `src/gameIso/stage/useStagePointer.test.tsx`
- Modify: `src/gameIso/pov/pov-volumique.test.tsx`
- Modify: `src/ui/CampaignView.tsx`
- Modify: `src/ui/CampaignView.test.tsx`
- Modify: `src/ui/ExplorationDock.tsx`
- Modify: `src/ui/ExplorationDock.test.tsx`

**Interfaces:**
- Consumes: `pendingInteract`, `setPendingInteract`, `interactEntity`, six fonctions `seating.ts`, leader `party[0]`, route `interactEntity` host/group-decision existante.
- Produces: `exploreSeatPlan(scene: Scene, partyPos: Pt, propId: string): { slotId: string; approach: Pt; path: Pt[] } | null`, s’asseoir/se relever atomique pour le meneur, action contextuelle d’exploration `Se relever`, libérations de cycle de vie, messages français, même `SeatPose` pour corps/chrome/picking/focus caméra/POV.

- [ ] **Step 1: Écrire le RED de l’interaction déterministe et atomique**

```ts
it('assoit puis relève party[0] par le même interactEntity', () => {
  setupAtApproach({ freeSlots: ['nord', 'est'] });
  useGame.getState().interactEntity('table-1');
  expect(seatPoseOf(useGame.getState().scene!, PARTY)).toMatchObject({ slotId: 'nord' });
  useGame.getState().interactEntity('table-1');
  expect(seatPoseOf(useGame.getState().scene!, PARTY)).toBeNull();
});

it('refuse la transaction si le groupe n’est pas exactement sur l’approche du slot', () => {
  setupAt({ x: APPROACH.x + 1, y: APPROACH.y });
  useGame.getState().interactEntity('table-1');
  expect(seatPoseOf(useGame.getState().scene!, PARTY)).toBeNull();
  expect(lastLog()).toContain('Vous devez rejoindre la place');
});

it('revalide le dernier slot et ne produit qu’un gagnant', () => {
  const stale = useGame.getState().scene!;
  useGame.getState().interactEntity('table-1');
  useGame.setState({ scene: stale });
  useGame.getState().interactEntity('table-1');
  expect(allOccupants(useGame.getState().scene!)).toHaveLength(1);
});
```

- [ ] **Step 2: Écrire le RED de navigation, des libérations, de l’action contextuelle et de la coop**

```ts
it('planifie vers l’approche du premier slot libre et atteignable', () => {
  const plan = exploreSeatPlan(sceneWithNorthOccupied(), { x: 8, y: 8 }, 'table-1');
  expect(plan).toMatchObject({ slotId: 'est', approach: { x: 11, y: 10 } });
  expect(plan!.path.at(-1)).toEqual(plan!.approach);
});
```

Tester séparément déplacement, `party[0]` remplacé, retrait du héros, transition, save/reload, ouverture de combat et mort. `SeatedLeaderActions.test.tsx` vérifie que le bouton « Se relever » existe seulement en exploration quand `party[0]` est assis, appelle `standPartyFromSeat`, porte `type="button"`, un nom accessible exact et un focus clavier, et n’est ni le bouton combat `battleStandUp` ni rendu dans `ActionBar`. `ExplorationDock.test.tsx` monte le vrai écran à 360 px et vérifie que l'action reste dans `.xd-openers`, sans débordement hors du pont; il lit aussi les feuilles vivantes pour prouver la tranche `max-width:560px` scrollable et la cible `pointer: coarse` de 44×44 px. Le test coop crée hôte/invité, affecte le meneur à l’hôte, envoie deux intentions sur le dernier slot et attend un seul assignment dans le snapshot hôte, puis chez l’invité.

```tsx
export function SeatedLeaderActions({ onStand }: { onStand: () => void }) {
  return (
    <button type="button" className="worldmap-btn" data-skin="tole" aria-label="Se relever" title="Se relever" onClick={onStand}>
      <Icon id="action/stand-up" size="lg" />
    </button>
  );
}
```

- [ ] **Step 3: Lancer le RED interaction/cycle/coop**

Run: `npx vitest run src/state/seating-interaction.test.ts src/state/seating-lifecycle.test.ts src/state/seating-coop.test.ts src/state/exploreNav.test.ts src/state/netOwnership.test.ts src/ui/SeatedLeaderActions.test.tsx src/ui/ExplorationDock.test.tsx`

Expected: FAIL car les props à slots ne sont pas interactifs, aucune action d’assise n’existe et les coutures ne libèrent rien.

- [ ] **Step 4: Étendre l’interaction existante sans second pending**

Dans `exploreNav.ts`, `exploreSeatPlan` parcourt `seatSlotsOf` dans l’ordre déclaré, ignore les slots occupés, appelle le planificateur existant vers chaque `slot.approach`, et retourne le premier chemin atteignable. `useStagePointer` arme le même `pendingInteract` avec le prop puis marche jusqu’à **cette approche**, pas jusqu’à la case d’ancrage du meuble.

Dans `interactEntity`, traiter un prop à slots avant dialogue/marchand/fouille : si le meneur occupe ce prop, appeler `releaseSeat`; sinon ne considérer que le premier slot libre dont `slot.approach` est exactement égal à `partyPos`, puis appeler `assignSeat` sur l’état courant dans le callback `set`. En cas d’échec, journaliser via ids i18n `seating.occupied`, `seating.noReachableSeat`, `seating.mustReachApproach`, `seating.sat`, `seating.stood`.

```ts
set((s) => {
  if (!s.scene || s.party[0]?.id !== leaderId || !samePt(s.partyPos, approach)) return {};
  const result = assignSeat(s.scene, entityId, slotId, { kind: 'party', heroId: leaderId }, new Set(s.party.map((h) => h.id)));
  return result.ok ? { scene: result.scene } : {};
});
```

La route coop reste `interactEntity` dans `ROUTES`, appartenant à la décision de groupe/hôte ; ne pas créer `sit`, `seat` ou intent invité distinct. Le prop à slots devient interactif dans `interactionHalos` et `useStagePointer` même sans `SceneEntity.interact`.

Ajouter au store `standPartyFromSeat(): void`, qui revalide `party[0]`, appelle `releaseSeat` et ne touche aucune propriété de combat. `CampaignView` passe l'action à `ExplorationDock`, qui la place dans sa rangée `.xd-openers` existante. `SeatedLeaderActions` compose uniquement la primitive visuelle existante `.worldmap-btn[data-skin='tole']` et l'icône existante `action/stand-up`; il ne crée aucune classe ni feuille CSS, n'importe ni ne réutilise l'action combat `battleStandUp`. La responsivité reste celle du pont existant : défilement à 360 px et cible 44×44 px sous `pointer: coarse`.

- [ ] **Step 5: Libérer aux coutures avant mutation**

Créer dans `partyFlow.ts` un helper state-safe qui applique `releaseSeat` au héros sortant, puis l’appeler avant réordonnancement/retrait. Dans `moveParty`, libérer avant `partyPos`; dans `transitionTo`, libérer le party occupant avant `captureMutation`; dans `startCombat`, libérer participants avant le passage battle. Une scène sans assignment reste strictement identique par référence utile et ne crée pas de delta.

- [ ] **Step 6: Dériver toutes les poses visibles de `seatPoseOf`**

`MondeDeCampagne` calcule une fois `partySeatPose`; `partyToken.pos` devient l’ancre fractionnaire en rendu mais `partyPos` reste l’approche logique. `VolumetricWorld`, `tokenChrome`, caméra/focal, halos, picking et POV consomment cette pose ; le brouillard/pathfinding restent sur `partyPos`. Le rig reçoit `seated:true`, cap du slot, armes rangées, sans `mountId`.

- [ ] **Step 7: Lancer le GREEN interaction et rendu**

Run: `npx vitest run src/state/seating-interaction.test.ts src/state/seating-lifecycle.test.ts src/state/seating-coop.test.ts src/state/exploreNav.test.ts src/state/netOwnership.test.ts src/gameIso/builders/interactHalos.test.ts src/gameIso/stage/chrome-jeton.test.tsx src/gameIso/stage/seated-pose.test.tsx src/gameIso/stage/useStagePointer.test.tsx src/gameIso/pov/pov-volumique.test.tsx src/ui/SeatedLeaderActions.test.tsx src/ui/ExplorationDock.test.tsx src/ui/CampaignView.test.tsx`

Expected: PASS ; un seul corps, un seul gagnant coop, caméra et chrome sur l’ancre, logique sur l’approche, aucune propriété `mountId`.

- [ ] **Step 8: Commit de la tâche 5**

```powershell
git add -- 'src/state/seating-interaction.test.ts' 'src/state/seating-lifecycle.test.ts' 'src/state/seating-coop.test.ts' 'src/gameIso/stage/seated-pose.test.tsx' 'src/ui/SeatedLeaderActions.tsx' 'src/ui/SeatedLeaderActions.test.tsx' 'src/state/store.ts' 'src/state/netOwnership.ts' 'src/state/netOwnership.test.ts' 'src/state/partyFlow.ts' 'src/state/stateFields.ts' 'src/state/exploreNav.ts' 'src/state/exploreNav.test.ts' 'src/i18n/messages/fr.ts' 'src/gameIso/builders/interactHalos.ts' 'src/gameIso/builders/interactHalos.test.ts' 'src/gameIso/builders/tokenChrome.ts' 'src/gameIso/stage/chrome-jeton.test.tsx' 'src/gameIso/stage/VolumetricWorld.tsx' 'src/gameIso/stage/MondeDeCampagne.tsx' 'src/gameIso/stage/useStagePointer.ts' 'src/gameIso/stage/useStagePointer.test.tsx' 'src/gameIso/pov/pov-volumique.test.tsx' 'src/ui/CampaignView.tsx' 'src/ui/CampaignView.test.tsx' 'src/ui/ExplorationDock.tsx' 'src/ui/ExplorationDock.test.tsx'
git commit -m "feat(exploration): permet au meneur de s'asseoir"
```

### Task 6: Inspector, mutations d’éditeur et compatibilité `MapSpec`/ASCII

**Files:**
- Create: `src/ui/editor/SeatAssignmentsField.tsx`
- Create: `src/ui/editor/SeatAssignmentsField.test.tsx`
- Create: `src/state/mapSpec-seating.test.ts`
- Modify: `src/ui/editor/Inspector.tsx`
- Modify: `src/ui/editor/Inspector.test.tsx`
- Modify: `src/ui/editor/editorState.ts`
- Modify: `src/ui/editor/editorState.test.ts`
- Modify: `src/state/sceneEdit.ts`
- Modify: `src/state/sceneEdit.test.ts`
- Modify: `src/state/mapSpec.ts`
- Modify: `src/state/mapSpec.test.ts`
- Modify: `src/state/sceneToAscii.ts`
- Modify: `src/state/sceneToAscii.test.ts`
- Modify: `docs/map-authoring.md`

**Interfaces:**
- Consumes: `Scene.seatAssignments`, `pruneSeatAssignments`, `PropData.seatSlots`, `MapSpec.entities`, `MapSpec.bind` et primitives d’édition existantes.
- Produces: authoring id-only des occupants, pruning atomique lors de suppression/changement de ref, `MapSpec.seatAssignments?: SeatAssignments`, validation d’ids fixes, `sceneToAscii.notRestored` honnête.

- [ ] **Step 1: Écrire le RED editor/pruning**

```tsx
it('affiche les slots de la ref et écrit un occupant par id', async () => {
  renderInspector(sceneWithTableAndNpc());
  expect(screen.getByText('4 places')).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Place nord'), 'pnj-aubergiste');
  expect(lastScene().seatAssignments).toEqual({ 'table-1': { nord: { kind: 'entity', entityId: 'pnj-aubergiste' } } });
});

it('changer la ref ou supprimer le prop élague dans la même mutation', () => {
  expect(changeEntityRef(SEATED, 'table-1', 'tonneau').seatAssignments).toEqual({});
  expect(deleteSel(SEATED, { type: 'entity', id: 'table-1' }).seatAssignments).toEqual({});
});

it('déplacer un PNJ authoré assis libère son siège dans la même mutation', () => {
  const moved = moveSel(SEATED, { type: 'entity', id: 'pnj-aubergiste' }, { x: 7, y: 9 });
  expect(moved.entities.find((e) => e.id === 'pnj-aubergiste')?.pos).toEqual({ x: 7, y: 9 });
  expect(moved.seatAssignments).toEqual({});
});
```

- [ ] **Step 2: Écrire le RED `MapSpec` à ids fixes et export inverse**

```ts
it('construit le même meuble via entities et bind, mais assigne seulement des ids fixes', () => {
  const byBind = buildScene(specWithBind('M', { kind: 'prop', ref: 'table-murale-2-tabourets', facing: 'O' }));
  expect(byBind.entities.find((e) => e.ref === 'table-murale-2-tabourets')).toMatchObject({ kind: 'prop', facing: 'O' });
  expect(() => buildScene(specAssigningGeneratedBindId())).toThrow(/seatAssignments.*ids fixes/);
  expect(buildScene(specWithFixedEntitiesAndSeat()).seatAssignments).toEqual(FIXED_ASSIGNMENT);
});

it('annonce tout ce que l’export ne restaure pas', () => {
  expect(sceneToAscii(SEATED).notRestored).toEqual(expect.arrayContaining(['entities', 'bind', 'seatAssignments']));
  expect(sceneToAscii(SEATED).text).toContain('seatAssignments');
});
```

- [ ] **Step 3: Lancer le RED authoring/ASCII**

Run: `npx vitest run src/ui/editor/SeatAssignmentsField.test.tsx src/ui/editor/Inspector.test.tsx src/state/sceneEdit.test.ts src/state/mapSpec-seating.test.ts src/state/mapSpec.test.ts src/state/sceneToAscii.test.ts`

Expected: FAIL avec champ UI/type `MapSpec.seatAssignments` absents et export ne nommant pas `seatAssignments`.

- [ ] **Step 4: Implémenter l’Inspector id-only et le pruning atomique**

`SeatAssignmentsField` reçoit `scene`, `propId`, `onChange(scene)` ; il liste les slots dans l’ordre de `seatSlotsOf`, options par `SceneEntity.id` avec label seulement comme affichage, et héros uniquement si le document fournit un id de héros fixe. Le changement appelle `assignSeat`/`releaseSeat`; aucun champ texte libre. Les primitives `deleteSel`, changement de `ref`, suppression PNJ et `moveSel` d’un PNJ authoré assis passent la scène résultante à `pruneSeatAssignments` avant retour ; le déplacement écrit la nouvelle `pos` et libère l’assise atomiquement, jamais par correction silencieuse au prochain chargement.

- [ ] **Step 5: Étendre `MapSpec` et `sceneToAscii`**

```ts
export interface MapSpec {
  // champs existants
  seatAssignments?: SeatAssignments;
}
```

Dans `buildScene`, copier après `entities+heroStart+bind`, mais valider que chaque `propId` et tout `entityId` occupant figurent littéralement dans `spec.entities`; rejeter tout id seulement généré par `bind`. Puis appeler le validateur strict commun. Ajouter `seatAssignments` au tableau/texte `notRestored`, en gardant `entities` et `bind` présents.

- [ ] **Step 6: Lancer le GREEN authoring/ASCII**

Run: `npx vitest run src/ui/editor/SeatAssignmentsField.test.tsx src/ui/editor/Inspector.test.tsx src/ui/editor/editorState.test.ts src/state/sceneEdit.test.ts src/state/mapSpec-seating.test.ts src/state/mapSpec.test.ts src/state/sceneToAscii.test.ts src/state/validateScene.test.ts`

Expected: PASS ; meubles bindés identiques par ref/facing, assignments seulement à ids fixes, export honnête.

- [ ] **Step 7: Commit de la tâche 6**

```powershell
git add -- 'src/ui/editor/SeatAssignmentsField.tsx' 'src/ui/editor/SeatAssignmentsField.test.tsx' 'src/state/mapSpec-seating.test.ts' 'src/ui/editor/Inspector.tsx' 'src/ui/editor/Inspector.test.tsx' 'src/ui/editor/editorState.ts' 'src/ui/editor/editorState.test.ts' 'src/state/sceneEdit.ts' 'src/state/sceneEdit.test.ts' 'src/state/mapSpec.ts' 'src/state/mapSpec.test.ts' 'src/state/sceneToAscii.ts' 'src/state/sceneToAscii.test.ts' 'docs/map-authoring.md'
git commit -m "feat(editeur): authore les places assises et leur ASCII"
```

### Task 7: Placement exact dans `zone-S-z0`, preuves spatiales et recette réelle

**Files:**
- Create: `src/scenes/diligence/diligence-mobilier-spatial.test.ts`
- Modify: `src/scenes/diligence/diligence-projet.json`
- Modify: `src/scenes/diligence/diligence-projet.test.ts`
- Modify: `src/scenes/diligence/__snapshots__/diligence-projet.test.ts.snap`
- Modify: `docs/test-scenarios.md`
- Delete after successful execution: `docs/plans/2026-08-20-mobilier-volumique-assise-diligence.md`
- Delete after successful execution: `docs/plans/2026-08-20-mobilier-volumique-assise-diligence-implementation.md`

**Interfaces:**
- Consumes: cinq refs Task 3, dix-huit slots résolus Task 4, interaction/rendu Task 5, schéma éditable Task 6, `reachableCells`/`walkNeighbors`, tests de scène existants et harnais navigateur vivant.
- Produces: quinze ancres exactes dans `zone-S-z0`, topologie inchangée, 89 tuiles libres connectées, captures quatre rotations/top/POV et preuves de cycle de vie.

- [ ] **Step 1: Écrire le RED des ancres et du non-changement architectural**

```ts
const EXPECTED = [
  ['cheminee-interieure', 10, 8],
  ['comptoir-droit', 10, 24], ['comptoir-angle', 11, 24],
  ['comptoir-droit', 11, 23], ['comptoir-droit', 11, 22], ['comptoir-droit', 11, 21],
  ['comptoir-droit', 11, 20], ['comptoir-droit', 11, 19], ['comptoir-droit', 10, 19],
  ['table-ronde-4-tabourets', 10, 23], ['table-ronde-4-tabourets', 12, 14], ['table-ronde-4-tabourets', 10, 10],
  ['table-murale-2-tabourets', 13, 10], ['table-murale-2-tabourets', 13, 14], ['table-murale-2-tabourets', 13, 19],
] as const;

it('pose les quinze ancres sans toucher la topologie', () => {
  expect(furnitureAnchors(scene)).toEqual(EXPECTED);
  expect(scene.walls).toHaveLength(TOPOLOGY_BEFORE.walls);
  expect(edgeDigest(scene.walls!)).toBe(TOPOLOGY_BEFORE.edgeDigest);
  expect(scene.layers).toEqual(expectLayersTopology(TOPOLOGY_BEFORE));
  expect(scene.effectZones).toEqual(TOPOLOGY_BEFORE.effectZones);
});
```

Le digest témoin est calculé et copié depuis le commit précédant cette tâche, sur tuples `x,y,z,side,door,window,structure`; il ne doit jamais être régénéré après placement pour masquer une modification.

- [ ] **Step 2: Écrire le RED spatial complet**

Tester exactement : 15 ancres, 18 slots, `zone-S-z0`, ouvertures/rampe libres, 89 tuiles libres sur 104, une composante, approches distinctes/marchables/non bloquées, AABB des volumes sans intersection entre meubles/ouvertures, corps assis dans zone. Ajouter une sonde nominative sur table `(10,23)` contre `(10,24)` et `(11,23)`.

```ts
it('la table frontière et ses quatre corps tiennent contre le comptoir', () => {
  const table = furnitureAt(scene, 10, 23);
  const occupied = seatSlotsOf(scene, table.id).map((slot) => seatedBodyBounds(slot));
  expect(intersects(propBounds(table), propBounds(furnitureAt(scene, 10, 24)))).toBe(false);
  expect(intersects(propBounds(table), propBounds(furnitureAt(scene, 11, 23)))).toBe(false);
  expect(occupied.every((body) => insideZone(body, 'zone-S-z0'))).toBe(true);
});
```

- [ ] **Step 3: Lancer le RED de scène**

Run: `npx vitest run src/scenes/diligence/diligence-projet.test.ts src/scenes/diligence/diligence-mobilier-spatial.test.ts`

Expected: FAIL avec zéro des quinze ancres trouvées et compte de slots nul.

- [ ] **Step 4: Annoter le recalage avant placement puis écrire uniquement les quinze entités**

Avant l’édition JSON, lancer la scène sans mobilier et capturer la vue du dessus. Produire une copie d’annotation hors source montrant axes, double porte `(14,8,E)`–`(14,9,E)`, rampe `(14,23..25)`/`(13,25)` et cheminée cible `(10,8)`. Si les axes sont inversés ou miroir, arrêter cette tâche.

Ajouter quinze `SceneEntity` à `entities`, ids stables `diligence-salle-*`, `kind:'prop'`, positions exactes. Les trois tables murales portent `facing:'O'`; les autres caps sont choisis explicitement pour l’intention du tableau §9, jamais déduits du label. La cheminée reçoit `light` ou hérite de `PropData.light`; aucun mur/porte/fenêtre/terrain/zone n’est édité.

- [ ] **Step 5: Lancer le GREEN spatial et mettre à jour le snapshot**

Run: `npx vitest run src/scenes/diligence/diligence-projet.test.ts src/scenes/diligence/diligence-mobilier-spatial.test.ts -u`

Expected: PASS avec 15 ancres, 18 slots, 89 cases libres connectées et digest architectural inchangé.

- [ ] **Step 6: Lancer tous les gates mécaniques et documentaires**

Run: `npm run typecheck`

Expected: exit 0.

Run: `npm run docs:check`

Expected: exit 0.

Run: `npm test`

Expected: exit 0, suite complète verte.

Run: `npm run galleries`

Expected: exit 0 et galerie `props-volumiques` liée depuis le hub.

- [ ] **Step 7: Exécuter la recette navigateur réelle**

Run: `npm run dev -- --host 127.0.0.1`

Dans une autre session PowerShell :

```powershell
node scripts/qc/capture-jeu.mjs --scenes diligence --vues iso-rot0,iso-rot1,iso-rot2,iso-rot3,top --zoom 1 --out public/qc/diligence-mobilier
```

Le script ne capture que `iso-rot0..3` et `top`. Ouvrir ensuite la scène dans le navigateur réel, basculer manuellement en POV et prendre séparément les captures depuis l’allée, l’arrière-bar, devant la cheminée, devant une table ronde et devant une table murale. Vérifier par contrôles réels : quatre rotations au même zoom ; top final ; ces cinq vues POV manuelles ; meneur assis/relevé sur les deux familles ; PNJ authoré assis puis libéré par combat ; déplacement assis ; transition aller-retour ; save/reload ; changement de meneur puis composition. La console doit contenir zéro erreur et zéro avertissement nouveau. Refuser panneaux plats, clipping corps/plateau, tabouret dans mur, braises flottantes, caméra sur approche, ouverture occultée, rampe bloquée ou meuble absent à une rotation.

- [ ] **Step 8: Revue finale, suppression des plans exécutés et commit**

Faire une réfutation adversariale de la spec §1–§15, vérifier chaque critère d’acceptation et conserver les captures. Supprimer les deux plans datés seulement après tous les gates verts.

```powershell
git add -- 'src/scenes/diligence/diligence-mobilier-spatial.test.ts' 'src/scenes/diligence/diligence-projet.json' 'src/scenes/diligence/diligence-projet.test.ts' 'src/scenes/diligence/__snapshots__/diligence-projet.test.ts.snap' 'docs/test-scenarios.md' 'docs/plans/2026-08-20-mobilier-volumique-assise-diligence.md' 'docs/plans/2026-08-20-mobilier-volumique-assise-diligence-implementation.md'
git commit -m "feat(carte): meuble la salle principale de la Diligence"
```

## Auto-revue SELF

- [ ] **Couverture de la spec :** §1–3 → Tasks 1–3 ; §4 → Task 4 ; §5–6 → Tasks 4–5 ; §7 → Task 6 ; §8 → Task 3 ; §9 → Task 7 ; §10–13 → gates de chaque tâche et recette Task 7 ; §14–15 → pathspecs et suppression finale.
- [ ] **Hors périmètre :** scanner le diff pour `kind:'furniture'`, `mountId`, `riderId`, imports `state/** → gameIso/**`, comparaisons aux cinq refs dans renderer, création de GLTF/mesh direct, multi-token party et IA sociale ; le résultat attendu est vide.
- [ ] **Placeholders :** scanner le plan et le diff pour les marqueurs de travail différé interdits ; chaque étape d’implémentation contient une signature, un snippet, une commande ou un attendu vérifiable.
- [ ] **Cohérence des signatures :** `buildPropVolumes(ent, prop, groundHeightM)`, `seatSlotsOf`, `seatPoseOf`, `assignSeat`, `releaseSeat`, `pruneSeatAssignments` gardent exactement les signatures du bloc partagé dans les Tasks 1–7 ; toute invocation de `buildPropVolumes` fournit explicitement la hauteur métrique du sol.
- [ ] **Cohérence des pathspecs :** chaque fichier Create/Modify/Test de chaque tâche figure une fois dans son `git add --`; aucun fichier WIP extérieur n’est ajouté.
- [ ] **Chaîne de données générée :** Task 1 exécute `npm run gen` avant `schema-contract`, stage `src/data/schemas/_registry.generated.ts`, puis exécute `npm run docs:donnees` depuis `src/data/donnees.manifest.json` et stage les deux sources/sorties exactes ; aucune édition manuelle de `docs/donnees.md` n'est présentée comme source.
- [ ] **Vérité d'empreinte unique :** refaire le scan TS/TSX et le parcours JSON exhaustif de `SceneEntity.foot`; la table avant/après contient exactement les vingt-quatre instances (Arène 11 + Opéra 13), les sept meubles Opéra variants pointent `table-2x1`/`bureau-2x1`/`etabli-2x1`, `salon-d-table`/`salon-s-table` restent `table` 1×1, et aucune autre instance ne porte `foot`. Collision, LdV, vision, rendu et le contrat z de `z-separation.test.ts` dérivent tous de `PropData.foot`; `gameIso/catalog/decor.test.ts` est vert dès Task 1 et absent de Task 3.
- [ ] **Picking multi-lots et #1297 :** chaque face prop, y compris lorsque ses matériaux créent plusieurs plages répétant le même `entId`, résout cet id par `face.a/b/c`; toute face monde sans plage est ignorée et un acteur derrière un mur non-prop reste cliquable.
- [ ] **Surface responsive de relève :** `SeatedLeaderActions` ne crée aucune classe CSS, compose `.worldmap-btn[data-skin='tole']` dans `ExplorationDock`, garde nom accessible/focus clavier et prouve 360 px ainsi que `pointer: coarse` 44×44 px.
- [ ] **Preuve éditable/ASCII :** JSON réel inchangé hors `entities`/`seatAssignments`, `MapSpec.bind` prouvé séparément des assignments à ids fixes, `sceneToAscii` annonce `entities`, `bind`, `seatAssignments` non restaurés.
- [ ] **Preuve spatiale :** 15 ancres exactes, 18 slots, 89 cases libres, une composante, digest murs/ouvertures/terrains/zones inchangé, sonde frontière `(10,23)` verte.
