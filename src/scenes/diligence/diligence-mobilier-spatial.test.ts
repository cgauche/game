import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { diligenceCampaign } from '../campaign';
import { doorAt, heightAt, isWalkable, wallBetween, type Scene, type SceneEntity } from '../../state/scene';
import { walkNeighbors, type Pt } from '../../state/path';
import { sceneZoneTiles } from '../../state/zones';
import { seatSlotsOf, seatIsOccupiable, type ResolvedSeatSlot } from '../../state/seating';
import { findPropById } from '../../data';
import { buildPropVolumes } from '../../gameIso/builders/propVolumes';

/**
 * IMPLANTATION DE LA SALLE PRINCIPALE — preuve SPATIALE des dix-huit poses de `zone-S-z0`, telles
 * que la carte de la salle les arrête (#1443).
 *
 * Ce fichier tient deux promesses distinctes :
 *  1. l'implantation n'a RIEN touché de l'architecture — digests témoins figés, calculés au commit
 *     83d02a10, celui qui précède la première pose, et jamais régénérés depuis ;
 *  2. la salle meublée reste JOUABLE : 86 tuiles libres d'une seule composante, seize places dont
 *     l'abord effectif est marchable et exclusif, comptoir d'un seul tenant (tous ses joints mesurés
 *     à zéro, façade de service alignée), espace du tenancier tenu ouvert sur la salle ET sur la
 *     cuisine, coutures obligatoires (portes, fenêtres, rampe) intactes.
 */
const scene: Scene = diligenceCampaign.scenes[0];

/** Les dix-huit poses : id, ref, case, cap — dans leur ordre d'inscription au document.
 *
 *  CAP DES PIÈCES DE COMPTOIR (contrat de `data/props.types.ts` : recette FACE AU NORD, cap `N` =
 *  identité, un cran = 45° horaires) : le cap NOMME la face de service, celle que la recette dessine
 *  au nord (barre de pied et panneaux en y négatif). Le module d'ANGLE joint une branche à sa face de
 *  service et une branche à sa gauche : cap `E` raccorde le retour haut (ouest) à la barre (sud) ;
 *  cap `S` raccorde la barre (nord) au pied bas (est). */
const POSES = [
  ['diligence-salle-table-ronde-1', 'table-ronde-4-tabourets', 11, 8, 'S'],
  ['diligence-salle-comptoir-1', 'comptoir-droit', 10, 9, 'N'],
  ['diligence-salle-comptoir-2', 'comptoir-angle', 11, 9, 'E'],
  ['diligence-salle-comptoir-3', 'comptoir-droit', 11, 10, 'E'],
  ['diligence-salle-comptoir-4', 'comptoir-droit', 11, 11, 'E'],
  ['diligence-salle-comptoir-5', 'comptoir-droit', 11, 12, 'E'],
  ['diligence-salle-comptoir-6', 'comptoir-droit', 11, 13, 'E'],
  ['diligence-salle-comptoir-7', 'comptoir-droit', 11, 14, 'E'],
  ['diligence-salle-comptoir-8', 'comptoir-droit', 11, 15, 'E'],
  ['diligence-salle-comptoir-9', 'comptoir-angle', 11, 16, 'S'],
  ['diligence-salle-comptoir-10', 'comptoir-droit', 12, 16, 'S'],
  ['diligence-salle-cheminee', 'cheminee-interieure', 10, 18, 'E'],
  ['diligence-salle-table-murale-1', 'table-murale-2-tabourets', 14, 11, 'E'],
  ['diligence-salle-table-murale-2', 'table-murale-2-tabourets', 14, 16, 'E'],
  ['diligence-salle-table-ronde-2', 'table-ronde-4-tabourets', 12, 18, 'S'],
  ['diligence-salle-table-ronde-3', 'table-ronde-4-tabourets', 10, 21, 'S'],
  ['diligence-salle-meuble-1', 'armoire', 14, 20, 'O'],
  ['diligence-salle-meuble-2', 'armoire', 9, 19, 'E'],
] as const;

