# Menu de scénarios de test — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le bouton « Test rapide » par un **sous-écran de scénarios de test auto-découverts** (un fichier = un scénario), dont un scénario « Tir & Rechargement » qui rend la feature munitions/rechargement enfin jouable (arbalétrier équipé à la main).

**Architecture:** Dossier `src/scenes/test-scenarios/` ; `_shared.ts` (type `TestScenario` + helper `arena`), un fichier par scénario (`export const scenario`), `index.ts` collecte via `import.meta.glob` et trie par `order`. Sous-écran `TestScenariosScreen` (écran `'test'`, lazy) liste les cartes ; lancer = `setParty` → `startScene` → `startCombat?` → `setScreen('campaign')`.

**Tech Stack:** Vite + TS + React, Zustand, Vitest. `createHero`/`itemFromTrapping`/`recomputeLoadout` (équipement), `spawnEnemy` (ennemis : `ref` bestiaire ou `statblock` inline), schéma `Scene`.

**Fidélité:** héros & règles sourcés ; ennemis = vraies créatures `creatures.json` (Ours, Minotaure, Gobelin, Zombie…) sauf le **mannequin** (fixture pure : `M 0`, `B 40`, immobile). Commits scopés à mes fichiers (`git commit -- <chemins>`).

**Commandes:** `npx vitest run <fichier>` ; `npm test` + `npm run typecheck` + `npm run build`.

---

## Task 1 : `_shared.ts` — type `TestScenario` + helper `arena`

**Files:**
- Create: `src/scenes/test-scenarios/_shared.ts`
- Test: `src/scenes/test-scenarios/_shared.test.ts`

- [ ] **Step 1 : Écrire le test (échec attendu)**
```ts
import { describe, it, expect } from 'vitest';
import { arena } from './_shared';
import { isWalkable } from '../../state/scene';

describe('arena (helper scénarios de test)', () => {
  it('produit une scène dégagée avec un point de départ héros', () => {
    const s = arena({ id: 'arn', nom: 'Arène', w: 16, h: 10 });
    expect(s.dimensions).toEqual({ w: 16, h: 10 });
    expect(s.tiles.length).toBe(160);
    expect(s.entities.find((e) => e.kind === 'heroStart')).toBeTruthy();
    expect(isWalkable(s, 8, 5)).toBe(true); // herbe = praticable
    expect(s.encounters).toEqual([]);
  });
});
```

- [ ] **Step 2 : Lancer → échec**

Run: `npx vitest run src/scenes/test-scenarios/_shared.test.ts`
Expected: FAIL (`arena` introuvable).

- [ ] **Step 3 : Implémenter `_shared.ts`**
```ts
import { Combatant } from '../../engine/types';
import { Scene, Terrain } from '../../state/scene';

/** Un scénario de test = un groupe fixé + une scène adaptée (+ combat direct optionnel). */
export interface TestScenario {
  id: string;
  order: number; // tri d'affichage dans le menu
  icon: string; // emoji de carte
  title: string;
  tests: string; // une ligne : « ce que ça vérifie »
  partyNote: string; // ex. « Arbalétrier solo »
  makeParty: () => Combatant[];
  scene: Scene;
  autoCombat?: string; // id d'encounter → démarre le combat directement
}

/** Arène dégagée + point de départ des héros (base des scénarios de combat direct). */
export function arena(opts: {
  id: string;
  nom: string;
  w?: number;
  h?: number;
  terrain?: Terrain;
  heroStart?: { x: number; y: number };
}): Scene {
  const w = opts.w ?? 16;
  const h = opts.h ?? 10;
  return {
    id: opts.id,
    nom: opts.nom,
    description: 'Arène de test.',
    dimensions: { w, h },
    ambiance: 'jour',
    tiles: new Array(w * h).fill(opts.terrain ?? 'herbe') as Terrain[],
    entities: [{ id: 'start', kind: 'heroStart', pos: opts.heroStart ?? { x: 2, y: Math.floor(h / 2) } }],
    dialogues: [],
    triggers: [],
    encounters: [],
    flags: {},
  };
}
```

