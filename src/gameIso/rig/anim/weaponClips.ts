/**
 * Animations PAR GROUPE D'ARME CANONIQUE (brin G). La famille vient de la donnée
 * `Source/` (trappings.subType) via weaponGroupKey — PAS d'un parsing du libellé.
 * Groupes : base/escrime/cavalerie/deuxmains/hast/fleau/parade/bagarre (mêlée) ;
 * arc/arbalete/poudre/fronde/lancer/entraves/explosifs/ingenierie (distance).
 *
 * Conventions d'angles (deg), déduites de clips.ts :
 *  - epauleD/epauleG < 0 : bras armé en arrière-haut ; > 0 : tendu en avant/bas.
 *  - torse/bassin > 0 : appui/avancée vers la cible. arme : rotation de l'arme.
 */
import type { Pose } from '../poses';
import type { Clip, ClipStep } from './clips';
import type { Weapon } from '../../../engine/types';
import { weaponGroupKey } from '../parts/weaponGroup';
import { isShield } from '../parts/equipment';

const REST: Pose = {};
const c = (steps: ClipStep[], onImpact?: number): Clip => ({ steps, onImpact });

// Estoc (lance/cavalerie/hast) : peu de lever de bras, FENTE du buste/bassin.
const THRUST = c([
  { pose: { epauleD: 6, epauleG: 10, avantBrasD: -6, torse: -3 }, ms: 120, easing: 'easeOut' },
  { pose: { epauleD: 34, epauleG: 24, avantBrasD: 10, torse: 12, bassin: 9, arme: -8 }, ms: 110, easing: 'easeOutBack' },
  { pose: REST, ms: 200, easing: 'easeInOut' },
], 230);

