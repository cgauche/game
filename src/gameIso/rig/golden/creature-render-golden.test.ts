/**
 * Golden master de RENDU SVG du bestiaire ENTIER — filet anti-régression VISUELLE pour les tranches
 * de-POC qui suivent (carrière, plan non-bipède, mutant…). Là où `creature-resolution-golden` ne fige
 * que la résolution (plan/espèce/def/échelle), celui-ci fige le SVG RÉSOLU bout-en-bout (carrière/tenue,
 * couleurs, parts, props de plan compris). Toute tranche de-POC doit reproduire ces snapshots à
 * l'identique, sinon une créature change d'apparence.
 *
 * Rend chaque entrée de `creatures.json` via le chemin de PROD (bipède = entityRigProfile+resolveRig ;
 * non-bipède = planById(bodyPlanOf).resolve), en `front` et `profile`, seed fixe.
 */
import { describe, it, expect } from 'vitest';
import { creatures } from '../../../data';
import { entityRigProfile } from '../enemyProfile';
import { resolveRig } from '../composeRig';
import { bonesToSvg } from '../renderBones';
import { planById, resolveByName } from '../bodyPlan';
import type { View } from '../facing';

const VIEWS: View[] = ['front', 'profile'];
const SEED = 7;

function renderSvg(name: string, view: View): string {
  const r = resolveByName(name); // résolution data-driven (record/espèce exacte, plus de name-match)
  if (r.kind === 'rig') {
    const p = entityRigProfile(name, SEED);
    return p ? bonesToSvg(resolveRig(p.appearance, p.equip, {}, p.tenue, view, [])) : '∅rig';
  }
  const plan = planById(r.plan);
  if (!plan) return '∅monolithic';
  if (!plan.hasView(r.species, view)) return `∅noview:${view}`;
  return bonesToSvg(plan.resolve(r.species, view, plan.restPose()));
}

describe('golden — rendu SVG du bestiaire entier (anti-régression de-POC apparence)', () => {
  for (const c of creatures)
    for (const view of VIEWS)
      it(`${c.label} / ${view}`, () => {
        expect(renderSvg(c.id, view)).toMatchSnapshot(); // résolution PAR ID (clé d'affichage = label)
      });
});
