# Éditeur — passe confort & outils — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter manipulation directe (glisser-déplacer, copier/coller/dupliquer), sélection/navigation, validation pré-runtime et confort terrain/carte à l'éditeur de scène.

**Architecture:** Deux modules **purs testés** (`entityId`, `validateScene`) + deux **panneaux** React extraits (`EntityListPanel`, `ValidationPanel`) pour ne pas gonfler `Editor.tsx` ; le reste = patchs ciblés dans `Editor.tsx` (outils, pointer handlers, clavier, inspecteur) et son hook `useSceneHistory` (coalescence d'undo).

**Tech Stack:** Vite + TS + React, Vitest (modules purs), rendu SVG iso. ⚠️ `Editor.tsx` est **gros et partagé** (autre session) → patchs ciblés + commits par pathspec ; relire chaque site avant d'éditer (lignes mouvantes).

**Spec:** `docs/superpowers/specs/2026-06-07-editeur-confort-outils-design.md`

---

## Carte des fichiers

| Fichier | Rôle | Phase |
|---|---|---|
| `src/state/entityId.ts` (créé) + `.test.ts` | `nextEntityId(kind, taken)` pur | P0 |
| `src/ui/editor/Editor.tsx` | hook `useSceneHistory` (coalescence) ; outil select + drag ; presse-papier + clavier ; recherche/calques ; brush/rect-fill/resize/fit-view ; câblage panneaux | P0-P5 |
| `src/state/validateScene.ts` (créé) + `.test.ts` | `validateScene(project) → Warning[]` pur | P4 |
| `src/ui/editor/EntityListPanel.tsx` (créé) | liste sélectionnable des entités | P3 |
| `src/ui/editor/ValidationPanel.tsx` (créé) | liste d'avertissements cliquables | P4 |

---

## VAGUE A — manipulation directe (P0 + P1 + P2)

### Task A1 : `nextEntityId` pur (P0) — TDD

**Files:** Create `src/state/entityId.ts` ; Test `src/state/entityId.test.ts`

- [ ] **Step 1 — test qui échoue** (`entityId.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { nextEntityId } from './entityId';

describe('nextEntityId', () => {
  it('plus petit suffixe libre, base36', () => {
    expect(nextEntityId('personnage', [])).toBe('personnage-0');
    expect(nextEntityId('objet', ['objet-0', 'objet-1'])).toBe('objet-2');
  });
  it('saute les ids pris (trou)', () => {
    expect(nextEntityId('e', ['e-0', 'e-2'])).toBe('e-1');
  });
  it('unicité en accumulant', () => {
    const taken = new Set<string>();
    const a = nextEntityId('p', taken); taken.add(a);
    const b = nextEntityId('p', taken); taken.add(b);
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2 — run → FAIL**

Run: `cd "C:/Users/gauch/PhpstormProjects/Foundry/Game" && npx vitest run src/state/entityId.test.ts`
Expected: FAIL (`nextEntityId is not a function`).

- [ ] **Step 3 — implémenter** (`entityId.ts`)

```ts
/**
 * Id d'entité STABLE et UNIQUE : `${kind}-${n}` (n base36, plus petit entier libre absent de
 * `taken`). Remplace `${kind}-${Date.now().toString(36)}` (collision même-ms / duplication / import). PUR.
 */
export function nextEntityId(kind: string, taken: Iterable<string>): string {
  const set = taken instanceof Set ? taken : new Set(taken);
  let n = 0;
  let id = `${kind}-0`;
  while (set.has(id)) id = `${kind}-${(++n).toString(36)}`;
  return id;
}
```

- [ ] **Step 4 — run → PASS** (`npx vitest run src/state/entityId.test.ts`).

- [ ] **Step 5 — commit**

```bash
git add src/state/entityId.ts src/state/entityId.test.ts
git commit -m "feat(editor): nextEntityId pur (id unique stable, fin des collisions Date.now)"
```

### Task A2 : Câbler `nextEntityId` + coalescence d'undo (P0)

**Files:** Modify `src/ui/editor/Editor.tsx`

- [ ] **Step 1 — import + remplacer les `Date.now()` d'id**

En tête : `import { nextEntityId } from '../../state/entityId';`. Puis remplacer les 4 fabrications d'id (relire les sites, ancrés sur `Date.now().toString(36)`) :
- entité (`applyAt` mode entity) : `const id = nextEntityId(tool.kind, scene.entities.map((e) => e.id));`
- trigger (`addTrigger`) : `id: nextEntityId('trig', scene.triggers.map((t) => t.id))`
- bâtiment (`addBuilding`) : `id: nextEntityId('b', (scene.buildings ?? []).map((b) => b.id))`
- rencontre (`applyAt` mode encounter) : `id: nextEntityId('enc', scene.encounters.map((e) => e.id))`

- [ ] **Step 2 — coalescence d'undo dans `useSceneHistory`**

Ajouter dans le hook (après `setScene`) :

```ts
  /** Push manuel de l'état COURANT dans l'historique (avant un geste coalescé). */
  const pushSnapshot = useCallback(() => {
    past.current.push(sceneRef.current);
    if (past.current.length > 200) past.current.shift();
    future.current = [];
  }, []);
  /** Mutation SANS snapshot (pendant un geste : peinture/glisser). */
  const setSceneNoHistory = useCallback((next: Scene) => setSceneState(next), []);
```

Et exposer dans le `return` : `pushSnapshot, setSceneNoHistory`. Déstructurer côté `Editor()` : `const { scene, setScene, setSceneNoHistory, pushSnapshot, undo, redo, resetScene, canUndo, canRedo } = useSceneHistory(...)`.

- [ ] **Step 3 — appliquer la coalescence à la peinture terrain**

Dans `onPointerDown`, branche peinture (`setPainting(true); applyAt(p)`) : préfixer par `pushSnapshot();`. Faire que `applyAt`, pour `mode:'tile'`, utilise `setSceneNoHistory` au lieu de `setScene` (peinture). Les autres modes d'`applyAt` (place/erase/encounter) gardent `setScene`. Concrètement, paramétrer : `applyAt(p, { coalesce: true })` depuis les moves de peinture → utilise `setSceneNoHistory`. Le 1er coup (pointerdown) a déjà fait `pushSnapshot()`, donc 1 seul cran pour tout le trait.

- [ ] **Step 4 — typecheck + recette undo**

Run: `npm run typecheck`
Recette : peindre un trait de 5 tuiles → **un seul Ctrl+Z** annule tout le trait (pas 5).

- [ ] **Step 5 — commit**

```bash
git add src/ui/editor/Editor.tsx
git commit -m "feat(editor): nextEntityId cable + coalescence d'undo (un geste = un cran)"
```

### Task A3 : Outil « Sélection/Déplacer » + glisser-déplacer (P1)

**Files:** Modify `src/ui/editor/Editor.tsx`

- [ ] **Step 1 — ajouter le mode `select` au type `Tool` + le rendre défaut**

`type Tool = { mode: 'select' } | { mode: 'tile'; … } | …`. Initialiser `useState<Tool>({ mode: 'select' })`. Ajouter un bouton « ↖ Sélection » en tête de la palette Carte (`palTab==='carte'`).

- [ ] **Step 2 — état de drag + helper de déplacement**

Ajouter `const moveRef = useRef<{ kind: 'entity'|'building'|'trigger'|'spawn'; id: string; enc?: number; idx?: number; from: {x:number;y:number} } | null>(null);`. Helper :

```ts
  /** Entité/spawn/bâtiment/trigger occupant la case p (priorité spawn > trigger > entité > bâtiment). */
  function hitAt(p: { x: number; y: number }) {
    const sp = scene.encounters.flatMap((e, ei) => e.enemies.map((en, ii) => ({ e: en, ei, ii })))
      .find((x) => x.e.pos.x === p.x && x.e.pos.y === p.y);
    if (sp) return { kind: 'spawn' as const, id: `${sp.ei}:${sp.ii}`, enc: sp.ei, idx: sp.ii };
    const t = scene.triggers.find((t) => p.x >= t.rect.x && p.x < t.rect.x + t.rect.w && p.y >= t.rect.y && p.y < t.rect.y + t.rect.h);
    const ent = scene.entities.find((e) => e.pos.x === p.x && e.pos.y === p.y);
    if (ent) return { kind: 'entity' as const, id: ent.id };
    if (t) return { kind: 'trigger' as const, id: t.id };
    const b = (scene.buildings ?? []).find((b) => p.x >= b.foot.x && p.x < b.foot.x + b.foot.w && p.y >= b.foot.y && p.y < b.foot.y + b.foot.h);
    if (b) return { kind: 'building' as const, id: b.id };
    return null;
  }
  /** Déplace la cible (delta en cases), clampée dans la carte. Mutation coalescée. */
  function moveTarget(m: NonNullable<typeof moveRef.current>, to: { x: number; y: number }) {
    const { w, h } = scene.dimensions;
    const cl = (v: number, max: number) => Math.max(0, Math.min(max - 1, v));
    if (m.kind === 'entity') {
      setSceneNoHistory({ ...scene, entities: scene.entities.map((e) => e.id === m.id ? { ...e, pos: { x: cl(to.x, w), y: cl(to.y, h) } } : e) });
    } else if (m.kind === 'spawn') {
      const encs = scene.encounters.map((e) => ({ ...e, enemies: [...e.enemies] }));
      encs[m.enc!].enemies[m.idx!] = { ...encs[m.enc!].enemies[m.idx!], pos: { x: cl(to.x, w), y: cl(to.y, h) } };
      setSceneNoHistory({ ...scene, encounters: encs });
    } else if (m.kind === 'trigger') {
      setSceneNoHistory({ ...scene, triggers: scene.triggers.map((t) => t.id === m.id ? { ...t, rect: { ...t.rect, x: cl(to.x, w - t.rect.w + 1), y: cl(to.y, h - t.rect.h + 1) } } : t) });
    } else {
      setSceneNoHistory({ ...scene, buildings: (scene.buildings ?? []).map((b) => b.id === m.id ? { ...b, foot: { ...b.foot, x: cl(to.x, w - b.foot.w + 1), y: cl(to.y, h - b.foot.h + 1) } } : b) });
    }
  }
```

- [ ] **Step 3 — brancher dans les pointer handlers**

`onPointerDown` (après le bloc pan, sinon) : si `tool.mode === 'select'`, faire `const hit = hitAt(p);` ; si `hit`, sélectionner (router vers `setSelected`/`selectTrigger`/`selectSpawn`/`setSelectedBuilding` selon `hit.kind`), `pushSnapshot()`, et `moveRef.current = { ...hit, from: p }`. Sinon, comportement existant (trigger/building drag-rect, ou paint).

`onPointerMove` : si `moveRef.current`, `moveTarget(moveRef.current, isoTile(e))` ; sinon logique existante.

`onPointerUp` / `onPointerLeave` : `moveRef.current = null;` (le snapshot a déjà été poussé au down → 1 undo).

- [ ] **Step 4 — champs X/Y pour entités/props dans l'inspecteur**

Dans le bloc inspecteur entité (`sel`), ajouter deux `<input type="number">` Position X / Y reliés à `updateSel({ pos: { ...sel.pos, x: +e.target.value } })` (et y).

- [ ] **Step 5 — typecheck + recette**

Run: `npm run typecheck`
Recette : outil Sélection → attraper un PNJ et le glisser ; glisser un bâtiment (tout le rect) ; un seul Ctrl+Z annule le déplacement ; les X/Y de l'inspecteur suivent.

- [ ] **Step 6 — commit** `feat(editor): outil Selection + glisser-deplacer (entites/spawns/triggers/batiments) + X/Y entites`.

### Task A4 : Copier / coller / dupliquer (P2)

**Files:** Modify `src/ui/editor/Editor.tsx`

- [ ] **Step 1 — état presse-papier + hover**

```ts
  const [clip, setClip] = useState<{ kind: 'entity'; data: SceneEntity } | null>(null);
  const hoverRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 }); // dernière case survolée
