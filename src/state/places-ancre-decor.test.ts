import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { findPropById } from '../data';
import { chebyshev } from '../engine/grid';
import { empreinteDuProp, offsetAncre, placesLocalesDuProp, rotatePropLocal, type PropData } from '../data/props.types';
import { buildProps } from '../gameIso/builders/props';
import { buildPropVolumes } from '../gameIso/builders/propVolumes';
import { estPropVolumique } from '../gameIso/builders/types';
import { scenario as opera } from '../scenes/test-scenarios/opera';
import { emptyScene, heightAt, sceneMetresPerTile, type Scene, type SceneEntity } from './scene';
import { seatSlotsOf } from './seating';
import { parseProject } from './worldMap';
import type { Dir4 } from './dir8';

/**
 * L'ANCRE D'UNE PLACE EST CELLE DU DÉCOR (#1509 L5′).
 *
 * Une place assise se pose sur `decorAncre` (`state/footprint.ts`) — le centre de l'empreinte
 * effective du meuble — exactement comme la géométrie de sa recette (`gameIso/builders/props.ts`) et
 * comme le foyer de la lampe qu'il porte (`state/vision.ts`). Ce fichier tient les deux faces de
 * cette affirmation :
 *  1. la POPULATION authorée ne bouge pas d'un flottant (toutes ses tables sont 1×1 à l'échelle de
 *     leur scène, où l'ancre du décor EST `pos`) ;
 *  2. sur un meuble qui couvre VRAIMENT deux cases, l'ancre de ses places coïncide avec celle que la
 *     géométrie emploie — l'ancre géométrique étant MESURÉE sur les faces émises, jamais recalculée.
 */

const SCENES_DIR = join(__dirname, '../scenes');

/** Tous les paquets de campagne bundlés (`*-projet.json`, glob récursif — jamais une liste de noms
 *  en dur : un paquet neuf entre dans ce contrat sans qu'on y pense). */
function fichiersDeProjet(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...fichiersDeProjet(full));
    else if (e.isFile() && e.name.endsWith('-projet.json')) out.push(full);
  }
  return out;
}

/** Les scènes COMMITTÉES où une place peut être authorée : les paquets bundlés, plus l'Opéra, dont la
 *  carte est déclarée en `MapSpec` et compilée hors de tout `.json`. */
function scenesCommittees(): Scene[] {
  const out: Scene[] = [];
  for (const f of fichiersDeProjet(SCENES_DIR)) out.push(...parseProject(JSON.parse(readFileSync(f, 'utf8'))).scenes);
  out.push(opera.scene as Scene);
  return out;
}

const n6 = (v: number) => v.toFixed(6);

/** Toutes les places AUTHORÉES du dépôt, résolues, une ligne par place : l'instance porteuse (ref,
 *  cap, case), l'ANCRE fractionnaire du corps assis, son sol, son cap et sa case d'ABORD. */
function placesAuthorees(): string[] {
  const out: string[] = [];
  for (const sc of scenesCommittees()) {
    for (const e of sc.entities) {
      if (e.kind !== 'prop') continue;
      if (!findPropById(e.ref ?? '')?.seatSlots?.length) continue;
      for (const s of seatSlotsOf(sc, e.id)) {
        out.push(`${sc.id}/${e.id}[${e.ref}@${e.facing ?? 'S'}](${e.pos.x},${e.pos.y})/${s.slotId}`
          + ` ancre=(${n6(s.anchor.x)},${n6(s.anchor.y)},${n6(s.anchor.h)}) sol=${n6(s.ground)}`
          + ` cap=${s.facing} abord=(${s.approach.x},${s.approach.y},${s.approach.z ?? 0})`);
      }
    }
  }
  return out;
}

