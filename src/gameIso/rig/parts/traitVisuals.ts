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
import { OV_CORNES } from './monstrous';
import { ARMS } from './monster';
import { pickView } from './types';
import { AILES_FRONT, AILES_BACK, AILES_PROFILE } from './wings';
import { dorsalOverlays } from './dorsal';
import { raceById } from '../races';
import { bipedDef } from '../creatures';
import { baseSpeciesOf } from '../skeletons';

const CORNES = `<g data-trait="cornes">${OV_CORNES}</g>`;
// Queue de trait : LONGUE et débordant la hanche (sinon, cachée derrière le bassin, elle
// est invisible de face) — fouet de chair terminé par une touffe de poils. De PROFIL elle
// part vers −x (le dos), pas toujours à droite.
const QUEUE = '<g data-trait="queue">'
  + '<path d="M0 2 Q14 7 19 17 Q22 26 17 31 Q20 23 13 18 Q5 13 0 10 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
  + '<path d="M3 6 Q12 11 16 19" stroke="@peauO" stroke-width="0.5" fill="none" opacity="0.6"/>'
  + '<path d="M17 31 q5 1.4 4.6 6 q-5 -0.4 -6.6 -4.2 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>'
  + '</g>';
const QUEUE_PROFILE = '<g data-trait="queue">'
  + '<path d="M-2 2 Q-15 6 -20 15 Q-23 24 -18 29 Q-21 21 -14 17 Q-6 12 -2 9 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
  + '<path d="M-5 6 Q-13 10 -17 17" stroke="@peauO" stroke-width="0.5" fill="none" opacity="0.6"/>'
  + '<path d="M-18 29 q-5 1.4 -4.6 6 q5 -0.4 6.6 -4.2 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>'
  + '</g>';
const TENTACULE_BRAS = `<g data-trait="tentacules">${pickView(ARMS['tentacule'], 'front')}</g>`;

/** Calques dérivés des traits du combattant (bipèdes — les plans dessinent les leurs). */
export function traitOverlaysFor(c: Combatant): RigOverlay[] {
  const traits = c.traits ?? [];
  if (!traits.length) return [];
  const d = bipedDef(c.species ?? 'Humain');
  const race = raceById(d?.race ?? baseSpeciesOf(c.species ?? 'Humain'));
  // La race OU le def créature (perso.features additifs : cornes du Gor/Prophète gris…)
  // peuvent déjà fournir l'appendice — dans les deux cas le trait ne double pas.
  const behindFeats = [...(race.features ?? []), ...(d?.perso?.features ?? [])];
  const hasBehind = (bone: BoneId) => behindFeats.some((f) => f.bone === bone && (f.layer ?? 50) < 0);
  const has = (re: RegExp) => traits.some((t) => re.test(t.trim()));
  const out: RigOverlay[] = [];
  if (has(/^cornes?\b/i) && !hasBehind('tete')) out.push({ bone: 'tete', svg: CORNES, behind: true });
  // Queue et ailes = appendices DORSAUX : règles de vue/profondeur codifiées par dorsalOverlays.
  if (has(/^attaque caudale\b/i) && !hasBehind('bassin')) {
    out.push(...dorsalOverlays('bassin', { front: QUEUE, back: QUEUE, profile: QUEUE_PROFILE }));
  }
  if (has(/^(\d+\s+)?tentacules?\b/i)) {
    out.push({ bone: 'epauleG', svg: TENTACULE_BRAS, replace: true });
    out.push({ bone: 'mainG', svg: '', replace: true });
  }
  // Vol : sauté si la créature porte déjà des ailes monstrueuses (Furie : ailes de cuir).
  const monsterWings = !!(c.appearance?.monster?.ailes ?? d?.perso?.monster?.ailes);
  if (has(/^vol\b/i) && !monsterWings) {
    out.push(...dorsalOverlays('torse', { front: AILES_FRONT, back: AILES_BACK, profile: AILES_PROFILE }));
  }
  return out;
}
