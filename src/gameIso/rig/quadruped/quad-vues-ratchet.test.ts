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
import { QUAD_Z, quadZOrder } from './quadZ';
import { buildQuadSkeleton, quadSkeletonForView, type QuadBoneId, type QuadProps } from './quadSkeleton';
import { quadParts } from './quadParts';
import { riderZForQuad, mountTackBones } from '../mountedRig';
import { rigFxGradients } from '../fxGradients';
import type { ResolvedBone } from '../composeRig';
import type { View } from '../facing';

const VIEWS: View[] = ['profile', 'front', 'back'];
const quadDefs = CREATURES.filter((c) => c.quad).map((c) => ({ id: c.id, quad: c.quad as QuadProps }));

// ── (a) DÉCORS MORTS ────────────────────────────────────────────────────────────────────────
/** Stock GELÉ (mesuré le 2026-08-05) : `<espèce> <vue> <clé deco>`. Ne peut que rétrécir. */
const DECOS_MORTS_GELES = [
  'boeuf back encolure',
  'boeuf front encolure',
  'cheval back encolure',
  'cheval front encolure',
  'chien back encolure',
  'chien front encolure',
  'grand-cerf back encolure',
  'grand-cerf front encolure',
  'pegase back encolure',
  'pegase front encolure',
  'sanglier back encolure',
  'sanglier front encolure',
];
const PLAFOND_DECOS_MORTS = DECOS_MORTS_GELES.length;

/**
 * Population GELÉE (mesurée le 2026-08-05) : les 79 couples `deco`×os×vue APPLICABLES, soit le
 * dénominateur du stock des morts. Un couple ne quitte cette liste que par un art émis (solde).
 */
const APPLICABLES_GELES = [
  'blaireau back tete#back',
  'blaireau front tete#front',
  'blaireau front tronc#front',
  'blaireau profile tete#profile',
  'blaireau profile tronc#profile',
  'boeuf back encolure',
  'boeuf back tete#back',
  'boeuf back tronc#back',
  'boeuf front encolure',
  'boeuf front tete#front',
  'boeuf front tronc#front',
  'boeuf profile encolure',
  'boeuf profile tete#profile',
  'boeuf profile tronc#profile',
  'cheval back encolure',
  'cheval back tete',
  'cheval front encolure',
  'cheval front tete',
  'cheval profile encolure',
  'cheval profile tete',
  'chien back encolure',
  'chien back tronc',
  'chien front encolure',
  'chien front tronc',
  'chien profile encolure',
  'chien profile tronc',
  'grand-cerf back encolure',
  'grand-cerf back tete',
  'grand-cerf front encolure',
  'grand-cerf front tete',
  'grand-cerf profile encolure',
  'grand-cerf profile tete',
  'grand-cerf profile tete#profile',
  'griffon back basAvD',
  'griffon back basAvG',
  'griffon back hautArD',
  'griffon back hautArG',
  'griffon back hautAvD',
  'griffon back hautAvG',
  'griffon front basAvD',
  'griffon front basAvG',
  'griffon front hautArD',
  'griffon front hautArG',
  'griffon front hautAvD',
  'griffon front hautAvG',
  'griffon profile basAvD',
  'griffon profile basAvG',
  'griffon profile hautArD',
  'griffon profile hautArG',
  'griffon profile hautAvD',
  'griffon profile hautAvG',
  'lion-de-guerre-de-chrace profile piedAvD#profile',
  'manticore back tete',
  'manticore front tete',
  'manticore profile queue#profile',
  'manticore profile tete',
  'pegase back encolure',
  'pegase front encolure',
  'pegase profile encolure',
  'preyton back tronc',
  'preyton front tronc',
  'preyton profile tronc',
  'rat-geant back tete',
  'rat-geant front tete',
  'rat-geant profile tete',
  'sanglier back encolure',
  'sanglier back tete#back',
  'sanglier front encolure',
  'sanglier front tete#front',
  'sanglier profile encolure',
  'sanglier profile tete#profile',
  'sanglier profile tronc#profile',
  'varghulf back aileD',
  'varghulf back aileG',
  'varghulf front aileD',
  'varghulf front aileG',
  'varghulf profile aileD',
  'varghulf profile aileG',
  'varghulf profile tronc#profile',
];

