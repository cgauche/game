import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EquipmentPanel } from './EquipmentPanel';
import { itemFromTrapping, recomputeLoadout } from '../engine/items';
import type { Combatant, ItemInstance } from '../engine/types';

/** Héros de test : cuir souple + maille PORTÉS (couches superposées), plate et cape au sac,
 *  arme simple en main + hallebarde (2M) au sac. Armure/armes/loadouts dérivés par recompute. */
const mkHero = (mut?: (items: ItemInstance[]) => void): Combatant => {
  const real = (label: string, uid: string, equipped: boolean): ItemInstance => ({
    ...itemFromTrapping(label)!,
    uid,
    equipped,
  });
  const items = [
    real('Justaucorps de cuir', 'cuir', true),
    real('Chemise de mailles', 'maille', true),
    real('Plastron', 'plate', false),
    real('Cape', 'cape', false),
    real('Arme simple', 'epee', true),
    real('Hallebarde', 'halle', false),
  ];
  mut?.(items);
  const c = {
    id: 'h',
    name: 'H',
    kind: 'hero',
    species: 'Humains (Reiklander)',
    career: 'Soldat',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 12, max: 12 },
    conditions: [],
    skills: [],
    talents: [],
    movement: 4,
    items,
  } as unknown as Combatant;
  recomputeLoadout(c); // dérive armour/weapons + auto-génère Set I / Set II
  return c;
};

describe('EquipmentPanel (rendu)', () => {
  it('zones à couches : cuir souple et maille portés ENSEMBLE (PA cumulés), plate proposée en Extérieure', () => {
    const html = renderToStaticMarkup(<EquipmentPanel hero={mkHero()} />);
    expect(html).toContain('Tête');
    expect(html).toContain('Corps');
    expect(html).toContain('Justaucorps de cuir'); // couche Souple portée
    expect(html).toContain('Chemise de mailles'); // couche Flexible portée
    expect(html).toContain('Souple');
    expect(html).toContain('Flexible');
    expect(html).toContain('PA 3'); // Corps : maille (Flexible, 2) + justaucorps (souple, 1) cumulés par wornArmourPoints
    expect(html).toContain('Plastron · PA 2'); // candidat de la couche Extérieure (option du sélecteur)
  });

  it('mannequin présent (rig SVG) et emplacement Cape proposant la cape du sac', () => {
    const html = renderToStaticMarkup(<EquipmentPanel hero={mkHero()} />);
    expect(html).toContain('equip-figure');
    expect(html).toContain('Cape');
    expect(html).toContain('+ Équiper…');
  });

  it('cape portée → rendue dans le dos du mannequin (data-equip="cape") et retirable', () => {
    const html = renderToStaticMarkup(<EquipmentPanel hero={mkHero((items) => { items.find((i) => i.uid === 'cape')!.equipped = true; })} />);
    expect(html).toContain('data-equip="cape"');
    expect(html).not.toContain('aucune cape');
  });

  it('sets d’armes : Set I (actif, arme en main) et Set II fixes ; hallebarde marquée (2M)', () => {
    const html = renderToStaticMarkup(<EquipmentPanel hero={mkHero()} />);
    expect(html).toContain('Set I');
    expect(html).toContain('Set II');
    expect(html).toContain('● Actif');
    expect(html).toContain('Hallebarde (2M)');
    expect(html).toContain('En main');
    expect(html).toContain('Arme simple');
  });

  it('arme 2 mains en principale → slot secondaire désactivé', () => {
    const h = mkHero();
    h.loadouts![0].main = 'halle';
    h.loadouts![0].off = undefined;
    recomputeLoadout(h);
    const html = renderToStaticMarkup(<EquipmentPanel hero={h} />);
    expect(html).toContain('(2 mains)');
    expect(html).toContain('disabled');
  });
});
