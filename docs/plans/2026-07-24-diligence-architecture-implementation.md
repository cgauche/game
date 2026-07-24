# La Diligence Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Représenter fidèlement l'architecture de `art-ref/page012_img3.png` avec des corps, façades et sections de toiture explicites, puis séparer coupe intérieure et occlusion caméra locale.

**Architecture:** `Scene` et `MapSpec` portent des corps architecturaux authorés et liés à des ids stables de zones intérieures. Les builders produisent des panneaux de façade et des pans de toiture indépendants, projetés et cullés avant génération SVG. Les anciennes entrées `Roof` restent compatibles pour les autres scènes, mais La Diligence n'utilise plus `Roof.groupId`.

**Tech Stack:** TypeScript strict, React, SVG isométrique, Zustand, Vitest, Resvg/CDP pour la recette.

## Global Constraints

- Référence visuelle canonique : `art-ref/page012_img3.png`.
- `MapSpec` reste l'unique chemin d'authoring de La Diligence.
- Aucune branche par id ou label de scène dans le moteur.
- Les ids, jamais les labels, pilotent relations et logique.
- `Scene.layers` et `Scene.walls` restent les seules vérités de collision, mouvement et ligne de vue.
- Les façades et toitures n'infèrent jamais leur géométrie depuis les rectangles des pièces.
- L'éditeur doit permettre de reproduire toute donnée ajoutée à `MapSpec`.
- La coupe intérieure et l'occlusion caméra sont deux fonctions indépendantes.
- Aucun objet SVG monolithique ne reste rendu parce qu'une seule de ses cellules est visible.
- Les noms de zones ne sont jamais peints sur l'environnement en vue joueur.

---

### Task 1: Schéma architectural et ids stables de zones

**Files:**
- Modify: `src/state/scene.ts`
- Modify: `src/state/mapSpec.ts`
- Modify: `src/state/mapSpec.test.ts`
- Modify: `src/state/validateScene.ts`
- Modify: `src/state/validateScene.test.ts`

**Interfaces:**
- Produces: `ArchitectureBody`, `ArchitectureStorey`, `ArchitecturePart`, `FacadeSection`, `FacadeFeature`, `RoofSection`.
- Produces: `Scene.architecture?: ArchitectureBody[]`.
- Produces: `ZoneLegendEntry.id?: string`, compilé vers `SceneEffectZone.id`.

- [ ] **Step 1: Écrire les tests rouges de compilation et de validation**

```ts
it('compile une architecture par ids stables et copie profondément ses parties', () => {
  const spec = {
    id: 'architecture', nom: 'Architecture', size: [8, 8] as [number, number],
    architecture: [{
      id: 'corps',
      style: 'maison',
      storeys: [{ id: 'corps-z0', z: 0, parts: [{ id: 'nef', foot: { x: 1, y: 1, w: 4, h: 3 } }], roomZoneIds: ['salle'] }],
      facades: [{ id: 'facade-sud', z: 0, edges: [{ x: 1, y: 3, side: 'S' as const }], appearance: 'mur-a-ossature-en-bois' }],
      roofs: [{ id: 'toit-nef', z: 0, foot: { x: 1, y: 1, w: 4, h: 3 }, profile: 'gable' as const, ridge: 'x' as const, eaveHeightM: 3, pitch: 0.75, material: 'tuile', roomZoneIds: ['salle'] }],
    }],
    zoneMap: { z0: ['........', '.SSSS...', '.SSSS...', '.SSSS...', '........', '........', '........', '........'] },
    zoneLegend: { S: { id: 'salle', label: 'Salle', presentation: 'interior' as const } },
  };
  const scene = buildScene(spec);
  expect(scene.effectZones?.[0]?.id).toBe('salle');
  expect(scene.architecture?.[0]?.roofs[0]?.id).toBe('toit-nef');
  scene.architecture![0].storeys[0].parts[0].foot.x = 7;
  expect(spec.architecture[0].storeys[0].parts[0].foot.x).toBe(1);
});

it.each([
  ['zone inconnue', { roomZoneIds: ['absente'] }],
  ['section hors carte', { foot: { x: 7, y: 7, w: 3, h: 3 } }],
])('refuse %s', (_label, patch) => {
  expect(() => validateScene(sceneWithArchitecturePatch(patch))).toThrow();
});
```

