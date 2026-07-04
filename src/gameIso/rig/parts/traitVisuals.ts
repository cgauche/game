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
import { appendageArt } from './appendages';
import { ARMS } from './monster';
import { pickView } from './types';
import { AILES_FRONT, AILES_BACK, AILES_PROFILE } from './wings';
import { dorsalOverlays } from './dorsal';
import { raceById } from '../races';
import { bipedDef } from '../creatures';
import { baseSpeciesOf } from '../skeletons';
import { hasTraitKey } from '../../../engine/traits/dispatch';

// Cornes de trait = MÊME registre multi-vues que features/monster (repli générique), rendues en 3
// calques view-taggés (comme queue/ailes via dorsalOverlays) → profil balayé, plus de cornes de face.
const CORNES3 = appendageArt('cornes-generique');
const corneOverlay = (v: 'front' | 'back' | 'profile'): RigOverlay =>
  ({ bone: 'tete', svg: `<g data-trait="cornes">${pickView(CORNES3, v)}</g>`, behind: true, view: v });
// Queue de trait (Attaque caudale) : art du fouet dans le registre UNIQUE (`queue-fouet`), rendu ICI
// en DORSAL (profondeur : longue, déborde la hanche) — le mécanisme diffère, PAS la source de l'art.
const QUEUE3 = appendageArt('queue-fouet');
const queueArt = (v: 'front' | 'back' | 'profile') => `<g data-trait="queue">${pickView(QUEUE3, v)}</g>`;
const TENTACULE_BRAS = `<g data-trait="tentacules">${pickView(ARMS['tentacule'], 'front')}</g>`;

/** Calques dérivés des traits du combattant (bipèdes — les plans dessinent les leurs). */
export function traitOverlaysFor(c: Combatant): RigOverlay[] {
  const traits = c.traits ?? [];
  if (!traits.length) return [];
  const d = bipedDef(c.species ?? 'humain');
  const race = raceById(d?.race ?? baseSpeciesOf(c.species ?? 'humain'));
  // La race OU le def créature (perso.features additifs : cornes du Gor/Prophète gris…)
  // peuvent déjà fournir l'appendice — dans les deux cas le trait ne double pas.
  const behindFeats = [...(race.features ?? []), ...(d?.perso?.features ?? [])];
  const hasBehind = (bone: BoneId) => behindFeats.some((f) => f.bone === bone && (f.layer ?? 50) < 0);
  const has = (key: string) => hasTraitKey(traits, key);
  const out: RigOverlay[] = [];
  if (has('cornes') && !hasBehind('tete')) out.push(corneOverlay('front'), corneOverlay('back'), corneOverlay('profile'));
  // Queue et ailes = appendices DORSAUX : règles de vue/profondeur codifiées par dorsalOverlays.
  if (has('attaque-caudale') && !hasBehind('bassin')) {
    out.push(...dorsalOverlays('bassin', { front: queueArt('front'), back: queueArt('back'), profile: queueArt('profile') }));
  }
  if (has('tentacules')) {
    out.push({ bone: 'epauleG', svg: TENTACULE_BRAS, replace: true });
    out.push({ bone: 'mainG', svg: '', replace: true });
  }
  // Vol : sauté si la créature porte déjà des ailes monstrueuses (Furie : ailes de cuir).
  const monsterWings = !!(c.appearance?.monster?.ailes ?? d?.perso?.monster?.ailes);
  if (has('vol') && !monsterWings) {
    out.push(...dorsalOverlays('torse', { front: AILES_FRONT, back: AILES_BACK, profile: AILES_PROFILE }));
  }
  return out;
}
