import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { propSvg } from './decor';
import { scenarioEntities } from '../../scenes/opera/furnished';
import { findPropById, props } from '../../data';
import { propFootOf, type PropPrimitive } from '../../data/props.types';
import { decorFootGeometry } from '../../state/footprint';
import { buildProps } from '../builders/props';
import { buildPropVolumes } from '../builders/propVolumes';
import { estPropVolumique, type Face } from '../builders/types';
import { bakeWorldGeometry, collectBillboards, wholeSceneBillboardEls } from '../backends/webgl/sceneMeshes';
import { facePoly, fanTriangles, polyNormal, type Vec3 } from '../backends/webgl/worldTris';
import { emptyScene, sceneMetresPerTile, type Scene, type SceneEntity } from '../../state/scene';

/**
 * LE DÉCOR VOLUMIQUE — les refs de `props.json` dont le corps MONDE est leur recette, et dont le SVG
 * de catalogue n'est plus qu'une vignette de palette. Ce fichier tient les deux moitiés du contrat :
 * l'identité (vignette + recette + places) et l'EXCLUSIVITÉ de la voie monde (une ref volumique n'a
 * plus aucun sujet de billboard).
 *
 * La liste est DÉRIVÉE du catalogue : une recette de plus entre sous contrat par sa seule déclaration
 * en donnée — une liste manuscrite laisserait les suivantes hors garde en silence.
 */
const IDS = props.filter((p) => p.volume).map((p) => p.id);

const propEntity = ({ id, ref, pos, facing }: { id: string; ref: string; pos: { x: number; y: number }; facing: 'N' | 'E' | 'S' | 'O' }): SceneEntity =>
  ({ id, kind: 'prop', pos, ref, facing }) as SceneEntity;
const sceneWith = (...entities: SceneEntity[]): Scene => ({ ...emptyScene(8, 8), entities });
const METRES_PAR_CASE = 2;

/** Un décor authoré quelque part dans `src/scenes` : sa provenance, son id, sa ref et son cap. */
interface DecorAuthore { source: string; id: string; ref?: string; facing?: string }

/**
 * TOUTES les instances de décor AUTHORÉES : les documents `.json` de `src/scenes` (récursif, toute
 * liste `entities` à n'importe quelle profondeur) ET le seul jeu de scènes écrit en TS (l'Opéra).
 * ANGLE MORT NOMMÉ : une scène TS de plus devrait être branchée ici — `src/data/prop-foot-migration.test.ts`
 * a exactement la même frontière, pour la même raison.
 */
const RACINE_SCENES = fileURLToPath(new URL('../../scenes', import.meta.url));
function entitesAuthorees(): DecorAuthore[] {
  const out: DecorAuthore[] = [];
  const recolte = (o: unknown, fichier: string): void => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { for (const x of o) recolte(x, fichier); return; }
    const noeud = o as Record<string, unknown>;
    if (Array.isArray(noeud.entities))
      for (const e of noeud.entities as DecorAuthore[]) out.push({ ...e, source: fichier });
    for (const v of Object.values(noeud)) recolte(v, fichier);
  };
  const parcours = (dir: string, rel: string): void => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const relPath = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) parcours(join(dir, ent.name), relPath);
      else if (ent.name.endsWith('.json')) recolte(JSON.parse(readFileSync(join(dir, ent.name), 'utf8')), relPath);
    }
  };
  parcours(RACINE_SCENES, '');
  for (const e of scenarioEntities as unknown as DecorAuthore[]) out.push({ ...e, source: 'opera/furnished.ts' });
  return out;
}

/** Les refs volumiques dont l'empreinte déclarée dépasse UNE case. */
const IDS_MULTI_CASE = props
  .filter((p) => p.volume && ((p.foot?.w ?? 1) > 1 || (p.foot?.h ?? 1) > 1))
  .map((p) => p.id);