- [ ] **Step 2: Vérifier le RED**

Run:

```powershell
npx vitest run src/state/mapSpec.test.ts src/state/validateScene.test.ts --reporter=dot
```

Expected: FAIL sur les types/champs architecturaux absents.

- [ ] **Step 3: Ajouter les types sans cycle `scene.ts` → `sceneEdit.ts`**

```ts
export interface ArchitectureRect { x: number; y: number; w: number; h: number }
export interface ArchitectureEdgeRef { x: number; y: number; side: WallSide; z?: number }
export interface ArchitecturePart { id: string; foot: ArchitectureRect }
export interface ArchitectureStorey {
  id: string;
  z: number;
  parts: ArchitecturePart[];
  roomZoneIds: string[];
}
export interface FacadeFeature {
  id: string;
  kind: 'gable' | 'stone-entry' | 'chimney' | 'sign' | 'window-band';
  edge: ArchitectureEdgeRef;
  offset?: number;
  width?: number;
  appearance?: string;
}
export interface FacadeSection {
  id: string;
  z: number;
  edges: ArchitectureEdgeRef[];
  appearance: string;
  roomZoneIds?: string[];
  features?: FacadeFeature[];
}
export interface RoofSection {
  id: string;
  z: number;
  foot: ArchitectureRect;
  profile: 'gable' | 'hip' | 'shed' | 'flat';
  ridge: 'x' | 'y';
  eaveHeightM: number;
  pitch: number;
  material: string;
  roomZoneIds: string[];
}
export interface ArchitectureBody {
  id: string;
  label?: string;
  style: string;
  storeys: ArchitectureStorey[];
  facades: FacadeSection[];
  roofs: RoofSection[];
}
```

- [ ] **Step 4: Compiler `MapSpec.architecture` et les ids de zones**

`zoneLegend` accepte `{ id?: string; label; presentation? }`. `buildScene` utilise
`entry.id ?? \`zone-${char}-z${z}\`` et échoue sur un id dupliqué. La copie des
corps descend jusqu'aux `foot`, `edges`, `features` et tableaux `roomZoneIds`.

- [ ] **Step 5: Valider les références**

`validateScene` vérifie :

- ids uniques à chaque niveau ;
- emprises positives et bornées ;
- arêtes de façade canoniques et bornées ;
- matériaux/profils/pentes valides ;
- chaque `roomZoneId` résout une zone descriptive `presentation:'interior'` du même étage.

- [ ] **Step 6: Vérifier le GREEN et committer**

```powershell
npx vitest run src/state/mapSpec.test.ts src/state/validateScene.test.ts --reporter=dot
git add src/state/scene.ts src/state/mapSpec.ts src/state/mapSpec.test.ts src/state/validateScene.ts src/state/validateScene.test.ts
git commit -m "feat(map): ajoute les corps architecturaux"
```

---

### Task 2: Mutations pures et sélection éditeur

**Files:**
- Modify: `src/state/sceneEdit.ts`
- Modify: `src/ui/editor/editorState.ts`
- Modify: `src/ui/editor/editorState.test.ts`

**Interfaces:**
- Consumes: types Task 1.
- Produces: `addArchitectureBody`, `addArchitecturePart`, `addFacadeSection`, `addRoofSection`.
- Produces: sélections `architecturePart`, `facadeSection`, `roofSection`.

- [ ] **Step 1: Écrire les tests rouges de mutation**

