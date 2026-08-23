// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SeatAssignmentsField } from './SeatAssignmentsField';
import { emptyScene, type Scene } from '../../state/scene';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/** Table ronde en (2,2) cap `N` → abords : nord (2,1), est (3,2), sud (2,3), ouest (1,2). */
function sceneWithTableAndNpc(): Scene {
  const s = emptyScene(8, 8);
  s.entities = [
    { id: 'table-1', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'table-ronde-4-tabourets', facing: 'N' },
    { id: 'pnj-aubergiste', kind: 'personnage', pos: { x: 6, y: 6 }, label: 'Aubergiste' },
  ];
  return s;
}

function mount(scene: Scene, propId = 'table-1') {
  let latest = scene;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  const render = (s: Scene) =>
    root.render(<SeatAssignmentsField scene={s} propId={propId} onChange={(next) => { latest = next; render(next); }} />);
  act(() => render(scene));
  const selects = () => [...container.querySelectorAll('select')] as HTMLSelectElement[];
  return {
    container,
    sceneOf: () => latest,
    text: () => container.textContent ?? '',
    /** Le `<select>` de la place dont le `<label>` porte ce texte. */
    selectOf: (labelText: string) => {
      const found = [...container.querySelectorAll('label')].find((l) => l.textContent?.startsWith(labelText));
      const sel = found?.querySelector('select');
      if (!sel) throw new Error(`aucune place « ${labelText} » (labels : ${selects().length})`);
      return sel as HTMLSelectElement;
    },
    choose: (labelText: string, value: string) => {
      const sel = [...container.querySelectorAll('label')]
        .find((l) => l.textContent?.startsWith(labelText))!
        .querySelector('select') as HTMLSelectElement;
      act(() => {
        sel.value = value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
    },
  };
}

describe('SeatAssignmentsField — authoring des places assises (id-only)', () => {
  it('affiche les slots de la ref et écrit un occupant par id', () => {
    const ui = mount(sceneWithTableAndNpc());
    expect(ui.text()).toContain('4 places');
    expect([...ui.selectOf('Place nord').options].map((o) => o.value)).toEqual(['', 'entity:pnj-aubergiste']);
    ui.choose('Place nord', 'entity:pnj-aubergiste');
    expect(ui.sceneOf().seatAssignments).toEqual({ 'table-1': { nord: { kind: 'entity', entityId: 'pnj-aubergiste' } } });
  });

  it('pose la `pos` du PNJ sur l’abord EFFECTIF de sa place, dans la même écriture', () => {
    const ui = mount(sceneWithTableAndNpc());
    ui.choose('Place nord', 'entity:pnj-aubergiste');
    expect(ui.sceneOf().entities.find((e) => e.id === 'pnj-aubergiste')?.pos).toEqual({ x: 2, y: 1 });
  });

  it('« — personne — » libère la place et laisse le PNJ où il se tient', () => {
    const ui = mount(sceneWithTableAndNpc());
    ui.choose('Place nord', 'entity:pnj-aubergiste');
    ui.choose('Place nord', '');
    expect(ui.sceneOf().seatAssignments).toEqual({});
    expect(ui.sceneOf().entities.find((e) => e.id === 'pnj-aubergiste')?.pos).toEqual({ x: 2, y: 1 });
  });

  it('rasseoir un PNJ déjà attablé le DÉPLACE de place — jamais deux places pour un corps', () => {
    const ui = mount(sceneWithTableAndNpc());
    ui.choose('Place nord', 'entity:pnj-aubergiste');
    ui.choose('Place est', 'entity:pnj-aubergiste');
    expect(ui.sceneOf().seatAssignments).toEqual({ 'table-1': { est: { kind: 'entity', entityId: 'pnj-aubergiste' } } });
    expect(ui.sceneOf().entities.find((e) => e.id === 'pnj-aubergiste')?.pos).toEqual({ x: 3, y: 2 });
  });

  it('n’offre AUCUNE saisie libre : les options sont des ids d’entités de la scène', () => {
    const ui = mount(sceneWithTableAndNpc());
    expect(ui.container.querySelectorAll('input').length).toBe(0);
    for (const opt of [...ui.selectOf('Place sud').options].filter((o) => o.value))
      expect(ui.sceneOf().entities.some((e) => `entity:${e.id}` === opt.value)).toBe(true);
  });

  it('un décor sans place n’affiche rien', () => {
    const s = sceneWithTableAndNpc();
    s.entities[0] = { id: 'table-1', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'tonneau' };
    expect(mount(s).text()).toBe('');
  });

  // ── I2 (sonde S4 du juge, promue) ────────────────────────────────────────────────────────────────
  it('déplacer un HÉROS d’une place à l’autre est ACCEPTÉ — la source des héros est le DOCUMENT, pas l’occupation', () => {
    const s = sceneWithTableAndNpc();
    s.seatAssignments = { 'table-1': { nord: { kind: 'party', heroId: 'h1' } } };
    const ui = mount(s);
    expect([...ui.selectOf('Place sud').options].map((o) => o.value)).toContain('party:h1');
    ui.choose('Place sud', 'party:h1');
    expect(ui.sceneOf().seatAssignments).toEqual({ 'table-1': { sud: { kind: 'party', heroId: 'h1' } } });
    expect(ui.text()).not.toContain('Place refusée');
  });

  it('libérer la place d’un héros ne le fait PAS disparaître de la liste', () => {
    const s = sceneWithTableAndNpc();
    s.seatAssignments = { 'table-1': { nord: { kind: 'party', heroId: 'h1' } } };
    const ui = mount(s);
    ui.choose('Place nord', '');
    expect(ui.sceneOf().seatAssignments).toEqual({});
    expect([...ui.selectOf('Place nord').options].map((o) => o.value)).toContain('party:h1');
    ui.choose('Place nord', 'party:h1');
    expect(ui.sceneOf().seatAssignments).toEqual({ 'table-1': { nord: { kind: 'party', heroId: 'h1' } } });
  });

  it('un abord introuvable REFUSE la place, en toutes lettres, sans écrire', () => {
    const s = sceneWithTableAndNpc();
    // Table cernée de murs : aucune case voisine du siège n'est marchable, aucun abord ne se résout.
    s.layers = [{ z: 0, tiles: new Array(8 * 8).fill('mur') }];
    s.layers[0].tiles[2 * 8 + 2] = 'plancher';
    s.entities[1] = { id: 'pnj-aubergiste', kind: 'personnage', pos: { x: 2, y: 2 }, label: 'Aubergiste' };
    const ui = mount(s);
    ui.choose('Place nord', 'entity:pnj-aubergiste');
    expect(ui.sceneOf().seatAssignments).toBeUndefined();
    expect(ui.text()).toContain('aucun abord praticable ne dessert cette place');
  });
});
