# La Diligence — Palier A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Améliorer immédiatement La Diligence en personnalisant sa scène avec les terrains, murs, façades et ouvertures déjà disponibles, sans créer de code applicatif ni modifier son plan.

**Architecture:** Ce palier ne change que le paquet de scène et ses tests. Il commence par figer la topologie dans un snapshot mécanique, puis applique des choix d’apparence déjà compris par le schéma : terrains existants, marqueurs de fenêtres et architecture de façade existante. Une recette réelle aux quatre rotations décide ensuite si un palier B de bibliothèque est nécessaire.

**Tech Stack:** JSON de scène éditable, TypeScript/Vitest, Vite, rendu volumique WebGL, script QC CDP existant.

**Spec:** `docs/plans/2026-08-14-diligence-peau-architecturale-design.md`

## Global Constraints

- Priorité utilisateur : éditer la carte avec l’existant avant toute nouvelle définition de bibliothèque ; modifier le code applicatif en dernier recours.
- Ne déplacer, ajouter ou supprimer aucune arête de mur ou de porte.
- Ne modifier ni dimensions, ni relief, ni escaliers, ni zones, ni entités, ni points d’entrée.
- Les fenêtres peuvent être ajoutées, retirées et déplacées.
- Un terrain peut changer uniquement pour un terrain existant de même marchabilité et sans changement de hauteur.
- Aucun meuble, objet intérieur ou PNJ dans ce palier.
- Aucun choix par label : toute affectation de zone utilise son id stable.
- Ne toucher qu’aux fichiers listés dans chaque tâche ; le worktree contient du WIP non lié à préserver.
- La scène reste éditable dans l’éditeur et aucun renderer ne reçoit de branche spéciale La Diligence.

---

### Task 1: Figer la topologie avant toute retouche

**Files:**
- Modify: `src/scenes/diligence/diligence-projet.test.ts`
- Create: `src/scenes/diligence/__snapshots__/diligence-projet.test.ts.snap`

**Interfaces:**
- Consumes: `diligenceCampaign.scenes[0]`, `sceneZoneTiles`, `isWalkable`, `heightAt`.
- Produces: un snapshot `plan sanctuarisé hors apparence` qui ignore seulement les ids de terrain et les booléens `window`.

- [ ] **Step 1: Ajouter une sérialisation déterministe de la topologie**

Ajouter sous la constante `start` :

```ts
function planSanctuarise(on: Scene) {
  const cells = on.layers.flatMap((layer) => {
    const z = layer.z;
    const out: { x: number; y: number; z: number; walkable: boolean; height: number }[] = [];
    for (let y = 0; y < on.dimensions.h; y++)
      for (let x = 0; x < on.dimensions.w; x++)
        out.push({ x, y, z, walkable: isWalkable(on, x, y, z), height: heightAt(on, x, y, z) });
    return out;
  });
  const walls = (on.walls ?? []).map(({ window: _window, ...wall }) => wall)
    .sort((a, b) => `${a.z ?? 0}:${a.y}:${a.x}:${a.side}`.localeCompare(`${b.z ?? 0}:${b.y}:${b.x}:${b.side}`));
  const zones = (on.effectZones ?? []).map((zone) => ({
    id: zone.id,
    z: zone.z ?? 0,
    presentation: zone.presentation ?? null,
    area: zone.area,
    tiles: sceneZoneTiles(zone).map((p) => [p.x, p.y, p.z ?? zone.z ?? 0]).sort(),
  })).sort((a, b) => a.id.localeCompare(b.id));
  const entities = on.entities.map((entity) => ({
    id: entity.id,
    kind: entity.kind,
    pos: entity.pos,
    z: entity.z ?? 0,
  })).sort((a, b) => a.id.localeCompare(b.id));
  return { dimensions: on.dimensions, cells, walls, zones, entities };
}
```

Le destructuring retire seulement `window`. Il conserve donc les coordonnées, portes, structures, états fermés et grimpe exactement comme aujourd’hui.

- [ ] **Step 2: Écrire le test de snapshot**

Ajouter au début du `describe` existant :

```ts
it('sanctuarise le plan hors apparence et fenêtres', () => {
  expect(planSanctuarise(scene)).toMatchSnapshot();
});
```

- [ ] **Step 3: Générer le snapshot sur la scène intacte**

Run:

```powershell
npx vitest run src/scenes/diligence/diligence-projet.test.ts -u
```

Expected: PASS et création d’un unique snapshot nommé `sanctuarise le plan hors apparence et fenêtres 1`.

- [ ] **Step 4: Vérifier que le snapshot ne contient aucun id de terrain ni champ `window`**