```ts
it('déplace et redimensionne une part architecturale par ids stables', () => {
  const selected: Sel = { type: 'architecturePart', bodyId: 'corps', storeyId: 'z0', id: 'aile' };
  const moved = moveSel(scene, selected, { x: 3, y: 4 });
  const resized = resizeSel(moved, selected, { x: 8, y: 9 });
  expect(architecturePart(resized, selected)?.foot).toEqual({ x: 3, y: 4, w: 6, h: 6 });
});

it('supprime une section de toit sans supprimer le corps', () => {
  const next = deleteSel(scene, { type: 'roofSection', bodyId: 'corps', id: 'toit-nef' });
  expect(next.architecture?.[0]?.roofs).toEqual([]);
  expect(next.architecture?.[0]?.id).toBe('corps');
});
```

- [ ] **Step 2: Vérifier le RED**

```powershell
npx vitest run src/ui/editor/editorState.test.ts --reporter=dot
```

- [ ] **Step 3: Ajouter les mutations Node-safe**

Chaque mutation retourne une nouvelle `Scene`, conserve les ids stables et
clamp les rectangles aux dimensions. Aucun helper n'importe `ui/`.

- [ ] **Step 4: Étendre `Sel`, `hitAt`, `selRect`, `moveSel`, `resizeSel`, `deleteSel`**

```ts
type ArchitectureSel =
  | { type: 'architecturePart'; bodyId: string; storeyId: string; id: string }
  | { type: 'facadeSection'; bodyId: string; id: string }
  | { type: 'roofSection'; bodyId: string; id: string };
```

La priorité de hit reste entité → logique → architecture. Une section de toit
est sélectionnée par son `foot`; une façade par son arête.

- [ ] **Step 5: Vérifier et committer**

```powershell
npx vitest run src/ui/editor/editorState.test.ts --reporter=dot
git add src/state/sceneEdit.ts src/ui/editor/editorState.ts src/ui/editor/editorState.test.ts
git commit -m "feat(editor): édite les volumes architecturaux"
```

---

### Task 3: Sections de toiture intentionnelles

**Files:**
- Modify: `src/gameIso/builders/types.ts`
- Modify: `src/gameIso/builders/roofs.ts`
- Modify: `src/gameIso/builders/roofs.test.ts`
- Modify: `src/gameIso/backends/affineRoofs.ts`
- Modify: `src/gameIso/backends/affineRoofs.test.ts`

**Interfaces:**
- Consumes: `ArchitectureBody.roofs`.
- Produces: un `RoofEl` par pan avec `bodyId`, `sectionId`, `panId`, `roomZoneIds`, bornes exactes.
- Keeps: `buildRoofs` compatible avec `Scene.roofs` legacy.

- [ ] **Step 1: Écrire les tests rouges profils/axes**

```ts
it.each(['x', 'y'] as const)('respecte le faîtage authoré %s', (ridge) => {
  const [roof] = buildRoofs(sceneWithRoofSection({ ridge, profile: 'gable' }));
  expect(new Set(roof.pans.map((pan) => pan.ridge))).toEqual(new Set([ridge]));
});

it('deux sections jointives restent deux volumes intentionnels', () => {
  const out = buildRoofs(sceneWithTwoRoofSections());
  expect(out.map((r) => r.sectionId)).toEqual(['aile-ouest', 'pignon-central']);
});
```

- [ ] **Step 2: Vérifier le RED**

```powershell
npx vitest run src/gameIso/builders/roofs.test.ts src/gameIso/backends/affineRoofs.test.ts --reporter=dot
```

- [ ] **Step 3: Étendre `roofPans` par paramètres explicites**

```ts
interface RoofShapeSpec {
  profile: RoofSection['profile'];
  ridge: RoofSection['ridge'];
  pitch: number;
  eaveHeightM: number;
}
```

Le calcul utilise `ridge` et `pitch`; il ne choisit plus l'axe depuis la boîte.
Les avant-toits emploient le bord local cellule occupée → voisine absente.

- [ ] **Step 4: Produire une granularité pan**

Chaque pan reçoit ses points, sa profondeur, sa boîte projetable et une fabrique
SVG indépendante. Les lignes décoratives appartiennent au pan correspondant.