- [ ] **Step 4 : Lancer → succès**

Run: `npx vitest run src/scenes/test-scenarios/_shared.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**
```bash
git add src/scenes/test-scenarios/_shared.ts src/scenes/test-scenarios/_shared.test.ts
git commit -m "feat(test-scenarios): type TestScenario + helper arena"
```

---

## Task 2 : `01-tir-rechargement.ts` — arbalétrier solo + mannequin passif

**Files:**
- Create: `src/scenes/test-scenarios/01-tir-rechargement.ts`
- Test: `src/scenes/test-scenarios/01-tir-rechargement.test.ts`

- [ ] **Step 1 : Écrire le test (échec attendu)**
```ts
import { describe, it, expect } from 'vitest';
import { scenario } from './01-tir-rechargement';

describe('Scénario Tir & Rechargement', () => {
  it('le héros porte une arbalète (Recharge ≥1) équipée + des carreaux', () => {
    const party = scenario.makeParty();
    expect(party.length).toBeGreaterThanOrEqual(1);
    const hero = party[0];
    const ranged = hero.weapons.find((w) => w.type === 'ranged');
    expect(ranged).toBeTruthy();
    expect((ranged!.reload ?? 0)).toBeGreaterThanOrEqual(1); // Recharge → Test étendu
    expect(ranged!.subType).toBe('Arbalète');
    const ammo = (hero.items ?? []).find((i) => i.kind === 'ammo' && i.subType === 'Arbalète');
    expect(ammo && (ammo.qty ?? 0) > 0).toBe(true);
  });
  it('la scène a un encounter (autoCombat) avec une cible à distance', () => {
    expect(scenario.autoCombat).toBeTruthy();
    const enc = scenario.scene.encounters.find((e) => e.id === scenario.autoCombat);
    expect(enc).toBeTruthy();
    expect(enc!.enemies.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2 : Lancer → échec**

Run: `npx vitest run src/scenes/test-scenarios/01-tir-rechargement.test.ts`
Expected: FAIL.

- [ ] **Step 3 : Implémenter `01-tir-rechargement.ts`**
```ts
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { itemFromTrapping, recomputeLoadout } from '../../engine/items';
import { Combatant } from '../../engine/types';
import { CustomStatblock } from '../../state/scene';
import { arena } from './_shared';
import type { TestScenario } from './_shared';

/** Cible inerte : M 0 (ne bouge pas), beaucoup de Blessures (encaisse les tirs) → passif. FIXTURE de test. */
const MANNEQUIN: CustomStatblock = {
  name: "Mannequin d'entraînement",
  char: { M: 0, CC: 5, CT: 0, F: 20, E: 35, I: 5, Ag: 5, Dex: 5, Int: 5, FM: 5, Soc: 5, B: 40 },
  traits: [],
};

function arbaletrier(): Combatant {
  const h = createHero({
    speciesLabel: 'Humains (Reiklander)',
    careerLabel: 'Soldat',
    name: 'Arbalétrier (test)',
    motivation: 'Test',
    rng: makeRNG(1101),
    id: 'test-arbaletrier',
  });
  const arb = itemFromTrapping('Arbalète')!;
  arb.equipped = true;
  const carreaux = itemFromTrapping('Carreau')!; // (12) → qty 12, subType Arbalète, Empaleuse
  h.items = [arb, carreaux];
  recomputeLoadout(h); // dérive weapons: Arbalète (reload 1, subType Arbalète) + Mains nues
  h.appearance = { species: 'Humains (Reiklander)', sex: 'M', build: 0.5 };
  return h;
}

const scene = arena({ id: 'test-tir', nom: 'Tir & Rechargement — stand de tir', w: 16, h: 9, heroStart: { x: 2, y: 4 } });
scene.startMessage = "Stand de tir. Un mannequin attend à distance. Tirez, rechargez, retirez.";
scene.encounters = [{ id: 'enc-tir', enemies: [{ statblock: MANNEQUIN, pos: { x: 12, y: 4 } }] }];

export const scenario: TestScenario = {
  id: 'tir-rechargement',
  order: 1,
  icon: '🏹',
  title: 'Tir & Rechargement',
  tests: 'Tir consomme 1 munition + Empaleuse ; modale de rechargement (Test étendu de Projectiles) ; arme déchargée → tir refusé.',
  partyNote: 'Arbalétrier solo (Arbalète Recharge 1 + Carreaux)',
  makeParty: () => [arbaletrier()],
  scene,
  autoCombat: 'enc-tir',
};
```

- [ ] **Step 4 : Lancer → succès**

Run: `npx vitest run src/scenes/test-scenarios/01-tir-rechargement.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**
```bash
git add src/scenes/test-scenarios/01-tir-rechargement.ts src/scenes/test-scenarios/01-tir-rechargement.test.ts
git commit -m "feat(test-scenarios): Tir & Rechargement (arbaletrier + mannequin passif)"
```

---

## Task 3 : `index.ts` — registre auto-découvert (glob)

**Files:**
- Create: `src/scenes/test-scenarios/index.ts`
- Test: `src/scenes/test-scenarios/index.test.ts`

- [ ] **Step 1 : Écrire le test (échec attendu)**
```ts
import { describe, it, expect } from 'vitest';
import { testScenarios } from './index';

describe('Registre des scénarios de test (auto-découverte)', () => {
  it('contient le scénario Tir & Rechargement', () => {
    expect(testScenarios.find((s) => s.id === 'tir-rechargement')).toBeTruthy();
  });
  it('est trié par order et sans id dupliqué, et exclut _shared', () => {
    const orders = testScenarios.map((s) => s.order);
    expect([...orders]).toEqual([...orders].sort((a, b) => a - b));
    const ids = testScenarios.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
  });
});
```

- [ ] **Step 2 : Lancer → échec**

Run: `npx vitest run src/scenes/test-scenarios/index.test.ts`
Expected: FAIL (`testScenarios` introuvable).

- [ ] **Step 3 : Implémenter `index.ts`**
```ts
import type { TestScenario } from './_shared';

// Auto-découverte : chaque fichier `<NN>-*.ts` du dossier exporte `scenario`.
// Ajouter un scénario = déposer un fichier ici — aucun import manuel.
const mods = import.meta.glob('./*.ts', { eager: true }) as Record<string, { scenario?: TestScenario }>;

export const testScenarios: TestScenario[] = Object.entries(mods)
  .filter(([path]) => !path.includes('/_') && !path.endsWith('/index.ts'))
  .map(([, m]) => m.scenario)
  .filter((s): s is TestScenario => !!s)
  .sort((a, b) => a.order - b.order);

export type { TestScenario } from './_shared';
```
> Note : `import.meta.glob` ramasse aussi les `*.test.ts` ; ils n'exportent pas `scenario` → filtrés par `.filter(Boolean)`. Les fichiers `_shared.ts`/`index.ts` sont exclus explicitement.

- [ ] **Step 4 : Lancer → succès**

Run: `npx vitest run src/scenes/test-scenarios/index.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**
```bash
git add src/scenes/test-scenarios/index.ts src/scenes/test-scenarios/index.test.ts
git commit -m "feat(test-scenarios): registre auto-decouvert par dossier (import.meta.glob)"
```

---

## Task 4 : Scénarios 02-06 (batterie large)

**Files (Create):**
- `src/scenes/test-scenarios/02-embuscade.ts`
- `src/scenes/test-scenarios/03-critiques-mort.ts`
- `src/scenes/test-scenarios/04-destin-resilience.ts`
- `src/scenes/test-scenarios/05-engagement.ts`
- `src/scenes/test-scenarios/06-magie.ts`
- Test: `src/scenes/test-scenarios/scenarios.test.ts`

- [ ] **Step 1 : Écrire le test paramétré (échec attendu)**
```ts
import { describe, it, expect } from 'vitest';
import { testScenarios } from './index';

describe('Batterie de scénarios de test', () => {
  it('couvre au moins 6 scénarios', () => {
    expect(testScenarios.length).toBeGreaterThanOrEqual(6);
  });
  it.each(['embuscade', 'critiques-mort', 'destin-resilience', 'engagement', 'magie'])(
    'le scénario %s existe, a un groupe non vide et une scène valide',
    (id) => {
      const s = testScenarios.find((x) => x.id === id)!;
      expect(s).toBeTruthy();
      const party = s.makeParty();
      expect(party.length).toBeGreaterThanOrEqual(1);
      expect(party.every((h) => h.kind === 'hero')).toBe(true);
      expect(s.scene.tiles.length).toBe(s.scene.dimensions.w * s.scene.dimensions.h);
      if (s.autoCombat) expect(s.scene.encounters.find((e) => e.id === s.autoCombat)).toBeTruthy();
    },
  );
});
```

- [ ] **Step 2 : Lancer → échec**

Run: `npx vitest run src/scenes/test-scenarios/scenarios.test.ts`
Expected: FAIL.

- [ ] **Step 3 : `02-embuscade.ts`** (porte l'ancien « Test rapide »)
```ts
import { makePregens } from '../../data/pregens';
import { ambushTest } from '../ambush-test';
import type { TestScenario } from './_shared';

export const scenario: TestScenario = {
  id: 'embuscade',
  order: 2,
  icon: '🩸',
  title: "L'Embuscade",
  tests: "Flux complet exploration → dialogue → combat (5 mutants, ch.2). L'ancien « Test rapide ».",
  partyNote: '4 pré-tirés',
  makeParty: () => makePregens().slice(0, 4),
  scene: ambushTest,
  // pas d'autoCombat : on entre en exploration, le trigger lance le dialogue puis le combat.
};
```

- [ ] **Step 4 : `03-critiques-mort.ts`** (héros fragile sans Destin vs frappeur)
```ts
import { makePregens } from '../../data/pregens';
import { Combatant } from '../../engine/types';
import { arena } from './_shared';
import type { TestScenario } from './_shared';

/** Halfling Voleur (peu de Blessures), Destin/Résilience mis à 0 → la mort survient vraiment. */
function fragile(): Combatant {
  const h = JSON.parse(JSON.stringify(makePregens().find((p) => p.name.startsWith('Klein'))!)) as Combatant;
  h.fate = 0;
  h.fortune = 0;
  h.resilience = 0;
  h.resolve = 0;
  return h;
}

const scene = arena({ id: 'test-crit', nom: 'Critiques & Mort — fosse', w: 14, h: 9, heroStart: { x: 2, y: 4 } });
scene.startMessage = 'Un ours enragé. Le héros est fragile et sans Destin : 0 PB → À Terre → Inconscient → mort.';
scene.encounters = [{ id: 'enc-crit', enemies: [{ ref: 'Ours', pos: { x: 8, y: 4 } }] }];

export const scenario: TestScenario = {
  id: 'critiques-mort',
  order: 3,
  icon: '💀',
  title: 'Critiques & Mort',
  tests: 'Overkill/double → Critique ; 0 PB → À Terre → Inconscient → mort (tables 18-Traumatisme).',
  partyNote: 'Héros fragile (Destin 0) vs Ours',
  makeParty: () => [fragile()],
  scene,
  autoCombat: 'enc-crit',
};
```

- [ ] **Step 5 : `04-destin-resilience.ts`** (héros à Destin vs frappeur létal)
```ts
import { makePregens } from '../../data/pregens';
import { Combatant } from '../../engine/types';
import { arena } from './_shared';
import type { TestScenario } from './_shared';

function combattant(): Combatant {
  return JSON.parse(JSON.stringify(makePregens().find((p) => p.name.startsWith('Sigmund'))!)) as Combatant;
}

const scene = arena({ id: 'test-destin', nom: 'Destin & Résilience — arène', w: 14, h: 9, heroStart: { x: 2, y: 4 } });
scene.startMessage = 'Un minotaure. Un coup létal déclenche le sauvetage par le Destin ; la Résilience garantit une réussite.';
scene.encounters = [{ id: 'enc-destin', enemies: [{ ref: 'Minotaure', pos: { x: 8, y: 4 } }] }];

export const scenario: TestScenario = {
  id: 'destin-resilience',
  order: 4,
  icon: '🍀',
  title: 'Destin / Résilience',
  tests: 'Coup létal → pendingFateSave (« Comment ça a pu rater ? » / « Meurs un autre jour ») + réussite garantie.',
  partyNote: 'Sigmund (Destin+Résilience) vs Minotaure',
  makeParty: () => [combattant()],
  scene,
  autoCombat: 'enc-destin',
};
```

- [ ] **Step 6 : `05-engagement.ts`** (2 mêlées vs 2 gobelins espacés)
```ts
import { makePregens } from '../../data/pregens';
import { arena } from './_shared';
import type { TestScenario } from './_shared';

const scene = arena({ id: 'test-engage', nom: 'Engagé / Charge / Désengagement', w: 16, h: 10, heroStart: { x: 2, y: 5 } });
scene.startMessage = 'Deux gobelins à quelques mètres : chargez, restez Engagé, puis désengagez-vous.';
scene.encounters = [
  {
    id: 'enc-engage',
    enemies: [
      { ref: 'Gobelin', pos: { x: 9, y: 4 } },
      { ref: 'Gobelin', pos: { x: 9, y: 6 } },
    ],
  },
];

export const scenario: TestScenario = {
  id: 'engagement',
  order: 5,
  icon: '⚔️',
  title: 'Engagé / Charge / Désengagement',
  tests: 'Charger (portée Course + Avantage), état Engagé symétrique, Se désengager (sacrifice d’Avantage / Esquive).',
  partyNote: 'Sigmund + Grunni (mêlée) vs 2 Gobelins',
  makeParty: () => {
    const P = makePregens();
    return [P.find((p) => p.name.startsWith('Sigmund'))!, P.find((p) => p.name.startsWith('Grunni'))!];
  },
  scene,
  autoCombat: 'enc-engage',
};
```

- [ ] **Step 7 : `06-magie.ts`** (Sorcier + Prêtre vs cibles)
```ts
import { makePregens } from '../../data/pregens';
import { arena } from './_shared';
import type { TestScenario } from './_shared';

const scene = arena({ id: 'test-magie', nom: 'Magie — incantation & bénédictions', w: 16, h: 10, heroStart: { x: 2, y: 5 } });
scene.startMessage = 'Lancez Fléchette/Choc (Sorcier), bénissez (Prêtre), tentez une Focalisation.';
scene.encounters = [
  {
    id: 'enc-magie',
    enemies: [
      { ref: 'Zombie', pos: { x: 10, y: 4 } },
      { ref: 'Zombie', pos: { x: 10, y: 6 } },
    ],
  },
];

export const scenario: TestScenario = {
  id: 'magie',
  order: 6,
  icon: '✨',
  title: 'Magie',
  tests: 'Modale d’incantation (NI/DR/Maladresse), Focalisation, Bénédictions.',
  partyNote: 'Wilhelmina (Sorcier) + Frère Anselm (Prêtre)',
  makeParty: () => {
    const P = makePregens();
    return [P.find((p) => p.name.startsWith('Wilhelmina'))!, P.find((p) => p.name.startsWith('Frère Anselm'))!];
  },
  scene,
  autoCombat: 'enc-magie',
};
```

- [ ] **Step 8 : Lancer → succès + régression**

Run: `npx vitest run src/scenes/test-scenarios/` puis `npm test`.
Expected: PASS. (Si une `ref` de créature n'existe pas, `spawnEnemy` retombe sur un générique — vérifier les noms via `creatures.json` : Ours, Minotaure, Gobelin, Zombie existent.)

- [ ] **Step 9 : Commit**
```bash
git add src/scenes/test-scenarios/02-embuscade.ts src/scenes/test-scenarios/03-critiques-mort.ts src/scenes/test-scenarios/04-destin-resilience.ts src/scenes/test-scenarios/05-engagement.ts src/scenes/test-scenarios/06-magie.ts src/scenes/test-scenarios/scenarios.test.ts
git commit -m "feat(test-scenarios): batterie large (embuscade, critiques/mort, destin/resilience, engagement, magie)"
```

---

## Task 5 : UI — écran `'test'`, `TestScenariosScreen`, bouton menu

**Files:**
- Modify: `src/state/store.ts` (union `Screen`)
- Modify: `src/ui/App.tsx` (route lazy)
- Modify: `src/ui/MainMenu.tsx` (bouton)
- Create: `src/ui/TestScenariosScreen.tsx`
- Modify: `src/ui/styles.css` (cartes)
- Test: `src/ui/TestScenariosScreen.test.tsx`

- [ ] **Step 1 : `Screen` += `'test'`** dans `src/state/store.ts` :
```ts
export type Screen = 'menu' | 'party' | 'creator' | 'campaign' | 'editor' | 'test';
```

- [ ] **Step 2 : Écrire le test de rendu (échec attendu)** — `src/ui/TestScenariosScreen.test.tsx` :
```tsx
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TestScenariosScreen } from './TestScenariosScreen';

describe('TestScenariosScreen (rendu)', () => {
  it('liste chaque scénario (titre + bouton Lancer)', () => {
    const html = renderToStaticMarkup(<TestScenariosScreen />);
    expect(html).toContain('Tir &amp; Rechargement'); // 01 (& échappé en HTML)
    expect(html).toContain("L'Embuscade");
    expect(html).toContain('Magie');
    expect(html).toContain('Lancer');
    expect(html).toContain('Retour');
  });
});
```

- [ ] **Step 3 : Lancer → échec**

Run: `npx vitest run src/ui/TestScenariosScreen.test.tsx`
Expected: FAIL (composant introuvable).

- [ ] **Step 4 : Implémenter `TestScenariosScreen.tsx`**
```tsx
import { useGame } from '../state/store';
import { testScenarios, type TestScenario } from '../scenes/test-scenarios';

/** Sous-écran « Scénarios de test » : groupe fixé + scène adaptée, par scénario. */
export function TestScenariosScreen() {
  const setScreen = useGame((s) => s.setScreen);
  const setParty = useGame((s) => s.setParty);
  const startScene = useGame((s) => s.startScene);
  const startCombat = useGame((s) => s.startCombat);

  const launch = (sc: TestScenario) => {
    setParty(sc.makeParty());
    startScene(sc.scene);
    if (sc.autoCombat) startCombat(sc.autoCombat);
    setScreen('campaign');
  };

  return (
    <div className="menu">
      <div className="menu-card test-scenarios">
        <button className="btn small" onClick={() => setScreen('menu')}>
          ← Retour
        </button>
        <h1 className="title">Scénarios de test</h1>
        <p className="subtitle">Chaque scénario fixe un groupe et une scène adaptée à ce qu'on vérifie.</p>
        <div className="ts-grid">
          {testScenarios.map((sc) => (
            <div className="ts-card" key={sc.id}>
              <div className="ts-head">
                <span className="ts-ico">{sc.icon}</span>
                <strong>{sc.title}</strong>
              </div>
              <p className="ts-tests">{sc.tests}</p>
              <p className="ts-party">👥 {sc.partyNote}</p>
              <button className="btn btn-primary" onClick={() => launch(sc)}>
                Lancer
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5 : Router `src/ui/App.tsx`** — ajouter le lazy + la route :
```tsx
const TestScenariosScreen = lazy(() => import('./TestScenariosScreen').then((m) => ({ default: m.TestScenariosScreen })));
```
et dans le `<Suspense>` (après la ligne `editor`) :
```tsx
        {screen === 'test' && <TestScenariosScreen />}
```

- [ ] **Step 6 : Bouton dans `src/ui/MainMenu.tsx`** — remplacer le bouton « Test rapide » et son handler `quickTest`/imports devenus inutiles :
  - Supprimer les imports `makePregens` et `ambushTest` et la fonction `quickTest` (déplacés dans le registre).
  - Garder `const setScreen = useGame((s) => s.setScreen);` (déjà présent). Retirer `setParty`/`startScene` s'ils ne servent plus.
  - Remplacer le bouton :
```tsx
          <button className="btn btn-test" onClick={() => setScreen('test')}>
            🧪 Tests — scénarios
          </button>
```

- [ ] **Step 7 : Styles `src/ui/styles.css`** — ajouter (à la fin) :
```css
.test-scenarios { max-width: 720px; }
.ts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
.ts-card { border: 1px solid #3a3a4a; border-radius: 8px; padding: 12px; background: #20202a; display: flex; flex-direction: column; gap: 6px; }
.ts-head { display: flex; align-items: center; gap: 8px; font-size: 15px; }
.ts-ico { font-size: 20px; }
.ts-tests { font-size: 12px; color: #b8b8c8; flex: 1; }
.ts-party { font-size: 12px; color: #8fae8f; }
```

- [ ] **Step 8 : Lancer → succès + typecheck**

Run: `npx vitest run src/ui/TestScenariosScreen.test.tsx` puis `npm run typecheck`.
Expected: PASS, 0 erreur.

- [ ] **Step 9 : Commit**
```bash
git add src/state/store.ts src/ui/App.tsx src/ui/MainMenu.tsx src/ui/TestScenariosScreen.tsx src/ui/TestScenariosScreen.test.tsx src/ui/styles.css
git commit -m "feat(ui): sous-ecran Scenarios de test (menu Tests) — registre auto-decouvert"
```

---

## Task 6 : Documentation + vérification finale

**Files:**
- Create: `docs/test-scenarios.md`
- Modify: `Game/CLAUDE.md` (§ Vérification)

- [ ] **Step 1 : `docs/test-scenarios.md`**
```markdown
# Scénarios de test

Le menu **« Tests — scénarios »** (écran `'test'`) liste des scénarios de vérification : chacun
fixe un **groupe** et une **scène adaptée** à ce qu'on veut tester, avec combat direct (`autoCombat`)
quand c'est utile.

## Vérifier une feature au navigateur

1. Lance `npm run dev`, ouvre le menu → **Tests — scénarios**.
2. **Passe par le scénario adapté.** S'il n'en existe pas pour ce que tu vérifies, **crée-en un**.

## Ajouter un scénario = un fichier

Dépose un fichier `src/scenes/test-scenarios/<NN>-<slug>.ts` exportant `scenario` :

\`\`\`ts
import { arena } from './_shared';
import type { TestScenario } from './_shared';
// (+ createHero / makePregens / itemFromTrapping selon le groupe voulu)

const scene = arena({ id: 'test-xxx', nom: '…', heroStart: { x: 2, y: 4 } });
scene.encounters = [{ id: 'enc-xxx', enemies: [{ ref: 'Gobelin', pos: { x: 9, y: 4 } }] }];

export const scenario: TestScenario = {
  id: 'xxx', order: 7, icon: '🧪', title: '…',
  tests: 'ce que ça vérifie', partyNote: 'le groupe',
  makeParty: () => [/* … */], scene, autoCombat: 'enc-xxx',
};
\`\`\`

`index.ts` le ramasse via `import.meta.glob` (tri par `order`) — **aucun import manuel**.

## Conventions

- **Équipement à la main** : `createHero(...)` puis réassigner `items` (`itemFromTrapping` + `recomputeLoadout`). Ex. arbalétrier = Arbalète + Carreaux équipés.
- **Ennemis** : vraies créatures du bestiaire via `ref` (`creatures.json`, LDB/ADE) ; fixture (`statblock` inline) seulement quand aucun équivalent canon n'existe (ex. le **mannequin** passif `M 0`).
- Le moteur reste couvert par Vitest ; les scénarios sont des fixtures de vérif manuelle/visuelle.

## Catalogue actuel

| Scénario | Vérifie |
|---|---|
| 🏹 Tir & Rechargement | tir + munition + modale de rechargement (Test étendu de Projectiles) |
| 🩸 L'Embuscade | exploration → dialogue → combat (5 mutants, ch.2) |
| 💀 Critiques & Mort | overkill/double → Critique ; 0 PB → À Terre → Inconscient → mort |
| 🍀 Destin / Résilience | coup létal → sauvetage par le Destin ; réussite garantie |
| ⚔️ Engagé / Charge / Désengagement | charge, Engagement, désengagement |
| ✨ Magie | incantation (NI/DR/Maladresse), Focalisation, Bénédictions |
```

- [ ] **Step 2 : `Game/CLAUDE.md` § Vérification** — remplacer la mention du bouton « 🧪 Test rapide » par :
```markdown
**Vérification** : après une feature UI, valider dans le navigateur (Playwright MCP) — charger
`localhost:5173`, dérouler le flux, vérifier `console` (0 erreur) et screenshoter. Le menu
**« 🧪 Tests — scénarios »** ouvre un choix de scénarios de test (groupe fixé + scène adaptée) ;
**passer par le scénario adapté, sinon en créer un** (cf. `docs/test-scenarios.md`).
```

- [ ] **Step 3 : Vérification finale**

Run: `npm test` (vert), `npm run typecheck` (0 erreur), `npm run build` (OK).

- [ ] **Step 4 : Commit**
```bash
git add docs/test-scenarios.md Game/CLAUDE.md
git commit -m "docs(test-scenarios): menu de scenarios + convention de verif visuelle (un fichier = un scenario)"
```

- [ ] **Step 5 : Recette navigateur (MANUELLE)** : menu → Tests → **Tir & Rechargement** → tirer (1 carreau consommé, arme déchargée), **Recharger** (modale : Lancer → DR → cumul jusqu'à 1 DR → rechargé), re-tirer, vider le carquois → tir refusé. Vérifier les 5 autres scénarios chargent sans erreur console.

---

## Auto-revue du plan

- **Couverture spec :** `_shared` type+arena (T1) · scénario Tir (T2) · registre glob (T3) · batterie 02-06 (T4) · écran+menu+route+css (T5) · doc + CLAUDE.md + vérif (T6). ✓
- **Cohérence des types :** `TestScenario` (T1) ↔ chaque `export const scenario` (T2/T4) ↔ `testScenarios` (T3) ↔ `TestScenariosScreen` (T5). `arena` signature stable. `Screen += 'test'` (T5) ↔ route (T5).
- **Fidélité :** héros via `createHero`/pregens ; ennemis = vraies créatures (`ref`: Ours, Minotaure, Gobelin, Zombie — présents dans `creatures.json`) ; seul le **mannequin** est une fixture (`M 0`, `B 40`). `spawnEnemy` retombe sur un générique si une `ref` manque (pas de crash).
- **Risques :** (a) un héros de groupe 1 (Tir, Critiques, Destin) — combat à 1 héros : vérifié par `npm test` + recette ; (b) le mannequin `M 0` : l'IA ne doit pas planter (cible hors d'atteinte → passe). Si l'IA bloque, c'est un vrai bug à corriger (le scénario sert à ça).
