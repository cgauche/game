import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConditionEditor, WhenEditor, condSummary, recast } from './ConditionEditor';
import type { Condition } from '../../state/flow';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

describe('ConditionEditor — conditions party-level (skill/career/species/status, #711)', () => {
  it('condSummary résume chaque nouveau kind', () => {
    expect(condSummary({ kind: 'skill', id: 'crochetage', who: 'any' })).toContain('crochetage');
    expect(condSummary({ kind: 'career', id: 'soldat', who: 'all' })).toContain('soldat');
    expect(condSummary({ kind: 'species', id: 'halflings', who: 'any' })).toContain('halflings');
    expect(condSummary({ kind: 'status', atLeast: 'Argent 2', who: 'any' })).toContain('Argent 2');
  });

  it('skill rend le sélecteur de Compétence + spec + seuil d’avances + who', () => {
    const html = renderToStaticMarkup(<ConditionEditor cond={{ kind: 'skill', id: 'crochetage', spec: 'Serrures', advances: 2, who: 'all' }} onChange={() => {}} />);
    expect(html).toContain('value="crochetage"');
    expect(html).toContain('value="Serrures"');
    expect(html).toContain('value="2"');
    expect(html).toContain('tout le groupe');
  });

  it('career rend le sélecteur de carrière', () => {
    const html = renderToStaticMarkup(<ConditionEditor cond={{ kind: 'career', id: 'soldat', who: 'any' }} onChange={() => {}} />);
    expect(html).toContain('value="soldat"');
  });

  it('species rend le sélecteur d’espèce', () => {
    const html = renderToStaticMarkup(<ConditionEditor cond={{ kind: 'species', id: 'halflings', who: 'any' }} onChange={() => {}} />);
    expect(html).toContain('value="halflings"');
  });

  it('status rend le champ atLeast', () => {
    const html = renderToStaticMarkup(<ConditionEditor cond={{ kind: 'status', atLeast: 'Argent 2', who: 'any' }} onChange={() => {}} />);
    expect(html).toContain('value="Argent 2"');
  });

  it('recast : même kind préservé (lossless), kind différent → défauts sains sans NaN', () => {
    const skill: Condition = { kind: 'skill', id: 'crochetage', who: 'all', advances: 3 };
    expect(recast(skill, 'skill')).toEqual(skill); // même kind = round-trip lossless
    expect(recast(skill, 'career')).toMatchObject({ kind: 'career', id: '', who: 'any' }); // défauts sains, aucun NaN/donnée fantôme
    expect(recast(recast(skill, 'status'), 'status')).toMatchObject({ kind: 'status', atLeast: 'Bronze 1' });
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

describe('#1318 E1 — le domaine du créneau horaire atteint le champ (cale de NumberField)', () => {
  it('les quatre champs d’heure/minute portent leurs bornes (0-23 / 0-59)', () => {
    const cond: Condition = { kind: 'time', window: { afterHour: 20, afterMinute: 30, beforeHour: 2, beforeMinute: 15 } };
    const html = renderToStaticMarkup(<ConditionEditor cond={cond} onChange={() => {}} />);
    expect(html.match(/max="23"/g)).toHaveLength(2);
    expect(html.match(/max="59"/g)).toHaveLength(2);
    expect(html.match(/min="0"/g)).toHaveLength(4);
  });
});


describe('#1318 E1 — la largeur des champs nombre du bloc Condition vit dans le CSS, pas au site', () => {
  it('editor.css borne `.cond-time input[type=number]` à la largeur compacte d’atelier', () => {
    const css = readFileSync(fileURLToPath(new URL('../styles/editor.css', import.meta.url)), 'utf8');
    expect(css).toMatch(/\.cond-time input\[type='number'\][^{]*\{[^}]*width:\s*44px/);
  });
});