// --- Gestes d'attaque par GROUPE ------------------------------------------
const ATTACK: Record<string, Clip> = {
  // Base (épée/hache/masse/dague une-main) : taille latérale.
  base: c([
    { pose: { epauleD: -30, avantBrasD: -18, torse: -5 }, ms: 130, easing: 'easeOut' },
    { pose: { epauleD: 52, avantBrasD: 24, torse: 9, bassin: 4 }, ms: 90, easing: 'easeOutBack' },
    { pose: REST, ms: 200, easing: 'easeInOut' },
  ], 220),
  // Escrime (rapière/fleuret) : fente rapide en estoc, peu d'armé.
  escrime: c([
    { pose: { epauleD: -8, avantBrasD: -12, torse: -3 }, ms: 80, easing: 'easeOut' },
    { pose: { epauleD: 40, avantBrasD: 22, torse: 8, bassin: 7 }, ms: 80, easing: 'easeOutBack' },
    { pose: REST, ms: 170, easing: 'easeInOut' },
  ], 165),
  cavalerie: THRUST,
  hast: THRUST,
  // Deux-mains (espadon/grande hache) : grand coup vertical, lève TRÈS haut.
  deuxmains: c([
    { pose: { epauleD: -72, epauleG: -60, avantBrasD: -28, torse: -4 }, ms: 180, easing: 'easeOut' },
    { pose: { epauleD: 44, epauleG: 30, avantBrasD: 34, torse: 13, bassin: 7 }, ms: 100, easing: 'easeOutBack' },
    { pose: REST, ms: 240, easing: 'easeInOut' },
  ], 285),
  // Fléau : moulinet circulaire au-dessus de la tête.
  fleau: c([
    { pose: { epauleD: -70, avantBrasD: -44, torse: -5 }, ms: 170, easing: 'easeOut' },
    { pose: { epauleD: 56, avantBrasD: 38, torse: 9, bassin: 5 }, ms: 100, easing: 'easeOutBack' },
    { pose: REST, ms: 230, easing: 'easeInOut' },
  ], 270),
  // Parade (main-gauche/brise-épée) : estoc court et bas.
  parade: c([
    { pose: { epauleD: -10, avantBrasD: -14 }, ms: 70, easing: 'easeOut' },
    { pose: { epauleD: 26, avantBrasD: 32, torse: 6, bassin: 3 }, ms: 70, easing: 'easeOut' },
    { pose: REST, ms: 150, easing: 'easeInOut' },
  ], 140),
  // Bagarre (poings) : double jab rapide.
  bagarre: c([
    { pose: { epauleD: -8, avantBrasD: -10 }, ms: 60, easing: 'easeOut' },
    { pose: { epauleD: 30, avantBrasD: 28, torse: 5 }, ms: 60, easing: 'easeOut' },
    { pose: { epauleG: -8, avantBrasG: -10 }, ms: 60, easing: 'easeOut' },
    { pose: { epauleG: 30, avantBrasG: 28 }, ms: 60, easing: 'easeOut' },
    { pose: REST, ms: 140, easing: 'easeInOut' },
  ], 120),
  // Arc : bande (gauche tend, droite tire), maintien, décoche.
  arc: c([
    { pose: { epauleG: 42, avantBrasG: -6, epauleD: -38, avantBrasD: -28, torse: -4 }, ms: 200, easing: 'easeOut' },
    { pose: { epauleG: 44, epauleD: -44, avantBrasD: -34 }, ms: 120, easing: 'easeInOut' },
    { pose: { epauleG: 40, epauleD: -8, avantBrasD: 6 }, ms: 80, easing: 'easeOut' },
    { pose: REST, ms: 200, easing: 'easeInOut' },
  ], 330),
  // Arbalète : visée à l'horizontale, léger recul.
  arbalete: c([
    { pose: { epauleD: 58, epauleG: 48, avantBrasD: -6, torse: -3 }, ms: 160, easing: 'easeOut' },
    { pose: { epauleD: 50, epauleG: 46, torse: -6, tete: -3 }, ms: 70, easing: 'easeOut' },
    { pose: REST, ms: 190, easing: 'easeInOut' },
  ], 175),
  // Poudre noire : visée, recul sec vers le haut (fumée = FX feedback).
  poudre: c([
    { pose: { epauleD: 64, epauleG: 40, avantBrasD: -4, torse: -3 }, ms: 170, easing: 'easeOut' },
    { pose: { epauleD: 48, avantBrasD: -12, torse: -9, tete: -6 }, ms: 80, easing: 'easeOutBack' },
    { pose: REST, ms: 210, easing: 'easeInOut' },
  ], 185),
  // Fronde : moulinet au-dessus puis lâcher en avant.
  fronde: c([
    { pose: { epauleD: -68, avantBrasD: -40, torse: -5 }, ms: 170, easing: 'easeOut' },
    { pose: { epauleD: 58, avantBrasD: 20, torse: 8 }, ms: 90, easing: 'easeOut' },
    { pose: REST, ms: 220, easing: 'easeInOut' },
  ], 250),
  // Lancer (javelot/couteau) : armé par-dessus l'épaule puis projection avant.
  lancer: c([
    { pose: { epauleD: -50, avantBrasD: -30, torse: -4 }, ms: 140, easing: 'easeOut' },
    { pose: { epauleD: 46, avantBrasD: 18, torse: 9, bassin: 5 }, ms: 90, easing: 'easeOut' },
    { pose: REST, ms: 200, easing: 'easeInOut' },
  ], 240),
  // Entraves (fouet/lasso) : grand arc au-dessus puis claquement.
  entraves: c([
    { pose: { epauleD: -66, avantBrasD: -44, torse: -5 }, ms: 150, easing: 'easeOut' },
    { pose: { epauleD: 54, avantBrasD: 40, torse: 8 }, ms: 90, easing: 'easeOut' },
    { pose: REST, ms: 240, easing: 'easeInOut' },
  ], 240),
  // Explosifs : lancer en cloche (revers bas puis projection).
  explosifs: c([
    { pose: { epauleD: 18, avantBrasD: 30, torse: 6 }, ms: 140, easing: 'easeOut' },
    { pose: { epauleD: -30, avantBrasD: -10, torse: -4 }, ms: 110, easing: 'easeOut' },
    { pose: REST, ms: 200, easing: 'easeInOut' },
  ], 240),
};
ATTACK.ingenierie = ATTACK.poudre; // armes à poudre d'ingénierie : même geste

