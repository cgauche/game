/**
 * SOCLE QUADRUPÈDE — cliquets des TROIS VUES (#1082, Lot 0 : instrumentation).
 *
 * Trois contrats, tous adossés à la table publiée `QUAD_Z` :
 *
 *  (a) DÉCORS MORTS — un couple `deco`×os×vue déclaré par une def mais JAMAIS émis par
 *      l'assemblage de cette vue : le décor est silencieusement perdu. Le stock est GELÉ
 *      nominativement et son plafond ne peut que décroître (plancher visé : 0). Un couple mort
 *      qui n'est pas dans le stock = régression. La POPULATION mesurée (les couples applicables)
 *      est gelée nominativement elle aussi : un couple applicable ne disparaît légitimement que
 *      si l'os porte désormais un art dans cette vue (solde réel) ; supprimer la clé `deco` pour
 *      faire baisser le stock des morts (blanchiment) ou substituer un couple à un autre rougit.
 *
 *  (b) ORDRE DES OS PAR VUE — la liste (os, z) triée par plan, figée depuis `QUAD_Z`. Tout
 *      changement d'ordre rougit. Ce snapshot SERA mis à jour intentionnellement au Lot 1
 *      (z par vue : crâne/nuque, ailes, cavalier) — la mise à jour se fait avec la table.
 *
 *  (c) SOURCE UNIQUE — le squelette (les 3 vues) et le couple monté (cavalier, harnachement)
 *      lisent leurs plans dans `QUAD_Z` ; aucun littéral de z ne subsiste dans `quadSkeleton.ts`
 *      ni `mountedRig.ts`.
 *
 * Les MESURES chiffrées (parité de silhouette, occlusion, ligne de sol, débords) ne sont pas ici :
 * elles sont l'état courant du socle, rapportées par `scripts/qc/quad-vues.mts`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CREATURES } from '../creatures';
import { QUAD_Z, quadZOrder, QUAD_DECO_PLAN_MAX } from './quadZ';
import {
  quadDecoCouples, APPLICABLES_GELES, PLAFOND_DECOS_MORTS,
  DECOS_SANS_PLAN_GELES, PLAFOND_DECOS_SANS_PLAN,
} from './deco-stock.fixture';
import { resolveQuadFromProps } from './composeQuad';
import { buildQuadSkeleton, quadSkeletonForView, type QuadBoneId, type QuadProps } from './quadSkeleton';
import { quadParts, quadLayersSvg, quadDecoFragments } from './quadParts';
import { riderZForQuad, mountTackBones } from '../mountedRig';
import { rigFxGradients } from '../fxGradients';
import type { ResolvedBone } from '../composeRig';
import type { View } from '../facing';

const VIEWS: View[] = ['profile', 'front', 'back'];
const quadDefs = CREATURES.filter((c) => c.quad).map((c) => ({ id: c.id, quad: c.quad as QuadProps }));

// ── (a) DÉCORS MORTS, PLANS NON DÉCLARÉS ────────────────────────────────────────────────────
// Le détecteur et les stocks GELÉS vivent dans `deco-stock.fixture.ts` (source unique, partagée
// avec le CONTRAT `quad-anchor-contract.test.ts` qui, lui, rougit sur tout couple mort NOUVEAU).

/** L'os d'un couple porte-t-il un art dans cette vue ? (art émis = le décor n'est plus perdu) */
function artEmis(couple: string): boolean {
  const [id, view, cle] = couple.split(' ') as [string, View, string];
  const def = quadDefs.find((d) => d.id === id);
  if (!def) return false;
  const os = cle.split('#')[0] as QuadBoneId;
  return !!quadParts({ ...def.quad, deco: undefined }, view)[os];
}

describe('décors MORTS : le stock gelé ne peut que décroître (#1082)', () => {
  it('la mesure porte sur une population réelle', () => {
    const { applicables } = quadDecoCouples();
    expect(quadDefs.length).toBeGreaterThan(20);
    expect(applicables.length).toBeGreaterThan(50);
  });

  it('le stock reste sous son plafond', () => {
    const { morts } = quadDecoCouples();
    expect(morts.length).toBeLessThanOrEqual(PLAFOND_DECOS_MORTS);
  });

  it('aucun couple applicable GELÉ n\'a disparu sans que son art soit émis', () => {
    const { applicables } = quadDecoCouples();
    const disparus = APPLICABLES_GELES.filter((c) => !applicables.includes(c) && !artEmis(c));
    expect(disparus, 'couple applicable retiré sans art émis dans la vue : blanchiment du stock des morts').toEqual([]);
  });
});

