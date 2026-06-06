/** Poses/clips du gabarit QUADRUPÈDE — propres au plan (démarche diagonale, morsure, mort). */
import type { QuadPose } from './quadSkeleton';

export const QUAD_REST: QuadPose = {};

const swing = (ph: number) => Math.sin(ph * Math.PI * 2) * 16; // balancier de la patte
const knee = (ph: number) => -Math.max(0, Math.sin(ph * Math.PI * 2)) * 22; // flexion en phase avancée

/** Démarche (trot) : paires DIAGONALES (AvD+ArG) / (AvG+ArD) en opposition, genoux pliés. phase 0..1. */
export function quadWalkPose(phase: number): QuadPose {
  return {
    hautAvD: swing(phase), basAvD: knee(phase), hautArG: swing(phase), basArG: knee(phase),
    hautAvG: swing(phase + 0.5), basAvG: knee(phase + 0.5), hautArD: swing(phase + 0.5), basArD: knee(phase + 0.5),
    tete: swing(phase) * 0.2, encolure: swing(phase) * 0.1,
  };
}

/** Morsure/charge : l'encolure plonge en avant + la gueule s'avance. phase 0..1 (cloche). */
export function quadBitePose(phase: number): QuadPose {
  const k = Math.sin(Math.min(1, Math.max(0, phase)) * Math.PI);
  return { encolure: 18 * k, tete: 26 * k, hautAvD: -10 * k, hautAvG: -8 * k, croupe: -4 * k };
}

/**
 * Mort d'un QUADRUPÈDE : effondré sur le flanc — pattes TENDUES (avant vers l'avant, arrière
 * vers l'arrière, raides, à l'horizontale), encolure et tête AU SOL, queue molle. PAS de
 * bascule 78° (ça c'est la chute en arrière des bipèdes) : le corps s'aplatit sur place.
 */
export const QUAD_DEATH: QuadPose = {
  hautAvD: 84, basAvD: 6, piedAvD: -4, hautAvG: 76, basAvG: 6, piedAvG: -4,
  hautArD: -86, basArD: -6, piedArD: 4, hautArG: -78, basArG: -6, piedArG: 4,
  encolure: 70, tete: 46, queue: 34,
  // Ailes affaissées (gabarit ailé uniquement ; ignoré par les quadrupèdes sans os d'aile) :
  // les deux ailes retombent vers l'avant, molles, étalées au sol.
  aileD: 58, aileG: -58,
};