/** Emprise d'une primitive : sa boîte englobante au sol (cases) et ses deux hauteurs (mètres). */
function emprise(p: PropPrimitive): { x0: number; x1: number; y0: number; y1: number; bas: number; haut: number } {
  const dx = p.kind === 'cylinder' ? p.radius : p.size.x / 2;
  const dy = p.kind === 'cylinder' ? p.radius : p.size.y / 2;
  const dh = (p.kind === 'cylinder' ? p.heightM : p.size.h) / 2;
  return { x0: p.center.x - dx, x1: p.center.x + dx, y0: p.center.y - dy, y1: p.center.y + dy, bas: p.center.h - dh, haut: p.center.h + dh };
}
type Emprise = ReturnType<typeof emprise>;
const seChevauchent = (a: Emprise, b: Emprise): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Distance HORIZONTALE d'un point à un segment, en cases — le bord d'une face, pas ses seuls sommets. */
function distanceAuSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

describe('décor volumique — chaque recette du catalogue, sa vignette et son corps monde', () => {
  // PLANCHER de la dérivation : `IDS` vient du catalogue, le comparer à sa propre définition ne
  // rougirait jamais. Ce qui peut vraiment casser, c'est une jointure VIDE (dataset non chargé,
  // `volume` renommé) : les `it.each` ci-dessous passeraient alors sans rien mesurer. L'existence de
  // la def d'ART de chaque id, elle, est gardée par `src/data/props-label-parite.test.ts`
  // (`labelDArt` est FAIL-FAST sur une def absente, sur TOUTES les entrées de `props.json`).
  it('la dérivation ne rend pas une liste VIDE (les contrats ci-dessous mesureraient du néant)', () => {
    expect(IDS.length).toBeGreaterThanOrEqual(11);
  });

  it.each(IDS)('%s possède vignette et volume monde, jamais billboard monde', (id) => {
    expect(propSvg(id).length).toBeGreaterThan(120);
    const prop = findPropById(id)!;
    expect(prop.volume!.primitives.length).toBeGreaterThan(0);
    const scene = sceneWith(propEntity({ id: `e-${id}`, ref: id, pos: { x: 2, y: 2 }, facing: 'S' }));
    expect(buildProps(scene)[0]).toMatchObject({ entId: `e-${id}`, faces: expect.any(Array) });
    const els = wholeSceneBillboardEls(scene);
    expect(collectBillboards(scene, sceneMetresPerTile(scene), els).some((b) => b.identity.includes(`e-${id}`))).toBe(false);
  });

  /**
   * QUESTION OUVERTE, volontairement NON verrouillée ici : l'assise des sièges AUTONOMES (chaise,
   * banc, tabouret — #1644) attend son design. Le patron canonique ci-dessous est celui des meubles
   * ENSEMBLES, qui portent l'assise ET le plan de travail dont les contrats géométriques mesurent
   * l'écart ; un siège seul n'a rien au-dessus de son assise. Ce contrat dit donc ce que les
   * ensembles DÉCLARENT, jamais que les autres n'ont pas le droit d'en déclarer — toute recette qui
   * pose des `seatSlots` tombe d'office sous les contrats géométriques `propsAvecPlaces` plus bas.
   */
  it('la table ronde offre quatre places, la table murale deux', () => {
    expect(findPropById('table-ronde-4-tabourets')!.seatSlots).toEqual([
      { id: 'place-nord', anchor: { x: 0, y: -0.48, h: 0.46 }, facing: 'S', approach: { x: 0, y: -1 } },
      { id: 'place-est', anchor: { x: 0.48, y: 0, h: 0.46 }, facing: 'O', approach: { x: 1, y: 0 } },
      { id: 'place-sud', anchor: { x: 0, y: 0.48, h: 0.46 }, facing: 'N', approach: { x: 0, y: 1 } },
      { id: 'place-ouest', anchor: { x: -0.48, y: 0, h: 0.46 }, facing: 'E', approach: { x: -1, y: 0 } },
    ]);
    expect(findPropById('table-murale-2-tabourets')!.seatSlots?.map((s) => s.id)).toEqual(['place-gauche', 'place-droite']);
  });

  /** Ancres FIGÉES de la table murale : la sonde d'implantation de la salle les attend au millimètre. */
  it('la table murale porte ses deux ancres canoniques, caps N et approches en diagonale', () => {
    expect(findPropById('table-murale-2-tabourets')!.seatSlots).toEqual([
      { id: 'place-gauche', anchor: { x: -0.32, y: 0.2, h: 0.46 }, facing: 'N', approach: { x: -1, y: 1 } },
      { id: 'place-droite', anchor: { x: 0.32, y: 0.2, h: 0.46 }, facing: 'N', approach: { x: 1, y: 1 } },
    ]);
  });

  /**
   * ASSISE SERVIE PAR SON MEUBLE — deux mesures sur les `Face[]` réelles, pour TOUT décor du catalogue
   * qui offre une place : le corps porte au SOL (aucun meuble suspendu à un mur qui n'est pas dans sa
   * case) et le plan de travail est à portée de bras de l'ancre du bassin. Sans elles, une recette peut
   * déclarer des places qu'aucun corps assis n'atteint.
   */
  const propsAvecPlaces = props.filter((p) => (p.seatSlots?.length ?? 0) > 0);

  it.each(propsAvecPlaces.map((p) => p.id))('%s : chaque volume porte, au sol ou sur un appui', (id) => {
    const primitives = findPropById(id)!.volume!.primitives.map(emprise);
    // Un volume PORTE s'il touche terre, ou s'il repose sur un volume déjà porté qui monte jusqu'à lui.
    const portes = primitives.map((p) => p.bas <= 1e-6);
    for (let passe = 0; passe < primitives.length; passe++)
      primitives.forEach((p, i) => {
        if (portes[i]) return;
        portes[i] = primitives.some((q, k) => portes[k] && k !== i && q.haut >= p.bas - 1e-6 && q.bas <= p.bas && seChevauchent(p, q));
      });
    const suspendus = primitives.filter((_, i) => !portes[i]).map((p) => `bas à ${p.bas} m`);
    expect(suspendus, `${id} : volumes suspendus dans le vide`).toEqual([]);
  });

  it.each(propsAvecPlaces.map((p) => p.id))('%s : chaque ancre est à portée du plan de travail', (id) => {
    const scene = sceneWith(propEntity({ id: 'e-1', ref: id, pos: { x: 3, y: 4 }, facing: 'N' }));
    const el = buildProps(scene)[0] as { faces: { poly: { x: number; y: number; h: number }[] }[] };
    for (const slot of findPropById(id)!.seatSlots!) {
      const ancre = { x: 3 + slot.anchor.x, y: 4 + slot.anchor.y };
      let ecart = Number.POSITIVE_INFINITY;
      for (const face of el.faces)
        for (let i = 0; i < face.poly.length; i++) {
          const a = face.poly[i], b = face.poly[(i + 1) % face.poly.length];
          if (a.h <= slot.anchor.h || b.h <= slot.anchor.h) continue; // sous l'assise : ce n'est pas le plan de travail
          ecart = Math.min(ecart, distanceAuSegment(ancre, a, b) * METRES_PAR_CASE);
        }
      expect(ecart, `${id}/${slot.id} : écart ancre → bord du plan (m)`).toBeLessThanOrEqual(0.3);
    }
  });

  /**
   * EMPREINTE — le CORPS d'un meuble tient dans l'empreinte DÉCLARÉE de son type (`foot`, défaut 1×1,
   * origine à son CENTRE) ; seuls ses TABOURETS en débordent, d'au plus 0,45 case, et uniquement du
   * côté de l'abord de la place qu'ils portent. La solidité reste celle de l'empreinte : la case qu'un
   * tabouret effleure demeure traversable.
   *
   * Le discriminant est STRUCTUREL, jamais un nom de ref : un tabouret est la primitive dont l'emprise
   * au plan CONTIENT l'ancre d'une place ET qui ne monte pas plus haut que l'assise (l'assise et son
   * fût) — un plateau qui survolerait l'ancre reste du corps, et se mesure comme tel.
   */
  const DEBORD_TABOURET = 0.45;
  /** Demi-empreinte déclarée du type, en cases — la borne du repaire local (1×1 ⇒ 0,5 × 0,5). */
  const demiEmpreinte = (id: string) => {
    const { w, h } = propFootOf(findPropById(id));
    return { x: w / 2, y: h / 2 };
  };
  const tabouretsDe = (id: string) => {
    const prop = findPropById(id)!;
    const demi = demiEmpreinte(id);
    return prop.volume!.primitives.map((p) => {
      const e = emprise(p);
      const slot = (prop.seatSlots ?? []).find((s) => s.anchor.x >= e.x0 - 1e-9 && s.anchor.x <= e.x1 + 1e-9
        && s.anchor.y >= e.y0 - 1e-9 && s.anchor.y <= e.y1 + 1e-9 && e.haut <= s.anchor.h + 1e-9);
      const debord = Math.max(
        Math.max(Math.abs(e.x0), Math.abs(e.x1)) - demi.x,
        Math.max(Math.abs(e.y0), Math.abs(e.y1)) - demi.y,
      );
      return { e, slot, debord };
    });
  };

  it.each(IDS)('%s : son corps tient dans son empreinte', (id) => {
    expect(tabouretsDe(id).filter((v) => !v.slot && v.debord > 1e-9).map((v) => v.e)).toEqual([]);
  });

  it.each(IDS)('%s : ses tabourets débordent d’au plus 0,45 case, vers l’abord de leur place', (id) => {
    for (const { e, slot, debord } of tabouretsDe(id)) {
      if (!slot) continue;
      expect(debord, `${id}/${slot.id} : débord (cases)`).toBeLessThanOrEqual(DEBORD_TABOURET);
      // Le débord suit l'abord : jamais un tabouret jeté du côté opposé à la case d'où l'on s'assoit.
      const demi = demiEmpreinte(id);
      if (e.x1 > demi.x) expect(Math.sign(slot.approach.x), `${id}/${slot.id} débord est`).toBe(1);
      if (e.x0 < -demi.x) expect(Math.sign(slot.approach.x), `${id}/${slot.id} débord ouest`).toBe(-1);
      if (e.y1 > demi.y) expect(Math.sign(slot.approach.y), `${id}/${slot.id} débord sud`).toBe(1);
      if (e.y0 < -demi.y) expect(Math.sign(slot.approach.y), `${id}/${slot.id} débord nord`).toBe(-1);
    }
  });

  /**
   * CAPS MESURÉS. Une empreinte CARRÉE tourne sans trou : la géométrie doit tenir dans ses bornes aux
   * QUATRE caps cardinaux. Une empreinte RECTANGULAIRE n'est mesurée qu'aux caps N/S : à E/O la recette
   * tourne (`rotatePropLocal`) mais l'empreinte NON (`propFootTiles` ignore `facing`) — le corps sort
   * alors en travers de cases restées traversables. Ce TROU est le socle #1509 (« le corps tourné
   * décide des cases »), pas ce lot ; le contrat de POPULATION ci-dessous tient la donnée hors de lui
   * en attendant, et ces deux caps s'ouvriront ensemble le jour du socle.
   */
  const capsDe = (id: string): readonly ('N' | 'E' | 'S' | 'O')[] => {
    const { w, h } = propFootOf(findPropById(id));
    return w === h ? (['N', 'E', 'S', 'O'] as const) : (['N', 'S'] as const);
  };

  it.each(IDS)('%s, cuit à chacun de ses caps, ne descend jamais sous le sol et reste dans son empreinte élargie', (id) => {
    // L'ANCRE monde du décor est le centre de son empreinte (`decorFootGeometry`), pas le coin NO :
    // pour une empreinte >1×1 elle tombe entre les cases, et c'est d'elle que la recette part.
    const { offX, offY } = decorFootGeometry(propFootOf(findPropById(id)));
    const demi = demiEmpreinte(id);
    for (const facing of capsDe(id)) {
      const scene = sceneWith(propEntity({ id: 'e-1', ref: id, pos: { x: 3, y: 4 }, facing }));
      const el = buildProps(scene)[0] as { faces: { poly: { x: number; y: number; h: number }[] }[] };
      for (const face of el.faces)
        for (const p of face.poly) {
          expect(Math.abs(p.x - (3 + offX)), `${id} cap ${facing} x`).toBeLessThanOrEqual(demi.x + DEBORD_TABOURET);
          expect(Math.abs(p.y - (4 + offY)), `${id} cap ${facing} y`).toBeLessThanOrEqual(demi.y + DEBORD_TABOURET);
          expect(p.h, `${id} cap ${facing} h`).toBeGreaterThanOrEqual(0);
        }
    }
  });

  /**
   * POPULATION — verrou par CONSTRUCTION du trou ci-dessus : tant que l'empreinte ne tourne pas avec
   * le cap (#1509), aucune instance authorée d'un décor volumique MULTI-CASE ne prend un cap E/O. Un
   * tel meuble poserait son plateau en travers de cases traversables et bloquerait des cases vides.
   * Ce contrat TOMBE avec le socle #1509 : c'est là qu'il faut le supprimer, pas le contourner.
   */
  it('aucune instance authorée d’un décor volumique MULTI-CASE ne porte un cap E/O (trou d’empreinte non tournée, #1509)', () => {
    expect(IDS_MULTI_CASE.length, 'aucun décor volumique multi-case : ce contrat mesurerait du néant').toBeGreaterThan(0);
    const multi = new Set(IDS_MULTI_CASE);
    const instances = entitesAuthorees().filter((e) => e.ref && multi.has(e.ref));
    expect(instances.length, 'aucune instance authorée trouvée : le scan des scènes ne joint plus rien').toBeGreaterThan(0);
    expect(instances.filter((e) => e.facing === 'E' || e.facing === 'O')
      .map((e) => `${e.source}/${e.id} (${e.ref}, cap ${e.facing})`)).toEqual([]);
  });
});