Run:

```powershell
rg '"(herbe|plancher|route|terre|window)"' src/scenes/diligence/__snapshots__/diligence-projet.test.ts.snap
```

Expected: aucune sortie. Les tableaux `cells`, `walls`, `zones` et `entities` doivent tous être présents.

- [ ] **Step 5: Vérifier les tests existants puis committer le garde**

Run:

```powershell
npx vitest run src/scenes/diligence/diligence-projet.test.ts
git add src/scenes/diligence/diligence-projet.test.ts src/scenes/diligence/__snapshots__/diligence-projet.test.ts.snap
git commit -m "test(carte): sanctuarise le plan de la Diligence"
```

Expected: tous les tests du fichier passent ; le commit ne contient que le test et son snapshot.

---

### Task 2: Capturer la référence jouable avant édition

**Files:**
- No tracked files modified.
- Generated, ignored QC output: `public/qc/diligence-palier-a-avant/`

**Interfaces:**
- Consumes: scénario `diligence`, script existant `scripts/qc/capture-jeu.mjs`.
- Produces: cinq captures de comparaison prises dans le jeu réel.

- [ ] **Step 1: Démarrer le serveur de développement sans fenêtre visible**

Run in a dedicated terminal/session:

```powershell
npm run dev -- --host 127.0.0.1
```

Expected: Vite écoute sur `http://localhost:5173` et reste actif pendant les captures.

- [ ] **Step 2: Capturer les quatre rotations et la vue tactique**

Run:

```powershell
node scripts/qc/capture-jeu.mjs --scenes diligence --vues iso-rot0,iso-rot1,iso-rot2,iso-rot3,top --zoom 1 --out public/qc/diligence-palier-a-avant
```

Expected: cinq PNG dans `public/qc/diligence-palier-a-avant/`, console sans erreur applicative.

- [ ] **Step 3: Consigner les défauts visibles à corriger dans le rendu de la tâche**

Le rendu brut de tâche doit nommer, capture par capture : façades uniformes, fenêtres absentes ou disproportionnées, grandes portes illisibles, sols indifférenciés et mur plein autour du jardin. Ce relevé est la baseline visuelle ; aucun fichier de plan n’est encore modifié.

---

### Task 3: Différencier les sols avec les terrains existants

**Files:**
- Modify: `src/scenes/diligence/diligence-projet.json`
- Test: `src/scenes/diligence/diligence-projet.test.ts`

**Interfaces:**
- Consumes: ids de zones existants et définitions de terrain `plancher`, `dalle`, `pierre`, `terre`, `herbe` dans `src/state/terrain/defs/`.
- Produces: sols différenciés sans changement de marchabilité, hauteur ou emprise de zone.

- [ ] **Step 1: Établir l’affectation stable des zones**

Appliquer ces familles par id, jamais par label :

```ts
const TERRAIN_PAR_ZONE = {
  'zone-S-z0': 'plancher', 'zone-U-z0': 'plancher', 'zone-P-z0': 'plancher',
  'zone-H-z0': 'plancher', 'zone-I-z0': 'plancher', 'zone-j-z0': 'plancher',
  'zone-Y-z1': 'plancher', 'zone-T-z1': 'plancher', 'zone-t-z1': 'plancher',
  'zone-G-z1': 'plancher', 'zone-g-z1': 'plancher', 'zone-Q-z1': 'plancher',
  'zone-q-z1': 'plancher', 'zone-D-z1': 'plancher', 'zone-d-z1': 'plancher',
  'zone-a-z1': 'plancher', 'zone-b-z1': 'plancher', 'zone-c-z1': 'plancher',
  'zone-O-z1': 'plancher', 'zone-X-z1': 'plancher',
  'zone-K-z0': 'dalle', 'zone-B-z0': 'dalle',
  'zone-L-z0': 'pierre', 'zone-R-z0': 'pierre', 'zone-r-z0': 'pierre',
  'zone-l-z1': 'pierre', 'zone-r-z1': 'pierre',
  'zone-F-z0': 'pierre',
  'zone-E-z0': 'terre', 'zone-e-z0': 'terre',
  'zone-J-z0': 'terre',
} as const;
```

Les zones de cour, passage et balcon extérieur gardent leur terrain actuel. `zone-J-z0` ne transforme que les cases actuellement marchables de la zone ; les bordures restent inchangées.

- [ ] **Step 2: Appliquer mécaniquement les terrains aux cases exactes de chaque zone**

Utiliser `sceneZoneTiles(zone)` pour obtenir les cases, puis remplacer uniquement l’id de terrain au même index `y * width + x` dans la couche `z` correspondante. L’opération est une édition de données : ne modifier ni `height`, ni `walls`, ni `effectZones`.