- [ ] **Step 5: Conserver le legacy**

Chaque ancien `Roof` est normalisé en section à une emprise avec les valeurs
historiques. `groupId` n'est jamais utilisé par la nouvelle architecture et sera
retiré lorsque La Diligence aura migré.

- [ ] **Step 6: Vérifier et committer**

```powershell
npx vitest run src/gameIso/builders/roofs.test.ts src/gameIso/backends/affineRoofs.test.ts --reporter=dot
git add src/gameIso/builders/types.ts src/gameIso/builders/roofs.ts src/gameIso/builders/roofs.test.ts src/gameIso/backends/affineRoofs.ts src/gameIso/backends/affineRoofs.test.ts
git commit -m "feat(rendu): rend les sections de toiture authorées"
```

---

### Task 4: Façades authorées et éléments d'élévation

**Files:**
- Modify: `src/gameIso/builders/walls.ts`
- Modify: `src/gameIso/builders/walls.test.ts`
- Modify: `src/gameIso/backends/affineWalls.ts`
- Modify: `src/gameIso/backends/affineWalls.test.ts`
- Modify: `src/gameIso/builders/props.ts`
- Modify: `src/gameIso/builders/props.test.ts`
- Modify: `src/gameIso/catalog/types.ts`
- Create: `src/gameIso/catalog/facades/index.ts`
- Create: `src/gameIso/catalog/facades/defs/auberge-relais-imperiale.ts`

**Interfaces:**
- Consumes: `FacadeSection.edges/features`.
- Produces: `WallEl.bodyId`, `facadeSectionId`, `roomZoneIds`, apparence par arête.
- Produces: registre générique de `FacadeFeature.kind`, sans connaissance de scène.

- [ ] **Step 1: Écrire les tests rouges**

```ts
it('l’apparence de façade enrichit le mur physique sans le remplacer', () => {
  const [wall] = buildWalls(sceneWithFacade());
  expect(wall.appearance.id).toBe('auberge-relais-imperiale');
  expect(sceneWithFacade().walls?.[0]?.state).toBe('wall');
});

it('émet chaque feature une fois par section', () => {
  expect(buildProps(sceneWithGableAndChimneys()).filter((p) => p.architectureFeatureId).map((p) => p.architectureFeatureId))
    .toEqual(['entree-centrale', 'pignon-central', 'cheminee-ouest', 'cheminee-est']);
});
```

- [ ] **Step 2: Vérifier le RED**

```powershell
npx vitest run src/gameIso/builders/walls.test.ts src/gameIso/backends/affineWalls.test.ts src/gameIso/builders/props.test.ts --reporter=dot
```

- [ ] **Step 3: Indexer les façades par arête canonique**

`buildWalls` enrichit le `WallEl` déjà issu de `WallSeg`; il ne crée aucune
collision. Les features sont des données génériques ancrées sur une arête.

- [ ] **Step 4: Ajouter l'apparence générique nécessaire à l'élévation source**

La def partage matériaux et couleurs avec `structureAppearance`. Elle couvre
colombage, bande de fenêtres, entrée maçonnée et pignon sans branche par scène.

- [ ] **Step 5: Vérifier et committer**

```powershell
npx vitest run src/gameIso/builders/walls.test.ts src/gameIso/backends/affineWalls.test.ts src/gameIso/builders/props.test.ts --reporter=dot
git add src/gameIso/builders src/gameIso/backends src/gameIso/catalog
git commit -m "feat(rendu): ajoute les façades architecturales"
```

---

### Task 5: Coupe intérieure relationnelle

**Files:**
- Modify: `src/gameIso/stage/roomFocus.ts`
- Modify: `src/gameIso/stage/roomFocus.test.ts`
- Create: `src/gameIso/stage/architectureVisibility.ts`
- Create: `src/gameIso/stage/architectureVisibility.test.ts`
- Modify: `src/gameIso/IsoStage.tsx`