/**
 * LE DEHORS — un décor volumique est une COQUILLE FERMÉE : chacune de ses faces regarde le dehors de la
 * primitive qui la porte, et ce sens survit à la cuisson du monde. Mesuré dans la convention du RENDU
 * (`gpToWorld` : `(x, y, h) → three (X, Y, Z) = (x, h, y)`, `worldTris.ts:49`), la seule qui décide de
 * la frontalité au GPU et de la carte d'ombre — une normale retournée pousse sa face dans sa propre
 * ombre (`sceneMeshes.ts:449`), ce qui se lit à l'écran comme un TROU dans le meuble.
 *
 * La liste est DÉRIVÉE du catalogue : une recette de plus entre sous contrat par sa seule déclaration.
 */
describe('décor volumique — chaque face regarde le DEHORS, de la recette au monde cuit', () => {
  const centroide = (poly: readonly { x: number; y: number; z: number }[]) =>
    poly.reduce((s, q) => ({ x: s.x + q.x / poly.length, y: s.y + q.y / poly.length, z: s.z + q.z / poly.length }), { x: 0, y: 0, z: 0 });

  it.each(IDS)('%s : chaque face de chaque primitive est FRONT-visible depuis l’extérieur, le long de sa normale', (id) => {
    const prop = findPropById(id)!;
    const ancre = { x: 0, y: 0 };
    const àRebours: string[] = [];
    prop.volume!.primitives.forEach((primitive, ip) => {
      const faces = buildPropVolumes({ ...prop, volume: { primitives: [primitive] } }, { ancre, facing: 'N', baseHeightM: 0 });
      // Le DEDANS de référence est le barycentre des sommets de la primitive : un point strictement
      // intérieur pour une boîte comme pour un coin de prisme, que le sens de parcours n'influence pas.
      const centre = centroide(faces.flatMap((f) => facePoly(f, METRES_PAR_CASE)));
      faces.forEach((face, k) => {
        const poly = facePoly(face, METRES_PAR_CASE);
        const n = polyNormal(poly);
        expect(n, `${id} primitive ${ip} face ${k} : aire nulle`).not.toBeNull();
        const g = centroide(poly);
        if (n!.x * (g.x - centre.x) + n!.y * (g.y - centre.y) + n!.z * (g.z - centre.z) <= 0)
          àRebours.push(`primitive ${ip} (${primitive.kind}) face ${k}`);
      });
    });
    expect(àRebours, `${id} : faces tournées vers le DEDANS`).toEqual([]);
  });

  it.each(IDS)('%s : la cuisson du monde ne RETOURNE aucune de ses faces', (id) => {
    const scene = sceneWith(propEntity({ id: 'e-1', ref: id, pos: { x: 3, y: 4 }, facing: 'N' }));
    const el = buildProps(scene).find((e) => e.kind === 'prop' && estPropVolumique(e)) as { faces: Face[] } | undefined;
    expect(el, `${id} : aucun décor volumique cuit dans la scène`).toBeDefined();
    // Les triangles se comparent par AMAS de position, formés sur la géométrie du pivot, et ce qui est
    // mesuré est le MULTI-ENSEMBLE des normales de chaque amas. Deux faces peuvent coïncider (le dessous
    // d'un couvercle sur le dessus du coffre qui le porte) : seul le multi-ensemble distingue alors un
    // retournement. Le biais coplanaire déplace un triangle cuit de 1,5 mm — il rejoint donc toujours
    // l'amas dont il vient.
    const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    const dir = (n: Vec3) => [n.x, n.y, n.z].map((v) => (Math.abs(v) < 5e-4 ? 0 : v).toFixed(3)).join(',');
    const amas: { g: Vec3; attendu: string[]; cuit: string[] }[] = [];
    for (const face of el!.faces)
      for (const tri of fanTriangles(facePoly(face, METRES_PAR_CASE)) as [Vec3, Vec3, Vec3][]) {
        const g = centroide(tri);
        const a = amas.find((c) => dist(c.g, g) < 0.01) ?? (amas.push({ g, attendu: [], cuit: [] }), amas[amas.length - 1]);
        a.attendu.push(dir(polyNormal(tri)!));
      }
    const { geometry } = bakeWorldGeometry(scene, METRES_PAR_CASE);
    const pos = geometry.getAttribute('position');
    const sommet = (i: number) => ({ x: pos.getX(i), y: pos.getY(i), z: pos.getZ(i) });
    let cuits = 0;
    for (const plage of geometry.userData.propVertexRanges.filter((p) => p.entId === 'e-1'))
      for (let i = plage.vertexStart; i + 2 < plage.vertexStart + plage.vertexCount; i += 3) {
        cuits++;
        const tri: [Vec3, Vec3, Vec3] = [sommet(i), sommet(i + 1), sommet(i + 2)];
        const g = centroide(tri);
        amas.reduce((meilleur, c) => (dist(c.g, g) < dist(meilleur.g, g) ? c : meilleur)).cuit.push(dir(polyNormal(tri)!));
      }
    expect(cuits, `${id} : triangles cuits`).toBe(amas.reduce((s, c) => s + c.attendu.length, 0));
    const écarts = amas
      .filter((c) => [...c.cuit].sort().join(' ') !== [...c.attendu].sort().join(' '))
      .map((c) => `amas (${c.g.x.toFixed(2)}, ${c.g.y.toFixed(2)}, ${c.g.z.toFixed(2)}) : attendu [${[...c.attendu].sort().join(' | ')}], cuit [${[...c.cuit].sort().join(' | ')}]`);
    expect(écarts, `${id} : normales retournées à la cuisson`).toEqual([]);
  });
});
