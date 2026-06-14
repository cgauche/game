/**
 * QC du rendu « cavalier en selle » : compose la MONTURE (Cheval, gabarit quadrupède) + le CAVALIER
 * (rig humanoïde) avec EXACTEMENT la même géométrie que l'IsoStage (mêmes échelles + offset de selle),
 * et rastérise en PNG — pour juger l'offset de selle hors navigateur.
 *   npx tsx scripts/_qc-monture.mts → public/qc/monture/*.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { resolveRig, type ResolvedBone } from '../src/gameIso/rig/composeRig';
import { bonesToSvg } from '../src/gameIso/rig/renderBones';
import { DEFS } from '../src/gameIso/sprites';
import { addPose } from '../src/gameIso/rig/poses';
import { CLIPS, sampleClip } from '../src/gameIso/rig/anim/clips';
import { entityRigProfile } from '../src/gameIso/rig/enemyProfile';
import { planById, bodyPlanOf, type BodyPlanId } from '../src/gameIso/rig/bodyPlan';
import { creatureMatch, creatureSpeciesScale, bipedSpeciesScale } from '../src/gameIso/rig/creatures';
import { mul, type Matrix } from '../src/gameIso/rig/kinematics';
import { sizeTokenScale } from '../src/gameIso/sizeScale';

type View = 'front' | 'profile';

/** Os NATIFS d'une créature (gabarit), pose de repos — comme l'IsoStage (pas de pré-fit). */
function mountBones(name: string, view: View): ResolvedBone[] {
  const plan = planById(bodyPlanOf(name) as BodyPlanId);
  const species = creatureMatch(name)?.name ?? plan.speciesNames()[0] ?? '';
  const pose = plan.idlePose ? plan.idlePose(0) : plan.restPose();
  return plan.resolve(species, view, pose, {});
}
/** Pose d'ÉQUITATION (assis à califourchon) : bassin abaissé, cuisses vers l'avant le long du barillet
 *  de la monture, genoux pliés (tibias en arrière) → les jambes drapent l'avant du flanc, pieds aux
 *  étriers ; léger penché en avant. Angles : cuisse>0 = avant, tibia<0 = genou plié (ambientClips l.6). */
const RIDING_POSE: Record<string, number> = { bassin: -6, torse: 8, tete: -6, cuisseG: 58, cuisseD: 50, tibiaG: -64, tibiaD: -58, piedG: 18, piedD: 14, epauleG: 8, epauleD: -8 };

/** Os NATIFS d'un humanoïde riggé (cavalier). `riding` → pose d'équitation, sinon idle (debout). */
function riderBones(name: string, view: View, riding: boolean): ResolvedBone[] {
  const p = entityRigProfile(name, 7)!;
  const pose = riding ? addPose({}, RIDING_POSE) : addPose({}, sampleClip(CLIPS.idle, 0).pose);
  return resolveRig(p.appearance, p.equip, pose, p.tenue, view, p.overlays);
}

/** Place des os via la géométrie BodyToken (pieds en (ax,ay), échelle s) — identique à l'IsoStage. */
function place(bones: ResolvedBone[], s: number, ax: number, ay: number): ResolvedBone[] {
  const M: Matrix = [s, 0, 0, s, ax - 60 * s, ay - 150 * s];
  return bones.map((b) => ({ ...b, matrix: mul(M, b.matrix) }));
}

mkdirSync('public/qc/monture', { recursive: true });

const W = 300, H = 300, cx = 150, cyMount = 255;
const MOUNT = 'Cheval';
const mountScale = 0.62 * creatureSpeciesScale(MOUNT) * sizeTokenScale('grande');

let uid = 0;
/**
 * @param seatFrac  fraction de la hauteur de la monture où se trouve la SELLE (≈ ligne du dos).
 * @param sinkFrac  enfoncement du cavalier sous la selle (pour que le BASSIN, pas les pieds, repose
 *                  sur le dos — le bas du corps passe DERRIÈRE le corps du cheval, masqué par occlusion).
 */
/**
 * @param seatFrac fraction de la hauteur de la monture où se trouve la SELLE (≈ ligne du dos).
 * @param seatY    fraction de la HAUTEUR DU CAVALIER posé sous la selle (bassin sur le dos).
 */
/** Os de la jambe LOINTAINE (en profil) — dessinés DERRIÈRE le corps de la monture. `farSide` = 'G'|'D'. */
const farLeg = (b: ResolvedBone, farSide: 'G' | 'D') => new RegExp(`(cuisse|tibia|pied)${farSide}$`).test(b.id);

function pair(rider: string, view: View, seatFrac: number, seatDrop: number, riding: boolean, split: boolean): string {
  const riderScale = 0.62 * bipedSpeciesScale(rider) * sizeTokenScale('moyenne') * 0.85;
  const saddleY = cyMount - seatFrac * 150 * mountScale; // ligne de selle (dos de la monture, px écran)
  const riderFeetY = saddleY + seatDrop * 150 * riderScale; // ancre du rig sous la selle → bassin sur le dos
  const mb = place(mountBones(MOUNT, view), mountScale, cx, cyMount);
  const rb = place(riderBones(rider, view, riding), riderScale, cx, riderFeetY);
  // Scission en PROFONDEUR : jambe lointaine derrière la monture, le reste devant → cavalier À CHEVAL.
  const behind = split && view === 'profile' ? rb.filter((b) => farLeg(b, 'G')) : [];
  const front = split && view === 'profile' ? rb.filter((b) => !farLeg(b, 'G')) : rb;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`
    + `<defs>${DEFS}</defs><rect width="${W}" height="${H}" fill="#1a1f2b"/>`
    + `<line x1="20" y1="${saddleY}" x2="${W - 20}" y2="${saddleY}" stroke="#556" stroke-dasharray="3 4" />`
    + bonesToSvg(behind) + bonesToSvg(mb) + bonesToSvg(front)
    + `<text x="8" y="18" fill="#cdd" font-family="sans-serif" font-size="13">${rider} — ${view} — ${riding ? 'équitation' : 'debout'}${split ? ' +SCISSION' : ''} — drop ${seatDrop.toFixed(2)}</text>`
    + `</svg>`;
}

const shots: Array<[string, () => string]> = [
  ['split-a', () => pair('Soldat', 'profile', 0.50, 0.18, true, true)],
  ['split-b', () => pair('Soldat', 'profile', 0.46, 0.10, true, true)],
  ['split-nopose', () => pair('Soldat', 'profile', 0.50, 0.30, false, true)],
  ['split-mutant', () => pair('Mutant', 'profile', 0.50, 0.18, true, true)],
];
for (const [id, make] of shots) {
  const png = new Resvg(make(), { fitTo: { mode: 'width', value: 600 } }).render().asPng();
  writeFileSync(`public/qc/monture/${id}.png`, png);
}
console.log(`OK: ${shots.length} rendus → public/qc/monture/ (mountScale=${mountScale.toFixed(2)})`);