```
Mettre à jour `hoverRef.current` dans `onPointerMove` (`hoverRef.current = isoTile(e)`).

- [ ] **Step 2 — actions copier/dupliquer**

```ts
  function copySel() { if (sel) setClip({ kind: 'entity', data: JSON.parse(JSON.stringify(sel)) }); }
  function pasteAt(p: { x: number; y: number }) {
    if (!clip) return;
    const id = nextEntityId(clip.data.kind, scene.entities.map((e) => e.id));
    const ent: SceneEntity = { ...JSON.parse(JSON.stringify(clip.data)), id, pos: { ...p } };
    setScene({ ...scene, entities: [...scene.entities, ent] });
    setSelected(id); setSelectedTrigger(null); setSelectedSpawn(null); setSelectedBuilding(null);
  }
  function duplicateSel() { if (sel) { setClip({ kind: 'entity', data: JSON.parse(JSON.stringify(sel)) }); pasteAt({ x: sel.pos.x + 1, y: sel.pos.y + 1 }); } }
```
(`duplicateSel` lit `clip` au prochain rendu ? Non : appeler `pasteAt` avec une copie locale. Refacto : `pasteEntity(data, p)` prenant la donnée en argument, utilisé par `pasteAt` et `duplicateSel`, pour ne pas dépendre du `setClip` asynchrone.)

- [ ] **Step 3 — raccourcis clavier (étendre le useEffect Ctrl)**

Dans le handler Ctrl existant (après undo/redo), ajouter : `c` → `copySel()` ; `v` → `pasteAt(hoverRef.current)` ; `d` → `e.preventDefault(); duplicateSel()`. (Toujours gated hors INPUT/TEXTAREA/SELECT.)

- [ ] **Step 4 — bouton « Dupliquer » dans l'inspecteur entité** (`onClick={duplicateSel}`).

- [ ] **Step 5 — typecheck + recette** : Ctrl+C sur un PNJ stylé → Ctrl+V sous le curseur (clone, id frais, apparence conservée) ; Ctrl+D décale de +1,+1 ; bouton Dupliquer OK.

- [ ] **Step 6 — commit** `feat(editor): copier/coller/dupliquer une entite (Ctrl+C/V/D + bouton, id frais)`.

### Task A5 : Recette Vague A + commit groupé

- [ ] `npm run typecheck && npm test` verts ; recette navigateur complète (drag, copier/coller, undo coalescé). Pousser si demandé.

---

## VAGUE B — navigation, sûreté, terrain (P3 + P4 + P5)

### Task B1 : `validateScene` pur (P4) — TDD

**Files:** Create `src/state/validateScene.ts` ; Test `src/state/validateScene.test.ts`

- [ ] **Step 1 — test qui échoue** (`validateScene.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { validateScene, type Warning } from './validateScene';
import { emptyScene } from './scene';

