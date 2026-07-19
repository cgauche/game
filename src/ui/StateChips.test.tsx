import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ActiveEffect, Combatant, ConditionInstance } from '../engine/types';
import { chipCodex, combatantFlags, summarizeEffects } from '../gameIso/effectIcons';
import { StateChips } from './StateChips';

const cond = (name: string, value = 1): ConditionInstance => ({ id: name, value } as ConditionInstance);

/** Héros minimal, patron `EtatPanel.test.tsx` (mkHero). */
const mkHero = (mut?: (c: Combatant) => void): Combatant => {
  const c = {
    id: 'h', name: 'H', kind: 'hero', species: 'humains-reiklander', career: 'soldat',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 },
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    conditions: [], skills: [], talents: [], movement: 4, items: [],
  } as unknown as Combatant;
  mut?.(c);
  return c;
};

describe('StateChips — pastilles de portrait', () => {
  it('État et buff informent par le MÊME mécanisme Codex que EffectChips', () => {
    const hero = mkHero((c) => {
      c.conditions = [cond('assourdi')];
      c.activeEffects = [{ label: 'Bénédiction de courage', bonus: 10, char: 'capacite-de-combat', duration: { scale: 'rounds', left: 3 }, sourceSpellId: 'benediction-de-courage' } as ActiveEffect];
    });
    const html = renderToStaticMarkup(<StateChips c={hero} />);
    expect(html).not.toContain('title=');
    expect((html.match(/codex-ref/g) ?? []).length).toBe(2);
  });

  it('le drapeau Peur du portrait ouvre SA fiche psychologique (routage par id stable, pas un popover générique)', () => {
    const hero = mkHero((c) => { c.psychState = [{ type: 'peur', indice: 2, calmeDR: 0 }] as Combatant['psychState']; });
    const chip = summarizeEffects([], [], Infinity, combatantFlags(hero)).visible[0];
    expect(chip.flagId).toBe('fear');
    expect(chipCodex(chip)).toMatchObject({ category: 'psychologies', id: 'peur' });
    expect(renderToStaticMarkup(<StateChips c={hero} />)).toContain('codex-ref');
  });

  it('la pastille garde sa classe de compacité `.pt-state` dans la colonne `.ptile-states`', () => {
    const hero = mkHero((c) => { c.conditions = [cond('assourdi')]; });
    const html = renderToStaticMarkup(<StateChips c={hero} />);
    expect(html).toContain('ptile-states');
    expect(html).toContain('pt-state');
  });

  it('le débord « ▾ » reste une pastille du même mécanisme (popover, pas d’infobulle)', () => {
    const hero = mkHero((c) => { c.conditions = [cond('assourdi'), cond('aveugle'), cond('empetre')]; });
    const html = renderToStaticMarkup(<StateChips c={hero} max={1} />);
    expect(html).not.toContain('title=');
    expect(html).toContain('ptile-more');
  });

  it('`reserve` garde l’empreinte stable de la cellule quand aucun effet n’est actif', () => {
    const html = renderToStaticMarkup(<StateChips c={mkHero()} reserve />);
    expect(html).toContain('ptile-states');
    expect(html).not.toContain('pt-state');
  });
});