// ── (a bis) PLANS DE DÉCOR NON DÉCLARÉS (transition N2) ─────────────────────────────────────
describe('décors SANS plan déclaré : stock gelé, plafond décroissant (#1082)', () => {
  it('aucun couple sans plan HORS du stock gelé', () => {
    const { sansPlan } = quadDecoCouples();
    const nouveaux = sansPlan.filter((c) => !DECOS_SANS_PLAN_GELES.includes(c));
    expect(nouveaux, 'décor authoré sans `plan` : le canal de calques attend un plan RELATIF à l\'os').toEqual([]);
  });

  it('le stock reste sous son plafond', () => {
    const { sansPlan } = quadDecoCouples();
    expect(sansPlan.length).toBeLessThanOrEqual(PLAFOND_DECOS_SANS_PLAN);
  });

  it('tout plan déclaré tient dans le voisinage de son os', () => {
    const hors: string[] = [];
    for (const { id, quad } of quadDefs) {
      for (const [cle, val] of Object.entries(quad.deco ?? {})) {
        if (!val) continue;
        for (const f of quadDecoFragments(val))
          if (f.plan != null && Math.abs(f.plan) > QUAD_DECO_PLAN_MAX) hors.push(`${id} ${cle} : plan=${f.plan}`);
      }
    }
    expect(hors, `un fragment de décor ne s'écarte pas de plus de ${QUAD_DECO_PLAN_MAX} du plan de son os`).toEqual([]);
  });
});

// ── (a ter) CONTRAT DU PLAN RELATIF : un fragment déclaré s'intercale ────────────────────────
describe('plan RELATIF d\'un fragment de décor : l\'os résolu se dédouble (#1082)', () => {
  /** Props d'épreuve : la première def quadrupède du registre, décorée de deux fragments opposés. */
  const props = (): QuadProps => ({
    ...(quadDefs[0].quad),
    deco: { 'tete#back': [{ svg: '<g data-deco="derriere"/>', plan: -0.5 }, { svg: '<g data-deco="devant"/>', plan: 0.5 }] },
  });

  it('un fragment à plan NÉGATIF est peint AVANT l\'art de son os, un plan POSITIF après', () => {
    const os = resolveQuadFromProps(props(), 'back').filter((b) => b.id === 'tete');
    expect(os.map((b) => b.z), 'trois plans distincts portés par le MÊME os').toEqual([
      QUAD_Z.tete.back - 0.5, QUAD_Z.tete.back, QUAD_Z.tete.back + 0.5,
    ]);
    expect(os[0].parts[0].svg).toContain('data-deco="derriere"');
    expect(os[1].parts[0].svg).toContain('rigCutQuadCrane'); // l'art de l'os, à son propre plan
    expect(os[2].parts[0].svg).toContain('data-deco="devant"');
  });

  it('sous la borne, un fragment atteint AU PLUS le plan de l\'os voisin, jamais au-delà', () => {
    // L'écart MINIMAL entre deux plans d'os voisins de la table vaut la borne elle-même (de dos :
    // croupe 4 · nuque 4,5 · tronc 5) : un fragment poussé à ±0,5 rejoint au pire le plan du
    // voisin — l'égalité se départage alors par l'ordre d'émission (tri STABLE), il ne le double pas.
    const ecarts: string[] = [];
    for (const view of VIEWS) {
      const zs = quadZOrder(view).map((o) => o.z);
      for (let i = 1; i < zs.length; i++)
        if (zs[i] !== zs[i - 1] && zs[i] - zs[i - 1] < QUAD_DECO_PLAN_MAX) ecarts.push(`${view} ${zs[i - 1]}→${zs[i]}`);
    }
    expect(ecarts, 'deux plans d\'os voisins plus proches que la borne : un décor pourrait en doubler un').toEqual([]);
  });
});

