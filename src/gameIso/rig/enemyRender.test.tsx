import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { RigSprite } from './composeRig';
import { enemyRigProfile } from './enemyProfile';
import type { Combatant, Weapon, ArmourPoints } from '../../engine/types';

const noArmour: ArmourPoints = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
function mkEnemy(name: string, over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'e1', name, kind: 'enemy',
    characteristics: {} as Combatant['characteristics'],
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [],
    weapons: [{ name: 'Épée', type: 'melee', damage: '+4', qualities: [] } as Weapon],
    armour: { ...noArmour }, skills: [], talents: [], movement: 4,
    ...over,
  } as Combatant;
}

function render(c: Combatant, view: 'front' | 'back' | 'profile' = 'front') {
  const p = enemyRigProfile(c)!;
  return renderToStaticMarkup(
    React.createElement(RigSprite, {
      appearance: p.appearance, equip: p.equip, career: p.career, overlays: p.overlays, view,
    }),
  );
}

describe('rendu rig ennemi (F1)', () => {
  it('un Bandit riggé affiche son arme (os arme rendu)', () => {
    const svg = render(mkEnemy('Bandit'));
    expect(svg).toContain('data-bone="arme"');
  });

  it('un Mutant riggé porte un calque de mutation visible', () => {
    const svg = render(mkEnemy('Mutant'));
    expect(svg).toContain('data-mut=');
  });

  it('rend les 3 vues sans planter', () => {
    for (const v of ['front', 'back', 'profile'] as const) {
      expect(render(mkEnemy('Soldat'), v).length).toBeGreaterThan(100);
    }
  });

  it('armure synthétisée des PA visible (os torse rendu pour un soldat cuirassé)', () => {
    const svg = render(mkEnemy('Soldat', { armour: { ...noArmour, corps: 4 } }));
    expect(svg).toContain('data-bone="torse"');
  });
});
