/**
 * BUILDER du CHROME D'ÉCRAN d'un jeton de combat (#1176, P3-0f) — ce qui se lit AU-DESSUS du corps :
 * barre de PV, icônes d'états/buffs (« +N » compris), pastille d'état de FIN ; et les trois états
 * d'ALLURE du corps lui-même : fantôme hors Ligne de Vue, jeton hors d'action, cible survolée.
 *
 * Frère de `builders/dynamicMarks`, et même frontière : PUR, camera-free. Ce que cette dérivation
 * rend, c'est ce qu'il y a à MONTRER d'un combattant — jamais où le montrer. La voie affine le peint
 * DANS son jeton (`BodyToken`, par le peintre partagé `TokenChromeMarks`), la voie volumique le peint
 * en overlay projeté au-dessus de la tête de son billboard (`stage/TokenChromeOverlay`) et porte
 * l'allure au MATÉRIAU du quad (`stage/boardPose`).
 *
 * La POPULATION est celle des ÉLÉMENTS DU BUILDER (`builders/tokens`) : les jetons réellement postés,
 * filtres compris — aucune voie ne refait de test de visibilité pour savoir qui porte un chrome.
 */
import { endState, isOutOfAction, type EndState } from '../../engine/conditions';
import type { Combatant } from '../../engine/types';
import { footprintN } from '../../state/footprint';
import type { IconId } from '../../ui/icons';
import { combatantFlags, summarizeEffects } from '../effectIcons';
import { relationColor } from '../teamColors';
import { combatantBodyTopFrac, combatantTokenScale } from '../sizeScale';
import type { MarkCell } from './dynamicMarks';
import type { TokenEl } from './types';

/** Icônes d'états montrées avant le report « +N » (`summarizeEffects`). */
export const CHROME_ICON_MAX = 3;

/** Ce qu'un jeton de combat MONTRE de son combattant. */
export interface TokenChrome {
  /** Barre de PV — `null` pour un engin INERTE (immune) : un objet n'a pas de santé. */
  hp: { current: number; max: number } | null;
  /** Icônes d'états/buffs, déjà tronquées à `CHROME_ICON_MAX`. */
  icons: IconId[];
  /** Surplus d'icônes non montrées. */
  iconsMore: number;
  /** État de FIN (#237) — pastille distincte, ou `null` pour un combattant en état. */
  endState: EndState | null;
  /** Hors Ligne de Vue du tireur actif → corps fantomatique. */
  ghost: boolean;
  /** Hors d'action → corps assombri (et basculé, côté affine). */
  dim: boolean;
  /** Cible courante du joueur (survol) → couleur de relation, sinon `null`. */
  highlight: string | null;
}

/** Ce que la frame sait du CIBLAGE, et rien de plus. */
export interface ChromeCtx {
  /** Combattants hors LdV du tireur actif. */
  ghostIds: ReadonlySet<string>;
  /** Combattant survolé (jeton ou frise), ou `null`. */
  hoveredId: string | null;
}

/** Le chrome d'un COMBATTANT posté. */
export function tokenChrome(c: Combatant, ctx: ChromeCtx): TokenChrome {
  const fx = summarizeEffects(c.conditions, c.activeEffects, CHROME_ICON_MAX, combatantFlags(c));
  return {
    hp: c.inert ? null : c.wounds ?? null,
    icons: fx.visible.map((v) => v.icon),
    iconsMore: fx.moreCount,
    endState: endState(c),
    ghost: ctx.ghostIds.has(c.id),
    dim: isOutOfAction(c),
    highlight: c.id === ctx.hoveredId ? relationColor(c.kind) : null,
  };
}

/** Le chrome d'un couple MONTÉ, porté par sa MONTURE : le corps composite ne montre ni PV ni états —
 *  ceux du cavalier et ceux de la monture se peindraient au même endroit — `tokenChromes` ne poste
 *  donc qu'UNE marque par couple, celle de la monture. */
export function mountChrome(mount: Combatant): TokenChrome {
  return { hp: null, icons: [], iconsMore: 0, endState: endState(mount), ghost: false, dim: isOutOfAction(mount), highlight: null };
}

/** Le chrome d'un jeton posté, avec de quoi le POSER : sa case d'ancrage (coin NO, celle que la marche
 *  fait glisser), le côté de son EMPREINTE et l'échelle de son corps — c'est d'eux que chaque voie tire
 *  le centre du bloc et la hauteur à laquelle la tête arrive (le disque-portrait en vue du dessus se
 *  mesure à l'empreinte ; le billboard, à l'échelle du corps ET à la toise de son gabarit). */
export interface TokenChromeMark extends TokenChrome {
  id: string;
  /** Case d'ANCRAGE (coin NO de l'empreinte) — la position logique, sans glissement. */
  cell: MarkCell;
  /** Côté de l'empreinte, en cases (`footprintN`). */
  n: number;
  /** Multiplicateur de taille du corps (espèce × Taille). */
  scaleK: number;
  /** Où la TÊTE DESSINÉE arrive dans la boîte de corps, en fraction de celle-ci (`combatantBodyTopFrac`). */
  bodyTopFrac: number;
}

/** Les chromes de la frame : UN par jeton posté (combattant, ou monture d'un couple monté). */
export function tokenChromes(tokens: readonly TokenEl[], ctx: ChromeCtx): TokenChromeMark[] {
  const out: TokenChromeMark[] = [];
  for (const tk of tokens) {
    const s = tk.subject;
    const unit = s.kind === 'combatant' ? s.c : s.kind === 'mounted' ? s.mount : null;
    if (!unit?.pos) continue;
    out.push({
      id: unit.id,
      cell: { x: unit.pos.x, y: unit.pos.y, z: tk.cell.z },
      n: footprintN(unit),
      scaleK: combatantTokenScale(unit),
      bodyTopFrac: combatantBodyTopFrac(unit),
      ...(s.kind === 'combatant' ? tokenChrome(s.c, ctx) : mountChrome(unit)),
    });
  }
  return out;
}
