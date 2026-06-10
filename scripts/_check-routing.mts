import { bodyPlanOf } from '../src/gameIso/rig/bodyPlan';
import { wingSpeciesFromName } from '../src/gameIso/rig/winged/composeWing';
import { quadSpeciesFromName } from '../src/gameIso/rig/quadruped/composeQuad';
for (const n of ['Dragon','Griffon','Pégase','Demigriffon','Cheval','Loup','Ours','Sanglier','Rat géant','Chien','Loup funeste','Rat ogre','Orc','Skaven']) {
  const plan = bodyPlanOf(n);
  const sp = plan==='winged'?wingSpeciesFromName(n):plan==='quadruped'?quadSpeciesFromName(n):'-';
  console.log(`${n.padEnd(16)} -> ${plan.padEnd(11)} ${sp}`);
}
