/**
 * ASSISE — source UNIQUE de la résolution et de la mutation des places assises d'une Scène.
 *
 * Le catalogue de décor (`props.json`) déclare les places d'un TYPE de meuble dans son repère local
 * (`PropSeatSlot`) ; une Scène déclare QUI les occupe (`Scene.seatAssignments`). Ce module fait le
 * pont, et lui seul : la persistance, l'interaction, le rig, l'éditeur et `MapSpec` le CONSOMMENT.
 * PUR — aucune écriture de store, aucun rendu, aucune caméra, aucune dépendance `gameIso`.
 *
 * FORME PERSISTÉE : `propId → slotId → occupant`. Deux niveaux imbriqués (et non une clé composée)
 * pour que « les places de CE meuble » et « ce meuble n'a plus personne » soient des lectures et des
 * suppressions directes.
 *
 * EXCLUSIVITÉ double : un occupant tient au plus UNE place, une place porte au plus UN occupant.
 *
 * APPROCHE — la case d'abord déclarée par le catalogue est un chemin PRÉFÉRÉ, pas une condition
 * d'occupation : une chaise poussée contre un mur ou un comptoir reste une chaise où l'on s'assoit.
 * `seatSlotsOf` rend donc l'approche EFFECTIVE (deux passes décrites à la fonction) : la case
 * déclarée si la scène la dit marchable, sinon un repli voisin du siège, jamais partagé avec l'abord
 * d'une AUTRE place de la SCÈNE. RÈGLE : deux places simultanément occupables n'ont jamais le même
 * abord — la portée en est la SCÈNE, pas le meuble (un repli qui volait l'abord déclaré d'un meuble
 * voisin posait deux corps sur la même case). `isWalkable` écarte déjà les empreintes de décor solide, les
 * terrains impassables et les cases effondrées. Une place sans AUCUNE case voisine libre et marchable
 * est la seule qui reste inoccupable (`approche-invalide`).
 *
 * DISPONIBILITÉ — un corps mis hors d'action ne tient pas sa chaise : `releaseUnavailableSeats` lève
 * les occupants que l'appelant déclare indisponibles (lui seul connaît le groupe et le combat).
 *
 * POSITION LOGIQUE — le corps assis se TIENT sur sa case d'abord (c'est de là qu'il s'est assis et
 * c'est là qu'il se relève) ; seul le RENDU applique l'ancre fractionnaire. Pour un PNJ authored,
 * `SceneEntity.pos === approche résolue` est un invariant du document, gardé par `validateScene`.
 */
import { findPropById } from '../data';
import { rotatePropLocal } from '../data/props.types';
import { DIR8_DELTA, DIR8_ORDER, rotateDir8, type Dir8 } from './dir8';
import { heightAt, isWalkable, type Scene, type SceneEntity } from './scene';
import { memoByRef } from './sceneMemo';
import type { Pt } from './path';

/** Qui occupe une place : un héros du groupe (corps du meneur) ou un PNJ de la scène (authoré). */
export type SeatOccupant =
  | { kind: 'party'; heroId: string }
  | { kind: 'entity'; entityId: string };

/** Occupation persistée d'une Scène : `propId → slotId → occupant`. */
export type SeatAssignments = Record<string, Record<string, SeatOccupant>>;

/** Place assise d'un meuble POSÉ : ancre monde du corps, cap du corps assis, case d'abord EFFECTIVE. */
export interface ResolvedSeatSlot {
  propId: string;
  slotId: string;
  anchor: { x: number; y: number; h: number };
  facing: Dir8;
  approach: Pt;
}

/** Une place résolue et son occupant. */
export interface SeatPose extends ResolvedSeatSlot { occupant: SeatOccupant }

export type SeatAssignmentResult =
  | { ok: true; scene: Scene; pose: SeatPose }
  | { ok: false; scene: Scene; reason: 'prop-absent' | 'slot-absent' | 'occupant-absent' | 'occupant-assis' | 'slot-occupe' | 'approche-invalide' };