**Interfaces:**
- Produces: `occupiedInteriorZoneIds(scene, heroPositions)`.
- Produces: `cutawayForSection(section, occupied)`.
- Produces: `frontFacadeCutaway(panel, occupied, dims)`.

- [ ] **Step 1: Écrire les tests rouges**

```ts
it('masque seulement les sections liées à la pièce occupée', () => {
  const occupied = new Set(['salle']);
  expect(cutawayForSection({ roomZoneIds: ['salle'] }, occupied)).toBe('hidden');
  expect(cutawayForSection({ roomZoneIds: ['cuisine'] }, occupied)).toBe('visible');
});

it('réunit les pièces occupées par plusieurs héros', () => {
  expect(occupiedInteriorZoneIds(scene, [{ x: 2, y: 2, z: 0 }, { x: 8, y: 2, z: 0 }]))
    .toEqual(new Set(['salle', 'cuisine']));
});
```

- [ ] **Step 2: Vérifier le RED**

```powershell
npx vitest run src/gameIso/stage/roomFocus.test.ts src/gameIso/stage/architectureVisibility.test.ts --reporter=dot
```

- [ ] **Step 3: Implémenter les fonctions pures**

La coupe ne reçoit aucune donnée caméra. Les panneaux de façade ne s'ouvrent que
s'ils sont liés à une zone occupée et frontaux selon `depth`/`screenBasis`.

- [ ] **Step 4: Brancher `IsoStage`**

`IsoStage` calcule une fois l'ensemble des ids occupés et le transmet aux
builders/stage. `roomFocusAt` reste un helper d'UI mais n'est plus la vérité de
toiture.

- [ ] **Step 5: Vérifier et committer**

```powershell
npx vitest run src/gameIso/stage/roomFocus.test.ts src/gameIso/stage/architectureVisibility.test.ts --reporter=dot
git add src/gameIso/stage src/gameIso/IsoStage.tsx
git commit -m "feat(exploration): lie la coupe aux pièces"
```

---

### Task 6: Occlusion caméra locale et SVG paresseux

**Files:**
- Modify: `src/geometry/iso.ts`
- Modify: `src/geometry/iso.test.ts`
- Modify: `src/gameIso/stage/objs.ts`
- Modify: `src/gameIso/stage/layers.tsx`
- Modify: `src/gameIso/stage/CulledScene.tsx`
- Modify: `src/gameIso/stage/CulledScene.test.tsx`

**Interfaces:**
- Produces: `projectOccluder(panel, dims)`.
- Produces: `occludesActor(occluder, actorCapsule)`.
- Produces: `visibilityOf(cutaway, cameraOcclusion)`.
- Requires: `StageObj.acc` appelé seulement après culling.

- [ ] **Step 1: Écrire les tests rouges des trois conditions**