function base() { const s = emptyScene(5, 5); s.id = 'A'; return s; }
const msgs = (w: Warning[]) => w.map((x) => x.message);

describe('validateScene', () => {
  it('scène propre = 0 avertissement', () => {
    expect(validateScene([base()])).toEqual([]);
  });
  it('dialogueId d entité inexistant → erreur', () => {
    const s = base(); s.entities.push({ id: 'e-0', kind: 'personnage', pos: { x: 1, y: 1 }, dialogueId: 'manque' });
    const w = validateScene([s]);
    expect(w.some((x) => x.scope === 'entity' && x.refId === 'e-0' && /dialogue inexistant/.test(x.message))).toBe(true);
  });
  it('effet transition vers scène inconnue → erreur', () => {
    const s = base(); s.triggers.push({ id: 't-0', rect: { x: 0, y: 0, w: 1, h: 1 }, effects: [{ type: 'transition', scene: 'nope' }] });
    expect(msgs(validateScene([s])).some((m) => /scène inexistante/.test(m))).toBe(true);
  });
  it('trigger hors carte → erreur', () => {
    const s = base(); s.triggers.push({ id: 't-1', rect: { x: 4, y: 4, w: 3, h: 3 }, effects: [] });
    expect(msgs(validateScene([s])).some((m) => /déborde/.test(m))).toBe(true);
  });
  it('ids dupliqués → erreur', () => {
    const s = base();
    s.entities.push({ id: 'dup', kind: 'objet', pos: { x: 0, y: 0 } }, { id: 'dup', kind: 'objet', pos: { x: 1, y: 1 } });
    expect(msgs(validateScene([s])).some((m) => /dupliqué/.test(m))).toBe(true);
  });
  it('building interiorScene vers scène présente dans le projet = OK', () => {
    const a = base(); a.buildings = [{ id: 'b', type: 'maison', foot: { x: 0, y: 0, w: 2, h: 2 }, reveal: 'door', interiorScene: 'B' }];
    const b = emptyScene(3, 3); b.id = 'B';
    expect(validateScene([a, b]).filter((w) => w.scope === 'building')).toEqual([]);
  });
});
```

- [ ] **Step 2 — run → FAIL** (`npx vitest run src/state/validateScene.test.ts`).

- [ ] **Step 3 — implémenter** (`validateScene.ts`)

```ts
import type { Scene, Effect } from './scene';

