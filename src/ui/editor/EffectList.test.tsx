import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EffectList } from './EffectList';
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
