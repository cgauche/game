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
import { mountedPlanOpts, mountedRest, riderBodyPose, seatedBodyPose, seatedRest, type SeatedBody } from './mountedRig';
import { baseSkeleton, groundSkeleton } from './skeletons';
import { gabaritById } from './gabarits';
import { xfOf } from './poses';
import { weaponRest } from './anim/weaponClips';
import { buildWeapon } from '../../engine/items';
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

/**
 * CORPS ASSIS SANS MONTURE (figurant attablé) : une CHAISE N'EST PAS UNE SELLE — le corps n'enfourche
 * rien, il pose son bassin à la hauteur d'assise et garde ses pieds par terre (`seatedBodyPose`,
 * résolue sur le squelette) — et il porte la tenue d'arme AU REPOS du fantassin, jamais une tenue
 * montée ni un geste.
 */
describe('seatedRest — un attablé n’est pas un cavalier', () => {
  const HAMPE = buildWeapon({ label: 'Hallebarde', hands: 2, reach: 'Longue', damage: { plusBF: true, flat: 4 }, qualities: [{ id: 'empalement' }] });
  const SK: SeatedBody = { sk: groundSkeleton(baseSkeleton(gabaritById('humain'), 'M')), speciesPose: {}, viewPose: {}, };
  const ASSISE = 32; // unités de boîte — un tabouret, cf. `boxUnitsPerM`

  it('le corps assis vient de la primitive NEUTRE (jambes résolues), pas de la tenue d’arme', () => {
    const corps = seatedBodyPose('profile', SK, ASSISE);
    const pose = seatedRest('profile', SK, ASSISE, HAMPE);
    for (const os of ['bassin', 'cuisseG', 'cuisseD', 'tibiaG', 'tibiaD', 'piedG', 'piedD'] as const) {
      expect(corps[os], `l'assise doit poser ${os}`).toBeDefined();
      expect(pose[os], `${os} appartient à l'assise`).toEqual(corps[os]);
    }
  });

  it('l’assise n’est PAS la pose du cavalier : le bassin descend, aucun straddle', () => {
    const assis = seatedBodyPose('profile', SK, ASSISE);
    const cavalier = riderBodyPose('profile');
    expect(cavalier.bassin).toBeUndefined();          // en selle, le bassin est ancré par le composite
    expect(xfOf(assis, 'bassin').ty).toBeGreaterThan(20); // assis, il DESCEND à la hauteur du siège
    expect(assis.cuisseG).not.toEqual(cavalier.cuisseG);
  });

  it('la tenue est celle du REPOS à pied, PAS la tenue montée', () => {
    const repos = weaponRest(HAMPE);
    expect(seatedRest('profile', SK, ASSISE, HAMPE).arme).toBe(repos.arme);
    expect(mountedRest('profile', HAMPE).arme).not.toBe(repos.arme); // la hampe montée est AU PORT
  });

  /** `anchor.h` d'un siège est ÉDITABLE : toute la plage doit rendre une jambe, pas une dégénérescence.
   *  Sous la hauteur du PIED lui-même, un raccourci non borné passe NÉGATIF — cuisse retournée, pied à
   *  l'envers ; au-dessus de l'atteinte de la jambe, il passerait au-dessus de 1 — jambe étirée. */
  it('toute hauteur d’assise authorée rend une jambe : aucune échelle nulle, négative ou étirée', () => {
    for (const drop of [0, 1, 5, 10, 20, 32, 60, 200]) {
      const p = seatedBodyPose('front', SK, drop);
      for (const os of ['cuisseG', 'cuisseD', 'piedG', 'piedD'] as const) {
        const { sy } = xfOf(p, os);
        expect(Number.isFinite(sy), `${os} @drop=${drop}`).toBe(true);
        expect(sy, `${os} @drop=${drop}`).toBeGreaterThan(0);
      }
      // Le PIED garde sa taille : son échelle compense EXACTEMENT celle héritée de la cuisse.
      expect(xfOf(p, 'cuisseD').sy * xfOf(p, 'piedD').sy).toBeCloseTo(1, 6);
      expect(xfOf(p, 'cuisseD').sy, `étirement @drop=${drop}`).toBeLessThanOrEqual(1);
    }
  });

  it('sans arme, il ne reste que l’assise', () => {
    expect(seatedRest('profile', SK, ASSISE)).toEqual(seatedBodyPose('profile', SK, ASSISE));
  });
});
