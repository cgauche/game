import { bodyPlanById } from '../src/gameIso/rig/bodyPlan';
import { creatures } from '../src/data';
// Diagnostic : route chaque créature du bestiaire (par ID de record → espèce explicite) vers son plan.
const by: Record<string, string[]> = {};
for (const c of creatures) { const p = bodyPlanById(c.id); (by[p] ??= []).push(c.label); }
for (const p of Object.keys(by).sort()) console.log(`[${p}] (${by[p].length}) : ${by[p].join(', ')}`);
