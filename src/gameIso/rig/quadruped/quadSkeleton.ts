/**
 * Squelette du gabarit QUADRUPÈDE (cheval/loup/sanglier/chien/rat géant/ours).
 * Profil tourné à DROITE, boîte 120×150, pieds au sol (y≈150). Le miroir gauche et le
 * facing sont gérés au rendu. Réutilise la FK générique (kinematics.worldTransformsG).
 */
import { worldTransformsG, type FKBone } from '../kinematics';
import type { StoredPalette } from '../palette';
import type { View } from '../facing';

export type QuadBoneId =
  | 'tronc' | 'croupe' | 'encolure' | 'tete' | 'queue'
  | 'aileD' | 'aileG' // gabarit AILÉ : paire d'ailes (membrane/plumes) sur le garrot
  | 'hautAvD' | 'basAvD' | 'piedAvD' | 'hautAvG' | 'basAvG' | 'piedAvG'
  | 'hautArD' | 'basArD' | 'piedArD' | 'hautArG' | 'basArG' | 'piedArG';

export interface QBone extends FKBone {
  length: number;
  thickness: number;
  z: number;
}
export type QuadSkeleton = Record<QuadBoneId, QBone>;
export type QuadPose = Partial<Record<QuadBoneId, number>>;

/** Caractère d'une espèce quadrupède (proportions + parts + couleurs par défaut). */
export type QuadBuild = 'equine' | 'canine' | 'suid' | 'rodent' | 'ursine' | 'feline' | 'draconic' | 'batracien';
export type QuadHead = 'cheval' | 'loup' | 'sanglier' | 'rat' | 'ours' | 'aigle' | 'dragon' | 'crapaud' | 'hydre';
export type QuadFoot = 'sabot' | 'patte' | 'serre'; // serre = serres d'aigle (rapace)
export type QuadTail = 'crin' | 'touffe' | 'fouet' | 'nue' | 'courte' | 'reptile' | 'leonine' | 'sans';
/** Crinière le long de l'encolure : crin couché (équin), hirsute (fourrure dressée — loup/
 *  sanglier), sans. Défaut historique : dérivée de `tail==='crin'` (rétro-compat). */
export type QuadMane = 'crin' | 'hirsute' | 'sans';
export interface QuadProps {
  sl: number; // échelle globale (taille)
  build: QuadBuild; // SILHOUETTE du corps (équin level / canin svelte / suidé bossu / rongeur arqué / ursin massif / félin / draconique)
  girth: number; // carrure : profondeur/épaisseur du corps (×, vertical)
  bodyLen: number; // allongement du tronc/croupe
  neckLen: number; // longueur d'encolure
  neckAngle: number; // inclinaison de l'encolure (deg ; négatif = redressée)
  legLen: number; // longueur des membres (hauteur sur pattes)
  head: QuadHead;
  tail: QuadTail;
  ears: 'courtes' | 'pointues' | 'rondes';
  foot: QuadFoot; // pied ARRIÈRE (et avant par défaut)
  frontFoot?: QuadFoot; // pied AVANT distinct (griffon : serres devant / pattes derrière)
  wings?: 'plumes' | 'membrane'; // gabarit AILÉ : ailes emplumées (rapace/pégase) ou membraneuses (dragon)
  wingSpan?: number; // envergure (× sur l'art des ailes, défaut 1 — dragon ample, demigriffon court)
  mane?: QuadMane; // crinière d'encolure (défaut : 'crin' si tail==='crin', sinon 'sans')
  ridge?: 'epines' | 'crete' | 'plaques' | 'sans'; // dorsale (défaut : 'epines' si draconic, sinon 'sans')
  markings?: 'taches' | 'rayures' | 'balzanes' | 'sans'; // robe : taches/rayures de flanc, balzanes aux membres
  headScale?: number; // × sur l'art de tête (défaut 1)
  tailLen?: number; // × sur l'art de queue (défaut 1)
  stored: StoredPalette; // robe/pelage par défaut (corps/cheveux/cuir…)
}

