/**
 * COUTURE MONTÉE (#1128 L4) — une monture PORTÉE est harnachée : le harnachement ne se dessine plus
 * en os synthétiques au call-site, il vient du canal DONNÉE (`appearance.harnais` du record, sinon le
 * set par DÉFAUT déclaré en donnée éditable, `src/data/renduMonte.json`).
 *
 * Ce défaut est une INFÉRENCE MAISON de rendu (#1128) : les listes de Possessions de carrière
 * donnent la monture « avec selle et harnais » (LDB 08 l.557, ADE I 07 l.48) ; aucune règle n'attache
 * la sellerie au fait d'être monté — d'où la donnée éditable, et le respect du nu explicite.
 *
 * Mesuré sur le chemin de PROD d'un record (`resolveById` + `mountedPlanOpts` + `plan.resolve`), et
 * sur les DEUX issues du set : servi, ou REFUSÉ visiblement (espèce dont l'art n'est pas cuit).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { mountedPlanOpts } from './mountedRig';
import { resolveById, planById, planOptsForRecord } from './bodyPlan';
import { QUAD_HARNAIS, DEFAUT_HARNAIS_MONTE } from './quadruped/harnais';
import { QUAD_REST } from './quadruped/quadPose';
import { bonesToSvg } from './renderBones';
import { MISSING_TONE } from './viewArt';
import { findCreatureById } from '../../data';
import type { View } from './facing';

/** Rendu d'un record par le chemin de PROD, PORTÉ (couture montée) ou LIBRE (token de bête). */
const svg = (id: string, porte: boolean, over?: Parameters<typeof planOptsForRecord>[1], vue: View = 'profile'): string => {
  const r = resolveById(id);
  const opts = porte ? mountedPlanOpts(id, over) : planOptsForRecord(id, over);
  return bonesToSvg(planById(r.plan).resolve(r.species, vue, QUAD_REST, opts));
};

describe('le set par défaut du monté est une DONNÉE, servie par le registre', () => {
  it('l\'id déclaré en donnée existe au registre et est cuit pour le cheval', () => {
    const set = QUAD_HARNAIS[DEFAUT_HARNAIS_MONTE];
    expect(set, `« ${DEFAUT_HARNAIS_MONTE} » (renduMonte.json) absent du registre des sets`).toBeTruthy();
    expect(set.especes).toContain('cheval');
  });

  it('monture SANS harnais déclaré : le défaut arrive ; avec harnais déclaré : la donnée PRIME', () => {
    expect(findCreatureById('cheval')?.appearance?.harnais, 'le record `cheval` doit rester NU (L3)').toBeUndefined();
    expect(mountedPlanOpts('cheval').harnais).toBe(DEFAUT_HARNAIS_MONTE);
    expect(planOptsForRecord('cheval').harnais, 'monture LIBRE : aucun set').toBeUndefined();
    expect(mountedPlanOpts('cheval-de-monte').harnais).toBe(findCreatureById('cheval-de-monte')!.appearance!.harnais);
  });

  it('`harnais: \'\'` (nu explicite d\'un override d\'instance) reste respecté, même monté', () => {
    expect(mountedPlanOpts('cheval', { harnais: '' }).harnais).toBe('');
  });
});

describe('la monture PORTÉE rend le set au pixel (chemin de prod)', () => {
  it('un cheval nu monté rend la bête + la sellerie — exactement ce que rend une monture harnachée par sa donnée', () => {
    const libre = svg('cheval', false);
    const porte = svg('cheval', true);
    expect(porte, 'le set n\'atteint pas le rendu : la monture porterait un cavalier À CRU').not.toBe(libre);
    expect(porte).toBe(svg('cheval-de-monte', false)); // le record sellé par sa donnée, à l'octet
    expect(porte).not.toContain(MISSING_TONE);
    expect(svg('cheval', true, { harnais: '' }), 'nu explicite').toBe(libre);
  });

  // Couverture PAR VUE : le set est cuit pour les trois vues jouées. Un art de bout manquant
  // (front/back) rendrait la monture à cru de face ou de dos sans que le profil ne bronche.
  it('aux TROIS vues, la monture portée rend autre chose que la même monture nue', () => {
    for (const vue of ['profile', 'front', 'back'] as View[]) {
      const libre = svg('cheval', false, undefined, vue);
      const porte = svg('cheval', true, undefined, vue);
      expect(porte, `vue ${vue} : le set n'atteint pas le rendu, la monture porterait à cru`).not.toBe(libre);
      expect(porte, `vue ${vue} : set refusé (espèce non cuite)`).not.toContain(MISSING_TONE);
    }
  });
});

describe('une monture dont l\'espèce n\'est pas cuite pour le set : ALARME visible, jamais un nu silencieux', () => {
  afterEach(() => vi.restoreAllMocks());

  it('le blaireau monté (ADE I 07 l.48) rend la caisse d\'alarme et nomme set + espèce', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveById('blaireau').species).toBe('blaireau'); // hors des `especes` du set
    const porte = svg('blaireau', true);
    expect(porte).toContain(MISSING_TONE);
    expect(svg('blaireau', false)).not.toContain(MISSING_TONE);
    const msg = warn.mock.calls.flat().join(' ');
    expect(msg).toContain(DEFAUT_HARNAIS_MONTE);
    expect(msg).toContain('blaireau');
  });
});
