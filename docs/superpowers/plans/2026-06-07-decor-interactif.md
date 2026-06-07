# Décor interactif (fouille/ramassage) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tout `prop` (décor) peut devenir fouillable/ramassable via un canal `interact: { effects, consume }` ; le kind `objet` disparaît (migration), avec affordance et déplacement-puis-fouille.

**Architecture:** Une migration **pure testée** (`objet`→`prop`+`interact`, ancien loot/search absorbés) appliquée au chargement ; l'interaction (exploration + combat) re-ciblée sur `prop.interact` ; affordance (halo) dans IsoStage ; éditeur : `prop` gagne un bloc « Interactif ».

**Tech Stack:** Vite + TS + React, Zustand, Vitest. ⚠️ `store.ts`/`Editor.tsx`/`IsoStage.tsx` partagés (autre session active) → patchs ciblés, commits par pathspec, relire chaque site avant édition.

**Spec:** `docs/superpowers/specs/2026-06-07-decor-interactif-design.md`

---

## Carte des fichiers

| Fichier | Rôle | Phase |
|---|---|---|
| `src/state/sceneMigrate.ts` (créé) + `.test.ts` | `migrateSceneEntity` / `migrateEntityKind` purs | P0 |
| `src/state/scene.ts` | `EntityKind` (−objet), `SceneEntity` (+interact, −loot/search), `normalizeEntityKind` délègue | P0 |
| (sites de chargement de scène) | appliquer `migrateSceneEntity` aux entités | P0 |
| `src/state/scene.test.ts` | maj test `normalizeEntityKind` (objet→prop) | P0 |
| `src/state/store.ts` | `interactEntity` (prop+interact) ; `battlePickup` re-ciblé ; `pendingInteract` (P5) | P1/P2/P5 |
| `src/state/combatFlow.ts` | `entityPickables(interact.effects)` | P2 |
| `src/state/store.test.ts` | maj tests fouille/ramassage (search/loot → interact) | P1/P2 |
| `src/gameIso/sprites.ts` | retirer `case 'objet'` + `objetSprite` (kind mort) | P1 |
| `src/gameIso/IsoStage.tsx` | clic→interact (prop+interact‖dialogueId) + **halo d'affordance** | P1/P4 |
| `src/ui/editor/Editor.tsx` | −kind objet ; bloc « Interactif » sur `prop` | P3 |

---

## P0 — Modèle de données + migration

### Task 0.1 : `migrateSceneEntity` pur (TDD)

**Files:** Create `src/state/sceneMigrate.ts` ; Test `src/state/sceneMigrate.test.ts`

- [ ] **Step 1 — test qui échoue**

```ts
import { describe, it, expect } from 'vitest';
import { migrateSceneEntity, migrateEntityKind } from './sceneMigrate';

describe('migrateEntityKind', () => {
  it('objet → prop, pnj/ennemi → personnage, le reste passe', () => {
    expect(migrateEntityKind('objet')).toBe('prop');
    expect(migrateEntityKind('pnj')).toBe('personnage');
    expect(migrateEntityKind('ennemi')).toBe('personnage');
    expect(migrateEntityKind('prop')).toBe('prop');
    expect(migrateEntityKind('zzz')).toBe('personnage');
  });
});

describe('migrateSceneEntity', () => {
  it('objet + search → prop interactif qui RESTE (consume false)', () => {
    const e = migrateSceneEntity({ id: 'a', kind: 'objet', pos: { x: 1, y: 1 }, search: [{ type: 'giveTrapping', trapping: 'Dague' }] });
    expect(e.kind).toBe('prop');
    expect(e.interact?.effects).toEqual([{ type: 'giveTrapping', trapping: 'Dague' }]);
    expect(e.interact?.consume).toBe(false);
    expect((e as any).search).toBeUndefined();
  });
  it('objet + loot → prop qui DISPARAÎT (consume true), loot→giveItem', () => {
    const e = migrateSceneEntity({ id: 'b', kind: 'objet', pos: { x: 0, y: 0 }, loot: ['Épée', 'Potion'] });
    expect(e.interact?.consume).toBe(true);
    expect(e.interact?.effects).toEqual([{ type: 'giveItem', item: 'Épée' }, { type: 'giveItem', item: 'Potion' }]);
    expect((e as any).loot).toBeUndefined();
  });
  it('décor pur (prop sans loot/search) → pas d’interact', () => {
    const e = migrateSceneEntity({ id: 'c', kind: 'prop', pos: { x: 0, y: 0 }, ref: 'tonneau' });
    expect(e.interact).toBeUndefined();
    expect(e.ref).toBe('tonneau');
  });
});
```