```ts
it.each([
  ['derrière', { front: false, overlap: true, vertical: true }],
  ['sans recouvrement', { front: true, overlap: false, vertical: true }],
  ['hors hauteur', { front: true, overlap: true, vertical: false }],
])('ne masque pas un panneau %s', (_label, fixture) => {
  expect(occludesActor(makeOccluder(fixture), ACTOR_CAPSULE)).toBe(false);
});

it('atténue uniquement le pan réellement occultant', () => {
  expect(renderVisibility([OCCLUDING_PAN, SIBLING_PAN])).toEqual([0.18, 1]);
});

it('n’appelle pas le SVG d’un pan hors champ', () => {
  const acc = vi.fn(() => '<path/>');
  render(<CulledScene objects={[offscreenPan(acc)]} {...VIEW} />);
  expect(acc).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Vérifier le RED**

```powershell
npx vitest run src/geometry/iso.test.ts src/gameIso/stage/CulledScene.test.tsx --reporter=dot
```

- [ ] **Step 3: Projeter polygones et capsule acteur**

Le test requiert simultanément profondeur avant, intersection 2D et recouvrement
vertical. Les rotations utilisent uniquement `rotTile`, `screenBasis`, `depth`
et `tileCenter`.

- [ ] **Step 4: Séparer les décisions**

```ts
export function visibilityOf(cutaway: boolean, cameraOcclusion: boolean) {
  if (cutaway) return { hidden: true, opacity: 0 };
  return { hidden: false, opacity: cameraOcclusion ? 0.18 : 1 };
}
```

Aucun `cutawayActive` global. Un pan frère reste opaque.

- [ ] **Step 5: Culler avant `acc()`**

`StageObj` porte des bornes écran serrées par panneau. `CulledScene` filtre,
calcule la visibilité, puis seulement appelle le thunk SVG.

- [ ] **Step 6: Vérifier les quatre rotations et committer**

```powershell
npx vitest run src/geometry/iso.test.ts src/gameIso/stage/CulledScene.test.tsx --reporter=dot
git add src/geometry/iso.ts src/geometry/iso.test.ts src/gameIso/stage
git commit -m "feat(camera): localise l'occlusion architecturale"
```

---

### Task 7: UI d'authoring architecturale

**Files:**
- Modify: `src/ui/editor/Palette.tsx`
- Modify: `src/ui/editor/EditorCanvas.tsx`
- Modify: `src/ui/editor/Inspector.tsx`
- Modify: `src/ui/editor/Editor.tsx`
- Modify: `src/ui/editor/Editor.test.tsx`
- Modify: `src/ui/editor/editorState.test.ts`

**Interfaces:**
- Consumes: mutations/sélections Task 2.
- Produces: création de corps, partie, façade et toit; édition des profils et liaisons de zones.

- [ ] **Step 1: Écrire le test rouge d'un flux d'authoring**

```ts
it('crée un corps, une section de toit et la lie à une pièce', async () => {
  render(<Editor initialScene={sceneWithInteriorZone('salle')} />);
  await user.click(screen.getByRole('button', { name: 'Architecture' }));
  await user.click(screen.getByRole('button', { name: 'Nouveau corps' }));
  await user.click(screen.getByRole('button', { name: 'Section de toiture' }));
  await user.selectOptions(screen.getByLabelText('Pièces révélées'), ['salle']);
  expect(savedScene().architecture?.[0]?.roofs[0]?.roomZoneIds).toEqual(['salle']);
});
```

- [ ] **Step 2: Vérifier le RED**

```powershell
npx vitest run src/ui/editor/Editor.test.tsx src/ui/editor/editorState.test.ts --reporter=dot
```

- [ ] **Step 3: Étendre palette, canvas et inspecteur**

L'inspecteur utilise des sections repliables :

- Corps ;
- Étage et parties ;
- Façades et features ;
- Toitures ;
- Pièces révélées.

Les options utilisent ids en valeur et labels uniquement en affichage.

- [ ] **Step 4: Vérifier responsive et committer**

```powershell
npx vitest run src/ui/editor/Editor.test.tsx src/ui/editor/editorState.test.ts --reporter=dot
git add src/ui/editor
git commit -m "feat(editor): expose l'architecture des bâtiments"
```

---

### Task 7A: Circulations, garde-corps et jonctions structurelles

**Files principaux :**
- Modify: `src/state/scene.ts`
- Modify: `src/state/mapSpec.ts`
- Modify: `src/state/mapSpec.test.ts`
- Modify: `src/state/validateScene.ts`
- Modify: `src/state/sceneEdit.ts`
- Modify: `src/gameIso/builders/types.ts`
- Modify: `src/gameIso/builders/walls.ts`
- Modify: `src/gameIso/builders/walls.test.ts`
- Modify: `src/gameIso/backends/affineWalls.ts`
- Modify: `src/gameIso/backends/affineWalls.test.ts`

**Contrat :**
- `applyStairs` conserve sa rampe de hauteurs, sa trémie et sa connectivité
  `surfaceLink`, mais n'émet plus une `SceneEntity prop` par marche ;
- les circulations et protections d'arête sont des données structurelles par
  ids stables, éditables, projetées depuis la même topologie que `WallSeg` ;
- `buildWalls` construit un graphe de sommets et classe chaque jonction :
  extrémité, segment, angle, T, croisement, porte et rupture de hauteur ;
- `crownFaces` devient la primitive commune des rambardes, parapets et créneaux ;
- `Scene.layers`/relief et `Scene.walls` restent les seules vérités de
  déplacement, collision et ligne de vue.

**Tests de sortie :**
- un escalier structurel relie visuellement et mécaniquement deux couches sans
  `PropEl` ;
- une rambarde/crénelage partage la même arête et les mêmes caps que le rempart ;
- chaque motif de jonction tourne correctement dans les quatre orientations ;
- aucune double face, fente noire ou cap flottant aux angles/T/portes.

---

### Task 7B: Lisibilité des accès entre pièces

**Files principaux :**
- Create: `src/state/roomPortals.ts`
- Create: `src/state/roomPortals.test.ts`
- Modify: `src/state/exploreNav.ts`
- Modify: `src/gameIso/stage/DoorOverlays.tsx`
- Modify: `src/gameIso/stage/MoveOverlays.tsx`
- Modify: `src/gameIso/stage/useHoverTargeting.ts`
- Modify: `src/gameIso/stage/useStagePointer.ts`
- Modify: `src/gameIso/IsoStage.tsx`

**Contrat :**
- le graphe pièce → portail → pièce est dérivé des deux cellules adjacentes à
  chaque `WallSeg.door`/passage, des zones descriptives et de l'étage ; aucune
  nouvelle vérité parallèle n'est persistée ;
- l'état utilise `doorIsOpen`, `structureIsDown`, la walkability et les ids de
  zones, jamais leurs labels ;
- depuis la pièce occupée, les portails atteignables sont lisibles à distance
  par un traitement local du seuil ; `DoorOverlays` n'est plus limité à une case ;
- `exploreMoveDest` reste la source unique du chemin pour survol et clic ;
- au survol/clic, le seuil, la destination et le chemin effectif sont
  prévisualisés avant engagement ; aucune ligne permanente.

**Tests de sortie :**
- une porte vers une pièce voisine est identifiable depuis le centre de la salle ;
- portes fermées, ouvertes, verrouillées et passages sans vantail ont des états
  distincts mais sobres ;
- un clic ambigu n'envoie pas le groupe dehors : destination/portail sont
  confirmés visuellement avant le mouvement ;
- aucun clignotement ni retour arrière au franchissement du seuil.

---

### Task 8: Migration fidèle de La Diligence

**Files:**
- Modify: `src/scenes/diligence/floorplan.ts`
- Modify: `src/scenes/diligence/floorplan.test.ts`
- Modify: `src/scenes/diligence/furnished.ts`
- Modify: `scripts/qc/render-diligence.mts`
- Modify: `docs/map-authoring.md`
- Delete from final schema usage: `Roof.groupId` and `MapSpec.roofs` bridge if no remaining consumer requires them.

**Interfaces:**
- Consumes: architecture Tasks 1-7B.
- Produces: `DILIGENCE_ARCHITECTURE`.
- Source: `art-ref/page012_img3.png`.

- [ ] **Step 1: Écrire les goldens rouges**

```ts
it('auteure des corps et sections, pas les 23 rectangles de pièces', () => {
  const scene = buildDiligenceFloorplan();
  expect(scene.architecture?.map((body) => body.id)).toEqual([
    'batiment-principal', 'portier', 'dependances-est', 'dependances-sud',
  ]);
  expect(scene.roofs).toBeUndefined();
});

