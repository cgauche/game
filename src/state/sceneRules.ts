/**
 * Modificateurs de combat dérivés de la SCÈNE (obscurité / météo) et empreinte des décors.
 * Source : LDB `14 - _GoBack.md` l.76 (tempête) / l.82 (neige) / l.75 (obscurité, bande Complexe). Vit en `state` (lit la Scène) ;
 * les valeurs sont injectées dans `attackModifiers`/`defenseModifiers` via `env` (cf. combatFlow).
 */
import type { Scene, SceneEntity } from './scene';
import { isIndoor } from './scene';
import { isNight } from '../engine/clock';
import { findPropById } from '../data';
import { propDeclaredFoot, propFootTiles } from './footprint';
import { memoByRef } from './sceneMemo';

export interface SceneCombatMods {
  /** Cible dissimulée (obscurité de nuit ou brouillard) → −20 au tir, bande Difficile (LDB 14 l.75). */
  concealed: boolean;
  /** Pénalité météo à l'attaque (tempête l.76 / neige l.82). */
  attackMod: number;
  /** Pénalité météo à l'esquive (neige épaisse, LDB 14 l.82 — « Attaquer ou esquiver »). */
  dodgeMod: number;
  /** Libellé court pour l'affichage. */
  label: string;
}

/** Obscurité de la scène (combat + rendu) : extérieur de nuit uniquement (l'intérieur reste éclairé).
 *  Source de l'obscurité = l'HORLOGE (`gameTime`), plus l'ambiance authored (#T1c). Unique dérivation partagée. */
export function sceneIsDark(scene: Pick<Scene, 'ambiance'>, gameTime: number): boolean {
  return !isIndoor(scene) && isNight(gameTime);
}

/** Modificateurs de combat de la scène (obscurité de nuit pilotée par l'horloge + météo). */
export function sceneCombatModifiers(scene: Pick<Scene, 'ambiance' | 'weather'>, gameTime: number): SceneCombatMods {
  const night = sceneIsDark(scene, gameTime);
  const weather = scene.weather ?? 'clair';
  const concealed = night || weather === 'brouillard'; // cible dissimulée : Difficile −20 au tir (LDB 14 l.75)
  let attackMod = 0;
  let dodgeMod = 0;
  let label = '';
  if (weather === 'tempete') {
    attackMod = -20; // mousson / ouragan / blizzard (LDB 14 l.76)
    label = 'Tempête';
  } else if (weather === 'neige') {
    attackMod = -30; // haute épaisseur de neige : attaque ET esquive (LDB 14 l.82)
    dodgeMod = -30;
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

/** Index O(1) des cases couvertes par une empreinte de décor (`entityBlockedAt`), bâti UNE fois par
 *  identité de `scene.entities` — mêmes règles que la version balayée : décor sans empreinte déclarée
 *  au catalogue = pas bloquant SAUF interactif ou solide (cf. JSDoc `entityBlockedAt` ci-dessous). */
function buildEntityBlockIndex(entities: SceneEntity[]): Set<string> {
  const blocked = new Set<string>();
  for (const e of entities) {
    if (e.kind !== 'prop') continue;
    if (!propDeclaredFoot(e.ref) && !e.interact && !propIsSolid(e.ref)) continue;
    const z = e.z ?? 0;
    for (const t of propFootTiles(e.ref, e.pos)) blocked.add(`${t.x},${t.y},${z}`);
  }
  return blocked;
}
/** Mémoïsé par IDENTITÉ de `scene.entities` (`memoByRef`) — PAS `scene` : `scene` reste souvent la
 *  MÊME réf entre deux rendus (aucun champ ne change), tandis que `entities` est TOUJOURS une
 *  NOUVELLE réf à chaque ajout/retrait en production (`.filter`/`.map`/spread — jamais
 *  `.push`/`.splice` hors fixtures de test) : la clé la plus fine est le tableau lui-même. */
const entityBlockIndex = memoByRef(buildEntityBlockIndex);

/** La case (x,y) est-elle couverte par l'empreinte (`PropData.foot`) d'un décor ? Pour la walkability.
 *  Un décor sans empreinte déclarée au catalogue ne bloque PAS — SAUF s'il est :
 *   • INTERACTIF (coffre, stèle, dépouille fouillable…) : on ne se tient pas SUR lui, on l'aborde en
 *     case adjacente (exploration P5 comme combat « Ramasser », LDB 13 l.115-116) ; ou
 *   • SOLIDE par son TYPE (`props.json` `solid` : feu de camp, brasero, statue, tonneau…) : objet
 *     plein infranchissable. */
export function entityBlockedAt(scene: Scene, x: number, y: number, z: number): boolean {
  return entityBlockIndex(scene.entities).has(`${x},${y},${z}`);
}
