import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameOpEditor, opSummary, newOp, formulaSummary, shapeOf, formulaForShape } from './GameOpEditor';
import type { GameOp } from '../../engine/ops';

/**
 * ÉDITEUR D'OPS COMPLET — gate de RÉGRESSION : (a) une Formule (`{dice}`/`{charOf}`) se lit/édite sans
 * être écrasée en nombre (le bug `num()` → 0), (b) le menu « + op » propose TOUT le vocabulaire, (c)
 * chaque op a un éditeur — dédié ou repli JSON. Round-trip SANS PERTE = critère n°1.
 */

describe('GameOpEditor — Formule sans perte (correction du bug num()→0)', () => {
  it('un wounds {dice} N’affiche PAS « 0 » et rend l’éditeur de dés (1 d 10)', () => {
    const ops: GameOp[] = [{ op: 'wounds', amount: { dice: { n: 1, sides: 10 } } }];
    const html = renderToStaticMarkup(<GameOpEditor ops={ops} onChange={() => {}} />);
    // Le résumé montre la formule, pas « 0 » (le bug historique : num()→0 → « 0 Blessure(s) »).
    expect(html).toContain('1d10');
    expect(opSummary(ops[0])).not.toMatch(/(^|[^d\d])0 Blessure/); // pas un « 0 » isolé devant « Blessure »
    expect(opSummary(ops[0])).toContain('1d10 Blessure');
    // L’éditeur est sur la forme « Dés » sélectionnée (pas un champ nombre à 0).
    expect(html).toContain('value="dice"');
    expect(html).toContain('value="1"'); // n
    expect(html).toContain('value="10"'); // faces
  });

  it('opSummary lit chaque forme de Formula (littéral / Bonus / Valeur / Dés)', () => {
    expect(opSummary({ op: 'wounds', amount: 5 })).toContain('5 Blessure');
    expect(opSummary({ op: 'wounds', amount: { bonusOf: 'FM' } })).toContain('BFM Blessure');
    expect(opSummary({ op: 'wounds', amount: { charOf: 'FM' } })).toContain('FM Blessure');
    expect(opSummary({ op: 'heal', amount: { dice: { n: 1, sides: 10, plus: 2 } } })).toContain('1d10+2');
  });

  it('formulaSummary couvre les 4 formes (jamais « 0 » pour une formule réelle)', () => {
    expect(formulaSummary(7)).toBe('7');
    expect(formulaSummary({ bonusOf: 'F' })).toBe('BF');
    expect(formulaSummary({ charOf: 'Int' })).toBe('Int');
    expect(formulaSummary({ dice: { n: 2, sides: 6 } })).toBe('2d6');
  });

  it('changer de forme NE clobbe PAS une formule déjà de la bonne forme', () => {
    const dice = { dice: { n: 1, sides: 10 } } as const;
    // Rester sur « dice » renvoie la MÊME référence (aucune coercition en nombre).
    expect(shapeOf(dice)).toBe('dice');
    expect(formulaForShape('dice', dice)).toBe(dice);
    expect(shapeOf({ charOf: 'FM' })).toBe('char');
    expect(formulaForShape('char', { charOf: 'FM' })).toEqual({ charOf: 'FM' });
    // Bascule littéral→nombre conserve la valeur littérale ; vers une forme structurée → défaut valide.
    expect(formulaForShape('lit', 4)).toBe(4);
    expect(formulaForShape('dice', 4)).toEqual({ dice: { n: 1, sides: 10 } });
  });
});

describe('GameOpEditor — menu « + op » COMPLET', () => {
  it('le menu propose narrative ET grantWeapon (entre autres)', () => {
    const html = renderToStaticMarkup(<GameOpEditor ops={[]} onChange={() => {}} />);
    expect(html).toContain('Effet narratif'); // narrative
    expect(html).toContain('Invoquer une arme magique'); // grantWeapon
    expect(html).toContain('+ Op mécanique');
  });

  it('toutes les op du vocabulaire ont un défaut valide et un libellé', () => {
    const OPS: GameOp['op'][] = [
      'wounds', 'heal', 'healCaster', 'condition', 'removeCondition', 'charMod', 'apAll', 'test',
      'corruption', 'gainResource', 'castPenalty', 'grantTrait', 'grantTalent',
      'augmentWeapon', 'cureDisease', 'reduceDiseaseDays', 'preventInfection', 'cureCriticalWound',
      'reduceToZero', 'ignoreStatePenalties', 'freeReroll', 'critTwice', 'damageArmour', 'suppressPsych',
      'castWard', 'suffocate', 'arrowWard', 'domeWard', 'attackWardFM', 'martyr', 'noBreath', 'noHunger',
      'testMod', 'weatherWard', 'giveTrapping', 'grantWeapon', 'grantNaturalWeapon', 'perRound', 'narrative',
    ];
    for (const k of OPS) {
      const o = newOp(k);
      expect(o.op, `${k} → défaut`).toBe(k);
      expect(opSummary(o), `${k} → résumé`).not.toBe(''); // résumé informatif, jamais vide
    }
  });
});

describe('GameOpEditor — éditeur pour TOUTE op (dédié ou repli JSON)', () => {
  it('grantWeapon (sans éditeur dédié) rend un repli JSON montrant ses params', () => {
    const ops: GameOp[] = [{ op: 'grantWeapon', name: 'Arme aethyrique', damage: { bonusOf: 'FM' }, plusBF: false }];
    const html = renderToStaticMarkup(<GameOpEditor ops={ops} onChange={() => {}} />);
    expect(html).toContain('(JSON)'); // repli JSON présent
    expect(html).toContain('Arme aethyrique'); // params lisibles dans le textarea
    expect(html).toContain('bonusOf'); // la formule de Dégâts est visible (pas perdue)
    expect(opSummary(ops[0])).toContain('Arme aethyrique');
  });

  it('narrative a un éditeur de texte dédié', () => {
    const ops: GameOp[] = [{ op: 'narrative', text: 'Le sol tremble.' }];
    const html = renderToStaticMarkup(<GameOpEditor ops={ops} onChange={() => {}} />);
    expect(html).toContain('Le sol tremble.');
    expect(opSummary(ops[0])).toContain('Le sol tremble.');
  });

  it('une op test (à sous-ops) a un éditeur DÉDIÉ : champs + sous-ops imbriquées visibles', () => {
    const test: GameOp = { op: 'test', skill: 'calme', difficulty: 'difficile', onFail: [{ op: 'condition', name: 'sonne' }], onSuccess: [] };
    const html = renderToStaticMarkup(<GameOpEditor ops={[test]} onChange={() => {}} />);
    expect(html).toContain('Calme'); // compétence (input du formulaire dédié)
    expect(html).toContain('sonne'); // sous-op onFail rendue par le GameOpEditor IMBRIQUÉ
    expect(opSummary(test)).toContain('Calme');
  });
});
