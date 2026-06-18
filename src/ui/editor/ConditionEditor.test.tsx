import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConditionEditor, WhenEditor, condSummary } from './ConditionEditor';
import type { Condition } from '../../state/flow';

describe('condSummary — résumé humain de l’algèbre de Condition', () => {
  it('rend chaque forme (flag / horaire / ET / OU / NON) en clair', () => {
    expect(condSummary({ kind: 'always' })).toBe('toujours');
    expect(condSummary({ kind: 'flag', expr: 'porte,!piege' })).toBe('porte,!piege');
    expect(condSummary({ kind: 'time', window: { afterHour: 20 } })).toContain('20:00');
    expect(condSummary({ kind: 'all', of: [{ kind: 'flag', expr: 'a' }, { kind: 'flag', expr: 'b' }] })).toBe('a ET b');
    expect(condSummary({ kind: 'any', of: [{ kind: 'flag', expr: 'cle' }, { kind: 'flag', expr: 'crochete' }] })).toBe('cle OU crochete');
    expect(condSummary({ kind: 'not', of: { kind: 'flag', expr: 'vu' } })).toBe('NON(vu)');
    expect(condSummary({ kind: 'hasItem', trappingId: 'Clé en fer' })).toContain('Clé en fer'); // custom → id brut affiché
    expect(condSummary({ kind: 'money', atLeast: { gold: 10 } })).toContain('10 CO');
    expect(condSummary({ kind: 'partyDead', who: 'any' })).toBe('un héros mort');
    expect(condSummary(undefined)).toBe('');
  });
});

describe('ConditionEditor — conditions d’état VIVANT (objet / bourse / mort)', () => {
  it('hasItem rend le LIBELLÉ de l’objet (id catalogue) + le compte', () => {
    const html = renderToStaticMarkup(<ConditionEditor cond={{ kind: 'hasItem', trappingId: 'corde', count: 2 }} onChange={() => {}} />);
    expect(html).toContain('value="Corde"'); // id 'corde' affiché par son libellé de catalogue
    expect(html).toContain('value="2"');
  });
  it('money rend les trois dénominations (CO/pa/sc)', () => {
    const html = renderToStaticMarkup(<ConditionEditor cond={{ kind: 'money', atLeast: { gold: 5 } }} onChange={() => {}} />);
    expect(html).toContain('CO');
    expect(html).toContain('value="5"');
  });
});

describe('ConditionEditor — éditeur récursif de l’algèbre close', () => {
  it('un OU (any) rend ses sous-conditions + le bouton « + OU »', () => {
    const cond: Condition = { kind: 'any', of: [{ kind: 'flag', expr: 'cle' }, { kind: 'flag', expr: 'crochete' }] };
    const html = renderToStaticMarkup(<ConditionEditor cond={cond} onChange={() => {}} />);
    expect(html).toContain('+ OU'); // composition OU
    expect(html).toContain('value="cle"');
    expect(html).toContain('value="crochete"');
  });

  it('un NON enveloppe une sous-condition', () => {
    const html = renderToStaticMarkup(<ConditionEditor cond={{ kind: 'not', of: { kind: 'flag', expr: 'vu' } }} onChange={() => {}} />);
    expect(html).toContain('value="vu"');
    // le sélecteur de type propose bien NON
    expect(html).toContain('NON');
  });

  it('WhenEditor traite « Toujours » comme l’absence de condition (sélecteur sur always)', () => {
    const html = renderToStaticMarkup(<WhenEditor when={undefined} onChange={() => {}} />);
    expect(html).toContain('Toujours');
    expect(html).toContain('value="always"'); // le select est positionné sur « always »
  });
});
