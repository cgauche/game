/**
 * Modificateurs de combat dérivés de la SCÈNE (obscurité / météo) et empreinte des décors.
 * Source : LDB `14 - _GoBack.md` l.94-116 (météo) / l.107 (obscurité). Vit en `state` (lit la Scène) ;
 * les valeurs sont injectées dans `attackModifiers`/`defenseModifiers` via `env` (cf. combatFlow).
 */
import type { Scene, SceneEntity } from './scene';
import { isIndoor } from './scene';
import { isNight } from '../engine/clock';

export interface SceneCombatMods {
  /** Cible dissimulée (obscurité de nuit ou brouillard) → −20 au tir (LDB 14 l.107). */
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
  const concealed = night || weather === 'brouillard'; // cible dissimulée −20 au tir (l.107)
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

/** La case (x,y) est-elle couverte par l'empreinte (`foot {w,h}`) d'un décor ? Pour la walkability.
 *  Un décor 1×1 (sans `foot`) ne bloque PAS (comportement historique préservé). */
export function entityBlockedAt(scene: Scene, x: number, y: number): boolean {
  return scene.entities.some((e: SceneEntity) => {
    if (e.kind !== 'prop') return false;
    if (!e.foot) return false;
    return x >= e.pos.x && x < e.pos.x + e.foot.w && y >= e.pos.y && y < e.pos.y + e.foot.h;
  });
}