- [ ] **Step 2 — run → FAIL** : `cd "C:/Users/gauch/PhpstormProjects/Foundry/Game" && npx vitest run src/state/sceneMigrate.test.ts`

- [ ] **Step 3 — implémenter**

```ts
import type { SceneEntity, EntityKind, Effect } from './scene';

/** Normalise le kind (compat) + 'objet' → 'prop'. PUR. */
export function migrateEntityKind(k: string): EntityKind {
  if (k === 'pnj' || k === 'ennemi') return 'personnage';
  if (k === 'objet') return 'prop';
  if (k === 'heroStart' || k === 'personnage' || k === 'prop') return k;
  return 'personnage';
}

/** Migre une entité (scène ancienne) : kind + ancien loot/search → `interact`. PUR. */
export function migrateSceneEntity(raw: any): SceneEntity {
  const { loot, search, kind, ...rest } = raw;
  const out: SceneEntity = { ...rest, kind: migrateEntityKind(kind) };
  const effects: Effect[] = [
    ...((search ?? []) as Effect[]),
    ...((loot ?? []) as string[]).map((item: string): Effect => ({ type: 'giveItem', item })),
  ];
  if (effects.length) out.interact = { effects, consume: !!loot && !search };
  return out;
}
```

- [ ] **Step 4 — run → PASS**.
- [ ] **Step 5 — commit** : `git add src/state/sceneMigrate.ts src/state/sceneMigrate.test.ts && git commit -m "feat(scene): migrateSceneEntity pur (objet→prop interactif)"`

### Task 0.2 : Schéma `scene.ts` + application au chargement

**Files:** Modify `src/state/scene.ts`, `src/state/scene.test.ts`, sites de chargement

- [ ] **Step 1 — `EntityKind` sans objet** : `export type EntityKind = 'heroStart' | 'personnage' | 'prop';`

- [ ] **Step 2 — `SceneEntity` : +interact, −loot/search**

Retirer `loot?: string[]` et `search?: Effect[]` ; ajouter :
```ts
  /** Décor INTERACTIF (fouille/ramassage). Absent = décor pur. consume:true → disparaît quand pris. */
  interact?: { effects: Effect[]; consume?: boolean };
```