// ── (b) ORDRE DES OS PAR VUE ────────────────────────────────────────────────────────────────
// Mis à jour au Lot 1 (2026-08-05) : c'est le CODE qui a bougé (table `QUAD_Z`), pas le détecteur —
// os `nuque` ajouté (calque bas de la tête), ailes portées SUR le dos en vue de dos (2 → 6).
const ORDRE_ATTENDU: Record<View, string[]> = {
  profile: [
    'basArG:1', 'basAvG:1', 'hautArG:1', 'hautAvG:1', 'piedArG:1', 'piedAvG:1',
    'aileG:2', 'queue:3', 'croupe:4', 'tronc:5', 'aileD:6', 'encolure:6', 'nuque:6', 'tete:7',
    'basArD:9', 'basAvD:9', 'hautArD:9', 'hautAvD:9', 'piedArD:9', 'piedAvD:9',
  ],
  front: [
    'aileD:2', 'aileG:2', 'basArD:2', 'basArG:2', 'hautArD:2', 'hautArG:2', 'piedArD:2', 'piedArG:2', 'queue:2',
    'basAvD:4', 'basAvG:4', 'croupe:4', 'hautAvD:4', 'hautAvG:4', 'piedAvD:4', 'piedAvG:4',
    'tronc:5', 'encolure:8', 'nuque:8', 'tete:9',
  ],
  back: [
    'basAvD:2', 'basAvG:2', 'hautAvD:2', 'hautAvG:2', 'piedAvD:2', 'piedAvG:2',
    'basArD:4', 'basArG:4', 'croupe:4', 'hautArD:4', 'hautArG:4', 'piedArD:4', 'piedArG:4',
    'nuque:4.5', 'tronc:5', 'aileD:6', 'aileG:6', 'queue:6', 'encolure:8', 'tete:9',
  ],
};

/** Props minimales d'un quadrupède AILÉ (tous les os, ailes comprises). */
const PROPS_AILE: QuadProps = { ...(quadDefs.find((d) => d.quad.wings)?.quad as QuadProps) };

describe('ordre des os par vue : snapshot de la table publiée (#1082)', () => {
  for (const view of VIEWS) {
    it(`${view} — ordre peintre (os, z)`, () => {
      expect(quadZOrder(view).map((o) => `${o.id}:${o.z}`)).toEqual(ORDRE_ATTENDU[view]);
    });
  }

  it('le squelette RÉSOLU porte exactement les z de la table, dans les 3 vues', () => {
    const ecarts: string[] = [];
    for (const view of VIEWS) {
      const sk = quadSkeletonForView(buildQuadSkeleton(PROPS_AILE), view);
      for (const id of Object.keys(QUAD_Z) as QuadBoneId[]) {
        if (sk[id].z !== QUAD_Z[id][view]) ecarts.push(`${view} ${id} : squelette=${sk[id].z} table=${QUAD_Z[id][view]}`);
      }
    }
    expect(ecarts).toEqual([]);
  });
});

// ── (c) SOURCE UNIQUE DES PLANS ─────────────────────────────────────────────────────────────
const isComment = (l: string) => /^\s*(\/\/|\/\*|\*)/.test(l);
const codeOf = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
    .split(/\r?\n/)
    .filter((l) => !isComment(l));

const bone = (id: string, z: number): ResolvedBone =>
  ({ id, matrix: [1, 0, 0, 1, 60, 75], scale: [1, 1], parts: [], z }) as ResolvedBone;