/** Empreinte figée de l'ARCHITECTURE au commit qui précède la pose (83d02a10). Une implantation qui
 *  déplace un mur, une ouverture, un terrain ou une zone fait bouger l'un de ces témoins. */
const TOPOLOGY_BEFORE = {
  walls: 668,
  edgeDigest: 'a8573f5ba372806b',
  layersDigest: 'bec00d303b88f5cc',
  effectZones: 39,
  effectZonesDigest: '007e9059756e689d',
  architectureDigest: 'f55715704e6a6e5f',
};

/** Espace de service du tenancier : la ruelle derrière le comptoir, tenue LIBRE. */
const RUELLE = [10, 11, 12, 13, 14, 15].map((y) => ({ x: 10, y }));

const digest = (valeurs: readonly string[]) =>
  createHash('sha256').update([...valeurs].sort().join('|')).digest('hex').slice(0, 16);

/** Digest des arêtes sur le tuple `x,y,z,side,door,window,structure`. */
const edgeDigest = (murs: NonNullable<Scene['walls']>) =>
  digest(murs.map((m) => `${m.x},${m.y},${m.z ?? 0},${m.side},${m.door ? 1 : 0},${m.window ? 1 : 0},${m.structure ?? ''}`));

const layersDigest = (couches: Scene['layers']) =>
  digest(couches.map((c) => `${c.z}:${digest([JSON.stringify(c)])}`));

const zonesDigest = (zones: NonNullable<Scene['effectZones']>) =>
  digest(zones.map((z) => `${z.id}:${z.z ?? 0}:${JSON.stringify(z.area)}:${sceneZoneTiles(z).map((p) => `${p.x},${p.y},${p.z ?? z.z ?? 0}`).sort().join(';')}`));

/** Les ancres de mobilier du document : `[id, ref, x, y, facing]`, dans l'ordre des entités. */
const implantation = (on: Scene) =>
  on.entities.filter((e) => e.kind === 'prop').map((e) => [e.id, e.ref ?? '', e.pos.x, e.pos.y, e.facing]);

const meubles = () => scene.entities.filter((e) => e.kind === 'prop');

const meubleAt = (x: number, y: number): SceneEntity =>
  scene.entities.find((e) => e.kind === 'prop' && e.pos.x === x && e.pos.y === y && (e.z ?? 0) === 0)!;

interface Boite { x0: number; x1: number; y0: number; y1: number; h0: number; h1: number }

/** AABB monde du meuble, dérivée de ses FACES réelles (`buildPropVolumes`) — pas d'une relecture
 *  parallèle de la recette : ce que le test mesure est ce que le monde cuit. Un décor SANS recette
 *  volumique (billboard) n'a pas de corps monde : `null`. */
function propBounds(ent: SceneEntity): Boite | null {
  const prop = findPropById(ent.ref ?? '')!;
  const faces = buildPropVolumes(ent, prop, heightAt(scene, ent.pos.x, ent.pos.y, ent.z ?? 0));
  const pts = faces.flatMap((f) => f.poly);
  if (!pts.length) return null;
  return {
    x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)),
    y0: Math.min(...pts.map((p) => p.y)), y1: Math.max(...pts.map((p) => p.y)),
    h0: Math.min(...pts.map((p) => p.h)), h1: Math.max(...pts.map((p) => p.h)),
  };
}

const corpsMonde = (id: string): Boite => propBounds(scene.entities.find((e) => e.id === id)!)!;

/**
 * Décalage du FER d'un module de comptoir par rapport à son ancre, en cases. Les recettes de comptoir
 * ne portent de `fer-noirci` que du côté du SERVICE : barre de pied et ses deux montants pour le
 * module droit, montant du coin extérieur pour le module d'angle. Ce décalage NOMME donc la face de
 * service telle que le monde la cuit — c'est ce que le cap de l'entité décide, et ce qu'un cap faux
 * retourne vers la ruelle du tenancier.
 */
