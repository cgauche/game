import { describe, it, expect } from 'vitest';
import { injuryOverlaysFor } from './injuries';
import type { Combatant, Trauma, ItemInstance } from '../../../engine/types';

const mk = (traumas: Trauma[], items: ItemInstance[] = []): Combatant =>
  ({ id: 'h1', name: 'H', kind: 'hero', traumas, items }) as unknown as Combatant;
const t = (over: Partial<Trauma>): Trauma => ({ label: 'x', location: 'tete', note: '', ...over });
const item = (name: string, equipped = true): ItemInstance =>
  ({ uid: name, name, kind: 'misc', qualities: [], enc: 0, equipped }) as unknown as ItemInstance;

const MAIN_D = t({ label: 'Main/bras amputé (brasD)', location: 'brasD', noTwoHanded: true });
const JAMBE_G = t({ label: 'Membre inférieur amputé (jambeG)', location: 'jambeG', movementHalved: true });

describe('visuels des amputations/prothèses (injuries)', () => {
  it('sans trauma → rien', () => {
    expect(injuryOverlaysFor(mk([]))).toEqual([]);
  });

  it('main amputée : moignon → crochet → main mécanique selon la prothèse PORTÉE', () => {
    expect(injuryOverlaysFor(mk([MAIN_D]))[0]).toMatchObject({ bone: 'mainD', replace: true });
    expect(injuryOverlaysFor(mk([MAIN_D]))[0].svg).toContain('data-injury="moignon"');
    expect(injuryOverlaysFor(mk([MAIN_D], [item('Crochet')]))[0].svg).toContain('data-injury="crochet"');
    expect(injuryOverlaysFor(mk([MAIN_D], [item("Merveille d'ingénierie")]))[0].svg).toContain('data-injury="main-mecanique"');
    // au sac (non porté) : pas de prothèse → moignon
    expect(injuryOverlaysFor(mk([MAIN_D], [item('Crochet', false)]))[0].svg).toContain('data-injury="moignon"');
  });

  it('jambe amputée : invisible sans prothèse ; Fausse jambe portée → jambe de bois + pied effacé', () => {
    expect(injuryOverlaysFor(mk([JAMBE_G]))).toEqual([]);
    const ovs = injuryOverlaysFor(mk([JAMBE_G], [item('Fausse jambe')]));
    expect(ovs.some((o) => o.bone === 'cuisseG' && o.replace && o.svg.includes('data-injury="jambe-de-bois"'))).toBe(true);
    expect(ovs.some((o) => o.bone === 'piedG' && o.replace && o.svg === '')).toBe(true);
  });

  it('œil : cicatrice → cache-œil/œil de verre ; Cécité → bandage (et pas les deux)', () => {
    const eye = t({ label: 'Œil perdu' });
    expect(injuryOverlaysFor(mk([eye]))[0].svg).toContain('data-injury="oeil-perdu"');
    expect(injuryOverlaysFor(mk([eye], [item('Cache-œil')]))[0].svg).toContain('data-injury="cache-oeil"');
    expect(injuryOverlaysFor(mk([eye], [item('Œil de verre')]))[0].svg).toContain('data-injury="oeil-de-verre"');
    const blind = injuryOverlaysFor(mk([eye, eye, t({ label: 'Cécité' })]));
    expect(blind.filter((o) => o.bone === 'tete').length).toBe(1);
    expect(blind[0].svg).toContain('data-injury="cecite"');
    for (const o of injuryOverlaysFor(mk([eye]))) expect(o.view).toBe('front');
  });

  it('nez : trou sombre, ou nez doré si porté', () => {
    const nez = t({ label: 'Nez amputé' });
    expect(injuryOverlaysFor(mk([nez]))[0].svg).toContain('data-injury="nez-ampute"');
    expect(injuryOverlaysFor(mk([nez], [item('Nez doré')]))[0].svg).toContain('data-injury="nez-dore"');
  });
});