/** Deux occupants désignent-ils le même corps ? */
function sameOccupant(a: SeatOccupant, b: SeatOccupant): boolean {
  return a.kind === b.kind && (a.kind === 'party' ? a.heroId === (b as { heroId: string }).heroId : a.entityId === (b as { entityId: string }).entityId);
}

/** Le meuble POSÉ (entité `prop` de la scène) qui porte les places de `propId`. */
const propEntity = (scene: Scene, propId: string): SceneEntity | undefined =>
  scene.entities.find((e) => e.id === propId && e.kind === 'prop');

/** Deux points désignent-ils la MÊME case (étage compris) ? Définition UNIQUE, partagée par
 *  l'interaction d'assise (store) et le clic de meuble (`stage/useStagePointer`). */
export const memeCase = (a: Pt, b: Pt): boolean => a.x === b.x && a.y === b.y && (a.z ?? 0) === (b.z ?? 0);

/** Case (entière) qui porte un point du plan. */
const caseDe = (x: number, y: number) => ({ x: Math.round(x), y: Math.round(y) });

/** Clé de case (étage compris), pour la réservation des abords à l'échelle de la SCÈNE. */
const cleCase = (p: { x: number; y: number }, z: number) => `${p.x},${p.y},${z}`;

/** Une place AVANT arbitrage de son abord : tout ce que la géométrie donne, moins l'approche. */
interface PlacePartielle {
  propId: string;
  slotId: string;
  anchor: { x: number; y: number; h: number };
  facing: Dir8;
  z: number;
  /** Abord DÉCLARÉ par le catalogue, tourné au cap de l'instance. */
  declaree: { x: number; y: number };
  /** Case qui porte le SIÈGE — l'origine des candidats de repli. */
  siege: { x: number; y: number };
}

/** Les places de TOUS les meubles posés, avant arbitrage : ordre des entités de la scène, puis ordre
 *  du catalogue — c'est cet ordre qui rend l'arbitrage ci-dessous déterministe. */
function placesPartielles(scene: Scene): PlacePartielle[] {
  const out: PlacePartielle[] = [];
  for (const ent of scene.entities) {
    if (ent.kind !== 'prop') continue;
    const slots = findPropById(ent.ref ?? '')?.seatSlots ?? [];
    if (!slots.length) continue;
    const facing = ent.facing ?? 'S';
    const crans = DIR8_ORDER.indexOf(facing);
    const z = ent.z ?? 0;
    const sol = heightAt(scene, ent.pos.x, ent.pos.y, z);
    for (const slot of slots) {
      const [ax, ay] = rotatePropLocal(slot.anchor.x, slot.anchor.y, facing);
      const anchor = { x: ent.pos.x + ax, y: ent.pos.y + ay, h: sol + slot.anchor.h };
      const [px, py] = rotatePropLocal(slot.approach.x, slot.approach.y, facing);
      out.push({
        propId: ent.id,
        slotId: slot.id,
        anchor,
        facing: rotateDir8(slot.facing, crans),
        z,
        declaree: caseDe(ent.pos.x + px, ent.pos.y + py),
        siege: caseDe(anchor.x, anchor.y),
      });
    }
  }
  return out;
}

/**
 * Toutes les places de la SCÈNE, abord EFFECTIF arbitré, indexées par meuble.
 *
 * ARBITRAGE en DEUX PASSES sur la population ENTIÈRE — la portée est la scène, pas le meuble : les
 * abords se réservent entre meubles voisins comme entre places d'une même table.
 *  1. les abords DÉCLARÉS marchables sont retenus et RÉSERVÉS, premier arrivé premier servi ;
 *  2. les autres se replient sur la première case voisine du SIÈGE (ordre `DIR8_ORDER` :
 *     N, NE, E, SE, S, SO, O, NO) qui soit marchable ET non encore réservée.
 * Aucune candidate → l'abord déclaré est rendu tel quel, et `assignSeat` refuse `approche-invalide`.
 */
