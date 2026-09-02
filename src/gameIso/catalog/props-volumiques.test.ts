import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { propSvg } from './decor';
import { scenarioEntities } from '../../scenes/opera/furnished';
import { findPropById, props } from '../../data';
import { aretesNonAppariees, CAP_IDENTITE_PROP, propFootOf, REF_DECOR_DEFAUT, type PropPrimitive } from '../../data/props.types';
import { decorFootGeometry } from '../../state/footprint';
import { buildProps } from '../builders/props';
import { buildPropVolumes } from '../builders/propVolumes';
import { estPropVolumique, type Face } from '../builders/types';
import { bakeWorldGeometry, collectBillboards, wholeSceneBillboardEls } from '../backends/webgl/sceneMeshes';
import { facePoly, fanTriangles, polyNormal, type Vec3 } from '../backends/webgl/worldTris';
import { emptyScene, sceneMetresPerTile, type Scene, type SceneEntity } from '../../state/scene';
import { sceneEntitySchema } from '../../data/schemas/defs-scenes/scene';
import { validateScene } from '../../state/validateScene';
import { DIR4_ORDER, type Dir4 } from '../../state/dir8';

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
interface DecorAuthore { source: string; id: string; kind?: string; ref?: string; facing?: string }

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
      { id: 'place-1', anchor: { x: 0, y: 0.48, h: 0.46 }, facing: 'N', approach: { x: 0, y: 1 } },
      { id: 'place-2', anchor: { x: -0.48, y: 0, h: 0.46 }, facing: 'E', approach: { x: -1, y: 0 } },
      { id: 'place-3', anchor: { x: 0, y: -0.48, h: 0.46 }, facing: 'S', approach: { x: 0, y: -1 } },
      { id: 'place-4', anchor: { x: 0.48, y: 0, h: 0.46 }, facing: 'O', approach: { x: 1, y: 0 } },
    ]);
    expect(findPropById('table-murale-2-tabourets')!.seatSlots?.map((s) => s.id)).toEqual(['place-1', 'place-2']);
  });

  /** Ancres FIGÉES de la table murale : la sonde d'implantation de la salle les attend au millimètre. */
  it('la table murale porte ses deux ancres canoniques, caps S et approches en diagonale', () => {
    expect(findPropById('table-murale-2-tabourets')!.seatSlots).toEqual([
      { id: 'place-1', anchor: { x: 0.32, y: -0.2, h: 0.46 }, facing: 'S', approach: { x: 1, y: -1 } },
      { id: 'place-2', anchor: { x: -0.32, y: -0.2, h: 0.46 }, facing: 'S', approach: { x: -1, y: -1 } },
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
    // Au CAP D'IDENTITÉ, et à lui seul, l'ancre AUTHORÉE d'une place et la géométrie monde sont dans
    // le même repère : c'est ce qui rend la comparaison ci-dessous licite sans re-tourner l'ancre.
    const scene = sceneWith(propEntity({ id: 'e-1', ref: id, pos: { x: 3, y: 4 }, facing: CAP_IDENTITE_PROP }));
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
   * CAPS MESURÉS : les QUATRE cardinaux, pour TOUTE recette. Les diagonales n'ont pas à être mesurées —
   * elles sont refusées À LA DONNÉE par le schéma de scène (`src/data/schemas/defs-scenes/scene.ts`,
   * `superRefine` de `sceneEntitySchema` sur `PROPS_VOLUMIQUES`), et le chargement d'un projet en
   * meurt (`parseProject`). Ce que la mesure suit, c'est l'empreinte TOURNÉE : à E/O la
   * recette tourne (`rotatePropLocal`), donc ses bornes échangent leurs axes.
   * L'empreinte SOLIDE, elle, ne tourne pas (`propFootTiles` ignore `facing`) — un meuble
   * multi-case au cap E/O poserait son corps en travers de cases restées traversables. Ce TROU est le
   * socle #1509 (« le corps tourné décide des cases »), pas ce lot ; le contrat de POPULATION ci-dessous
   * tient la donnée hors de lui en attendant.
   */
  /** Demi-empreinte au cap : à E/O la recette a tourné d'un quart de tour, ses bornes aussi. */
  const demiAuCap = (id: string, facing: 'N' | 'E' | 'S' | 'O') => {
    const demi = demiEmpreinte(id);
    return facing === 'E' || facing === 'O' ? { x: demi.y, y: demi.x } : demi;
  };

  it.each(IDS)('%s, cuit à chacun de ses caps, ne descend jamais sous le sol et reste dans son empreinte élargie', (id) => {
    // L'ANCRE monde du décor est le centre de son empreinte (`decorFootGeometry`), pas le coin NO :
    // pour une empreinte >1×1 elle tombe entre les cases, et c'est d'elle que la recette part.
    const { offX, offY } = decorFootGeometry(propFootOf(findPropById(id)));
    for (const facing of DIR4_ORDER) {
      const demi = demiAuCap(id, facing);
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

  /**
   * POPULATION, second volet — le contrat POSITIF du cap CARDINAL (#1680 ligne 3) sur TOUTE la donnée
   * authorée, y compris la seule scène écrite en TS (l'Opéra). Le schéma refuse déjà la diagonale au
   * parse d'un projet ; ce contrat couvre ce que le parse ne voit pas : une scène TS n'est pas un
   * document chargé. Contrairement au contrat ci-dessus, celui-ci NE TOMBE PAS avec #1509 — un décor
   * volumique ne prendra jamais de cap diagonal.
   */
  it('aucune instance authorée d’un décor VOLUMIQUE ne porte un cap DIAGONAL', () => {
    const volumiques = new Set(IDS);
    const instances = entitesAuthorees().filter((e) => e.kind === 'prop' && volumiques.has(e.ref ?? REF_DECOR_DEFAUT));
    expect(instances.length, 'aucune instance de décor volumique authorée : le scan ne joint plus rien').toBeGreaterThan(0);
    expect(instances.filter((e) => e.facing && !DIR4_ORDER.includes(e.facing as Dir4))
      .map((e) => `${e.source}/${e.id} (${e.ref ?? REF_DECOR_DEFAUT}, cap ${e.facing})`)).toEqual([]);
  });
});

/**
 * CAP CARDINAL — LA CHAÎNE ENTIÈRE, sur une seule donnée fautive (#1680 ligne 3). Un décor dont le
 * TYPE porte une recette ne prend qu'un cap cardinal : sa recette tourne (`rotatePropLocal`) là où son
 * empreinte solide ne tourne pas (#1509). Quatre verrous, du plus AMONT au dernier filet, et ce test
 * les tient ENSEMBLE — la règle est celle du CATALOGUE (`refEstVolumique`), donc un BILLBOARD au même
 * cap reste licite à chaque étage :
 *   1. SCHÉMA (bloquant) : `sceneEntitySchema` refuse au parse, `parseProject` lève ;
 *   2. VALIDATEUR (signalant) : `validateScene` nomme l'entité à l'éditeur — il n'interdit rien, il
 *      montre (le panneau d'avertissements d'`Editor.tsx` est son seul consommateur) ;
 *   3. ÉDITEUR : le sélecteur d'orientation n'offre pas la diagonale (`Inspector.tsx`, testé chez lui) ;
 *   4. ÉMETTEUR : `buildProps` lève, invariant interne — si une donnée fautive arrivait quand même,
 *      le monde ne se cuit pas en silence.
 */
describe('décor volumique — le cap DIAGONAL est refusé de bout en bout', () => {
  const entiteBrute = (ref: string, facing: string) =>
    ({ id: 'e-1', kind: 'prop', pos: { x: 2, y: 2 }, ref, facing });

  it('1. SCHÉMA : le parse refuse un décor volumique en diagonale, et l’accepte au cardinal', () => {
    expect(sceneEntitySchema.safeParse(entiteBrute('table-ronde-4-tabourets', 'NE')).success).toBe(false);
    expect(sceneEntitySchema.safeParse(entiteBrute('table-ronde-4-tabourets', 'E')).success).toBe(true);
    // Le message NOMME la recette et le cap — un refus muet n'apprendrait rien à l'auteur.
    const echec = sceneEntitySchema.safeParse(entiteBrute('table-ronde-4-tabourets', 'NE'));
    expect(echec.success ? [] : echec.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)).toEqual([
      "facing: décor volumique « table-ronde-4-tabourets » au cap NE — un décor volumique ne prend qu'un cap cardinal (N/E/S/O)",
    ]);
    // Un BILLBOARD au même cap passe : la règle vient du catalogue, pas du `kind`.
    expect(sceneEntitySchema.safeParse(entiteBrute('brasero', 'NE')).success).toBe(true);
  });

  it('2. VALIDATEUR : `validateScene` signale l’entité, sans rien interdire', () => {
    const scene = sceneWith(propEntity({ id: 'e-1', ref: 'table-ronde-4-tabourets', pos: { x: 2, y: 2 }, facing: 'N' }));
    const diagonale = { ...scene, entities: [{ ...scene.entities[0], facing: 'NE' as const }] };
    expect(validateScene([diagonale]).filter((w) => w.level === 'error').map((w) => w.message)).toEqual([
      "e-1 : décor volumique « table-ronde-4-tabourets » au cap NE — un décor volumique ne prend qu'un cap cardinal (N/E/S/O)",
    ]);
    expect(validateScene([scene])).toEqual([]);
  });

  it('4. ÉMETTEUR : `buildProps` lève sur un volumique en diagonale, et cuit un billboard au même cap', () => {
    const scene = sceneWith(propEntity({ id: 'e-1', ref: 'table-ronde-4-tabourets', pos: { x: 2, y: 2 }, facing: 'N' }));
    const diagonale = { ...scene, entities: [{ ...scene.entities[0], facing: 'NE' as const }] };
    expect(() => buildProps(diagonale)).toThrow(
      "décor volumique « table-ronde-4-tabourets » (e-1) : cap NE — un décor volumique ne prend qu'un cap cardinal (N/E/S/O)",
    );
    const billboard = sceneWith({ ...propEntity({ id: 'e-2', ref: 'brasero', pos: { x: 2, y: 2 }, facing: 'N' }), facing: 'NE' } as SceneEntity);
    expect(() => buildProps(billboard)).not.toThrow();
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
      const faces = buildPropVolumes({ ...prop, volume: { ...prop.volume!, primitives: [primitive] } }, { ancre, facing: 'N', baseHeightM: 0 });
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

  /**
   * FERMETURE sur les FACES MONDE — indépendant de l'instrument « barycentre » du contrat ci-dessus :
   * une coquille close porte chaque arête par exactement DEUX faces, parcourues en sens OPPOSÉS. C'est
   * le même prédicat que le validateur de catalogue applique à la géométrie LOCALE
   * (`validatePropCatalog` → `aretesNonAppariees`) ; ici il tombe sur ce que le builder a réellement
   * produit, cap et ancre compris — la transformation rigide doit préserver la fermeture.
   */
  it.each(IDS)('%s : chaque primitive sort du builder en COQUILLE CLOSE (arêtes appariées à contre-sens)', (id) => {
    const prop = findPropById(id)!;
    const défauts: string[] = [];
    prop.volume!.primitives.forEach((primitive, ip) => {
      const faces = buildPropVolumes({ ...prop, volume: { ...prop.volume!, primitives: [primitive] } }, { ancre: { x: 3, y: 4 }, facing: 'E', baseHeightM: 1.5 });
      for (const { arete, sens, contreSens } of aretesNonAppariees(faces.map((f) => f.poly)))
        défauts.push(`primitive ${ip} (${primitive.kind}, ${primitive.material}) : arête ${arete} — ${sens} dans le sens, ${contreSens} à contre-sens`);
    });
    expect(défauts, `${id} : arêtes non appariées`).toEqual([]);
  });

  /**
   * ARÊTE DE COUTEAU du modelé de forme : `shadeFamily` (`backends/webgl/sceneMeshes.ts`) départage une
   * normale par le plus grand de |nx| et |nz|, et une égalité exacte est indécidable — un fût y prend
   * des tons de familles voisines sur des faces symétriques. C'est ce qui exclut `sides: 12` du type
   * (`PropCylinderSides`) ; ce contrat le mesure sur la géométrie, jamais sur la valeur authorée.
   */
  it.each(IDS)('%s : aucune face latérale de cylindre ne tombe sur |nx| == |nz|', (id) => {
    const prop = findPropById(id)!;
    const surLArete: string[] = [];
    prop.volume!.primitives.forEach((primitive, ip) => {
      if (primitive.kind !== 'cylinder') return;
      const faces = buildPropVolumes({ ...prop, volume: { ...prop.volume!, primitives: [primitive] } }, { ancre: { x: 0, y: 0 }, facing: 'N', baseHeightM: 0 });
      faces.forEach((face, k) => {
        const n = polyNormal(facePoly(face, METRES_PAR_CASE))!;
        if (Math.abs(n.y) > 1e-6) return; // dessus / dessous : pas une face latérale
        if (Math.abs(Math.abs(n.x) - Math.abs(n.z)) < 1e-6)
          surLArete.push(`primitive ${ip} (${primitive.sides} côtés) face ${k} : nx=${n.x.toFixed(4)} nz=${n.z.toFixed(4)}`);
      });
    });
    expect(surLArete, `${id} : faces latérales sur l’arête de couteau`).toEqual([]);
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