export interface Warning {
  level: 'error' | 'warn';
  sceneId: string;
  scope: 'entity' | 'building' | 'trigger' | 'dialogue' | 'encounter' | 'scene';
  refId?: string; // id du fautif (pour clic → sélection)
  message: string;
}

/** Le Test imbrique onSuccess/onFailure → parcours récursif. */
function walkEffects(effects: Effect[] | undefined, fn: (e: Effect) => void) {
  for (const e of effects ?? []) {
    fn(e);
    if (e.type === 'test') { walkEffects(e.onSuccess, fn); walkEffects(e.onFailure, fn); }
  }
}

export function validateScene(project: Scene[]): Warning[] {
  const out: Warning[] = [];
  const sceneIds = new Set(project.map((s) => s.id));
  for (const s of project) {
    const dlgIds = new Set(s.dialogues.map((d) => d.id));
    const encIds = new Set(s.encounters.map((e) => e.id));
    const { w, h } = s.dimensions;
    const within = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
    const add = (level: Warning['level'], scope: Warning['scope'], refId: string | undefined, message: string) =>
      out.push({ level, sceneId: s.id, scope, refId, message });
    const checkEffect = (eff: Effect, refId: string, scope: Warning['scope']) => {
      if (eff.type === 'startDialogue' && !dlgIds.has(eff.dialogue)) add('error', scope, refId, `Effet → dialogue inexistant « ${eff.dialogue} »`);
      if (eff.type === 'startCombat' && !encIds.has(eff.encounter)) add('error', scope, refId, `Effet → rencontre inexistante « ${eff.encounter} »`);
      if (eff.type === 'transition' && !sceneIds.has(eff.scene)) add('error', scope, refId, `Effet → scène inexistante « ${eff.scene} »`);
    };
    const dup = (ids: string[], scope: Warning['scope']) => {
      const seen = new Set<string>();
      for (const id of ids) { if (seen.has(id)) add('error', scope, id, `Id dupliqué « ${id} »`); seen.add(id); }
    };

    dup(s.entities.map((e) => e.id), 'entity');
    dup((s.buildings ?? []).map((b) => b.id), 'building');
    dup(s.triggers.map((t) => t.id), 'trigger');
    dup(s.dialogues.map((d) => d.id), 'dialogue');
    dup(s.encounters.map((e) => e.id), 'encounter');

    for (const e of s.entities) {
      if (e.dialogueId && !dlgIds.has(e.dialogueId)) add('error', 'entity', e.id, `${e.label ?? e.id} → dialogue inexistant « ${e.dialogueId} »`);
      if (!within(e.pos.x, e.pos.y)) add('warn', 'entity', e.id, `${e.label ?? e.id} hors carte (${e.pos.x},${e.pos.y})`);
    }
    for (const b of s.buildings ?? []) {
      if (b.interiorScene && !sceneIds.has(b.interiorScene)) add('error', 'building', b.id, `${b.label ?? b.id} → scène intérieure inexistante « ${b.interiorScene} »`);
    }
    for (const t of s.triggers) {
      if (!within(t.rect.x, t.rect.y) || !within(t.rect.x + t.rect.w - 1, t.rect.y + t.rect.h - 1)) add('warn', 'trigger', t.id, `Zone « ${t.id} » déborde de la carte`);
      walkEffects(t.effects, (eff) => checkEffect(eff, t.id, 'trigger'));
    }
    for (const d of s.dialogues) {
      const nodeIds = new Set(d.nodes.map((n) => n.id));
      if (!nodeIds.has(d.start)) add('error', 'dialogue', d.id, `Dialogue « ${d.id} » : départ « ${d.start} » inexistant`);
      for (const n of d.nodes) for (const c of n.choices) {
        if (c.next && !nodeIds.has(c.next)) add('error', 'dialogue', d.id, `Dialogue « ${d.id} » : choix → « ${c.next} » inexistant`);
        walkEffects(c.effects, (eff) => checkEffect(eff, d.id, 'dialogue'));
      }
    }
    for (const e of s.encounters) walkEffects(e.onVictory, (eff) => checkEffect(eff, e.id, 'encounter'));
  }
  return out;
}
```

- [ ] **Step 4 — run → PASS** (`npx vitest run src/state/validateScene.test.ts`).

- [ ] **Step 5 — commit** `feat(editor): validateScene pur (refs cassees, hors-carte, ids dupliques) + tests`.

### Task B2 : `ValidationPanel` + câblage (P4)

**Files:** Create `src/ui/editor/ValidationPanel.tsx` ; Modify `Editor.tsx`

- [ ] **Step 1 — composant** (`ValidationPanel.tsx`)

```tsx
import type { Warning } from '../../state/validateScene';

