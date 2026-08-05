/**
 * Table des PLANS de profondeur (z) du gabarit QUADRUPÈDE : un z par OS et par VUE, en données
 * nommées. SOURCE UNIQUE — consommée par le squelette (`buildQuadSkeleton` en profil,
 * `quadSkeletonForView` de face/dos) ET par le couple monté (`mountedRig` : cavalier et
 * harnachement s'intercalent dans la MÊME échelle). Aucun littéral de z ne vit ailleurs
 * (garde `quad-vues-ratchet.test.ts`).
 *
 * Échelle (croissant = plus près de l'œil). En PROFIL : pattes lointaines 1 · aile lointaine 2 ·
 * queue 3 · croupe 4 · tronc 5 · encolure et aile proche 6 · tête 7 · pattes proches 9.
 * De FACE/DOS le corps est vu de bout : l'encolure et la tête montent au-dessus du tronc, la paire
 * de pattes face à l'œil passe devant (4) et l'autre derrière (2), la queue passe derrière de face
 * et devant de dos.
 *
 * Ce module est une FEUILLE : il n'importe que des types (aucun cycle d'exécution avec
 * `quadSkeleton.ts`).
 */
import type { View } from '../facing';
import type { QuadBoneId } from './quadSkeleton';

/** z d'un os pour chacune des 3 vues. Table TOTALE : tout `QuadBoneId` y figure. */
export type QuadZTable = Record<QuadBoneId, Record<View, number>>;

export const QUAD_Z: QuadZTable = {
  tronc: { profile: 5, front: 5, back: 5 },
  croupe: { profile: 4, front: 4, back: 4 },
  encolure: { profile: 6, front: 8, back: 8 },
  tete: { profile: 7, front: 9, back: 9 },
  // `nuque` = calque BAS de l'art de tête (scission `rigCutQuad*`, quadParts.ts) : il suit la tête
  // (même os porteur, même repère) mais porte son propre plan. De DOS il passe SOUS le tronc — le
  // raccord crinière→garrot se glisse entre les épaules, le crâne restant au-dessus (9).
  nuque: { profile: 6, front: 8, back: 4.5 },
  queue: { profile: 3, front: 2, back: 6 },
  // Ailes : en profil aileD = proche (par-dessus le flanc), aileG = lointaine (derrière le corps).
  // De FACE, l'aile pliée est sur les flancs, derrière le poitrail qui fait face à l'œil (2) ; de
  // DOS elle repose SUR le dos, donc au-dessus du tronc (6).
  aileD: { profile: 6, front: 2, back: 6 },
  aileG: { profile: 2, front: 2, back: 6 },
  // Membres : en profil, côté D = proche (9), côté G = lointain (1). De face/dos, c'est la PAIRE
  // face à l'œil qui est devant (antérieurs de face, postérieurs de dos) — le côté n'y joue pas.
  hautAvD: { profile: 9, front: 4, back: 2 },
  basAvD: { profile: 9, front: 4, back: 2 },
  piedAvD: { profile: 9, front: 4, back: 2 },
  hautAvG: { profile: 1, front: 4, back: 2 },
  basAvG: { profile: 1, front: 4, back: 2 },
  piedAvG: { profile: 1, front: 4, back: 2 },
  hautArD: { profile: 9, front: 2, back: 4 },
  basArD: { profile: 9, front: 2, back: 4 },
  piedArD: { profile: 9, front: 2, back: 4 },
  hautArG: { profile: 1, front: 2, back: 4 },
  basArG: { profile: 1, front: 2, back: 4 },
  piedArG: { profile: 1, front: 2, back: 4 },
};

/** Ordre PEINTRE des os pour une vue : z croissant, `QuadBoneId` en départage stable. */
export function quadZOrder(view: View): { id: QuadBoneId; z: number }[] {
  return (Object.entries(QUAD_Z) as [QuadBoneId, Record<View, number>][])
    .map(([id, byView]) => ({ id, z: byView[view] }))
    .sort((a, b) => a.z - b.z || a.id.localeCompare(b.id));
}
