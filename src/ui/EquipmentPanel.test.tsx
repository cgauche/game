import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EquipmentPanel } from './EquipmentPanel';
import { itemFromTrappingById, recomputeLoadout } from '../engine/items';
import { trappings } from '../data';
import type { Combatant, ItemInstance } from '../engine/types';

/** Shim de test : libellé → instance par id (authoring). */
const itemFromTrapping = (label: string) => itemFromTrappingById(trappings.find((t) => t.label === label)!.id);

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
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
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
  it('localisations × couches : PA cumulé en face de la zone, plate proposée en Extérieure', () => {
    const html = renderToStaticMarkup(<EquipmentPanel hero={mkHero()} />);
    expect(html).toContain('Tête');
    expect(html).toContain('Corps');
    expect(html).toContain('Souple'); // libellé de couche (en-tête + tooltip)
    expect(html).toContain('Flexible');
    expect(html).toContain('PA 3'); // Corps : maille (Flexible, 2) + justaucorps (souple, 1) cumulés par wornArmourPoints
    expect(html).toContain('Plastron · PA 2'); // candidat de la couche Extérieure (option du picker)
    expect(html).toContain('eq-slot'); // cellules-emplacements (nom des pièces portées = popover au survol)
  });

  it('mannequin présent (rig SVG) + colonne emplacements en cellules + ligne Cape', () => {
    const html = renderToStaticMarkup(<EquipmentPanel hero={mkHero()} />);
    expect(html).toContain('equip-figure');
    expect(html).toContain('equip-slots');
    expect(html).toContain('eq-slot'); // cellules-emplacements
    expect(html).toContain('Cape');
  });

  it('cape portée → rendue dans le dos du mannequin (data-equip="cape") et retirable', () => {
    const html = renderToStaticMarkup(<EquipmentPanel hero={mkHero((items) => { items.find((i) => i.uid === 'cape')!.equipped = true; })} />);
    expect(html).toContain('data-equip="cape"');
    expect(html).not.toContain('aucune cape');
  });

  it('sets d’armes en cartes-cellules (sans libellé « Set ») ; hallebarde marquée (2M) ; récap en main', () => {
    const html = renderToStaticMarkup(<EquipmentPanel hero={mkHero()} />);
    expect(html).toContain('set-card');
    expect(html).toContain('● Actif'); // Set I actif par défaut
    expect(html).toContain('Hallebarde (2M)'); // option du picker d'arme
    expect(html).toContain('En main');
    expect(html).toContain('Arme simple');
    expect(html).not.toContain('Set I'); // plus de libellé « Set 1/2/3 »
  });

  it('arme 2 mains en principale → cellule secondaire bloquée (pas de 2nde main)', () => {
    const h = mkHero();
    h.loadouts![0].main = 'halle';
    h.loadouts![0].off = undefined;
    recomputeLoadout(h);
    const html = renderToStaticMarkup(<EquipmentPanel hero={h} />);
    expect(html).toContain('deux mains'); // titre de la cellule 2nde bloquée
  });
});
