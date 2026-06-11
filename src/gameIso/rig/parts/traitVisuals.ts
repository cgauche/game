/**
 * Visuels dérivés des TRAITS de créature (LDB 85) — COSMÉTIQUE, même canal que les
 * mutations/blessures (combatantVisuals). Couvre les statblocs SANS race dédiée :
 * PNJ custom de l'éditeur (trait « Cornes +6 » → cornes visibles) et traits accordés
 * par SORT (« Envol » → grantTrait Vol → ailes), sans toucher au bestiaire nommé.
 *
 * ANTI-DOUBLON : si la RACE du combattant fournit déjà une feature `behind` sur l'os
 * visé (cornes du Gor/Minotaure/Démon en tete(-2), queue du Skaven/Fimir en bassin(-2)),
 * le visuel de trait est sauté — la race fait foi.
 */
import type { Combatant } from '../../../engine/types';
import type { RigOverlay, BoneId } from '../bones';
import { OV_CORNES, OV_QUEUE } from './monstrous';
import { ARMS } from './monster';
import { pickView } from './types';
import { AILES_FRONT, AILES_BACK, AILES_PROFILE } from './wings';
import { raceById } from '../races';
import { baseSpeciesOf } from '../skeletons';

const CORNES = `<g data-trait="cornes">${OV_CORNES}</g>`;
const QUEUE = `<g data-trait="queue">${OV_QUEUE}</g>`;
const TENTACULE_BRAS = `<g data-trait="tentacules">${pickView(ARMS['tentacule'], 'front')}</g>`;

/** Calques dérivés des traits du combattant (bipèdes — les plans dessinent les leurs). */
export function traitOverlaysFor(c: Combatant): RigOverlay[] {
  const traits = c.traits ?? [];
  if (!traits.length) return [];
  const race = raceById(baseSpeciesOf(c.species ?? 'Humain'));
  const raceHasBehind = (bone: BoneId) => (race.features ?? []).some((f) => f.bone === bone && (f.layer ?? 50) < 0);
  const has = (re: RegExp) => traits.some((t) => re.test(t.trim()));
  const out: RigOverlay[] = [];
  if (has(/^cornes?\b/i) && !raceHasBehind('tete')) out.push({ bone: 'tete', svg: CORNES, behind: true });
  if (has(/^attaque caudale\b/i) && !raceHasBehind('bassin')) out.push({ bone: 'bassin', svg: QUEUE, behind: true });
  if (has(/^(\d+\s+)?tentacules?\b/i)) {
    out.push({ bone: 'epauleG', svg: TENTACULE_BRAS, replace: true });
    out.push({ bone: 'mainG', svg: '', replace: true });
  }
  if (has(/^vol\b/i)) {
    out.push({ bone: 'torse', svg: AILES_FRONT, behind: true, view: 'front' });
    out.push({ bone: 'torse', svg: AILES_BACK, view: 'back' });
    out.push({ bone: 'torse', svg: AILES_PROFILE, behind: true, view: 'profile' });
  }
  return out;
}
