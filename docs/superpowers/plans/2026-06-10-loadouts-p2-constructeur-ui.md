# Loadouts — Plan #2 : constructeur de loadouts (fiche perso)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (ou subagent-driven-development).
> Steps en checkbox (`- [ ]`).

**Goal:** Le joueur construit/nomme ses loadouts (main/secondaire) dans la fiche perso, choisit l'actif, et les
armes sont gérées via les loadouts (le bouton « Équiper » des armes est remplacé par l'assignation aux slots).

**Architecture:** Mutateurs de loadout PURS dans `engine/items.ts` (testables) → `partyFlow` les enveloppe
(clone + `recomputeLoadout`) → `store.ts` câble (pattern `toggleEquip`) → UI `LoadoutSection` dans
`CharacterSheet`. Hors combat uniquement (le verrou d'équipement-en-combat est plan #3).

**Tech Stack:** TypeScript, React, Zustand, Vitest. Réf : `docs/superpowers/specs/2026-06-10-loadouts-deux-armes-design.md` (§4.1, §6) + plan #1 (fondation livrée).

**Commande de test :** `npx vitest run <fichier>` ; `npm test` ; `npm run typecheck`.

---

## Task 1 : Mutateurs de loadout purs + actions store

**Files:**
- Modify: `src/engine/items.ts` (`newLoadoutId`, `loadoutCreate`, `loadoutRename`, `loadoutDelete`, `loadoutSetSlot`, `loadoutSetActive`)
- Modify: `src/state/partyFlow.ts` (wrappers)
- Modify: `src/state/store.ts` (types + câblage)
- Test: `src/engine/items.test.ts` (bloc « mutateurs de loadout »)

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter à `src/engine/items.test.ts` :
```ts
import { loadoutCreate, loadoutRename, loadoutDelete, loadoutSetSlot, loadoutSetActive } from './items';

describe('mutateurs de loadout (purs)', () => {
  const w = (uid: string, name: string, p: Partial<ItemInstance> = {}): ItemInstance =>
    ({ uid, name, kind: 'melee', qualities: [], enc: 1, equipped: true, hands: 1, ...p } as ItemInstance);
  const hero = (items: ItemInstance[]): Combatant =>
    ({ id: 'h', name: 'H', kind: 'hero', items, loadouts: [], activeLoadoutId: undefined } as unknown as Combatant);

  it('loadoutCreate ajoute un loadout vide et le rend actif', () => {
    const c = hero([w('e', 'Epee')]);
    const id = loadoutCreate(c, 'Test');
    expect(c.loadouts!.find((l) => l.id === id)).toMatchObject({ name: 'Test', main: undefined, off: undefined });
    expect(c.activeLoadoutId).toBe(id);
  });

  it('loadoutSetSlot pose une arme ; une arme 2 mains en main vide le slot off', () => {
    const c = hero([w('h2', 'Hallebarde', { hands: 2 }), w('b', 'Bouclier')]);
    const id = loadoutCreate(c, 'L');
    loadoutSetSlot(c, id, 'off', 'b');
    loadoutSetSlot(c, id, 'main', 'h2'); // 2 mains → off effacé
    const lo = c.loadouts!.find((l) => l.id === id)!;
    expect(lo.main).toBe('h2');
    expect(lo.off).toBeUndefined();
  });

  it('loadoutSetSlot(slot, null) vide le slot', () => {
    const c = hero([w('e', 'Epee')]);
    const id = loadoutCreate(c, 'L');
    loadoutSetSlot(c, id, 'main', 'e');
    loadoutSetSlot(c, id, 'main', null);
    expect(c.loadouts!.find((l) => l.id === id)!.main).toBeUndefined();
  });

  it('loadoutRename / loadoutSetActive', () => {
    const c = hero([w('e', 'Epee')]);
    const id = loadoutCreate(c, 'L');
    loadoutRename(c, id, 'Garde');
    expect(c.loadouts!.find((l) => l.id === id)!.name).toBe('Garde');
    const id2 = loadoutCreate(c, 'L2');
    loadoutSetActive(c, id);
    expect(c.activeLoadoutId).toBe(id);
    loadoutSetActive(c, 'inconnu'); // ignore un id invalide
    expect(c.activeLoadoutId).toBe(id);
  });

  it('loadoutDelete : supprime ; si actif, bascule sur le 1er restant', () => {
    const c = hero([w('e', 'Epee')]);
    const a = loadoutCreate(c, 'A');
    const b = loadoutCreate(c, 'B'); // actif = b
    loadoutDelete(c, b);
    expect(c.loadouts!.map((l) => l.id)).toEqual([a]);
    expect(c.activeLoadoutId).toBe(a);
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `npx vitest run src/engine/items.test.ts` → FAIL (`loadoutCreate` is not a function).

- [ ] **Step 3 : Implémenter les mutateurs purs dans `items.ts`**

Ajouter (après `ensureDefaultLoadout`) :
```ts
/** Id de loadout unique (réutilise le compteur d'ensureDefaultLoadout). */
export function newLoadoutId(): string {
  return `lo-${++loadoutCounter}`;
}

/** Crée un loadout vide nommé, le rend actif, et renvoie son id. */
export function loadoutCreate(c: Combatant, name: string): string {
  const id = newLoadoutId();
  c.loadouts = [...(c.loadouts ?? []), { id, name }];
  c.activeLoadoutId = id;
  return id;
}

export function loadoutRename(c: Combatant, id: string, name: string): void {
  const lo = c.loadouts?.find((l) => l.id === id);
  if (lo) lo.name = name;
}

/** Supprime un loadout ; si c'était l'actif, bascule sur le 1er restant (ou undefined). */
export function loadoutDelete(c: Combatant, id: string): void {
  c.loadouts = (c.loadouts ?? []).filter((l) => l.id !== id);
  if (c.activeLoadoutId === id) c.activeLoadoutId = c.loadouts[0]?.id;
}

export function loadoutSetActive(c: Combatant, id: string): void {
  if (c.loadouts?.some((l) => l.id === id)) c.activeLoadoutId = id;
}

/** Assigne (ou retire si `uid` null) une arme à un slot. Une arme à 2 mains en `main` vide le slot `off`. */
export function loadoutSetSlot(c: Combatant, id: string, slot: 'main' | 'off', uid: string | null): void {
  const lo = c.loadouts?.find((l) => l.id === id);
  if (!lo) return;
  lo[slot] = uid ?? undefined;
  if (slot === 'main' && uid) {
    const it = (c.items ?? []).find((i) => i.uid === uid);
    if (it && weaponHands(it) === 2) lo.off = undefined; // 2 mains → pas de secondaire
  }
}
```

- [ ] **Step 4 : Lancer le bloc, vérifier le succès**

Run: `npx vitest run src/engine/items.test.ts` → PASS.

- [ ] **Step 5 : Wrappers `partyFlow` + câblage `store`**

Dans `src/state/partyFlow.ts`, importer les mutateurs et ajouter (après `toggleEquip`) :
```ts
/** Applique une mutation de loadout à un héros (clone + recompute), pattern de toggleEquip. */
function mutLoadout(set: Set, heroId: string, fn: (c: Combatant) => void): void {
  set((s) => ({
    party: s.party.map((h) => {
      if (h.id !== heroId) return h;
      const clone: Combatant = JSON.parse(JSON.stringify(h));
      fn(clone);
      recomputeLoadout(clone);
      return clone;
    }),
  }));
}

export function createLoadout(_get: Get, set: Set, heroId: string, name: string): void {
  mutLoadout(set, heroId, (c) => loadoutCreate(c, name));
}
export function renameLoadout(_get: Get, set: Set, heroId: string, id: string, name: string): void {
  mutLoadout(set, heroId, (c) => loadoutRename(c, id, name));
}
export function deleteLoadout(_get: Get, set: Set, heroId: string, id: string): void {
  mutLoadout(set, heroId, (c) => loadoutDelete(c, id));
}
export function setActiveLoadout(_get: Get, set: Set, heroId: string, id: string): void {
  mutLoadout(set, heroId, (c) => loadoutSetActive(c, id));
}
export function setLoadoutSlot(_get: Get, set: Set, heroId: string, id: string, slot: 'main' | 'off', uid: string | null): void {
  mutLoadout(set, heroId, (c) => loadoutSetSlot(c, id, slot, uid));
}
```
Ajouter à l'import existant de `partyFlow.ts` depuis `../engine/items` : `loadoutCreate, loadoutRename, loadoutDelete, loadoutSetActive, loadoutSetSlot`.

Dans `src/state/store.ts`, déclarer les types (près de `toggleEquip:` ~l.224) :
```ts
  createLoadout: (heroId: string, name: string) => void;
  renameLoadout: (heroId: string, id: string, name: string) => void;
  deleteLoadout: (heroId: string, id: string) => void;
  setActiveLoadout: (heroId: string, id: string) => void;
  setLoadoutSlot: (heroId: string, id: string, slot: 'main' | 'off', uid: string | null) => void;
```
et câbler (près de `toggleEquip:` ~l.597) :
```ts
  createLoadout: (heroId, name) => partyFlow.createLoadout(get, set, heroId, name),
  renameLoadout: (heroId, id, name) => partyFlow.renameLoadout(get, set, heroId, id, name),
  deleteLoadout: (heroId, id) => partyFlow.deleteLoadout(get, set, heroId, id),
  setActiveLoadout: (heroId, id) => partyFlow.setActiveLoadout(get, set, heroId, id),
  setLoadoutSlot: (heroId, id, slot, uid) => partyFlow.setLoadoutSlot(get, set, heroId, id, slot, uid),
```

- [ ] **Step 6 : typecheck + suite**

Run: `npm run typecheck` → 0 erreur. `npm test` → PASS.

- [ ] **Step 7 : Commit**

```bash
git add src/engine/items.ts src/engine/items.test.ts src/state/partyFlow.ts src/state/store.ts
git commit -m "feat(combat): mutateurs de loadout purs + actions store (create/rename/delete/active/setSlot)"
```

---

## Task 2 : Composant `LoadoutSection`

**Files:**
- Create: `src/ui/LoadoutSection.tsx`
- Test: `src/ui/LoadoutSection.test.tsx`

- [ ] **Step 1 : Écrire le test qui échoue**

`src/ui/LoadoutSection.test.tsx` :
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadoutSection } from './LoadoutSection';
import type { Combatant } from '../engine/types';

const hero = (): Combatant =>
  ({
    id: 'h', name: 'H', kind: 'hero',
    items: [
      { uid: 'e', name: 'Épée', kind: 'melee', qualities: [], enc: 1, equipped: true, hands: 1 },
      { uid: 'b', name: 'Bouclier', kind: 'melee', qualities: ['Défensive'], enc: 1, equipped: true, hands: 1 },
    ],
    loadouts: [{ id: 'l1', name: 'Mêlée', main: 'e', off: 'b' }],
    activeLoadoutId: 'l1',
  } as unknown as Combatant);

const handlers = { onCreate: vi.fn(), onRename: vi.fn(), onDelete: vi.fn(), onSetActive: vi.fn(), onSetSlot: vi.fn() };

describe('LoadoutSection', () => {
  it('rend le loadout, ses slots, et le bouton créer', () => {
    render(<LoadoutSection hero={hero()} {...handlers} />);
    expect(screen.getByDisplayValue('Mêlée')).toBeTruthy(); // nom éditable
    expect(screen.getByText(/Nouveau loadout/i)).toBeTruthy();
    // slot principal = Épée sélectionnée
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2); // main + off
  });
});
```

- [ ] **Step 2 : Lancer, vérifier l'échec**

Run: `npx vitest run src/ui/LoadoutSection.test.tsx` → FAIL (module introuvable).

- [ ] **Step 3 : Implémenter `LoadoutSection.tsx`**

```tsx
import type { Combatant, ItemInstance } from '../engine/types';
import { weaponHands } from '../engine/items';

interface Props {
  hero: Combatant;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onSetActive: (id: string) => void;
  onSetSlot: (id: string, slot: 'main' | 'off', uid: string | null) => void;
}

/** Constructeur de loadouts (sets d'armes) : nom, actif, slots main/secondaire depuis les armes portées.
 *  Une arme à 2 mains en principale grise le slot secondaire (LDB : 2 mains). */
export function LoadoutSection({ hero, onCreate, onRename, onDelete, onSetActive, onSetSlot }: Props) {
  const loadouts = hero.loadouts ?? [];
  const weapons: ItemInstance[] = (hero.items ?? []).filter((i) => i.kind === 'melee' || i.kind === 'ranged');
  const oneHanded = weapons.filter((w) => weaponHands(w) === 1);

  return (
    <div className="sheet-loadouts">
      <div className="mini-title">Sets d'armes (loadouts)</div>
      {loadouts.length === 0 && <p className="muted">Aucun set. Créez-en un pour choisir vos armes en main.</p>}
      {loadouts.map((lo) => {
        const mainItem = weapons.find((w) => w.uid === lo.main);
        const mainTwoHanded = mainItem ? weaponHands(mainItem) === 2 : false;
        const active = hero.activeLoadoutId === lo.id;
        return (
          <div key={lo.id} className={`loadout-row ${active ? 'active' : ''}`}>
            <button className={`btn small ${active ? 'btn-primary' : ''}`} title="Rendre actif" onClick={() => onSetActive(lo.id)}>
              {active ? '● Actif' : 'Activer'}
            </button>
            <input className="lo-name" value={lo.name} onChange={(e) => onRename(lo.id, e.target.value)} />
            <label className="lo-slot">Main
              <select value={lo.main ?? ''} onChange={(e) => onSetSlot(lo.id, 'main', e.target.value || null)}>
                <option value="">— vide —</option>
                {weapons.map((w) => <option key={w.uid} value={w.uid}>{w.name}{weaponHands(w) === 2 ? ' (2M)' : ''}</option>)}
              </select>
            </label>
            <label className="lo-slot">2nde
              <select value={lo.off ?? ''} disabled={mainTwoHanded} onChange={(e) => onSetSlot(lo.id, 'off', e.target.value || null)}>
                <option value="">{mainTwoHanded ? '— (2 mains) —' : '— vide —'}</option>
                {oneHanded.filter((w) => w.uid !== lo.main).map((w) => <option key={w.uid} value={w.uid}>{w.name}</option>)}
              </select>
            </label>
            <button className="btn small" title="Supprimer ce set" onClick={() => onDelete(lo.id)}>🗑</button>
          </div>
        );
      })}
      <button className="btn small" onClick={() => onCreate(`Set ${loadouts.length + 1}`)}>+ Nouveau loadout</button>
    </div>
  );
}
```

- [ ] **Step 4 : Lancer, vérifier le succès**

Run: `npx vitest run src/ui/LoadoutSection.test.tsx` → PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/ui/LoadoutSection.tsx src/ui/LoadoutSection.test.tsx
git commit -m "feat(ui): LoadoutSection — constructeur de sets d'armes (main/secondaire, actif, 2M grise le secondaire)"
```

---

## Task 3 : Intégrer dans `CharacterSheet` + réconcilier l'« Équiper » des armes

**Files:**
- Modify: `src/ui/CharacterSheet.tsx` (monter `LoadoutSection` ; les armes ne montrent plus « Équiper »)

- [ ] **Step 1 : Monter `LoadoutSection` dans `FicheBody`**

Dans `src/ui/CharacterSheet.tsx`, importer en tête :
```tsx
import { LoadoutSection } from './LoadoutSection';
```
Dans `FicheBody`, lire les actions du store (à côté de `toggleEquip`) :
```tsx
  const createLoadout = useGame((s) => s.createLoadout);
  const renameLoadout = useGame((s) => s.renameLoadout);
  const deleteLoadout = useGame((s) => s.deleteLoadout);
  const setActiveLoadout = useGame((s) => s.setActiveLoadout);
  const setLoadoutSlot = useGame((s) => s.setLoadoutSlot);
```
Juste APRÈS le bloc `<div className="sheet-combat">…</div>` (après la fermeture, ~l.256), insérer :
```tsx
      {!inBattle && (
        <LoadoutSection
          hero={hero}
          onCreate={(name) => createLoadout(hero.id, name)}
          onRename={(id, name) => renameLoadout(hero.id, id, name)}
          onDelete={(id) => deleteLoadout(hero.id, id)}
          onSetActive={(id) => setActiveLoadout(hero.id, id)}
          onSetSlot={(id, slot, uid) => setLoadoutSlot(hero.id, id, slot, uid)}
        />
      )}
```

- [ ] **Step 2 : Réconcilier l'inventaire (armes gérées via loadouts)**

Dans le bloc inventaire (~l.327), restreindre « équipable » aux armures/prothèses (les armes passent par les
loadouts ; `recomputeLoadout` resynchronise leur `equipped` → le toggle serait inopérant). Remplacer :
```tsx
            const equipable = it.kind === 'melee' || it.kind === 'ranged' || it.kind === 'armor' || isProsthesis;
```
par :
```tsx
            const equipable = it.kind === 'armor' || isProsthesis; // armes = via les loadouts (cf. LoadoutSection)
            const inLoadout = (it.kind === 'melee' || it.kind === 'ranged') && (hero.loadouts ?? []).some((l) => l.main === it.uid || l.off === it.uid);
```
Et dans la rangée, juste avant le `{equipable ? (…) : consumable ? (…)}`, ajouter un indicateur pour les armes :
```tsx
                  {(it.kind === 'melee' || it.kind === 'ranged') && (
                    <span className={`ir-loadout ${inLoadout ? 'on' : ''}`} title="Géré via les sets d'armes (loadouts)">
                      {inLoadout ? '🗡 en set' : '—'}
                    </span>
                  )}
```

- [ ] **Step 3 : typecheck + suite + render**

Run: `npm run typecheck` → 0 erreur.
Run: `npx vitest run src/ui/CharacterSheet.test.tsx` → PASS (ajuster l'assertion si elle attendait un bouton « Équiper » sur une arme — elle ne devrait pas).
Run: `npm test` → PASS.

- [ ] **Step 4 : Commit**

```bash
git add src/ui/CharacterSheet.tsx
git commit -m "feat(ui): LoadoutSection dans la fiche ; armes gerees via loadouts (plus d'Equiper par arme)"
```

---

## Auto-revue (couverture)

- Actions store loadout (§6) → Task 1. Mutateurs purs testés → Task 1.
- Constructeur UI (nom/actif/slots, 2M grise le secondaire, §6) → Task 2.
- Intégration fiche + réconciliation « Équiper » armes → Task 3.
- HORS de ce plan : verrou d'équipement EN COMBAT + commutateur ActionBar (plan #3) ; choix d'arme
  attaque/parade (plan #3) ; Maniement (plan #4) ; lâcher/amputation (plan #5).
- Recette navigateur (Playwright) : à faire en fin de plan #3 quand le combat consomme les loadouts.
