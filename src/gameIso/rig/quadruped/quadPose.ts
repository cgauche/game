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

// Recul d'impact (touché / attaque esquivée) : tête et encolure qui rentrent, tronc en arrière.
// Mêmes os que `creatureAttackPoses` — le gabarit AILÉ partage ce squelette et donc ce recul.
const QUAD_FLINCH: QuadPose = { tronc: -7, encolure: -13, tete: -8, croupe: 3 };

/** Recul quad/ailé à l'amplitude `k` (0..1, modulée en cloche par l'appelant). PUR. */
export function quadFlinchPose(k: number): QuadPose {
  const out: QuadPose = {};
  for (const [b, v] of Object.entries(QUAD_FLINCH)) out[b as keyof QuadPose] = (v ?? 0) * k;
  return out;
}

/** BOND (trait LDB 85) : démarche BONDISSANTE — cycle ramassé (pattes sous le corps, dos
 *  arqué) → DÉTENTE (avants jetés devant, arrières étendus derrière, encolure allongée).
 *  Remplace quadWalkPose quand le combattant a le trait. phase 0..1 (boucle). */
export function quadLeapPose(phase: number): QuadPose {
  const s = Math.sin(phase * Math.PI * 2); // -1 ramassé … +1 détendu
  const ext = Math.max(0, s), tuck = Math.max(0, -s);
  return {
    hautAvD: -42 * ext + 16 * tuck, basAvD: 8 * ext - 34 * tuck, piedAvD: 6 * ext,
    hautAvG: -36 * ext + 14 * tuck, basAvG: 8 * ext - 30 * tuck, piedAvG: 6 * ext,
    hautArD: 36 * ext - 18 * tuck, basArD: -10 * ext + 26 * tuck, piedArD: -6 * ext,
    hautArG: 32 * ext - 16 * tuck, basArG: -10 * ext + 22 * tuck, piedArG: -6 * ext,
    encolure: -8 * ext + 7 * tuck, tete: -6 * ext + 5 * tuck, croupe: -7 * tuck, queue: -12 * ext,
  };
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