Après écriture, reformater uniquement `src/scenes/diligence/diligence-projet.json` avec le formatter JSON déjà employé par le dépôt ; ne pas reformater d’autres fichiers.

- [ ] **Step 3: Vérifier que le golden et la connectivité restent verts**

Run:

```powershell
npx vitest run src/scenes/diligence/diligence-projet.test.ts
```

Expected: PASS sans mise à jour du snapshot. Un snapshot modifié signifie que le remplacement de terrain a changé marchabilité ou hauteur et doit être annulé pour les cases fautives.

- [ ] **Step 4: Capturer les sols aux quatre rotations**

Run:

```powershell
node scripts/qc/capture-jeu.mjs --scenes diligence --vues iso-rot0,iso-rot1,iso-rot2,iso-rot3,top --zoom 1 --out public/qc/diligence-palier-a-sols
```

Expected: la salle et les chambres restent en plancher ; cuisine/brasserie se lisent en dalles ; réserves/celliers/forge en pierre ; écuries et jardin en terre. Aucun trou, dalle flottante ou changement de niveau.

- [ ] **Step 5: Committer uniquement les données de sol**

Run:

```powershell
git add src/scenes/diligence/diligence-projet.json
git commit -m "feat(carte): différencie les sols de la Diligence"
```

---

### Task 4: Appliquer la façade existante et redistribuer les fenêtres

**Files:**
- Modify: `src/scenes/diligence/diligence-projet.json`
- Test: `src/scenes/diligence/diligence-projet.test.ts`
- Reference only: `src/gameIso/catalog/facades/defs/auberge-relais-imperiale.ts`
- Reference only: `src/state/scene.ts` (`FacadeSection`, `FacadeFeature`)

**Interfaces:**
- Consumes: architecture body id `diligence`, façade id `auberge-relais-imperiale`, features existantes `window-band`, `stone-entry`, `gable`, `chimney`, `sign`.
- Produces: sections de façade explicites et fenêtres authorées sur les arêtes existantes.

- [ ] **Step 1: Inventorier les arêtes extérieures sans les modifier**

Dans l’éditeur ou par lecture de la scène, regrouper les arêtes d’enveloppe contiguës et collinéaires par étage. Pour chaque groupe, relever les coordonnées canoniques `{x,y,z,side}` et les portes déjà présentes. Aucune arête intérieure ne doit entrer dans une section de façade.

Le rendu brut de cette étape doit fournir la liste JSON exacte des sections retenues avant écriture ; ce relevé sert à la revue de diff.

- [ ] **Step 2: Authorer les sections avec l’apparence existante**

Dans l’inspecteur Architecture de l’éditeur, créer une section pour chaque groupe inventorié à l’étape 1, sélectionner exactement ses arêtes, choisir l’apparence `auberge-relais-imperiale`, puis rattacher les ids stables des zones adjacentes. Nommer les sections `facade-nord-z0-1`, `facade-est-z0-1`, etc. selon leur orientation monde, leur étage et leur ordre sur le côté ; ne jamais dériver l’id du label d’une pièce.

Exporter le projet depuis l’éditeur vers `src/scenes/diligence/diligence-projet.json`, puis vérifier dans le diff que chaque `edges` recopie exclusivement une coordonnée de l’inventaire brut de l’étape 1.

- [ ] **Step 3: Poser seulement les features déjà supportées**

- `stone-entry` sur l’arête de la porte principale existante ;
- `sign` sur la même section, décalée hors du passage ;
- `gable` sur le pignon principal que la primitive actuelle sait réellement couvrir ;
- `chimney` sur les sections correspondant aux souches déjà visibles dans la référence ;
- `window-band` uniquement sur une arête qui porte aussi `window: true`, afin d’étiqueter/reteinter la croisée existante plutôt que de peindre une fausse fenêtre sur un mur plein.

Ne pas simuler un grand pignon multi-travées ni un portail cintré si la primitive existante ne sait pas les dessiner : ces écarts alimenteront le palier B.

- [ ] **Step 4: Redistribuer les fenêtres sans toucher aux portes**

Sur les seules arêtes extérieures inventoriées :

- retirer les fenêtres qui donnent sur un angle, une porte ou une zone non bâtie ;
- ajouter des fenêtres aux chambres, salles publiques, salles de réunion et circulations extérieures ;
- conserver cuisine, brasserie, réserves, forge et écuries plus parcimonieuses ;
- alterner les travées pour éviter la grille uniforme ;
- ne jamais ajouter `window` sur une arête `door: true`.

