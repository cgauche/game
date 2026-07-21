import { describe, it, expect } from 'vitest';
import { baseSpeciesOf, baseSkeleton, applyBuild, groundSkeleton, referenceSkeleton } from './skeletons';
import { gabaritById } from './gabarits';
import { worldTransforms, apply } from './kinematics';
import { BONE_IDS } from './bones';
import { species } from '../../data/index';
import speciesRaceJson from '../../data/speciesRace.json';

describe('baseSpeciesOf', () => {
  it('normalise les variantes régionales', () => {
    expect(baseSpeciesOf('Humains (Reiklander)')).toBe('Humain');
    expect(baseSpeciesOf('Nains (Norse)')).toBe('Nain');
    expect(baseSpeciesOf('Halflings (Cendreplaine)')).toBe('Halfling');
    expect(baseSpeciesOf('Hauts Elfes')).toBe('Haut-Elfe');
    expect(baseSpeciesOf('Elfes sylvains')).toBe('Elfe sylvain');
  });

  // Le vocabulaire d'`appearance.species` = ids STABLES de species.json (slug du libellé). Chaque id
  // valide DOIT matcher une RÈGLE explicite de speciesRace.json, jamais vivre du défaut silencieux.
  const RACE_BY_FAMILY: Record<string, string> = {
    Humains: 'Humain', Halflings: 'Halfling', Nains: 'Nain', Gnomes: 'Gnome',
    Ogres: 'Ogre', 'Hauts elfes': 'Haut-Elfe', 'Elfes sylvains': 'Elfe sylvain',
  };
  it('une règle EXPLICITE couvre l\'id humain (pas le défaut)', () => {
    const humainRule = speciesRaceJson.rules.find((r) => r.race === 'Humain' && (r.prefix ?? []).includes('humain'));
    expect(humainRule, 'speciesRace.json doit porter une règle prefix "humain" → Humain').toBeTruthy();
  });
  it('tout id de species.json résout vers la race de sa famille PAR RÈGLE', () => {
    for (const s of species) {
      const family = s.family ?? s.label;
      const expected = RACE_BY_FAMILY[family];
      expect(expected, `famille non cartographiée: ${family} (${s.id})`).toBeTruthy();
      expect(baseSpeciesOf(s.id), `${s.id} → ${expected}`).toBe(expected);
    }
  });
  it('une chaîne poubelle retombe sur le DÉFAUT (Humain), discriminant', () => {
    // 'zzz-espece-inconnue' ne matche AUCUNE règle → défaut ; 'nains' matche une règle → Nain (≠ défaut),
    // ce qui prouve que les ids valides passent bien par les règles et non par la retombée.
    expect(baseSpeciesOf('zzz-espece-inconnue')).toBe(speciesRaceJson.default);
    expect(baseSpeciesOf('nains')).toBe('Nain');
    expect(baseSpeciesOf('nains')).not.toBe(speciesRaceJson.default);
  });
});

describe('baseSkeleton', () => {
  it("un Nain a des jambes plus courtes qu'un Humain", () => {
    const h = baseSkeleton(gabaritById('moyen'), 'M');
    const n = baseSkeleton(gabaritById('courtaud'), 'M');
    expect(n.cuisseG.length).toBeLessThan(h.cuisseG.length);
  });
  it("un Haut-Elfe est plus élancé (membres plus longs) qu'un Humain", () => {
    const h = baseSkeleton(gabaritById('moyen'), 'M');
    const e = baseSkeleton(gabaritById('elance'), 'M');
    expect(e.cuisseG.length).toBeGreaterThan(h.cuisseG.length);
  });
  it('M et F diffèrent en proportions sans être identiques', () => {
    const m = baseSkeleton(gabaritById('moyen'), 'M');
    const f = baseSkeleton(gabaritById('moyen'), 'F');
    expect(f.epauleG.pivot.x).not.toBe(m.epauleG.pivot.x);
  });
  it("espèce inconnue retombe sur Humain", () => {
    const u = baseSkeleton(gabaritById('moyen'), 'M');
    const h = baseSkeleton(gabaritById('moyen'), 'M');
    expect(u.torse.length).toBe(h.torse.length);
  });
});

