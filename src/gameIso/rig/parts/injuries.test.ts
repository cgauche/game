import { describe, it, expect } from 'vitest';
import { injuryOverlaysFor, injuryAppearance } from './injuries';
import type { Combatant, Trauma, ItemInstance } from '../../../engine/types';
import type { Appearance } from '../appearance';

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

  it('œil perdu : REMPLACE l’œil peint en place (cicatrice → cache-œil → œil de verre)', () => {
    const APP = { species: 'Humain', sex: 'M', build: 0.5 } as Appearance;
    const eye = t({ label: 'Œil perdu' });
    expect(injuryAppearance(APP, mk([eye])).eyes?.G).toContain('data-injury="oeil-perdu"');
    expect(injuryAppearance(APP, mk([eye], [item('Cache-œil')])).eyes?.G).toContain('data-injury="cache-oeil"');
    expect(injuryAppearance(APP, mk([eye], [item('Œil de verre')])).eyes?.G).toContain('data-injury="oeil-de-verre"');
    expect(injuryAppearance(APP, mk([]))).toBe(APP); // même référence sans blessure d'œil
    expect(injuryOverlaysFor(mk([eye]))).toEqual([]); // plus de calque d'œil
  });

  it('Cécité : bandage sur le visage (et pas de remplacement d’œil)', () => {
    const APP = { species: 'Humain', sex: 'M', build: 0.5 } as Appearance;
    const blindT = [t({ label: 'Œil perdu' }), t({ label: 'Œil perdu' }), t({ label: 'Cécité' })];
    const blind = injuryOverlaysFor(mk(blindT));
    expect(blind.filter((o) => o.bone === 'tete').length).toBe(1);
    expect(blind[0].svg).toContain('data-injury="cecite"');
    expect(blind[0].view).toBe('front');
    expect(injuryAppearance(APP, mk(blindT))).toBe(APP);
  });

  it('nez : trou sombre, ou nez doré si porté', () => {
    const nez = t({ label: 'Nez amputé' });
    expect(injuryOverlaysFor(mk([nez]))[0].svg).toContain('data-injury="nez-ampute"');
    expect(injuryOverlaysFor(mk([nez], [item('Nez doré')]))[0].svg).toContain('data-injury="nez-dore"');
  });
});
