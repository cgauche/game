/**
 * Capacités du POINTEUR (évaluées au clic — un même appareil peut changer d'entrée).
 * Desktop souris : le survol montre déjà la carte de visée + le réticule + le chemin → un clic
 * UNIQUE commet l'attaque (l'aperçu tap-1 ferait double emploi). Tactile : pas de survol —
 * le deux-taps RESTE l'aperçu (tap 1 = visée, tap 2 = commit).
 */
export const hoverClickCommits = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
