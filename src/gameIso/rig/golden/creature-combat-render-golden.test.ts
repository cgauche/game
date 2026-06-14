/**
 * Golden master du rendu COMBAT des bipèdes : spawn (`creatureToCombatant`) → `enemyRigProfile` →
 * SVG. Couvre le chemin SPÉCIFIQUE au combat que le render-golden entité ne touche pas : équipement
 * synthétisé des traits/PA, chaîne de carrière (perso/race/detectCareer + isHumanMutant), calques de
 * mutation. Filet pour les tranches de-POC suivantes (carrière `ROLE_CAREERS`, `isMutant`) : tout
 * changement de tenue/apparence en combat casse un snapshot.
 *
 * Non-bipèdes : `enemyRigProfile` renvoie null (rendus par le chemin plan = déjà couvert par
 * `creature-render-golden`) → ignorés ici.
 */
import { describe, it, expect } from 'vitest';
import { creatures } from '../../../data';
import { creatureToCombatant } from '../../../state/spawn';
import { enemyRigProfile } from '../enemyProfile';
import { resolveRig } from '../composeRig';
import { bonesToSvg } from '../renderBones';
import type { View } from '../facing';

const VIEWS: View[] = ['front', 'profile'];

describe('golden — rendu COMBAT (spawn→enemyRigProfile) du bestiaire bipède', () => {
  for (const cr of creatures) {
    const c = creatureToCombatant(cr, `g-${cr.label}`, { x: 0, y: 0 });
    const prof = enemyRigProfile(c);
    if (!prof) continue; // non-bipède → chemin plan (couvert par creature-render-golden)
    for (const view of VIEWS)
      it(`${cr.label} / ${view}`, () => {
        expect(bonesToSvg(resolveRig(prof.appearance, prof.equip, {}, prof.career, view, prof.overlays ?? []))).toMatchSnapshot();
      });
  }
});