Avant écriture finale, produire une planche aux quatre rotations et corriger les alignements qui superposent une croisée à un plancher, un toit ou une autre ouverture.

- [ ] **Step 5: Ajouter des attendus de contenu sans figer le goût au pixel**

Ajouter au test de scène :

```ts
it('authorise la peau de relais sans toucher au plan', () => {
  const body = scene.architecture?.find((candidate) => candidate.id === 'diligence');
  expect(body?.facades.length).toBeGreaterThan(0);
  expect(body?.facades.every((facade) => facade.appearance === 'auberge-relais-imperiale')).toBe(true);
  const windows = (scene.walls ?? []).filter((wall) => wall.window);
  expect(windows.length).toBeGreaterThan(9);
  expect(windows.every((wall) => !wall.door)).toBe(true);
});
```

Ce test verrouille l’usage réel de la façade et l’amélioration mesurée par rapport aux 9 fenêtres initiales, sans imposer un nombre arbitraire qui empêcherait les raffinements visuels.

- [ ] **Step 6: Vérifier le golden, les tests et la capture**

Run:

```powershell
npx vitest run src/scenes/diligence/diligence-projet.test.ts
node scripts/qc/capture-jeu.mjs --scenes diligence --vues iso-rot0,iso-rot1,iso-rot2,iso-rot3,top --zoom 1 --out public/qc/diligence-palier-a-facades
```

Expected: tests PASS sans mise à jour du snapshot ; façade visible aux quatre rotations ; fenêtres lisibles et non superposées aux portes.

- [ ] **Step 7: Committer le palier façade/fenêtres**

Run:

```powershell
git add src/scenes/diligence/diligence-projet.json src/scenes/diligence/diligence-projet.test.ts
git commit -m "feat(carte): habille les façades de la Diligence"
```

---

### Task 5: Recette du palier A et décision d’arrêt

**Files:**
- No application files created.
- Generated QC output: `public/qc/diligence-palier-a-final/`
- Modify only if a defect is found: files already owned by Tasks 3–4.

**Interfaces:**
- Consumes: scène personnalisée, illustration utilisateur, captures avant/après.
- Produces: verdict `PALIER A SUFFISANT` ou liste fermée d’écarts justifiant un futur palier B.

- [ ] **Step 1: Lancer les portes mécaniques ciblées**

Run:

```powershell
npx vitest run src/scenes/diligence/diligence-projet.test.ts scripts/map/check.test.ts
npm run typecheck
npm test
```

Expected: toutes les commandes passent. Le test complet n’est pas remplacé par les seuls tests ciblés.

- [ ] **Step 2: Produire la planche finale réelle**

Run:

```powershell
node scripts/qc/capture-jeu.mjs --scenes diligence --vues iso-rot0,iso-rot1,iso-rot2,iso-rot3,top --zoom 1 --out public/qc/diligence-palier-a-final
```

Expected: cinq captures, console à zéro erreur.

- [ ] **Step 3: Juger les critères visibles**

Comparer la planche avant, la planche finale et l’illustration sur ces critères :

- silhouette et matières d’auberge à colombages ;
- façade non uniforme et fenêtres crédibles ;
- salles publiques, chambres, services, forge et écuries lisibles par leurs sols ;
- aucune altération de circulation ou de verticalité ;
- jardin toujours identifié comme extérieur, même si sa paroi reste trop haute avec le moteur actuel.

- [ ] **Step 4: Corriger uniquement les données authorées**

Toute correction issue de la revue modifie seulement les ids de terrain, les marqueurs `window` ou les sections/features de façade. Relancer les tests ciblés et les cinq captures après chaque correction.

- [ ] **Step 5: Émettre le verdict de point d’arrêt**

Rendre `PALIER A SUFFISANT` si les défauts restants sont des raffinements pièce par pièce. Sinon rendre une liste fermée, capture à l’appui, limitée aux capacités absentes de la bibliothèque actuelle : fenêtre étroite, porte double, portail cintré, colombage moins répétitif, haie/clôture basse, grand pignon multi-travées.

Ne modifier aucun code applicatif dans ce plan. Un verdict négatif ouvre d’abord un plan de palier B limité aux définitions de bibliothèque réellement nécessaires.

- [ ] **Step 6: Committer les seules corrections finales éventuelles**

Run:

```powershell
git add src/scenes/diligence/diligence-projet.json src/scenes/diligence/diligence-projet.test.ts
git diff --cached --quiet || git commit -m "fix(carte): affine la peau existante de la Diligence"
```

Expected: aucun fichier d’application ni WIP non lié dans le commit.
