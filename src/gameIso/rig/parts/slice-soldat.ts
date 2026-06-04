import type { PartArt } from './types';

/**
 * Tranche verticale du facing directionnel : UN archétype (Soldat humain) en
 * front/back/profile, pour valider le système avant la génération d'art de masse.
 * Valeurs réglées à la recette navigateur.
 */

const eye = (cx: number) =>
  `<ellipse cx="${cx}" cy="7" rx="1.4" ry="2" fill="url(#g_eye)"/><circle cx="${cx}" cy="7" r="0.8" fill="#140a06"/>`;

/** Tête Humain M : face (visage+yeux), dos (nuque, pas d'yeux), profil (¾ de côté). */
export const HEAD_HUMAIN_M: { visage: PartArt; cheveux: PartArt } = {
  visage: {
    front: `<circle cx="0" cy="7" r="9" fill="#e2b48c"/>${eye(-3)}${eye(3)}`,
    back: `<circle cx="0" cy="7" r="9" fill="#d8a87c"/>`,
    profile: `<path d="M-2 -2 Q9 -2 9 7 Q9 16 -1 16 Q-3 10 -2 -2Z" fill="#e2b48c"/><ellipse cx="4" cy="7" rx="1.3" ry="2" fill="url(#g_eye)"/><circle cx="4" cy="7" r="0.75" fill="#140a06"/>`,
  },
  cheveux: {
    front: `<path d="M-9 6 Q0 -7 9 6 Q5 -1 0 -1 Q-5 -1 -9 6Z" fill="#5a4427"/>`,
    back: `<path d="M-9 6 Q0 -8 9 6 L9 14 Q0 12 -9 14Z" fill="#5a4427"/>`,
    profile: `<path d="M-3 6 Q-4 -7 6 -6 Q9 -2 8 6 Q3 0 -3 6Z" fill="#5a4427"/>`,
  },
};

/** Tenue Soldat (cuirasse + bas) : face / dos (métal mat) / profil (resserré). */
export const TENUE_SOLDAT: { torse: PartArt; jambes: PartArt } = {
  torse: {
    front: `<path d="M-14 -28 Q0 -33 14 -28 L13 4 L11 34 Q0 38 -11 34 L-13 4 Z" fill="url(#g_steel)" stroke="#3a4150"/>`,
    back: `<path d="M-14 -28 Q0 -33 14 -28 L13 4 L11 34 Q0 38 -11 34 L-13 4 Z" fill="#6a7384" stroke="#3a4150"/>`,
    profile: `<path d="M-7 -28 Q4 -31 9 -26 L8 6 L7 34 Q0 37 -6 33 L-7 4 Z" fill="url(#g_steel)" stroke="#3a4150"/>`,
  },
  jambes: {
    front: `<rect x="-4" y="0" width="8" height="50" rx="3" fill="#3a2c22"/>`,
    back: `<rect x="-4" y="0" width="8" height="50" rx="3" fill="#2f241c"/>`,
    profile: `<rect x="-3" y="0" width="7" height="50" rx="3" fill="#3a2c22"/>`,
  },
};

/** Épée : face / dos (lame grise mate) / profil (fine). */
export const WEAPON_EPEE: PartArt = {
  front: `<rect x="-1.5" y="-2" width="3" height="6" fill="#5a3f24"/><rect x="-1" y="-30" width="2" height="28" fill="url(#g_steel)"/><rect x="-5" y="-2" width="10" height="2.5" fill="#caa64a"/>`,
  back: `<rect x="-1.5" y="-2" width="3" height="6" fill="#4a3320"/><rect x="-1" y="-30" width="2" height="28" fill="#6a7384"/>`,
  profile: `<rect x="-1.2" y="-2" width="2.4" height="6" fill="#5a3f24"/><rect x="-0.8" y="-30" width="1.6" height="28" fill="url(#g_steel)"/>`,
};

/** Overrides du slice (priment sur l'art généré tant qu'il n'a pas ses vues). */
export const SLICE_HEADS: Record<string, { visage: PartArt; cheveux: PartArt }> = {
  'Humain:M': HEAD_HUMAIN_M,
};
export const SLICE_TENUES: Record<string, Partial<Record<'torse' | 'jambes' | 'bras' | 'tete', PartArt>>> = {
  Soldat: TENUE_SOLDAT,
};
