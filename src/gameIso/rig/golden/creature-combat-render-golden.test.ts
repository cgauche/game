/**
 * Golden master du rendu COMBAT des bipèdes par le chemin RÉEL de prod (`AnimatedRigToken`) :
 * spawn (`creatureToCombatant`) → `enemyRigProfile` PUIS application des visuels d'ÉTAT du combattant
 * (`combatantAppearance` + `combatantOverlays` = mutations RÉELLES de `c.mutations`, amputations,
 * traits) → SVG. Couvre le chemin SPÉCIFIQUE au combat : équipement synthétisé des traits/PA, tenue
 * data-driven, ET les calques de mutation DATA-DRIVEN (ex. Mutant → trait « Mutation (Cornes
 * asymétriques) » + tirage → cornes + mutation tirée). Filet contre toute régression d'apparence en
 * combat.
 *
 * Non-bipèdes : `enemyRigProfile` renvoie null (rendus par le chemin plan = déjà couvert par
 * `creature-render-golden`) → ignorés ici.
 */
import { describe, it, expect } from 'vitest';
import { creatures } from '../../../data';
import { creatureToCombatant } from '../../../state/spawn';
import { enemyRigProfile } from '../enemyProfile';
import { combatantAppearance, combatantOverlays } from '../parts/combatantVisuals';
import { resolveRig } from '../composeRig';
import { bonesToSvg } from '../renderBones';
import type { View } from '../facing';

const VIEWS: View[] = ['front', 'profile'];

describe('golden — rendu COMBAT (spawn→enemyRigProfile→visuels d’état) du bestiaire bipède', () => {
  for (const cr of creatures) {
    const c = creatureToCombatant(cr, `g-${cr.label}`, { x: 0, y: 0 });
    const prof = enemyRigProfile(c);
    if (!prof) continue; // non-bipède → chemin plan (couvert par creature-render-golden)
    for (const view of VIEWS)
      it(`${cr.label} / ${view}`, () => {
        expect(bonesToSvg(resolveRig(combatantAppearance(prof.appearance, c), prof.equip, {}, prof.tenue, view, combatantOverlays(c)))).toMatchSnapshot();
      });
  }
});