describe('géométrie au repos (proxy visuel sans navigateur)', () => {
  const w = worldTransforms(baseSkeleton(gabaritById('moyen'), 'M'), {});
  const origin = (id: keyof typeof w) => apply(w[id], { x: 0, y: 0 });

  it('la figure est debout : tête en haut, bassin au milieu, pieds en bas', () => {
    const tete = origin('tete');
    const bassin = origin('bassin');
    const pied = origin('piedG');
    expect(tete.y).toBeLessThan(bassin.y);     // tête au-dessus du bassin
    expect(bassin.y).toBeLessThan(pied.y);     // bassin au-dessus des pieds
    expect(bassin.y).toBeGreaterThan(80);      // bassin ~96
    expect(bassin.y).toBeLessThan(110);
    expect(pied.y).toBeGreaterThan(140);       // pieds proches de la ligne de sol (150)
    expect(pied.y).toBeLessThan(160);
    expect(tete.y).toBeLessThan(60);           // tête dans le haut de la boîte
  });

  it('la posture est symétrique : mains/jambes en miroir autour de x=60', () => {
    const mainG = origin('mainG');
    const mainD = origin('mainD');
    const piedG = origin('piedG');
    const piedD = origin('piedD');
    // main droite à droite du centre, main gauche à gauche
    expect(mainD.x).toBeGreaterThan(60);
    expect(mainG.x).toBeLessThan(60);
    // symétrie autour de x=60 (tolérance)
    expect(Math.abs((60 - mainG.x) - (mainD.x - 60))).toBeLessThan(3);
    expect(Math.abs((60 - piedG.x) - (piedD.x - 60))).toBeLessThan(2);
  });

  it('tous les os tiennent dans la boîte 120×150 (± marge)', () => {
    for (const id of BONE_IDS) {
      const p = origin(id);
      expect(p.x).toBeGreaterThan(-10);
      expect(p.x).toBeLessThan(130);
      expect(p.y).toBeGreaterThan(-10);
      expect(p.y).toBeLessThan(165);
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
  });
});

/**
 * CANON D'EMBOÎTEMENT du squelette humanoïde (#633 P3 — `rig/SKELETON-CONTRACT.md`).
 * L'art des parts est la donnée FIXE ; le squelette doit placer ses articulations sur les
 * repères anatomiques que l'art peint (constantes ART_* ci-dessous, mesurées sur les defs).
 * Échoue si un pivot/une longueur ré-ouvre un « enfoncement » (tête dans le torse, jambes
 * sous l'ourlet) ou une déconnexion (art plus court que l'écart des joints).
 */
describe('canon du squelette (moyen M, build 0.5, ancré au sol)', () => {
  // Repères de l'ART (repère local de l'os porteur — cf. tableau de SKELETON-CONTRACT.md) :
  const ART_CHIN = 16;        // bas du visage (menton/nuque), tete-local — visage/BACK_CRANE/PROFILE_FACE
  const ART_COLLAR_TOP = -32; // sommet du col des arts de torse (courbe Q0 −32, épaules −27/−28)
  const ART_HEM_MAX = 38;     // ourlet le plus long des arts de torse (tunique générique : Q0 38)
  const ART_LEG_SPAN = 50;    // art de jambes : hanche (0) → cheville (50)
  const ART_KNEE = 22;        // genou de l'art de jambes (plaque/renflement à 22..30)
  const ART_ARM_END = 32;     // fin de l'art de bras (manche/poignet ~27..31.6)

  const sk = groundSkeleton(applyBuild(baseSkeleton(gabaritById('moyen'), 'M'), 0.5));
  const wc = worldTransforms(sk, {});
  const at = (id: keyof typeof wc, p = { x: 0, y: 0 }) => apply(wc[id], p);

  it('EMBOÎTEMENT : chaque pivot enfant tombe au bout de son os parent (aucun trou possible en FK)', () => {
    expect(sk.tibiaG.pivot.y).toBe(sk.cuisseG.length);
    expect(sk.tibiaD.pivot.y).toBe(sk.cuisseD.length);
    expect(sk.piedG.pivot.y).toBe(sk.tibiaG.length);
    expect(sk.piedD.pivot.y).toBe(sk.tibiaD.length);
    expect(sk.avantBrasG.pivot.y).toBe(sk.epauleG.length);
    expect(sk.avantBrasD.pivot.y).toBe(sk.epauleD.length);
    expect(sk.tete.pivot.y).toBe(-sk.cou.length); // la tête naît au SOMMET du cou
    expect(sk.cou.pivot.y).toBe(-sk.torse.length); // le cou naît au SOMMET du torse
  });

  it('TÊTE POSÉE : le menton reste AU-DESSUS du col du torse (2..8 — un cou visible, jamais enfoncé)', () => {
    const chin = at('tete', { x: 0, y: ART_CHIN }).y;
    const collar = at('torse', { x: 0, y: ART_COLLAR_TOP }).y;
    expect(collar - chin).toBeGreaterThanOrEqual(2);
    expect(collar - chin).toBeLessThanOrEqual(8);
  });

  it("JAMBES ATTACHÉES : l'ourlet du torse couvre les hanches mais laisse le genou visible", () => {
    const hem = at('torse', { x: 0, y: ART_HEM_MAX }).y;
    const hip = at('cuisseG').y;
    const knee = at('cuisseG', { x: 0, y: ART_KNEE }).y;
    expect(hem).toBeGreaterThan(hip);          // l'ourlet couvre l'attache (pas de trou hanche/tunique)
    expect(hem).toBeLessThanOrEqual(knee + 1); // …sans avaler le genou (jambes lisibles ; +1 = écart d'angle de repos)
  });

  it("CONNEXITÉ jambe : la chaîne hanche→cheville égale l'étendue de l'art de jambes (50)", () => {
    expect(sk.cuisseG.length + sk.tibiaG.length).toBe(ART_LEG_SPAN);
    expect(sk.cuisseD.length + sk.tibiaD.length).toBe(ART_LEG_SPAN);
  });

  it("CONNEXITÉ bras : le poignet FK tombe dans la fin de l'art de bras (le poing s'y emboîte)", () => {
    const drop = at('mainG').y - at('epauleG').y;
    expect(drop).toBeGreaterThan(ART_ARM_END - 4);
    expect(drop).toBeLessThanOrEqual(ART_ARM_END + 1);
  });

  it('SOL : le bout du pied touche la ligne de sol (150) après ancrage', () => {
    expect(at('piedG', { x: 0, y: sk.piedG.length }).y).toBeCloseTo(150, 5);
  });

  it('MAINS À HAUTEUR DE HANCHE : le poing pend près de la ceinture (anatomie, jamais à mi-torse)', () => {
    const fist = at('mainG', { x: 0, y: sk.mainG.length }).y;
    expect(Math.abs(fist - at('cuisseG').y)).toBeLessThanOrEqual(10);
  });

  it('RÉFÉRENCE : le squelette de réf (échelle des parts) satisfait le même canon (jamais deux vérités)', () => {
    const ref = referenceSkeleton();
    expect(ref.tete.pivot.y).toBe(-ref.cou.length);
    expect(ref.tibiaG.pivot.y).toBe(ref.cuisseG.length);
  });
});

describe('applyBuild', () => {
  it('build élevé épaissit le torse de façon monotone', () => {
    const sk = baseSkeleton(gabaritById('moyen'), 'M');
    const thin = applyBuild(sk, 0).torse.thickness;
    const mid = applyBuild(sk, 0.5).torse.thickness;
    const fat = applyBuild(sk, 1).torse.thickness;
    expect(thin).toBeLessThan(mid);
    expect(mid).toBeLessThan(fat);
  });
  it("ne mute pas l'entrée", () => {
    const sk = baseSkeleton(gabaritById('moyen'), 'M');
    const before = sk.torse.thickness;
    applyBuild(sk, 1);
    expect(sk.torse.thickness).toBe(before);
  });
});