function placesResolues(scene: Scene): Map<string, ResolvedSeatSlot[]> {
  const partiels = placesPartielles(scene);
  const reservees = new Set<string>();
  const declareeGagnee = new Set<number>();
  partiels.forEach((p, i) => {
    if (!isWalkable(scene, p.declaree.x, p.declaree.y, p.z)) return;
    const cle = cleCase(p.declaree, p.z);
    if (reservees.has(cle)) return;
    reservees.add(cle);
    declareeGagnee.add(i);
  });
  const out = new Map<string, ResolvedSeatSlot[]>();
  partiels.forEach(({ propId, slotId, anchor, facing, z, declaree, siege }, i) => {
    const enCase = (p: { x: number; y: number }): Pt => (z ? { x: p.x, y: p.y, z } : { x: p.x, y: p.y });
    let approach = enCase(declaree);
    if (!declareeGagnee.has(i)) {
      for (const dir of DIR8_ORDER) {
        const { gx, gy } = DIR8_DELTA[dir];
        const voisine = { x: siege.x + gx, y: siege.y + gy };
        if (!isWalkable(scene, voisine.x, voisine.y, z) || reservees.has(cleCase(voisine, z))) continue;
        reservees.add(cleCase(voisine, z));
        approach = enCase(voisine);
        break;
      }
    }
    const liste = out.get(propId) ?? [];
    liste.push({ propId, slotId, anchor, facing, approach });
    out.set(propId, liste);
  });
  return out;
}

/** Arbitrage de la scène, MÉMOÏSÉ par référence (patron canonique `state/sceneMemo`) : il porte sur la
 *  scène ENTIÈRE, et `interactHalos`/`placesOccupees` l'interrogent meuble par meuble — sans mémo, une
 *  frame de halos re-résolvait toute la salle une fois par décor. Aucune invalidation manuelle : toute
 *  mutation de scène rend une référence neuve. */
const placesResoluesMemo = memoByRef(placesResolues);

/**
 * Les places du meuble `propId`, résolues dans le monde : ancre tournée au cap de l'instance
 * (`facing ?? 'S'`, le défaut canonique de la scène), cap du corps assis tourné du même nombre de
 * crans, case d'abord EFFECTIVE (arbitrée à l'échelle de la SCÈNE, cf. `placesResolues`). ORDRE DU
 * CATALOGUE conservé. `[]` si le meuble ou son type est absent, ou si le type n'offre aucune place.
 */
export function seatSlotsOf(scene: Scene, propId: string): ResolvedSeatSlot[] {
  return placesResoluesMemo(scene).get(propId) ?? [];
}

/** Parcours DÉTERMINISTE de l'occupation : entités de la scène dans leur ordre, puis places du
 *  catalogue dans leur ordre. Base commune de `seatPoseOf` et de `pruneSeatAssignments`. */
function* placesOccupees(scene: Scene): Generator<{ slot: ResolvedSeatSlot; occupant: SeatOccupant }> {
  const assignments = scene.seatAssignments;
  if (!assignments) return;
  for (const ent of scene.entities) {
    const parMeuble = ent.kind === 'prop' ? assignments[ent.id] : undefined;
    if (!parMeuble) continue;
    for (const slot of seatSlotsOf(scene, ent.id)) {
      const occupant = parMeuble[slot.slotId];
      if (occupant) yield { slot, occupant };
    }
  }
}

/** La place que tient cet occupant, résolue dans le monde — `null` s'il est debout. */
export function seatPoseOf(scene: Scene, occupant: SeatOccupant): SeatPose | null {
  for (const { slot, occupant: assis } of placesOccupees(scene)) {
    if (sameOccupant(assis, occupant)) return { ...slot, occupant: assis };
  }
  return null;
}

/**
 * PRÉDICAT UNIQUE D'OCCUPABILITÉ — « ce siège se tient-il ? ». Une place n'est occupable que si son
 * abord EFFECTIF est praticable : `isWalkable` écarte déjà l'empreinte des décors solides, les
 * terrains impassables et les cases effondrées. Quand `placesResolues` n'a trouvé AUCUNE candidate
 * (siège cerné), elle rend l'abord déclaré tel quel — c'est ici, et ici seulement, que ce cas se
 * traduit en refus.
 *
 * `assignSeat` (le GESTE), `seatAssignmentDefects` (le DOCUMENT) et `normaliseAssises`
 * (les mutations d'éditeur) l'appellent tous les trois : ce qu'un geste refuse, le validateur et le
 * compilateur le refusent aussi, et la règle N+1 s'écrit ICI, une fois.
 */