// La DATA des espèces (props + alias) vit désormais dans `creatures/defs/<Nom>.ts` (un fichier
// par créature, auto-collectés). `quadSkeleton` ne garde que les TYPES + la mécanique de rendu.
// On RE-EXPORTE les tables dérivées pour que les consommateurs existants ne changent pas.
export { QUAD_SPECIES, quadSpeciesNames } from '../creatures';

/** Construit le squelette d'une espèce (profil tourné à droite, pieds ~y150). */
export function buildQuadSkeleton(p: QuadProps): QuadSkeleton {
  const bl = p.bodyLen, ll = p.legLen;
  const leg = (
    haut: QuadBoneId, bas: QuadBoneId, pied: QuadBoneId,
    parent: QuadBoneId, px: number, py: number, far: boolean, rear = false,
  ): Partial<QuadSkeleton> => {
    const z = far ? 1 : 9;
    // ARRIÈRE-main angulée (cuisse portée en avant, JARRET cassé en arrière, canon qui revient
    // d'aplomb) — 4 pattes verticales parallèles = silhouette « table ». L'avant reste ~d'aplomb.
    const aHaut = rear ? (far ? -4 : -7) : far ? 3 : -1;
    const aBas = rear ? (far ? 13 : 16) : far ? 6 : 8;
    const aPied = rear ? -9 : far ? -5 : -7;
    return {
      [haut]: { parent, pivot: { x: px, y: py }, angle: aHaut, length: 30 * ll, thickness: 9, z },
      [bas]: { parent: haut, pivot: { x: 0, y: 30 * ll }, angle: aBas, length: 22 * ll, thickness: 7, z }, // pli de genou/jarret
      [pied]: { parent: bas, pivot: { x: 0, y: 22 * ll }, angle: aPied, length: 9, thickness: 7, z }, // sabot ramené à la verticale
    } as Partial<QuadSkeleton>;
  };
  const sk: Partial<QuadSkeleton> = {
    tronc: { parent: null, pivot: { x: 56, y: 82 }, angle: 0, length: 0, thickness: 26, z: 5 },
    croupe: { parent: 'tronc', pivot: { x: -28 * bl, y: -2 }, angle: 0, length: 0, thickness: 26, z: 4 },
    // Encolure penchée en AVANT (tête devant le poitrail, pas au-dessus = « fusionnée »).
    // neckAngle est stocké négatif (héritage) → on le négocie en avant via -neckAngle.
    encolure: { parent: 'tronc', pivot: { x: 28 * bl, y: -12 }, angle: -p.neckAngle, length: 30 * p.neckLen, thickness: 14, z: 6 },
    tete: { parent: 'encolure', pivot: { x: 0, y: -30 * p.neckLen }, angle: 10 + p.neckAngle, length: 18, thickness: 14, z: 7 },
    queue: { parent: 'croupe', pivot: { x: -16, y: -6 }, angle: 42, length: 26, thickness: 6, z: 3 },
    ...leg('hautAvG', 'basAvG', 'piedAvG', 'tronc', 24 * bl + 6, 8, true),
    ...leg('hautArG', 'basArG', 'piedArG', 'croupe', -6 * bl + 6, 8, true, true),
    ...leg('hautAvD', 'basAvD', 'piedAvD', 'tronc', 24 * bl, 10, false),
    ...leg('hautArD', 'basArD', 'piedArD', 'croupe', -6 * bl, 10, false, true),
  };
  // Ailes (gabarit AILÉ) : attachées au garrot (haut-avant du tronc). aileD = aile PROCHE
  // (par-dessus le flanc, z élevé) ; aileG = aile LOINTAINE (derrière le corps, z bas). L'art
  // est dessiné librement dans le repère de l'os (comme la queue). Length/thickness 0 = os
  // d'attache (pas de FK de longueur). Angle de repos = aile à demi-repliée dressée vers l'arrière.
  if (p.wings) {
    sk.aileD = { parent: 'tronc', pivot: { x: 12 * bl, y: -15 }, angle: 0, length: 0, thickness: 0, z: 6 };
    sk.aileG = { parent: 'tronc', pivot: { x: 9 * bl, y: -16 }, angle: 0, length: 0, thickness: 0, z: 2 };
  }
  return sk as QuadSkeleton;
}

