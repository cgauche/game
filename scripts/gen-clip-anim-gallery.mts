/**
 * Galerie ANIMÉE (SVG + CSS, pas de GIF) des clips du moteur d'animation : les 9 clips de base
 * (idle/walk/melee/ranged/dodge/parry/hit/fall + cast) joués en boucle sur un rig, plus les
 * clips de sort (bolt arcane / bénédiction divine). Chaque tuile = un rig + des @keyframes CSS
 * par os mobile (cf. _lib-anim-rig). Lancer : npx tsx scripts/gen-clip-anim-gallery.mts
 */
import { writeFileSync } from 'node:fs';
import { resolveRig } from '../src/gameIso/rig/composeRig';
import { DEFS } from '../src/gameIso/sprites';
import { addPose } from '../src/gameIso/rig/poses';
import { CLIPS, sampleClip, clipDuration, type Clip } from '../src/gameIso/rig/anim/clips';
import { spellCastClip } from '../src/gameIso/rig/anim/spellClips';
import { weaponRest } from '../src/gameIso/rig/anim/weaponClips';
import { animatedRig, sampleTimes } from './_lib-anim-rig';
import type { Appearance } from '../src/gameIso/rig/appearance';
import type { Weapon } from '../src/engine/types';
import type { EquipCtx } from '../src/gameIso/rig/parts/equipment';

const N = 16; // échantillons par cycle
const styles: string[] = [];
let uidN = 0;

function tile(label: string, clip: Clip, app: Appearance, equip: EquipCtx, career: string, hold: Record<string, number> = {}, bg = '#1d2230') {
  const dur = Math.max(clipDuration(clip), 1);
  const samples = sampleTimes(dur, N).map((t) => resolveRig(app, equip, addPose(hold, sampleClip(clip, t).pose), career));
  const uid = `k${uidN++}`;
  const { css, svg } = animatedRig(samples, dur, uid);
  styles.push(css);
  return `<figure style="margin:0;text-align:center">
    <svg viewBox="0 0 120 150" width="104" height="130"><defs>${DEFS}</defs><rect width="120" height="150" fill="${bg}"/>${svg}</svg>
    <figcaption style="color:#bcd;font:11px sans-serif">${label}</figcaption></figure>`;
}

const soldat: Appearance = { species: 'Humain', sex: 'M', build: 0.55, seed: 4 };
const sorcier: Appearance = { species: 'Humain', sex: 'F', build: 0.45, seed: 5 };
const epee: Weapon = { name: 'Épée', type: 'melee', damage: '+4', qualities: [] };
const arc: Weapon = { name: 'Arc long', type: 'ranged', damage: '+4', qualities: [] };
const baton: Weapon = { name: 'Bâton', type: 'melee', damage: '+2', qualities: [] };
const eqEpee: EquipCtx = { weapons: [epee], armour: [] };
const eqArc: EquipCtx = { weapons: [arc], armour: [] };
const eqBaton: EquipCtx = { weapons: [baton], armour: [] };
const eqNu: EquipCtx = { weapons: [], armour: [] };

const meleeClips: [string, Clip][] = [
  ['idle', CLIPS.idle], ['walk', CLIPS.walk], ['melee', CLIPS.melee],
  ['dodge', CLIPS.dodge], ['parry', CLIPS.parry], ['hit', CLIPS.hit], ['fall', CLIPS.fall],
];
const rowSoldat = meleeClips.map(([l, c]) => tile(l, c, soldat, l === 'idle' || l === 'walk' ? eqEpee : eqEpee, 'Soldat', weaponRest(epee))).join('');
const rowArc = tile('ranged (arc)', CLIPS.ranged, soldat, eqArc, 'Soldat', weaponRest(arc)).concat(
  tile('cast', CLIPS.cast, sorcier, eqBaton, 'Sorcier', weaponRest(baton)),
  tile('bolt (arcane)', spellCastClip('bolt'), sorcier, eqNu, 'Sorcier', {}, '#231a30'),
  tile('blessing (divin)', spellCastClip('blessing'), sorcier, eqNu, 'Nonne', {}, '#2a2618'),
);

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Clips animés</title>
<style>${styles.join('')}</style></head>
<body style="background:#11141c;padding:18px;margin:0">
<a href="galeries.html" style="color:#8fb6ff;text-decoration:none;font:13px sans-serif">← Galeries</a>
<h1 style="color:#eee;font:18px sans-serif;margin:10px 0 2px">Animations — clips du moteur (SVG/CSS, en boucle)</h1>
<p style="color:#9ab;font:12px sans-serif;margin:0 0 8px">Chaque rig joue son clip en boucle, animé en CSS pur (1 rig + @keyframes par os mobile). Aucun GIF.</p>
<div style="display:flex;flex-wrap:wrap;gap:12px">${rowSoldat}${rowArc}</div>
</body></html>`;
writeFileSync('public/clip-anim-gallery.html', html);
console.log(`OK: public/clip-anim-gallery.html (${uidN} tuiles animées)`);