export function seatIsOccupiable(scene: Scene, slot: ResolvedSeatSlot): boolean {
  const z = propEntity(scene, slot.propId)?.z ?? 0;
  return isWalkable(scene, slot.approach.x, slot.approach.y, z);
}

/** L'occupant désigne-t-il un corps RÉELLEMENT disponible dans cette scène ? */
function occupantExiste(scene: Scene, occupant: SeatOccupant, partyHeroIds: ReadonlySet<string>): boolean {
  return occupant.kind === 'party'
    ? partyHeroIds.has(occupant.heroId)
    : scene.entities.some((e) => e.id === occupant.entityId && e.kind === 'personnage');
}

/**
 * Assoit `occupant` à la place `slotId` du meuble `propId`. Revalide TOUT au moment de l'écriture
 * (meuble, place, corps, exclusivités, approche) et rend une raison stable en cas de refus — la
 * scène retournée est alors l'entrée, inchangée.
 */
export function assignSeat(
  scene: Scene,
  propId: string,
  slotId: string,
  occupant: SeatOccupant,
  partyHeroIds: ReadonlySet<string>,
): SeatAssignmentResult {
  if (!propEntity(scene, propId)) return { ok: false, scene, reason: 'prop-absent' };
  const slot = seatSlotsOf(scene, propId).find((s) => s.slotId === slotId);
  if (!slot) return { ok: false, scene, reason: 'slot-absent' };
  if (!occupantExiste(scene, occupant, partyHeroIds)) return { ok: false, scene, reason: 'occupant-absent' };
  if (seatPoseOf(scene, occupant)) return { ok: false, scene, reason: 'occupant-assis' };
  if (scene.seatAssignments?.[propId]?.[slotId]) return { ok: false, scene, reason: 'slot-occupe' };
  if (!seatIsOccupiable(scene, slot)) return { ok: false, scene, reason: 'approche-invalide' };
  const seatAssignments: SeatAssignments = { ...scene.seatAssignments };
  seatAssignments[propId] = { ...seatAssignments[propId], [slotId]: occupant };
  return { ok: true, scene: { ...scene, seatAssignments }, pose: { ...slot, occupant } };
}

/** Lève `occupant` de sa place — les meubles qui se vident perdent leur objet. Scène INCHANGÉE
 *  (même référence) s'il était déjà debout. */
export function releaseSeat(scene: Scene, occupant: SeatOccupant): Scene {
  const assignments = scene.seatAssignments;
  if (!assignments) return scene;
  let touche = false;
  const seatAssignments: SeatAssignments = {};
  for (const [propId, parMeuble] of Object.entries(assignments)) {
    const restant: Record<string, SeatOccupant> = {};
    for (const [slotId, assis] of Object.entries(parMeuble)) {
      if (sameOccupant(assis, occupant)) { touche = true; continue; }
      restant[slotId] = assis;
    }
    if (Object.keys(restant).length) seatAssignments[propId] = restant;
  }
  return touche ? { ...scene, seatAssignments } : scene;
}

/**
 * Lève de leur place les corps que l'appelant déclare INDISPONIBLES — un mort, un Inconscient, un
 * corps mis hors d'action ne tient pas sa chaise. PURE : l'oracle `disponible` vient de l'appelant,
 * seul à connaître le groupe et le combat en cours (ce module ne lit que la Scène).
 * Rend la scène d'entrée, MÊME RÉFÉRENCE, si tout le monde tient encore sa place.
 */
export function releaseUnavailableSeats(scene: Scene, disponible: (occupant: SeatOccupant) => boolean): Scene {
  const assignments = scene.seatAssignments;
  if (!assignments) return scene;
  let scèneCourante = scene;
  for (const parMeuble of Object.values(assignments))
    for (const occupant of Object.values(parMeuble))
      if (!disponible(occupant)) scèneCourante = releaseSeat(scèneCourante, occupant);
  return scèneCourante;
}