/**
 * Adapte le squelette à la VUE. Profil = tel quel (riche). Face/dos = corps vu de BOUT :
 * le tronc devient le hub central (poitrail en face / croupe de dos), les 4 pattes
 * straddlent l'axe (gauche/droite) et passent DERRIÈRE le corps (pieds dépassent en bas),
 * l'encolure se réduit en colonne verticale, la queue (dos) pend au centre. → vrai 8-dir.
 */
export function quadSkeletonForView(sk: QuadSkeleton, view: View): QuadSkeleton {
  if (view === 'profile') return sk;
  const front = view === 'front';
  const out = { ...sk } as QuadSkeleton;
  const neckL = sk.encolure.length * 0.26;
  out.croupe = { ...sk.croupe, pivot: { x: -2, y: -2 }, angle: 0, z: 4 };
  // Encolure VERTICALE par le PIVOT (pas par rotation) : angle 0 → la tête monte droit au-
  // dessus du tronc ET reste à l'endroit (face au spectateur). Une rotation -90 ici déportait
  // la tête à gauche ET la faisait pivoter (« deux yeux empilés, museau à gauche »).
  out.encolure = { ...sk.encolure, pivot: { x: 0, y: -18 }, length: neckL, angle: 0, z: 8 };
  out.tete = { ...sk.tete, pivot: { x: 0, y: -neckL - 4 }, angle: 0, z: 9 };
  out.queue = { ...sk.queue, pivot: { x: 0, y: -6 }, angle: front ? 60 : 4, z: front ? 2 : 6 };
  // pattes : straddle ±, segments droits, derrière le corps (la paire la plus proche de
  // l'œil selon la vue est devant : avant en face / arrière de dos).
  const set = (id: QuadBoneId, x: number, z: number) => {
    out[id] = { ...sk[id], pivot: { x, y: sk[id].pivot.y }, angle: 0, z };
  };
  // La paire face à l'œil (avant en face / arrière de dos) est ÉCARTÉE et devant ; l'autre
  // paire est resserrée et derrière (profondeur) → on lit bien 4 pattes, pas 2 fusionnées.
  const zNear = 4, zFar = 2, wNear = 15, wFar = 6;
  set('hautAvD', front ? wNear : wFar, front ? zNear : zFar); set('hautAvG', front ? -wNear : -wFar, front ? zNear : zFar);
  set('hautArD', front ? wFar : wNear, front ? zFar : zNear); set('hautArG', front ? -wFar : -wNear, front ? zFar : zNear);
  for (const id of ['basAvD', 'basAvG', 'basArD', 'basArG', 'piedAvD', 'piedAvG', 'piedArD', 'piedArG'] as QuadBoneId[]) {
    out[id] = { ...sk[id], angle: 0, z: out[id.startsWith('basAv') || id.startsWith('piedAv') ? 'hautAvD' : 'hautArD'].z };
  }
  // Ailes de face/dos : DÉPLOYÉES de part et d'autre du corps (droite +x / gauche -x), derrière
  // le tronc (z bas) → silhouette d'oiseau de proie ailes ouvertes. Art symétrique (miroir géré
  // par la part front/back de l'aile elle-même).
  if (sk.aileD) {
    out.aileD = { ...sk.aileD, pivot: { x: 10, y: -15 }, angle: 0, z: 2 };
    out.aileG = { ...sk.aileG, pivot: { x: -10, y: -15 }, angle: 0, z: 2 };
  }
  return out;
}

/** Ancre le pied le plus bas au sol (y=floorY) en translatant le tronc. */
export function groundQuad(sk: QuadSkeleton, pose: QuadPose, floorY = 150): QuadSkeleton {
  const w = worldTransformsG(sk, pose);
  let footY = -Infinity;
  for (const id of ['piedAvD', 'piedAvG', 'piedArD', 'piedArG'] as QuadBoneId[]) {
    const m = w[id];
    const y = m[3] * sk[id].length + m[5];
    if (y > footY) footY = y;
  }
  const d = floorY - footY;
  if (Math.abs(d) < 0.01) return sk;
  return { ...sk, tronc: { ...sk.tronc, pivot: { x: sk.tronc.pivot.x, y: sk.tronc.pivot.y + d } } };
}