function ferDuComptoir(id: string): { x: number; y: number } {
  const ent = scene.entities.find((e) => e.id === id)!;
  const faces = buildPropVolumes(ent, findPropById(ent.ref ?? '')!, heightAt(scene, ent.pos.x, ent.pos.y, ent.z ?? 0))
    .filter((f) => f.material.id === 'fer-noirci');
  const pts = faces.flatMap((f) => f.poly);
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length - ent.pos.x,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length - ent.pos.y,
  };
}

/** Recouvrement STRICT : deux volumes qui se touchent joint à joint ne s'intersectent pas. */
const intersects = (a: Boite, b: Boite, eps = 1e-9) =>
  a.x0 < b.x1 - eps && b.x0 < a.x1 - eps && a.y0 < b.y1 - eps && b.y0 < a.y1 - eps && a.h0 < b.h1 - eps && b.h0 < a.h1 - eps;

/** Boîte au sol d'une case : le monde des décors centre la case sur ses coordonnées entières. */
const caseBox = (x: number, y: number): Boite =>
  ({ x0: x - 0.5, x1: x + 0.5, y0: y - 0.5, y1: y + 0.5, h0: -Infinity, h1: Infinity });

const contenu = (petit: Boite, grand: Boite, eps = 1e-9) =>
  petit.x0 >= grand.x0 - eps && petit.x1 <= grand.x1 + eps && petit.y0 >= grand.y0 - eps && petit.y1 <= grand.y1 + eps;

const zoneSalle = scene.effectZones!.find((z) => z.id === 'zone-S-z0')!;
const tuilesSalle = sceneZoneTiles(zoneSalle);
const dansSalle = new Set(tuilesSalle.map((t) => `${t.x},${t.y}`));

/** La CASE que tient un corps assis — sa position LOGIQUE au sens de `state/seating.ts` (l'ancre
 *  fractionnaire n'est que du rendu). */
const caseDuCorps = (slot: ResolvedSeatSlot) => `${Math.round(slot.anchor.x)},${Math.round(slot.anchor.y)}`;

/** La case du SIÈGE d'une place — l'origine dont son abord doit être voisin. */
const caseDuSiege = (slot: ResolvedSeatSlot) => ({ x: Math.round(slot.anchor.x), y: Math.round(slot.anchor.y) });

/**
 * Une CLOISON sépare-t-elle ces deux cases ? Lu ici directement au document (`wallBetween`,
 * `state/scene`), sans passer par `seating.ts` : c'est le fait de la SCÈNE que ce test vérifie, pas
 * la parole du module. En diagonale, les deux chemins en L doivent être libres de mur.
 */
function cloisonEntre(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 || dy === 0) return wallBetween(scene, a.x, a.y, b.x, b.y, 0);
  return wallBetween(scene, a.x, a.y, a.x + dx, a.y, 0) || wallBetween(scene, a.x + dx, a.y, b.x, b.y, 0)
    || wallBetween(scene, a.x, a.y, a.x, a.y + dy, 0) || wallBetween(scene, a.x, a.y + dy, b.x, b.y, 0);
}

const cle = (p: Pt) => `${p.x},${p.y},${p.z ?? 0}`;

/** Composante du PAS (`walkNeighbors`, SOURCE UNIQUE : anti coupe-de-coin comprise) atteinte depuis
 *  une case, à tous les étages. */
function composante(depart: Pt): Set<string> {
  const vus = new Set([cle(depart)]);
  const file: Pt[] = [depart];
  while (file.length) {
    const p = file.shift()!;
    for (const n of walkNeighbors(scene, p)) if (!vus.has(cle(n))) { vus.add(cle(n)); file.push(n); }
  }
  return vus;
}

/** Toutes les places de la salle, meuble par meuble, dans l'ordre du document. */
const placesDeLaSalle = (): ResolvedSeatSlot[] => meubles().flatMap((e) => seatSlotsOf(scene, e.id));

