import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WeaponField } from './WeaponField';
import { REACH_IDS } from '../../engine/items';
import { REACH_LABELS, REACH_VARIABLE } from '../../engine/types';
import type { Weapon } from '../../engine/types';

const melee: Weapon = { label: 'Tentacule', type: 'melee', damage: { plusBF: true, flat: 2 }, reach: 'Longue', qualities: [] };

describe('WeaponField — Allonge = choix FERMÉ sur l’axe (LDB 62 l.156-164)', () => {
  const html = () => renderToStaticMarkup(<WeaponField value={melee} onChange={() => {}} />);

  it('rend un <select> (plus de saisie libre) portant les SEPT longueurs + « Variable »', () => {
    const h = html();
    expect(h).toContain('<select');
    for (const id of REACH_IDS) expect(h).toContain(`value="${REACH_LABELS[id]}"`);
    expect(h).toContain(`value="${REACH_VARIABLE}"`);
    expect(h).not.toContain('placeholder="Moyenne…"'); // plus de saisie libre
  });

  it('aucune option hors vocabulaire : 7 longueurs + « Variable » + le vide', () => {
    const options = [...html().matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]);
    const allonge = options.filter((v) => v !== 'melee' && v !== 'ranged' && v !== '1' && v !== '2');
    expect(new Set(allonge)).toEqual(new Set(['', ...Object.values(REACH_LABELS), REACH_VARIABLE]));
  });

  it('une arme à DISTANCE n’expose pas l’Allonge (Portée à la place)', () => {
    const h = renderToStaticMarkup(<WeaponField value={{ ...melee, type: 'ranged' }} onChange={() => {}} />);
    expect(h).not.toContain(REACH_LABELS.considerable);
  });
});