describe('les plans de profondeur ne vivent QUE dans QUAD_Z (#1082)', () => {
  for (const rel of ['./quadSkeleton.ts', '../mountedRig.ts']) {
    it(`${rel} : aucun littéral \`z: <nombre>\``, () => {
      const fautifs = codeOf(rel).filter((l) => /\bz:\s*-?\d/.test(l));
      expect(fautifs).toEqual([]);
    });
  }

  it('au PROFIL, le cavalier s\'intercale entre sa jambe lointaine (sous le barillet) et sa jambe proche (au-dessus de la tête)', () => {
    const profil = riderZForQuad('profile');
    expect(profil(bone('cuisseG', 0))).toBe(4.5);  // jambe lointaine, sous le barillet (5)
    expect(profil(bone('torse', 0))).toBe(6.6);    // corps, au-dessus de l'encolure (6)
    expect(profil(bone('cuisseD', 0))).toBe(8.2);  // jambe proche, au-dessus de la tête (7)
  });

  // Le plan du cavalier se lit PAR VUE dans `QUAD_RIDER_Z` : chaque vue tient son propre contrat
  // d'intercalage (profil ci-dessus, dos et face ci-dessous).
  it('de DOS, le cavalier COUVRE la tête de sa monture et ses jambes passent derrière la croupe', () => {
    const dos = riderZForQuad('back');
    expect(dos(bone('torse', 0))).toBeGreaterThan(QUAD_Z.tete.back);
    for (const jambe of ['cuisseG', 'cuisseD', 'piedG', 'piedD']) {
      expect(dos(bone(jambe, 0)), `${jambe} doit passer derrière la croupe`).toBeLessThan(QUAD_Z.tronc.back);
    }
  });

  it('de FACE, le cavalier passe DERRIÈRE la tête redressée et ses jambes derrière le poitrail', () => {
    const face = riderZForQuad('front');
    expect(face(bone('torse', 0))).toBeLessThan(QUAD_Z.tete.front);
    expect(face(bone('torse', 0))).toBeGreaterThan(QUAD_Z.tronc.front);
    for (const jambe of ['cuisseG', 'cuisseD']) expect(face(bone(jambe, 0))).toBeLessThan(QUAD_Z.tronc.front);
  });

  it('le harnachement s\'intercale juste au-dessus du barillet, dans les 3 vues', () => {
    for (const view of VIEWS) {
      const monture = [bone('tronc', QUAD_Z.tronc[view]), bone('tete', QUAD_Z.tete[view])];
      const tack = mountTackBones(monture, view);
      expect(tack.find((b) => b.id === 'selle')?.z, `selle ${view}`).toBe(QUAD_Z.tronc[view] + 0.5);
      if (view === 'profile') expect(tack.find((b) => b.id === 'renes')?.z).toBe(QUAD_Z.encolure.profile + 0.7);
    }
  });
});

// ── (d) SÉMANTIQUE DE LA VUE DE DOS (Lot 1) ─────────────────────────────────────────────────
/** Contenu du groupe `clip-path="url(#id)"` : l'art DÉCOUPÉ seul (le décor apposé après en est exclu). */
function clipContent(svg: string, id: string): string {
  const open = `<g clip-path="url(#${id})">`;
  const i = svg.indexOf(open);
  expect(i, `groupe découpé ${id} absent`).toBeGreaterThanOrEqual(0);
  const re = /<g\b|<\/g>/g;
  re.lastIndex = i + open.length;
  for (let m = re.exec(svg), depth = 1; m; m = re.exec(svg)) {
    depth += m[0] === '</g>' ? -1 : 1;
    if (depth === 0) return svg.slice(i + open.length, m.index);
  }
  throw new Error(`groupe découpé ${id} non fermé`);
}

type Box = { x0: number; y0: number; x1: number; y1: number };
/**
 * Boîte englobante d'un art SVG dans SON repère (M/L/Q absolus et relatifs, `circle`, `ellipse`,
 * `translate` interne). SUR-ENSEMBLE assumé : les points de contrôle des Q comptent comme des
 * sommets. Toute autre commande ou transformation lève — l'art nouveau se mesure, il ne se devine pas.
 */
function bboxOf(svg: string): Box {
  const b: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const add = (x: number, y: number) => {
    b.x0 = Math.min(b.x0, x); b.y0 = Math.min(b.y0, y); b.x1 = Math.max(b.x1, x); b.y1 = Math.max(b.y1, y);
  };
  let dx = 0, dy = 0;
  for (const [, t] of svg.matchAll(/transform="([^"]+)"/g)) {
    const m = /^translate\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/.exec(t);
    if (!m) throw new Error(`transformation non mesurée : ${t}`);
    dx = Math.max(dx, Math.abs(+m[1])); dy = Math.max(dy, Math.abs(+m[2]));
  }
  for (const [, d] of svg.matchAll(/d="([^"]+)"/g)) {
    const toks = d.match(/[A-Za-z]|-?[\d.]+/g) ?? [];
    let x = 0, y = 0, cmd = '', k = 0;
    const n = () => +toks[k++];
    while (k < toks.length) {
      if (/[A-Za-z]/.test(toks[k])) cmd = toks[k++];
      if (cmd === 'Z' || cmd === 'z') continue;
      const rel = cmd === cmd.toLowerCase(), px = rel ? x : 0, py = rel ? y : 0, c = cmd.toUpperCase();
      if (c === 'Q') { add(px + n(), py + n()); x = px + n(); y = py + n(); }
      else if (c === 'M' || c === 'L') { x = px + n(); y = py + n(); }
      else throw new Error(`commande de tracé non mesurée : ${cmd}`);
      add(x, y);
    }
  }
  const attr = (tag: string, a: string) => +(new RegExp(`${a}="(-?[\\d.]+)"`).exec(tag)?.[1] ?? 0);
  for (const [, tag] of svg.matchAll(/<circle([^>]*)>/g)) {
    const [cx, cy, r] = [attr(tag, 'cx'), attr(tag, 'cy'), attr(tag, 'r')];
    add(cx - r, cy - r); add(cx + r, cy + r);
  }
  for (const [, tag] of svg.matchAll(/<ellipse([^>]*)>/g)) {
    const [cx, cy, rx, ry] = [attr(tag, 'cx'), attr(tag, 'cy'), attr(tag, 'rx'), attr(tag, 'ry')];
    add(cx - rx, cy - ry); add(cx + rx, cy + ry);
  }
  return { x0: b.x0 - dx, y0: b.y0 - dy, x1: b.x1 + dx, y1: b.y1 + dy };
}