/** Les deux cases que dessert une PORTE — un abord posé là condamne le passage. */
const PORTES = [[14, 8, 'E'], [14, 9, 'E'], [9, 11, 'E'], [8, 20, 'E']] as const;
const SEUILS = new Set(PORTES.flatMap(([x, y]) => [`${x},${y}`, `${x + 1},${y}`]));
const RAMPE = [[14, 23], [14, 24], [14, 25], [13, 25]] as const;

describe('La Diligence — implantation de la salle principale', () => {
  it('pose les dix-huit meubles de la carte sans toucher la topologie', () => {
    expect(implantation(scene)).toEqual(POSES.map(([id, ref, x, y, facing]) => [id, ref, x, y, facing]));
    expect(scene.walls).toHaveLength(TOPOLOGY_BEFORE.walls);
    expect(edgeDigest(scene.walls!)).toBe(TOPOLOGY_BEFORE.edgeDigest);
    expect(layersDigest(scene.layers)).toBe(TOPOLOGY_BEFORE.layersDigest);
    expect(scene.effectZones).toHaveLength(TOPOLOGY_BEFORE.effectZones);
    expect(zonesDigest(scene.effectZones!)).toBe(TOPOLOGY_BEFORE.effectZonesDigest);
    expect(digest((scene.architecture ?? []).map((a) => JSON.stringify(a)))).toBe(TOPOLOGY_BEFORE.architectureDigest);
  });

  it('chaque meuble repose au niveau du sol de la salle, et dans la salle', () => {
    expect(meubles().map((e) => e.z ?? 0)).toEqual(new Array(POSES.length).fill(0));
    expect(meubles().map((e) => heightAt(scene, e.pos.x, e.pos.y, 0))).toEqual(new Array(POSES.length).fill(0));
    expect(meubles().filter((e) => !dansSalle.has(`${e.pos.x},${e.pos.y}`)).map((e) => e.id)).toEqual([]);
  });

  it('la salle meublée garde 86 tuiles libres sur 104, en une seule composante', () => {
    expect(tuilesSalle).toHaveLength(104);
    const libres = tuilesSalle.filter((t) => isWalkable(scene, t.x, t.y, 0));
    expect(libres).toHaveLength(86);
    const vues = new Set([cle(libres[0])]);
    const file: Pt[] = [libres[0]];
    while (file.length) {
      const p = file.shift()!;
      for (const n of walkNeighbors(scene, p)) {
        if ((n.z ?? 0) !== 0 || !dansSalle.has(`${n.x},${n.y}`) || vues.has(cle(n))) continue;
        vues.add(cle(n));
        file.push(n);
      }
    }
    expect(libres.filter((t) => !vues.has(cle(t))).map((t) => `${t.x},${t.y}`)).toEqual([]);
  });

  /**
   * L'ESPACE DU TENANCIER est un couloir de service, pas un cul-de-sac : la ruelle derrière le
   * comptoir reste libre, s'ouvre sur la salle par (10,16)-(10,17) — les cases laissées entre le
   * module d'angle du bas et l'âtre — et sur la CUISINE par la porte (9,11). Sans cette bouche, la
   * ruelle et l'aile de cuisine entière (67 tuiles) ne se rejoignent plus depuis la salle.
   */
  it('la ruelle du tenancier est libre, ouverte sur la salle et sur la cuisine', () => {
    expect(RUELLE.filter((p) => !isWalkable(scene, p.x, p.y, 0))).toEqual([]);
    expect(doorAt(scene, 9, 11, 'E', 0)).toBeTruthy();
    const depuisLaSalle = composante({ x: 12, y: 20 });
    expect(RUELLE.filter((p) => !depuisLaSalle.has(`${p.x},${p.y},0`))).toEqual([]);
    expect(depuisLaSalle.has('10,16,0')).toBe(true);
    expect(depuisLaSalle.has('10,17,0')).toBe(true);
    // La cuisine (derrière la porte (9,11)) est dans la MÊME composante que la salle.
    expect(depuisLaSalle.has('9,11,0')).toBe(true);
    expect(depuisLaSalle.has('5,7,0')).toBe(true);
  });

  it('les coutures obligatoires de la salle restent libres', () => {
    for (const [x, y, side] of PORTES) expect(doorAt(scene, x, y, side, 0)).toBeTruthy();
    for (const [x, y] of [[14, 12], [14, 16], [14, 20], [14, 24]] as const)
      expect(scene.walls!.find((m) => m.x === x && m.y === y && m.side === 'E' && (m.z ?? 0) === 0)?.window).toBe(true);
    for (const [x, y] of [[11, 7], [10, 26], [13, 26]] as const)
      expect(scene.walls!.find((m) => m.x === x && m.y === y && m.side === 'N' && (m.z ?? 0) === 0)?.window).toBe(true);
    expect(RAMPE.map(([x, y]) => heightAt(scene, x, y, 0))).toEqual([1, 2, 3, 4]);
    expect(RAMPE.every(([x, y]) => isWalkable(scene, x, y, 0))).toBe(true);
    expect(meubles().filter((e) => RAMPE.some(([rx, ry]) => rx === e.pos.x && ry === e.pos.y)).map((e) => e.id)).toEqual([]);
    // Aucune case de SEUIL n'est meublée : une porte s'ouvre sur du sol.
    expect(meubles().filter((e) => SEUILS.has(`${e.pos.x},${e.pos.y}`)).map((e) => e.id)).toEqual([]);
  });

  it('chaque volume tient dans sa propre case, n’en recoupe aucun autre et laisse le plan des ouvertures libre', () => {
    const corps = meubles().map((e) => ({ id: e.id, pos: e.pos, boite: propBounds(e) }))
      .filter((c): c is { id: string; pos: { x: number; y: number }; boite: Boite } => c.boite !== null);
    expect(corps.filter((c) => !contenu(c.boite, caseBox(c.pos.x, c.pos.y))).map((c) => c.id)).toEqual([]);
    const collisions: string[] = [];
    for (let i = 0; i < corps.length; i++)
      for (let j = i + 1; j < corps.length; j++)
        if (intersects(corps[i].boite, corps[j].boite)) collisions.push(`${corps[i].id} × ${corps[j].id}`);
    expect(collisions).toEqual([]);
    // Le mur EST porte quatre fenêtres : aucun corps ne vient toucher leur plan (x = 14,5).
    expect(corps.filter((c) => c.pos.x === 14 && c.boite.x1 >= 14.5 - 1e-9).map((c) => c.id)).toEqual([]);
  });

  /**
   * COMPTOIR D'UN SEUL TENANT — les dix modules forment UNE chaîne continue, du retour haut au pied
   * bas : chaque maillon touche le suivant (jour NUL sur l'axe de contact) et sa FAÇADE DE SERVICE
   * est alignée sur celle de son voisin. Un cap d'angle faux, ou un module posé au-delà du dernier
   * maillon, rouvre un jour — la revue du 2026-08-23 en a mesuré un de 0,300 case (0,60 m) au retour
   * haut, une dalle flottante de 11 px en vue du dessus, quand un onzième module occupait (12,9).
   */
  it('les dix modules du comptoir forment une chaîne continue, sans jour ni façade décalée', () => {
    const CHAINE = ['diligence-salle-comptoir-1', 'diligence-salle-comptoir-2', 'diligence-salle-comptoir-3',
      'diligence-salle-comptoir-4', 'diligence-salle-comptoir-5', 'diligence-salle-comptoir-6',
      'diligence-salle-comptoir-7', 'diligence-salle-comptoir-8', 'diligence-salle-comptoir-9',
      'diligence-salle-comptoir-10'];
    // Aucun autre module de comptoir dans la salle : la chaîne EST tout le comptoir.
    expect(meubles().filter((e) => (e.ref ?? '').startsWith('comptoir')).map((e) => e.id)).toEqual(CHAINE);
    // JOUR entre deux maillons : l'écart des AABB sur chaque axe. Négatif = ils se recouvrent (les
    // angles empiètent sur la bande de leur voisin), zéro = ils se touchent, positif = fente.
    const jour = (a: string, b: string) => {
      const A = corpsMonde(a), B = corpsMonde(b);
      return Math.max(Math.max(A.x0 - B.x1, B.x0 - A.x1), Math.max(A.y0 - B.y1, B.y0 - A.y1));
    };
    const fentes = CHAINE.slice(1).map((id, i) => ({ joint: `${CHAINE[i]} ↔ ${id}`, jour: jour(CHAINE[i], id) })).filter((j) => j.jour > 1e-9);
    expect(fentes).toEqual([]);
    // FAÇADE DE SERVICE du retour haut : le nez EST de l'angle et celui de la barre sont au même x —
    // c'est le joint que la revue a trouvé ouvert, il se mesure désormais.
    expect(corpsMonde('diligence-salle-comptoir-2').x1).toBeCloseTo(corpsMonde('diligence-salle-comptoir-3').x1, 9);
    // …et les deux modules d'un joint présentent leur FER — donc leur face de service — du MÊME côté
    // de la ligne de joint : c'est le cap de chaque angle qui se mesure ici.
    const memeCote = (a: string, b: string, axe: 'x' | 'y') => Math.sign(ferDuComptoir(a)[axe]) === Math.sign(ferDuComptoir(b)[axe]);
    expect(memeCote('diligence-salle-comptoir-1', 'diligence-salle-comptoir-2', 'y'), 'retour haut ↔ angle haut').toBe(true);
    expect(memeCote('diligence-salle-comptoir-2', 'diligence-salle-comptoir-3', 'x'), 'angle haut ↔ barre').toBe(true);
    expect(memeCote('diligence-salle-comptoir-8', 'diligence-salle-comptoir-9', 'x'), 'barre ↔ angle bas').toBe(true);
    expect(memeCote('diligence-salle-comptoir-9', 'diligence-salle-comptoir-10', 'y'), 'angle bas ↔ pied bas').toBe(true);
    // La face de service de la BARRE regarde la salle (est), jamais la ruelle du tenancier (ouest).
    for (const n of [3, 4, 5, 6, 7, 8]) expect(ferDuComptoir(`diligence-salle-comptoir-${n}`).x, `comptoir-${n}`).toBeGreaterThan(0);
    // Les six modules droits de la barre sont alignés sur la même bande de x, au millimètre…
    const barre = [3, 4, 5, 6, 7, 8].map((n) => corpsMonde(`diligence-salle-comptoir-${n}`));
    expect(new Set(barre.map((b) => `${b.x0.toFixed(6)},${b.x1.toFixed(6)}`)).size).toBe(1);
    // …et se touchent bout à bout, du nord au sud.
    for (let i = 1; i < barre.length; i++) expect(Math.abs(barre[i].y0 - barre[i - 1].y1)).toBeLessThan(1e-9);
  });

  it('les seize places sont occupables : abord marchable, exclusif, hors seuil et hors rampe', () => {
    const places = placesDeLaSalle();
    expect(places).toHaveLength(16);
    expect(places.filter((s) => !seatIsOccupiable(scene, s)).map((s) => `${s.propId}/${s.slotId}`)).toEqual([]);
    const abords = places.map((s) => `${s.approach.x},${s.approach.y}`);
    expect(new Set(abords).size).toBe(16);
    const cases = new Set(meubles().map((e) => `${e.pos.x},${e.pos.y}`));
    expect(abords.filter((a) => cases.has(a))).toEqual([]);
    expect(abords.filter((a) => SEUILS.has(a))).toEqual([]);
    const rampe = new Set(RAMPE.map(([x, y]) => `${x},${y}`));
    expect(abords.filter((a) => rampe.has(a))).toEqual([]);
    expect(places.filter((s) => !dansSalle.has(caseDuCorps(s))).map((s) => `${s.propId}/${s.slotId}`)).toEqual([]);
  });

  /**
   * SONDE promue (Task 4bis, 2026-08-23) : un abord marchable ne suffit pas, il doit être VOISIN du
   * siège et qu'aucune CLOISON ne l'en sépare. `table-ronde-3/ouest` résolvait son abord en (9,10),
   * marchable mais derrière le mur bâti (9,10,E) — dans la CUISINE : la place était tenue pour
   * occupable et personne ne pouvait s'y asseoir.
   */
  it('les seize abords sont voisins de leur siège, sans cloison entre eux, et tous dans la salle', () => {
    const places = placesDeLaSalle();
    const lointains = places.filter((s) => {
      const siege = caseDuSiege(s);
      return Math.max(Math.abs(s.approach.x - siege.x), Math.abs(s.approach.y - siege.y)) !== 1;
    });
    expect(lointains.map((s) => `${s.propId}/${s.slotId}`)).toEqual([]);
    expect(places.filter((s) => cloisonEntre(caseDuSiege(s), s.approach)).map((s) => `${s.propId}/${s.slotId}`)).toEqual([]);
    expect(places.filter((s) => !dansSalle.has(`${s.approach.x},${s.approach.y}`)).map((s) => `${s.propId}/${s.slotId}`)).toEqual([]);
  });

  /**
   * SONDE promue (revue de la Task 4bis) : l'absence de CLOISON entre un siège et son abord ne dit
   * pas que le GROUPE peut y venir. Ce contrat-là se mesure par la connectivité RÉELLE du pas
   * (`walkNeighbors`, SOURCE UNIQUE) : les seize abords appartiennent à la composante jouable, celle
   * qui porte aussi la cour d'arrivée.
   */
  it('les seize abords sont dans la composante jouable — 972 tuiles au rez, 422 à l’étage', () => {
    const depart = tuilesSalle.find((t) => isWalkable(scene, t.x, t.y, 0))!;
    const vus = composante({ x: depart.x, y: depart.y });
    const parEtage = [...vus].reduce<Record<string, number>>((acc, k) => ({ ...acc, [k.split(',')[2]]: (acc[k.split(',')[2]] ?? 0) + 1 }), {});
    expect(parEtage).toEqual({ 0: 972, 1: 422 });
    expect(placesDeLaSalle().filter((s) => !vus.has(`${s.approach.x},${s.approach.y},0`)).map((s) => `${s.propId}/${s.slotId}`)).toEqual([]);
    // La cour d'arrivée est HORS de la salle et dans la MÊME composante : ce qui joint les places
    // joint le dehors — le groupe entre à pied et va s'asseoir.
    expect(dansSalle.has('17,2')).toBe(false);
    expect(vus.has('17,2,0')).toBe(true);
  });

  it('la table ronde coincée entre le mur nord et le comptoir assoit quand même quatre convives', () => {
    const table = meubleAt(11, 8);
    expect(table.id).toBe('diligence-salle-table-ronde-1');
    expect(isWalkable(scene, 11, 9, 0), 'le comptoir DOIT fermer le sud de la table pour que le test morde').toBe(false);
    const places = seatSlotsOf(scene, table.id);
    expect(places.every((s) => seatIsOccupiable(scene, s))).toBe(true);
    expect(places.map((s) => `${s.slotId}:${s.approach.x},${s.approach.y}`))
      .toEqual(['nord:12,7', 'est:10,8', 'sud:11,7', 'ouest:12,8']);
  });

  it('les deux tables murales assoient leurs convives DU CÔTÉ SALLE, jamais dans le mur est', () => {
    for (const [x, y] of [[14, 11], [14, 16]] as const) {
      const table = meubleAt(x, y);
      expect(table.ref).toBe('table-murale-2-tabourets');
      expect(wallBetween(scene, x, y, x + 1, y, 0), 'le mur est DOIT longer la table pour que le test morde').toBe(true);
      const places = seatSlotsOf(scene, table.id);
      expect(places).toHaveLength(2);
      expect(places.every((s) => seatIsOccupiable(scene, s))).toBe(true);
      expect(places.map((s) => `${s.slotId}:${s.approach.x},${s.approach.y}`))
        .toEqual([`gauche:13,${y - 1}`, `droite:13,${y + 1}`]);
    }
  });
});