it('relie chaque pièce intérieure à au moins une section ouvrable', () => {
  const scene = buildDiligenceFloorplan();
  const linked = new Set(scene.architecture?.flatMap((b) => [
    ...b.roofs.flatMap((r) => r.roomZoneIds),
    ...b.facades.flatMap((f) => f.roomZoneIds ?? []),
  ]));
  expect(interiorZoneIds(scene).every((id) => linked.has(id))).toBe(true);
});
```

- [ ] **Step 2: Vérifier le RED**

```powershell
npx vitest run src/scenes/diligence/floorplan.test.ts --reporter=dot
```

- [ ] **Step 3: Authorer depuis la planche**

Conserver les grilles z0/z1 sauf réfutation de superposition. Authorer :

- bâtiment principal à colombages ;
- pignon et entrée maçonnée centraux de l'élévation ;
- portier ;
- dépendances orientales et méridionales ;
- sections de toiture par axe réel ;
- cheminées et ouvertures visibles ;
- mur d'enceinte hors architecture des bâtiments.

- [ ] **Step 4: Étendre la QC**

`render-diligence.mts` produit :

- source ;
- deux plans top-down ;
- quatre rotations extérieures avec architecture ;
- quatre vues intérieures témoins ;
- compte nœuds/markup/appels SVG.

- [ ] **Step 5: Mettre à jour l'authoring vivant et committer**

```powershell
npx vitest run src/scenes/diligence/floorplan.test.ts src/state/mapSpec.test.ts --reporter=dot
npx tsx scripts/qc/render-diligence.mts
npm run docs:check
git add src/scenes/diligence scripts/qc/render-diligence.mts docs/map-authoring.md src/state/scene.ts src/state/mapSpec.ts
git commit -m "feat(scene): reconstruit l'architecture de La Diligence"
```

---

### Task 9: Recette joueur et portes de sortie

**Files:**
- Modify: `src/scenes/test-scenarios/diligence.ts`
- Modify: `docs/test-scenarios.md`

**Interfaces:**
- Validates: source, quatre rotations, entrée réelle, intérieur, sortie, déplacement.

- [ ] **Step 1: Lancer les gardes mécaniques**

```powershell
npx vitest run src/state/mapSpec.test.ts src/state/validateScene.test.ts src/ui/editor/editorState.test.ts src/gameIso/builders/roofs.test.ts src/gameIso/builders/walls.test.ts src/gameIso/stage/architectureVisibility.test.ts src/gameIso/stage/CulledScene.test.tsx src/scenes/diligence/floorplan.test.ts --reporter=dot
npm run typecheck
```

Expected: toutes les suites du périmètre vertes; aucun nouvel écart TypeScript.

- [ ] **Step 2: Recette navigateur 1600 × 900**

Scénario :

1. charger `diligence` ;
2. vérifier la façade et le toit dehors aux rotations 0, 1, 2, 3 ;
3. cliquer une porte du bâtiment principal ;
4. vérifier que le chemin annoncé finit dans la pièce choisie ;
5. vérifier la coupe de cette seule pièce ;
6. changer de pièce puis ressortir ;
7. contrôler `window.__wfrp.errors` et la console.

- [ ] **Step 3: Mesurer la cadence**

Capturer pour chaque rotation :

- nombre de panneaux visibles ;
- nombre d'appels de thunk SVG ;
- nœuds et caractères du SVG de scène ;
- durée de 20 rotations et d'un trajet entrée → salle → cour.

Aucune régression ne peut être masquée par une baisse du seul nombre d'objets.

- [ ] **Step 4: Faire juger source ↔ rendu**

Un juge vision compare `art-ref/page012_img3.png`, la QC et les captures joueur.
Bloqueurs : silhouette méconnaissable, façade inversée, toit qui remplit l'écran,
cutaway global, pièce adjacente révélée, interaction illisible.

- [ ] **Step 5: Lancer la suite complète**

```powershell
npx vitest run --reporter=dot
npm run typecheck
npm run docs:check
git diff --check
```

- [ ] **Step 6: Commit d'ajustements et push**

```powershell
git add src/geometry src/gameIso src/scenes/diligence src/scenes/test-scenarios/diligence.ts src/state src/ui/editor scripts/qc/render-diligence.mts docs/map-authoring.md docs/test-scenarios.md
git commit -m "fix(scene): finalise la lisibilité de La Diligence"
git push origin main
```