function decosMorts(): { morts: string[]; applicables: string[] } {
  const morts: string[] = [];
  const applicables: string[] = [];
  for (const { id, quad } of quadDefs) {
    if (!quad.deco) continue;
    for (const view of VIEWS) {
      const nu = quadParts({ ...quad, deco: undefined }, view);
      for (const cle of Object.keys(quad.deco)) {
        const [os, vue] = cle.split('#') as [QuadBoneId, View | undefined];
        if (vue && vue !== view) continue;
        applicables.push(`${id} ${view} ${cle}`);
        if (!nu[os]) morts.push(`${id} ${view} ${cle}`);
      }
    }
  }
  return { morts: morts.sort(), applicables: applicables.sort() };
}

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
    const { applicables } = decosMorts();
    expect(quadDefs.length).toBeGreaterThan(20);
    expect(applicables.length).toBeGreaterThan(50);
  });

  it('aucun couple deco×os×vue mort HORS du stock gelé', () => {
    const { morts } = decosMorts();
    const nouveaux = morts.filter((m) => !DECOS_MORTS_GELES.includes(m));
    expect(nouveaux, 'décor authoré perdu par une vue qui n\'a pas d\'art sur l\'os visé').toEqual([]);
  });

  it('le stock reste sous son plafond', () => {
    const { morts } = decosMorts();
    expect(morts.length).toBeLessThanOrEqual(PLAFOND_DECOS_MORTS);
  });

  it('aucun couple applicable GELÉ n\'a disparu sans que son art soit émis', () => {
    const { applicables } = decosMorts();
    const disparus = APPLICABLES_GELES.filter((c) => !applicables.includes(c) && !artEmis(c));
    expect(disparus, 'couple applicable retiré sans art émis dans la vue : blanchiment du stock des morts').toEqual([]);
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

  it('le cavalier s\'intercale au PROFIL comme avant la publication de la table', () => {
    const profil = riderZForQuad('profile');
    expect(profil(bone('cuisseG', 0))).toBe(4.5);  // jambe lointaine, sous le barillet (5)
    expect(profil(bone('torse', 0))).toBe(6.6);    // corps, au-dessus de l'encolure (6)
    expect(profil(bone('cuisseD', 0))).toBe(8.2);  // jambe proche, au-dessus de la tête (7)
  });

  // Lot 1 (2026-08-05) : c'est le CODE qui a bougé — le forfait unique de face/dos (torse 6.6,
  // jambes au même plan que le torse) devient une table PAR VUE (`QUAD_RIDER_Z`).
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
describe('vue de DOS : crâne au-dessus du tronc, nuque dessous, aile pliée SUR le dos (#1082)', () => {
  it('l\'art de tête de dos est scindé en DEUX calques portés par deux os de plans différents', () => {
    for (const { id, quad } of quadDefs) {
      const back = quadParts(quad, 'back');
      expect(back.tete, `${id} : calque crâne`).toContain('clip-path="url(#rigCutQuadCrane)"');
      expect(back.nuque, `${id} : calque nuque`).toContain('clip-path="url(#rigCutQuadNuque)"');
    }
    expect(QUAD_Z.nuque.back).toBeLessThan(QUAD_Z.tronc.back);
    expect(QUAD_Z.tete.back).toBeGreaterThan(QUAD_Z.tronc.back);
  });

  it('les deux découpes se PARTAGENT le plan de l\'art (complémentaires, sans recouvrement ni trou)', () => {
    const rect = (id: string) => {
      const m = new RegExp(`id="${id}"[^>]*><rect x="(-?[\\d.]+)" y="(-?[\\d.]+)" width="([\\d.]+)" height="([\\d.]+)"`).exec(rigFxGradients);
      expect(m, `clipPath ${id} absent des DEFS`).toBeTruthy();
      return { x: +m![1], y: +m![2], w: +m![3], h: +m![4] };
    };
    const crane = rect('rigCutQuadCrane'), nuque = rect('rigCutQuadNuque');
    expect(crane.y + crane.h, 'le bas du crâne = le haut de la nuque').toBe(nuque.y);
    expect(crane.x).toBe(nuque.x);
    expect(crane.w).toBe(nuque.w);
  });

  it('l\'os `nuque` ne porte d\'art QUE de dos (de face et de profil, la tête est entière)', () => {
    for (const { id, quad } of quadDefs) {
      for (const view of ['profile', 'front'] as View[]) {
        expect(quadParts(quad, view).nuque, `${id} ${view}`).toBeUndefined();
        expect(quadParts(quad, view).tete, `${id} ${view}`).not.toContain('rigCutQuad');
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