/** Un défaut d'assise du DOCUMENT : le message français à afficher, et l'entité à blâmer (pour que
 *  l'éditeur y emmène au clic). */
export interface SeatAssignmentDefect { at: string; message: string }

/**
 * VALIDATEUR STRICT COMMUN de `Scene.seatAssignments` — source unique des règles du document,
 * partagée par `validateScene` (qui en fait des avertissements cliquables) et par le compilateur
 * d'authoring `mapSpec.buildScene` (qui échoue fail-fast dessus).
 *
 * Chaque place occupée doit désigner un meuble POSÉ, une place que son type déclare, et un corps
 * présent ; la place doit être OCCUPABLE au sens du prédicat unique `seatIsOccupiable` (le même que
 * le geste applique) ; et la `pos` d'un PNJ assis est EXACTEMENT la case d'abord résolue de sa place
 * (sa position LOGIQUE : c'est de là qu'il s'est assis et là qu'il se relève ; l'ancre fractionnaire
 * n'est que du rendu). Le groupe n'appartient pas au document : une place `kind:'party'` ne se
 * vérifie que jusqu'au meuble, au slot et à l'occupabilité.
 */
export function seatAssignmentDefects(scene: Scene): SeatAssignmentDefect[] {
  const out: SeatAssignmentDefect[] = [];
  for (const [propId, parMeuble] of Object.entries(scene.seatAssignments ?? {})) {
    const places = seatSlotsOf(scene, propId);
    const propPose = !!propEntity(scene, propId);
    for (const [slotId, occupant] of Object.entries(parMeuble)) {
      const occupantId = occupant.kind === 'party' ? occupant.heroId : occupant.entityId;
      if (!propPose) { out.push({ at: propId, message: `Assise « ${propId}/${slotId} » (« ${occupantId} ») : aucun décor « ${propId} » dans la scène` }); continue; }
      const place = places.find((p) => p.slotId === slotId);
      if (!place) { out.push({ at: propId, message: `Assise « ${propId}/${slotId} » (« ${occupantId} ») : le décor « ${propId} » n'offre pas de place « ${slotId} »` }); continue; }
      if (!seatIsOccupiable(scene, place)) {
        const { x: rx, y: ry } = place.approach;
        out.push({ at: propId, message: `Assise « ${propId}/${slotId} » (« ${occupantId} ») : aucun abord praticable ne dessert cette place (abord résolu en (${rx},${ry}), infranchissable)` });
        continue;
      }
      if (occupant.kind === 'party') continue;
      const pnj = scene.entities.find((e) => e.id === occupant.entityId && e.kind === 'personnage');
      if (!pnj) { out.push({ at: propId, message: `Assise « ${propId}/${slotId} » : aucun personnage « ${occupantId} » dans la scène` }); continue; }
      const { x: ax, y: ay } = place.approach;
      if (pnj.pos.x !== ax || pnj.pos.y !== ay)
        out.push({ at: occupant.entityId, message: `Assise « ${propId}/${slotId} » : « ${occupantId} » est posé en (${pnj.pos.x},${pnj.pos.y}) alors que l’abord de sa place est en (${ax},${ay})` });
    }
  }
  return out;
}

/**
 * Occupation NORMALISÉE de la scène : ne survivent que les places dont le meuble est posé, dont la
 * place est déclarée par le catalogue et dont le corps est disponible (héros du groupe fourni, ou
 * PNJ encore présent). Parcours déterministe (entités, puis places déclarées) ; un occupant apparu
 * deux fois garde son PREMIER siège. Rend toujours une valeur — `{}` = plus personne d'assis.
 */
export function pruneSeatAssignments(scene: Scene, partyHeroIds: ReadonlySet<string>): SeatAssignments {
  const out: SeatAssignments = {};
  const vus: SeatOccupant[] = [];
  for (const { slot, occupant } of placesOccupees(scene)) {
    if (!occupantExiste(scene, occupant, partyHeroIds)) continue;
    if (vus.some((v) => sameOccupant(v, occupant))) continue;
    vus.push(occupant);
    (out[slot.propId] ??= {})[slot.slotId] = occupant;
  }
  return out;
}