describe('vue de DOS : crâne au-dessus du tronc, nuque dessous, aile pliée SUR le dos (#1082)', () => {
  it('l\'art de tête de dos est scindé en DEUX calques portés par deux os de plans différents', () => {
    for (const { id, quad } of quadDefs) {
      const back = quadParts(quad, 'back');
      expect(quadLayersSvg(back.tete), `${id} : calque crâne`).toContain('clip-path="url(#rigCutQuadCrane)"');
      expect(quadLayersSvg(back.nuque), `${id} : calque nuque`).toContain('clip-path="url(#rigCutQuadNuque)"');
    }
    expect(QUAD_Z.nuque.back).toBeLessThan(QUAD_Z.tronc.back);
    expect(QUAD_Z.tete.back).toBeGreaterThan(QUAD_Z.tronc.back);
  });

  it('les deux découpes se PARTAGENT le plan de l\'art (complémentaires, et elles le COUVRENT)', () => {
    const rect = (id: string) => {
      const m = new RegExp(`id="${id}"[^>]*><rect x="(-?[\\d.]+)" y="(-?[\\d.]+)" width="([\\d.]+)" height="([\\d.]+)"`).exec(rigFxGradients);
      expect(m, `clipPath ${id} absent des DEFS`).toBeTruthy();
      return { x: +m![1], y: +m![2], w: +m![3], h: +m![4] };
    };
    const crane = rect('rigCutQuadCrane'), nuque = rect('rigCutQuadNuque');
    expect(crane.y + crane.h, 'le bas du crâne = le haut de la nuque').toBe(nuque.y);
    expect(crane.x).toBe(nuque.x);
    expect(crane.w).toBe(nuque.w);
    // Couverture : l'art de tête de dos de CHAQUE espèce tient dans l'union des deux rects — un art
    // qui déborde serait amputé au rendu, il rougit ici.
    const union = { x0: crane.x, x1: crane.x + crane.w, y0: crane.y, y1: nuque.y + nuque.h };
    const debords: string[] = [];
    for (const { id, quad } of quadDefs) {
      const b = bboxOf(clipContent(quadLayersSvg(quadParts(quad, 'back').tete), 'rigCutQuadCrane'));
      if (b.x0 < union.x0 || b.x1 > union.x1 || b.y0 < union.y0 || b.y1 > union.y1)
        debords.push(`${id} : art x[${b.x0}..${b.x1}] y[${b.y0}..${b.y1}] hors de x[${union.x0}..${union.x1}] y[${union.y0}..${union.y1}]`);
    }
    expect(debords, 'l\'union des deux découpes doit couvrir l\'art de tête de dos').toEqual([]);
  });

  it('l\'os `nuque` ne porte d\'art QUE de dos (de face et de profil, la tête est entière)', () => {
    for (const { id, quad } of quadDefs) {
      for (const view of ['profile', 'front'] as View[]) {
        expect(quadParts(quad, view).nuque, `${id} ${view}`).toBeUndefined();
        expect(quadLayersSvg(quadParts(quad, view).tete), `${id} ${view}`).not.toContain('rigCutQuad');
      }
    }
  });

  it('l\'aile pliée repose SUR le dos de dos, et reste derrière le poitrail de face', () => {
    expect(QUAD_Z.aileD.back).toBeGreaterThan(QUAD_Z.tronc.back);
    expect(QUAD_Z.aileG.back).toBeGreaterThan(QUAD_Z.tronc.back);
    expect(QUAD_Z.aileD.front).toBeLessThan(QUAD_Z.tronc.front);
    expect(QUAD_Z.aileG.front).toBeLessThan(QUAD_Z.tronc.front);
  });
});