export function ValidationPanel({ warnings, onSelect }: { warnings: Warning[]; onSelect: (w: Warning) => void }) {
  if (!warnings.length) return <p className="ed-ok">✓ Aucun problème détecté.</p>;
  const errs = warnings.filter((w) => w.level === 'error').length;
  return (
    <div className="ed-validation">
      <div className="ed-validation-head">{errs} erreur(s), {warnings.length - errs} avertissement(s)</div>
      <ul>
        {warnings.map((w, i) => (
          <li key={i} className={w.level} onClick={() => onSelect(w)} style={{ cursor: 'pointer' }}>
            <span className="badge">{w.level === 'error' ? '⛔' : '⚠️'}</span> [{w.scope}] {w.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2 — câbler dans l'onglet Logique**

Dans `Editor.tsx` : `import { validateScene } from '../../state/validateScene'; import { ValidationPanel } from './ValidationPanel';`. Calcul mémoïsé : `const warnings = useMemo(() => validateScene([scene, ...otherScenes]).filter((w) => w.sceneId === scene.id), [scene, otherScenes]);`. Sous l'onglet `logique`, ajouter un bouton/section « Validation (N) » montrant `<ValidationPanel warnings={warnings} onSelect={selectWarning} />`. Badge compteur sur le bouton de l'onglet si `warnings.some(level==='error')`.

- [ ] **Step 3 — `selectWarning`** : route selon `w.scope`/`w.refId` → `setSelected(w.refId)` (entity), `selectTrigger(w.refId)`, `setSelectedBuilding(w.refId)`, ou ouvrir le modal dialogues/rencontres.

- [ ] **Step 4 — typecheck + recette** : casser un `dialogueId`, un `transition.scene`, dupliquer un id → apparaissent ; clic → sélectionne le fautif.

- [ ] **Step 5 — commit** `feat(editor): panneau de validation (clic → selection du fautif)`.

### Task B3 : `EntityListPanel` + clavier Suppr/flèches (P3)

**Files:** Create `src/ui/editor/EntityListPanel.tsx` ; Modify `Editor.tsx`

- [ ] **Step 1 — composant** (`EntityListPanel.tsx`)

```tsx
import type { SceneEntity } from '../../state/scene';

export function EntityListPanel({ entities, selectedId, onSelect }: { entities: SceneEntity[]; selectedId: string | null; onSelect: (id: string) => void }) {
  if (!entities.length) return null;
  const ICON: Record<string, string> = { heroStart: '🏁', personnage: '🙂', objet: '📦', prop: '🌳' };
  return (
    <div className="ed-entity-list">
      <h4>Entités ({entities.length})</h4>
      <ul>
        {entities.map((e) => (
          <li key={e.id} className={e.id === selectedId ? 'sel' : ''} onClick={() => onSelect(e.id)} style={{ cursor: 'pointer' }}>
            {ICON[e.kind] ?? '•'} {e.label ?? e.ref ?? e.id} <span className="pos">({e.pos.x},{e.pos.y})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2 — afficher** dans l'inspecteur quand rien n'est sélectionné (à côté de « Bâtiments posés »), `onSelect={(id)=>{ setSelected(id); setSelectedTrigger(null); setSelectedSpawn(null); setSelectedBuilding(null); }}`.

- [ ] **Step 3 — clavier Suppr/flèches** (nouveau `useEffect`, gated hors INPUT/TEXTAREA/SELECT)

```ts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (sel) { e.preventDefault(); setScene({ ...scene, entities: scene.entities.filter((x) => x.id !== sel.id) }); setSelected(null); }
        else if (selT) { e.preventDefault(); setScene({ ...scene, triggers: scene.triggers.filter((t) => t.id !== selT.id) }); setSelectedTrigger(null); }
        else if (selB) { e.preventDefault(); setScene({ ...scene, buildings: (scene.buildings ?? []).filter((b) => b.id !== selB.id) }); setSelectedBuilding(null); }
        return;
      }
      const d: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (sel && d[e.key]) {
        e.preventDefault();
        const { w, h } = scene.dimensions;
        const nx = Math.max(0, Math.min(w - 1, sel.pos.x + d[e.key][0]));
        const ny = Math.max(0, Math.min(h - 1, sel.pos.y + d[e.key][1]));
        setScene({ ...scene, entities: scene.entities.map((x) => x.id === sel.id ? { ...x, pos: { x: nx, y: ny } } : x) });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scene, sel, selT, selB, setScene]);
```

- [ ] **Step 4 — typecheck + recette** : liste → sélectionner une entité cachée sous un bâtiment ; Suppr supprime ; flèches nudgent.

- [ ] **Step 5 — commit** `feat(editor): liste d'entites selectionnable + clavier Suppr/fleches`.

### Task B4 : Recherche palette + calques masquables (P3)

**Files:** Modify `Editor.tsx`

- [ ] **Step 1 — recherche créatures** : ajouter un `<input>` filtre au-dessus de chaque `<select>` créature (rencontre / spawn ref / apparence). État `const [creatureFilter, setCreatureFilter] = useState('')` ; filtrer les options : `enemyCreatures.filter((c) => c.label.toLowerCase().includes(creatureFilter.toLowerCase()))`. (Un filtre par select suffit s'ils ne sont pas visibles simultanément ; sinon un état par select.)

- [ ] **Step 2 — calques masquables** : `const [layers, setLayers] = useState({ triggers: true, spawns: true, buildings: true });` + 3 cases à cocher (palette Carte ou barre d'outils). Gater le rendu de chaque calque dans le canvas (`{layers.triggers && …}`, idem spawns, buildings) — masquer retire aussi leur `stopPropagation` (le calque n'est pas monté).

- [ ] **Step 3 — typecheck + recette** : taper « rat » filtre la liste ; décocher « Triggers » → on peut peindre/cliquer sous une zone.

- [ ] **Step 4 — commit** `feat(editor): recherche dans les palettes creatures + calques masquables`.

### Task B5 : Confort terrain & carte (P5)

**Files:** Modify `Editor.tsx`

- [ ] **Step 1 — taille de pinceau** : `const [brush, setBrush] = useState(1);` (1/3/5, contrôle dans la palette terrain). Dans `applyAt` mode tile, peindre un carré de rayon `r = (brush-1)/2` autour de `p` (clamp carte) au lieu d'une seule tuile.

- [ ] **Step 2 — remplissage rectangle terrain** : ajouter un sous-mode (case « rect » sur l'outil terrain) → réutiliser le mécanisme drag-rect (`dragStartRef`/`setDragRect`) et, au pointerup, remplir le rect avec `tool.terrain` (un seul `setScene` = 1 undo).

- [ ] **Step 3 — resize non-destructif** : dans `resize()`, avant de réduire, compter `lost = #tuiles/entités/triggers/bâtiments hors nouvelles bornes` ; si `lost>0`, afficher un avertissement inline + bouton « Réduire quand même » (au lieu du drop silencieux). Sinon appliquer directement.

- [ ] **Step 4 — recentrer/fit-to-view** : bouton « ⊡ Recentrer » → calcule `view.zoom`/`x`/`y` pour cadrer toute la carte (depuis `stageSize(dims)` et la taille du conteneur) ; sinon reset `{ zoom: 1, x: 0, y: 0 }` (déjà existant) comme repli.

- [ ] **Step 5 — typecheck + recette** : pinceau 3×3 + rect-fill (1 undo) ; réduire la carte avec contenu dehors → avertissement ; recentrer cadre la carte.

- [ ] **Step 6 — commit** `feat(editor): pinceau/rect-fill terrain + resize non-destructif + recentrer`.

### Task B6 : Recette Vague B + suite complète

- [ ] `npm run typecheck && npm test` verts ; recette navigateur complète (validation, liste, clavier, recherche, calques, terrain) ; 0 erreur console. Pousser si demandé.

---

## Self-review (couverture spec)

- §4 P0 (`nextEntityId` + coalescence) → A1, A2. ✓
- §4 P1 (glisser-déplacer + outil select + X/Y) → A3. ✓
- §4 P2 (copier/coller/dupliquer) → A4. ✓
- §4 P3 (liste, clavier, recherche, calques) → B3, B4. ✓
- §4 P4 (`validateScene` + panneau) → B1, B2. ✓
- §4 P5 (pinceau/rect-fill/resize/recentrer) → B5. ✓
- §5 tests (purs + recette) → A1/B1 unitaires ; recettes A5/B6. ✓

**Risques d'exécution** : `Editor.tsx` partagé/mouvant → relire chaque site avant édition, ancrer sur motifs (pas lignes), commits pathspec ; `duplicateSel` ne doit pas lire `clip` après `setClip` (passer la donnée en argument, cf. A4 Step 2) ; deps des `useEffect` clavier (inclure `scene`/`sel`) pour éviter les closures périmées.