describe('places AUTHORÉES — la population entière, ancre et abord, au flottant près', () => {
  it('les seize places de `la-diligence` sont exactement celles-ci', () => {
    expect(placesAuthorees()).toEqual([
      'la-diligence/diligence-salle-table-ronde-1[table-ronde-4-tabourets@S](11,8)/place-1 ancre=(11.000000,8.480000,0.460000) sol=0.000000 cap=N abord=(12,7,0)',
      'la-diligence/diligence-salle-table-ronde-1[table-ronde-4-tabourets@S](11,8)/place-2 ancre=(10.520000,8.000000,0.460000) sol=0.000000 cap=E abord=(10,8,0)',
      'la-diligence/diligence-salle-table-ronde-1[table-ronde-4-tabourets@S](11,8)/place-3 ancre=(11.000000,7.520000,0.460000) sol=0.000000 cap=S abord=(11,7,0)',
      'la-diligence/diligence-salle-table-ronde-1[table-ronde-4-tabourets@S](11,8)/place-4 ancre=(11.480000,8.000000,0.460000) sol=0.000000 cap=O abord=(12,8,0)',
      'la-diligence/diligence-salle-table-murale-1[table-murale-2-tabourets@E](14,11)/place-1 ancre=(13.800000,10.680000,0.460000) sol=0.000000 cap=E abord=(13,10,0)',
      'la-diligence/diligence-salle-table-murale-1[table-murale-2-tabourets@E](14,11)/place-2 ancre=(13.800000,11.320000,0.460000) sol=0.000000 cap=E abord=(13,12,0)',
      'la-diligence/diligence-salle-table-murale-2[table-murale-2-tabourets@E](14,16)/place-1 ancre=(13.800000,15.680000,0.460000) sol=0.000000 cap=E abord=(13,15,0)',
      'la-diligence/diligence-salle-table-murale-2[table-murale-2-tabourets@E](14,16)/place-2 ancre=(13.800000,16.320000,0.460000) sol=0.000000 cap=E abord=(13,17,0)',
      'la-diligence/diligence-salle-table-ronde-2[table-ronde-4-tabourets@S](12,18)/place-1 ancre=(12.000000,18.480000,0.460000) sol=0.000000 cap=N abord=(12,19,0)',
      'la-diligence/diligence-salle-table-ronde-2[table-ronde-4-tabourets@S](12,18)/place-2 ancre=(11.520000,18.000000,0.460000) sol=0.000000 cap=E abord=(11,18,0)',
      'la-diligence/diligence-salle-table-ronde-2[table-ronde-4-tabourets@S](12,18)/place-3 ancre=(12.000000,17.520000,0.460000) sol=0.000000 cap=S abord=(12,17,0)',
      'la-diligence/diligence-salle-table-ronde-2[table-ronde-4-tabourets@S](12,18)/place-4 ancre=(12.480000,18.000000,0.460000) sol=0.000000 cap=O abord=(13,18,0)',
      'la-diligence/diligence-salle-table-ronde-3[table-ronde-4-tabourets@S](10,21)/place-1 ancre=(10.000000,21.480000,0.460000) sol=0.000000 cap=N abord=(10,22,0)',
      'la-diligence/diligence-salle-table-ronde-3[table-ronde-4-tabourets@S](10,21)/place-2 ancre=(9.520000,21.000000,0.460000) sol=0.000000 cap=E abord=(9,21,0)',
      'la-diligence/diligence-salle-table-ronde-3[table-ronde-4-tabourets@S](10,21)/place-3 ancre=(10.000000,20.520000,0.460000) sol=0.000000 cap=S abord=(10,20,0)',
      'la-diligence/diligence-salle-table-ronde-3[table-ronde-4-tabourets@S](10,21)/place-4 ancre=(10.480000,21.000000,0.460000) sol=0.000000 cap=O abord=(11,21,0)',
    ]);
  });

  it('POURQUOI elle ne bouge pas : à l’échelle de leur scène, ces cinq meubles tiennent sur UNE case', () => {
    const etendues = new Set<string>();
    for (const sc of scenesCommittees()) {
      for (const e of sc.entities) {
        if (e.kind !== 'prop') continue;
        const prop = findPropById(e.ref ?? '');
        if (!prop?.seatSlots?.length) continue;
        const { w, h } = empreinteDuProp(prop, e.facing, sceneMetresPerTile(sc));
        etendues.add(`${e.ref}@${e.facing ?? 'S'}:${w}x${h}`);
      }
    }
    expect([...etendues].sort()).toEqual(['table-murale-2-tabourets@E:1x1', 'table-ronde-4-tabourets@S:1x1']);
  });
});

/**
 * MEUBLE À PLACES SUR DEUX CASES — le cas que la population n'exerce pas encore.
 *
 * L'empreinte se dérive à l'ÉCHELLE de la scène : le corps de `table-murale-2-tabourets` tient sur
 * une case à 2 m/case (le défaut, LDB 15 l.12) et en couvre deux à 1 m/case — le premier contrat
 * ci-dessous le MESURE. C'est donc la même donnée authorée qui, à une autre échelle, sépare d'une
 * demi-case l'ancrage au coin NO et l'ancrage au centre de l'empreinte.
 */
