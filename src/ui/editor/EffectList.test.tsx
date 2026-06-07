import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EffectList, newEffect } from './EffectList';
import type { Effect } from '../../state/scene';

const ctx = { encounters: [], dialogues: [] };

describe('EffectList — Test de compétence : champ Interlocuteur/groupes (P3)', () => {
  it('un Test de SOCIABILITÉ (Charme) expose le champ des groupes de l’interlocuteur', () => {
    const effects: Effect[] = [{ type: 'test', skill: 'Charme', vsGroups: ['Elfe'], onSuccess: [], onFailure: [] } as Effect];
    const html = renderToStaticMarkup(<EffectList effects={effects} onChange={() => {}} ctx={ctx} />);
    expect(html).toMatch(/Interlocuteur/i);
    expect(html).toContain('Elfe'); // la valeur courante est affichée
  });

  it('un Test NON-social (Escalade) MASQUE le champ (pas de no-op silencieux)', () => {
    const effects: Effect[] = [{ type: 'test', skill: 'Escalade', onSuccess: [], onFailure: [] } as Effect];
    const html = renderToStaticMarkup(<EffectList effects={effects} onChange={() => {}} ctx={ctx} />);
    expect(html).not.toMatch(/Interlocuteur/i);
  });
});

describe('EffectList — Effet setTime (jour/nuit via trigger, #T1c)', () => {
  it('newEffect("setTime") crée un défaut phase nuit', () => {
    expect(newEffect('setTime')).toEqual({ type: 'setTime', phase: 'nuit' });
  });
  it('un Effet setTime rend un sélecteur de phase (les 7 phases)', () => {
    const effects: Effect[] = [{ type: 'setTime', phase: 'nuit' } as Effect];
    const html = renderToStaticMarkup(<EffectList effects={effects} onChange={() => {}} ctx={ctx} />);
    expect(html).toMatch(/Régler l’heure sur/);
    expect(html).toContain('Nuit');
    expect(html).toContain('Aube');
  });
});