const TWO_HANDED = new Set(['hast', 'deuxmains', 'cavalerie']);
const RANGED_FAM = new Set(['arc', 'arbalete', 'poudre', 'fronde', 'lancer', 'entraves', 'explosifs', 'ingenierie']);

// --- Gardes de parade ------------------------------------------------------
const SHIELD_PARRY = c([
  { pose: { epauleG: -50, avantBrasG: -40, torse: 4 }, ms: 90, easing: 'easeOut' },
  { pose: REST, ms: 260, easing: 'easeInOut' },
]);
const SWORD_GUARD = c([
  { pose: { epauleD: -46, avantBrasD: -34, torse: 3 }, ms: 90, easing: 'easeOut' },
  { pose: REST, ms: 260, easing: 'easeInOut' },
]);
const STAFF_BLOCK = c([
  { pose: { epauleG: -28, epauleD: -30, torse: 2, arme: -18 }, ms: 90, easing: 'easeOut' },
  { pose: REST, ms: 260, easing: 'easeInOut' },
]);
// Un tireur pris au corps-à-corps esquive plutôt qu'il ne pare.
const RANGED_FLINCH = c([
  { pose: { bassin: -14, torse: -9, tete: -5 }, ms: 110, easing: 'easeOut' },
  { pose: REST, ms: 220, easing: 'easeInOut' },
]);

// --- API -------------------------------------------------------------------
/** Pose portée (repos) selon le Groupe — l'arme est tenue différemment au calme. */
export function carryPose(w?: Weapon): Pose {
  if (!w) return {};
  switch (weaponGroupKey(w)) {
    case 'hast': case 'cavalerie': return { arme: -26, epauleD: 8, avantBrasD: -6 };
    case 'arc': return { epauleD: 12, avantBrasD: 16, arme: 18 };
    case 'arbalete': return { epauleD: 16, avantBrasD: 8 };
    case 'poudre': case 'ingenierie': return { epauleD: 14, avantBrasD: 6 };
    case 'fronde': case 'lancer': case 'entraves': return { epauleD: 10 };
    case 'explosifs': return { epauleD: 8 };
    case 'deuxmains': case 'fleau': return { epauleD: 10, avantBrasD: 8 };
    case 'bagarre': return {};
    default: return { epauleD: 6, avantBrasD: 6 }; // base/escrime/parade
  }
}

/** Geste d'attaque pour l'arme (défaut : base en mêlée, arc à distance). */
export function weaponAttackClip(w?: Weapon): Clip {
  if (!w) return ATTACK.base;
  return ATTACK[weaponGroupKey(w)] ?? (w.type === 'ranged' ? ATTACK.arc : ATTACK.base);
}

/** Geste de parade : bouclier > deux-mains > tireur (esquive) > garde d'arme. */
export function weaponParryClip(w?: Weapon, hasShield = false): Clip {
  if (hasShield) return SHIELD_PARRY;
  if (!w) return SWORD_GUARD;
  const f = weaponGroupKey(w);
  if (TWO_HANDED.has(f)) return STAFF_BLOCK;
  if (RANGED_FAM.has(f)) return RANGED_FLINCH;
  return SWORD_GUARD;
}

/** True si l'arme se manie à distance (geste de tir plutôt que de mêlée). */
export function isRangedFamily(w?: Weapon): boolean {
  return !!w && RANGED_FAM.has(weaponGroupKey(w));
}

/** Bouclier présent dans l'équipement (pour le choix de parade). */
export function hasShieldEquipped(weapons: Weapon[] | undefined, shield: unknown): boolean {
  if (shield) return true;
  return !!weapons?.some((w) => isShield(w));
}