- [ ] **Step 3 — `normalizeEntityKind` délègue** : remplacer son corps par `return migrateEntityKind(k);` (import depuis `./sceneMigrate`). (Garde l'API existante.)

- [ ] **Step 4 — appliquer `migrateSceneEntity` au CHARGEMENT**

Repérer où les scènes entrent dans le runtime (relire : `loadProject` `store.ts:771`, l'import éditeur, `transitionTo`/registre campagne, et tout endroit construisant un `Scene` depuis un document). À chaque entrée, mapper `scene.entities = scene.entities.map(migrateSceneEntity)`. Centraliser dans un helper `migrateScene(scene)` si plusieurs sites.

- [ ] **Step 5 — maj `scene.test.ts`** : le cas `normalizeEntityKind('objet')` (`scene.test.ts:28`) attend désormais `'prop'`.

- [ ] **Step 6 — typecheck** : `npm run typecheck` — relèvera TOUS les usages restants de `.loot`/`.search`/`kind==='objet'` à corriger (store, combatFlow, IsoStage, Editor, sprites). Les traiter dans les phases suivantes ; à ce stade la compilation peut être rouge tant que P1-P3 ne sont pas faites — **committer P0 quand `sceneMigrate` est vert même si le reste reste à câbler**, OU enchaîner P1-P3 avant de committer le tout. (Préférence : enchaîner P1-P3 puis committer ensemble la suppression des champs.)

> Note d'ordonnancement : retirer `loot`/`search` de `SceneEntity` casse la compilation jusqu'à ce que store/combatFlow/IsoStage/Editor soient migrés. Faire P0-step1/2/3 + P1 + P2 + P3 **en un bloc**, puis committer. (P0.1 `sceneMigrate` est committable seul avant.)

---

## P1 — Interaction exploration (`interactEntity`)

**Files:** Modify `src/state/store.ts` (`interactEntity` `:839-870`), `src/gameIso/IsoStage.tsx` (clic), `src/gameIso/sprites.ts`, `src/state/store.test.ts`

- [ ] **Step 1 — réécrire `interactEntity`** (remplace le bloc `:839-870`)

```ts
  interactEntity: (entityId) => {
    const { scene, partyPos } = get();
    if (!scene) return;
    const ent = scene.entities.find((e) => e.id === entityId);
    if (!ent) return;
    if (chebyshev(partyPos, ent.pos) > 1) {
      get().log('Trop loin pour interagir.'); // P5 : déplacement-puis-fouille
      return;
    }
    if (ent.dialogueId) {
      const dlg = scene.dialogues.find((d) => d.id === ent.dialogueId);
      if (dlg) set({ dialogue: { dialogue: dlg, nodeId: dlg.start } });
      return;
    }
    if (ent.interact) {
      if (get().flags[`__fouille_${entityId}`]) {
        get().log(`${ent.label ?? 'Déjà fouillé'} : rien de plus à trouver.`);
        return;
      }
      get().log(`Vous fouillez ${ent.label ?? 'les lieux'}…`);
      applyEffects(get, set, ent.interact.effects);
      get().advanceTime(TIME_COST.search);
      if (ent.interact.consume) removeEntity(get, set, entityId);
      else set((s) => ({ flags: { ...s.flags, [`__fouille_${entityId}`]: true } }));
    }
  },
```

- [ ] **Step 2 — clic→interact dans IsoStage** : relire le site (`IsoStage.tsx` ~432-435), remplacer la garde `ent.dialogueId || ent.kind === 'objet'` par `ent.dialogueId || !!ent.interact`.

- [ ] **Step 3 — nettoyer `sprites.ts`** : retirer `case 'objet': return objetSprite();` (kind mort) et la fonction `objetSprite` (vérifier 0 autre appelant). `prop` garde `propSprite(ent.ref)`.

- [ ] **Step 4 — maj `store.test.ts`** : les tests qui posaient `entity.search`/`entity.loot` (ex. `:1968` fouille avance le temps, `:1539-1540` corps→giveTrapping) doivent poser `interact: { effects: [...] }` à la place. Adapter les assertions (`corps.interact?.effects.some(...)`).

- [ ] **Step 5 — typecheck + tests** : `npm run typecheck && npm test` verts.

- [ ] **Step 6 — recette** : fouiller un cadavre (prop + interact `[giveTrapping, document]`) → objet reçu + document affiché + « rien de plus » au 2e clic ; prop `consume` → disparaît.

---

## P2 — Combat (« Ramasser »)

**Files:** Modify `src/state/combatFlow.ts` (`entityPickables` `:105-112`), `src/state/store.ts` (`battlePickup` `:1582-1624`), `src/state/store.test.ts`

- [ ] **Step 1 — `entityPickables` lit `interact.effects`**

```ts
/** Items ramassables d'un prop interactif : un par effet « donneur » de son `interact`. */
export function entityPickables(ent: { interact?: { effects: Effect[] } }): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  (ent.interact?.effects ?? []).forEach((e, i) => {
    if (e.type === 'giveTrapping') out.push({ key: `eff:${i}`, label: e.trapping });
    else if (e.type === 'giveItem') out.push({ key: `eff:${i}`, label: e.item });
    else if (e.type === 'giveMoney') out.push({ key: `eff:${i}`, label: `Argent` });
  });
  return out;
}
```

- [ ] **Step 2 — réécrire `battlePickup`** : relire le corps (`store.ts:1582-1624`). Nouveau flux : garde `ent.kind === 'prop' && ent.interact` (au lieu de `'objet'`), adjacent, non-`__fouille_`. `key = 'eff:<i>'` → `const eff = ent.interact.effects[i]` ; appliquer selon `eff.type` (`giveTrapping` → `itemFromTrapping` ajouté à l'actif **et** au membre party + `recomputeLoadout` ; `giveItem` → `inventory` ; `giveMoney` → bourse) ; retirer l'effet du pool `ent.interact.effects = ent.interact.effects.filter((_, j) => j !== i)`. Quand le pool est vide → `ent.interact.consume ? removeEntity : set flag __fouille_`. `battle.acted = true`, log.

- [ ] **Step 3 — maj `store.test.ts`** combat pickup (search/loot → interact.effects).

- [ ] **Step 4 — typecheck + tests** verts. **Recette** : « Ramasser » sur un prop interactif adjacent en combat → vrai objet dans l'inventaire du héros.

---

## P3 — Éditeur

**Files:** Modify `src/ui/editor/Editor.tsx`

- [ ] **Step 1 — retirer le kind `objet`** : `KINDS` (`:36`) sans `'objet'` ; retirer `KIND_LABEL.objet`. Le bouton « Objet » disparaît.

- [ ] **Step 2 — supprimer le bloc inspecteur `objet`** (`:1361-1379`, butin + fouille).

- [ ] **Step 3 — bloc « Interactif » sur `prop`** : dans l'inspecteur `prop` (après `ref`/`foot`), ajouter

```tsx
<label className="ed-field">
  <input type="checkbox" checked={!!sel.interact} onChange={(e) => updateSel({ interact: e.target.checked ? (sel.interact ?? { effects: [] }) : undefined })} /> Interactif (fouille / ramassage)
</label>
{sel.interact && (
  <>
    <label className="ed-field">
      <input type="checkbox" checked={!!sel.interact.consume} onChange={(e) => updateSel({ interact: { ...sel.interact!, consume: e.target.checked } })} /> Disparaît quand pris
    </label>
    <EffectList effects={sel.interact.effects} encounters={scene.encounters} dialogues={scene.dialogues} onChange={(eff) => updateSel({ interact: { ...sel.interact!, effects: eff } })} />
  </>
)}
```
(Adapter les props d'`EffectList` à sa signature réelle — relire `EffectList.tsx`.)

- [ ] **Step 4 — typecheck + recette éditeur** : sélectionner un `prop` (ex. cadavre), cocher « Interactif », ajouter un effet `giveTrapping`, tester en jeu → fouillable.

- [ ] **Step 5 — commit groupé P0(reste)+P1+P2+P3** (les champs supprimés rendent la compilation cohérente) :
```bash
git add src/state/scene.ts src/state/scene.test.ts src/state/store.ts src/state/store.test.ts src/state/combatFlow.ts src/gameIso/sprites.ts src/gameIso/IsoStage.tsx src/ui/editor/Editor.tsx
git commit -m "feat(scene): decor interactif — dissout objet dans prop (interact effects+consume), migration, combat, editeur"
```

---

## P4 — Affordance (halo)

**Files:** Modify `src/gameIso/IsoStage.tsx`

- [ ] **Step 1 — halo pulsé sur les props interactifs** : dans la passe de rendu des `prop` (relire `IsoStage.tsx`, passe prop), si `ent.interact`, ajouter un `<ellipse>`/`<path>` lumineux doux animé (CSS `anim.css`, ex. classe `interact-halo` : pulsation d'opacité) sous/autour du sprite, + `cursor:pointer` sur son `<g>`. Décor pur = inchangé (pas de halo).

- [ ] **Step 2 — CSS** : ajouter `.interact-halo { animation: haloPulse 1.6s ease-in-out infinite; }` + keyframes (opacité 0.25↔0.6) dans `src/gameIso/anim.css`.

- [ ] **Step 3 — recette** : un prop interactif a un halo pulsé + curseur main ; un décor pur n'en a pas. 0 erreur console.

- [ ] **Step 4 — commit** : `feat(iso): halo d'affordance sur les decors interactifs`.

---

## P5 — Déplacement-puis-fouille (move-to-interact)

**Files:** Modify `src/state/store.ts`

- [ ] **Step 1 — champ `pendingInteract`** : ajouter `pendingInteract: string | null` (init null) à l'état + interface.

- [ ] **Step 2 — clic à distance pose `pendingInteract` + se déplace** : dans `interactEntity`, remplacer la branche `chebyshev > 1` (qui logue « Trop loin ») par : calculer une case adjacente libre à `ent.pos` (réutiliser le pathing/`bestAdjacentReachable` ou un voisin walkable), `set({ pendingInteract: entityId })`, puis `get().moveParty(cible)` (ou la primitive de déplacement libre exploration).

- [ ] **Step 3 — déclencher à l'arrivée** : dans `moveParty` (après mise à jour `partyPos`), si `pendingInteract` et le groupe est désormais adjacent à l'entité → `const id = get().pendingInteract; set({ pendingInteract: null }); get().interactEntity(id)`. Annuler `pendingInteract` si le joueur clique ailleurs (clic sol/déplacement manuel sans cible).

- [ ] **Step 4 — recette** : cliquer un prop interactif **éloigné** → le groupe s'y rend et **fouille automatiquement** à l'arrivée. Cliquer ailleurs en route annule.

- [ ] **Step 5 — commit** : `feat(scene): clic-a-distance sur un decor interactif -> deplacement puis fouille`.

---

## Self-review (couverture spec)

- §3 (data model interact, −objet/loot/search) → P0.2. ✓
- §4 (migration pure) → P0.1. ✓
- §5 (interaction explo + move-to-interact) → P1 + P5. ✓
- §6 (combat) → P2. ✓
- §7 (rendu + affordance) → P1.3 (sprites) + P4 (halo). ✓
- §8 (éditeur) → P3. ✓
- §9 (tests) → P0.1/P1/P2 unitaires ; recettes P1-P5. ✓
- §10 découpage SP1 → ce plan ; SP2 sprites = spec séparé. ✓

**Risques d'exécution** : suppression `loot`/`search` casse la compilation → faire P0(schéma)+P1+P2+P3 en bloc avant commit ; `battlePickup` à relire intégralement (corps non lu ici) ; `EffectList` props à confirmer ; appliquer `migrateSceneEntity` à TOUS les sites de chargement (grep `loadProject`/`transitionTo`/construction de `Scene`) ; vérifier le scénario Chapitre 2 (butin par corps) reste vert ; fichiers partagés → pathspec.
