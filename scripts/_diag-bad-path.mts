/** Diagnostic : repère les chemins SVG malformés (Q/C/L sans assez de coords) dans le rendu
 *  PROFIL des créatures non-bipèdes. Imprime créature + le fragment fautif. npx tsx scripts/_diag-bad-path.mts */
import { planById, bodyPlanOf, type BodyPlanId } from '../src/gameIso/rig/bodyPlan';
import { creatureMatch } from '../src/gameIso/rig/creatures';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { creatures } from '../src/data/index';

// Un Q exige 4 nombres, un C 6, un L/M/T 2. On détecte un Q suivi de < 4 nombres avant la prochaine lettre.
function badSegments(d: string): string[] {
  const bad: string[] = [];
  // tokenise commande + nombres
  const re = /([MLHVCSQTAZmlhvcsqtaz])([^MLHVCSQTAZmlhvcsqtaz]*)/g;
  let m: RegExpExecArray | null;
  const need: Record<string, number> = { Q: 4, T: 2, C: 6, S: 4, L: 2, M: 2, A: 7, H: 1, V: 1 };
  while ((m = re.exec(d))) {
    const cmd = m[1].toUpperCase();
    if (cmd === 'Z') continue;
    const nums = (m[2].match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).filter((x) => x !== '');
    const k = need[cmd];
    if (k && nums.length % k !== 0) bad.push(`${m[1]}${m[2]}`.trim().slice(0, 40));
  }
  return bad;
}

for (const c of creatures) {
  const id = bodyPlanOf(c.label);
  if (id === 'monolithic' || id === 'biped') continue;
  const plan = planById(id as BodyPlanId);
  const species = creatureMatch(c.label)?.name ?? plan.speciesNames()[0] ?? '';
  for (const view of ['profile', 'front'] as const) {
    const svg = bonesToSvg(plan.resolve(species, view, plan.restPose(), {}));
    const paths = svg.match(/ d="([^"]*)"/g) ?? [];
    for (const p of paths) {
      const d = p.slice(4, -1);
      const bad = badSegments(d);
      if (bad.length) console.log(`${c.label} [${id}/${view}] :: ${bad.join(' | ')}`);
    }
  }
}
console.log('--- fin ---');
