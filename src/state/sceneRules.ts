/**
 * Modificateurs de combat dérivés de la SCÈNE (obscurité / météo) et empreinte des décors.
 * Source : LDB `14 - _GoBack.md` l.94-116 (météo) / l.75 (obscurité, bande Complexe). Vit en `state` (lit la Scène) ;
 * les valeurs sont injectées dans `attackModifiers`/`defenseModifiers` via `env` (cf. combatFlow).
 */
import type { Scene, SceneEntity } from './scene';
import { isIndoor } from './scene';
import { isNight } from '../engine/clock';
import { findPropById } from '../data';

export interface SceneCombatMods {
  /** Cible dissimulée (obscurité de nuit ou brouillard) → −10 au tir, bande Complexe (LDB 14 l.75). */
  concealed: boolean;
  /** Pénalité météo à l'attaque (tempête/neige, l.108-116). */
  attackMod: number;
  /** Pénalité météo à l'esquive (neige épaisse, l.115-116 — « attaquer OU esquiver »). */
  dodgeMod: number;
  /** Libellé court pour l'affichage. */
  label: string;
}

/** Obscurité de la scène (combat + rendu) : extérieur de nuit uniquement (l'intérieur reste éclairé).
 *  Source de l'obscurité = l'HORLOGE (`gameTime`), plus l'ambiance authored (#T1c). Unique dérivation partagée. */
export function sceneIsDark(scene: Pick<Scene, 'ambiance'>, gameTime: number): boolean {
  return !isIndoor(scene) && isNight(gameTime);
}

/** Modificateurs de combat de la scène (obscurité de nuit pilotée par l'horloge + météo). Pluie/clair = aucun (+0, l.94-98). */
export function sceneCombatModifiers(scene: Pick<Scene, 'ambiance' | 'weather'>, gameTime: number): SceneCombatMods {
  const night = sceneIsDark(scene, gameTime);
  const weather = scene.weather ?? 'clair';
  const concealed = night || weather === 'brouillard'; // cible dissimulée : Complexe −10 au tir (l.75)
  let attackMod = 0;
  let dodgeMod = 0;
  let label = '';
  if (weather === 'tempete') {
    attackMod = -20; // mousson / ouragan / blizzard (l.108-109)
    label = 'Tempête';
  } else if (weather === 'neige') {
    attackMod = -20; // haute neige : attaque ET esquive (l.115-116)
    dodgeMod = -20;
    label = 'Neige épaisse';
  } else if (weather === 'brouillard') {
    label = 'Brouillard';
  } else if (night) {
    label = 'Obscurité';
  }
  return { concealed, attackMod, dodgeMod, label };
}

/** Un décor est SOLIDE (objet plein infranchissable : on ne se tient pas DESSUS) si son TYPE le déclare
 *  dans le dataset `props.json` (`solid`). Physique éditable au Codex ; un `ref` ABSENT du dataset =
 *  passable. Couvre combat ET exploration (via `isWalkable`). Le rendu SVG reste au catalogue gameIso. */
export const propIsSolid = (ref: string | undefined): boolean => !!ref && !!findPropById(ref)?.solid;

/** La case (x,y) est-elle couverte par l'empreinte (`foot {w,h}`) d'un décor ? Pour la walkability.
 *  Un décor 1×1 (sans `foot`) ne bloque PAS — SAUF s'il est :
 *   • INTERACTIF (coffre, stèle, dépouille fouillable…) : on ne se tient pas SUR lui, on l'aborde en
 *     case adjacente (exploration P5 comme combat « Ramasser », LDB 13 l.115-116) ; ou
 *   • SOLIDE par son TYPE (`props.json` `solid` : feu de camp, brasero, statue, tonneau…) : objet
 *     plein infranchissable. */
export function entityBlockedAt(scene: Scene, x: number, y: number, z: number): boolean {
  return scene.entities.some((e: SceneEntity) => {
    if (e.kind !== 'prop') return false;
    if ((e.z ?? 0) !== z) return false;
    const solid = propIsSolid(e.ref);
    if (!e.foot && !e.interact && !solid) return false;
    const w = e.foot?.w ?? 1;
    const h = e.foot?.h ?? 1;
    return x >= e.pos.x && x < e.pos.x + w && y >= e.pos.y && y < e.pos.y + h;
  });
}