describe('meuble à places de DEUX cases — l’ancre des places EST celle de la géométrie', () => {
  const REF = 'table-murale-2-tabourets';
  const ID = 'murale';
  const POS = { x: 5, y: 5 };
  /** Échelle à laquelle le corps de ce meuble couvre deux cases (cf. l'en-tête ci-dessus). */
  const MPT = 1;
  const CAPS: Dir4[] = ['N', 'E', 'S', 'O'];

  const prop = findPropById(REF) as PropData;
  const scene = (facing: Dir4): Scene => ({
    ...emptyScene(12, 12),
    metresPerTile: MPT,
    entities: [{ id: ID, kind: 'prop', pos: { ...POS }, ref: REF, facing } as SceneEntity],
  });

  /**
   * ANCRE MONDE que la GÉOMÉTRIE emploie, MESURÉE sur les faces émises : la recette bâtie à
   * l'origine (`ancre` (0,0)) et la recette du décor posé ne diffèrent que d'une TRANSLATION rigide,
   * et cette translation EST l'ancre. Rien n'est relu de `decorAncre` ici — sinon ce contrat
   * répéterait la formule qu'il juge au lieu de la confronter au monde dessiné.
   */
  function ancreDeLaGeometrie(facing: Dir4, sc: Scene = scene(facing)): { x: number; y: number; sol: number } {
    const el = buildProps(sc).find((e) => e.entId === ID)!;
    expect(estPropVolumique(el), `${REF} doit sortir en VOLUME (sinon rien n’est mesuré)`).toBe(true);
    const posees = estPropVolumique(el) ? el.faces : [];
    const locales = buildPropVolumes(prop, { ancre: { x: 0, y: 0 }, facing, baseHeightM: 0 }, MPT);
    expect(posees.length).toBe(locales.length);
    const deltas = posees.flatMap((f, i) => f.poly.map((p, j) => ({ x: p.x - locales[i].poly[j].x, y: p.y - locales[i].poly[j].y, h: p.h - locales[i].poly[j].h })));
    const ecart = Math.max(...deltas.map((d) => Math.max(chebyshev(d, deltas[0]), Math.abs(d.h - deltas[0].h))));
    expect(ecart, 'la pose du décor doit être une translation RIGIDE de sa recette').toBeLessThan(1e-9);
    return { x: deltas[0].x, y: deltas[0].y, sol: deltas[0].h };
  }

  /** ANCRE MONDE que la PLACE emploie : sa position résolue, moins la rotation de son ancre locale au
   *  cap de l'instance (`rotatePropLocal`, la même rotation que la géométrie applique). */
  function ancreDeLaPlace(facing: Dir4, slotId: string): { x: number; y: number } {
    const place = seatSlotsOf(scene(facing), ID).find((s) => s.slotId === slotId)!;
    const slot = prop.seatSlots!.find((s) => s.id === slotId)!;
    const [rx, ry] = rotatePropLocal(slot.anchor.xM / MPT, slot.anchor.yM / MPT, facing);
    return { x: place.anchor.x - rx, y: place.anchor.y - ry };
  }

  it('la fixture EXERCE bien le cas : deux cases, et l’empreinte tourne avec le cap', () => {
    expect(CAPS.map((c) => { const { w, h } = empreinteDuProp(prop, c, MPT); return `${c}:${w}x${h}`; }))
      .toEqual(['N:2x1', 'E:1x2', 'S:2x1', 'O:1x2']);
    expect(prop.seatSlots?.map((s) => s.id)).toEqual(['place-1', 'place-2']);
  });

  it('aux quatre caps, l’ancre de chaque place coïncide avec celle de la géométrie (≤ 1e-9)', () => {
    const ecarts: string[] = [];
    for (const cap of CAPS) {
      const geo = ancreDeLaGeometrie(cap);
      for (const slot of prop.seatSlots!) {
        const place = ancreDeLaPlace(cap, slot.id);
        const d = chebyshev(place, geo);
        if (d > 1e-9) ecarts.push(`${cap}/${slot.id} : place=(${n6(place.x)},${n6(place.y)}) géométrie=(${n6(geo.x)},${n6(geo.y)}) écart=${n6(d)}`);
      }
    }
    expect(ecarts).toEqual([]);
  });

  /**
   * ABORDS SYMÉTRIQUES. Les deux places de ce meuble sont l'image l'une de l'autre par l'axe de son
   * ancre (ancres locales opposées, `xM: ±0,64`) : leurs cases d'abord le sont donc aussi, et leur
   * somme vaut deux fois l'ancre. C'est ce que garantit l'application de `approach` depuis la CASE du
   * siège ; appliqué depuis l'ancre FRACTIONNAIRE du meuble, l'arrondi tombe sur un demi-entier à
   * chaque place d'une empreinte paire et les départage toutes du même côté — mesuré au cap N :
   * (0,1) et (2,1), dont la somme vaut 2 pour une ancre à 0,5.
   */
  it('les abords des DEUX places sont MIROIR l’un de l’autre, aux quatre caps', () => {
    const ecarts: string[] = [];
    for (const cap of CAPS) {
      const centre = offsetAncre(empreinteDuProp(prop, cap, MPT));
      const [p1, p2] = placesLocalesDuProp(prop, cap, MPT);
      // L'AXE du miroir se lit sur les places elles-mêmes : `u` est la direction qui SÉPARE les deux
      // ancres, donc la normale de l'axe — aucune orientation n'est écrite en dur, elle tourne avec
      // le cap comme le reste.
      const d = { x: p1.ancre.x - p2.ancre.x, y: p1.ancre.y - p2.ancre.y };
      const norme = Math.hypot(d.x, d.y);
      expect(norme, `${cap} : deux places confondues, il n’y a plus de miroir à mesurer`).toBeGreaterThan(1e-9);
      const u = { x: d.x / norme, y: d.y / norme };
      const relatif = (p: { x: number; y: number }) => ({ x: p.x - centre.x, y: p.y - centre.y });
      const a = relatif(p1.abord), b = relatif(p2.abord);
      const dot = a.x * u.x + a.y * u.y;
      const reflechi = { x: a.x - 2 * dot * u.x, y: a.y - 2 * dot * u.y };
      if (Math.abs(reflechi.x - b.x) > 1e-9 || Math.abs(reflechi.y - b.y) > 1e-9) {
        ecarts.push(`${cap} : abord de « ${p1.slot.id} » réfléchi = (${n6(reflechi.x + centre.x)},${n6(reflechi.y + centre.y)})`
          + ` mais « ${p2.slot.id} » aborde en (${p2.abord.x},${p2.abord.y})`);
      }
    }
    expect(ecarts).toEqual([]);
  });

  /**
   * ALTITUDE. Le sol d'une place est celui que la GÉOMÉTRIE pose sous la recette — mesuré ici comme la
   * translation VERTICALE des faces émises, jamais relu de `heightAt`. La fixture porte une marche
   * SOUS la seconde case de l'empreinte : lire le sol à la case du siège au lieu du pied du décor
   * décollerait le corps de l'un des deux tabourets dessinés.
   */
  it('le sol d’une place est celui du PIED du décor, marche sous l’empreinte comprise', () => {
    const cap: Dir4 = 'N';
    const sc = scene(cap);
    const marche = sc.layers[0];
    marche.height = new Array(sc.dimensions.w * sc.dimensions.h).fill(0);
    marche.height[POS.y * sc.dimensions.w + POS.x + 1] = 1.5; // la SECONDE case du 2×1
    expect(heightAt(sc, POS.x, POS.y, 0)).not.toBe(heightAt(sc, POS.x + 1, POS.y, 0)); // la marche MORD
    const geo = ancreDeLaGeometrie(cap, sc);
    const sols = seatSlotsOf(sc, ID).map((p) => p.ground);
    expect(sols).toEqual([geo.sol, geo.sol]);
  });

  it('LA MORSURE : sur ce meuble, l’ancre de la géométrie N’EST PAS `pos` — une demi-case l’en sépare', () => {
    const ecarts = CAPS.map((cap) => {
      const geo = ancreDeLaGeometrie(cap);
      return `${cap}:${n6(geo.x - POS.x)},${n6(geo.y - POS.y)}`;
    });
    // Le coin NO d'une empreinte 2×1 est à une demi-case de son centre, sur l'axe étendu : c'est
    // exactement l'écart qu'une place ancrée sur `SceneEntity.pos` porterait, et que le contrat
    // ci-dessus mesure à zéro.
    expect(ecarts).toEqual(['N:0.500000,0.000000', 'E:0.000000,0.500000', 'S:0.500000,0.000000', 'O:0.000000,0.500000']);
  });
});
