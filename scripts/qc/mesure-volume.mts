/**
 * MESURE DE VOLUME DU RIG — harnais CANONIQUE du contrat d'art (écart de luminance sur le
 * rendu COMPOSÉ). Artiste et juge invoquent CE fichier ; aucun script de mesure jetable.
 *
 *   npx tsx scripts/qc/mesure-volume.mts <tenueId> [--slot bras] [--views front,profile,back]
 *                                        [--json] [--with-flesh] [--no-erode]
 *   npx tsx scripts/qc/mesure-volume.mts --all [--ids <a,b,c>] [--slot bras] [--views …] [--json] …
 *     (sweep de tout `SPECIFIC_TENUES` — mêmes réglages/métriques que le mode mono, ligne par
 *     tenue×vue. `--ids` restreint le sweep à une liste explicite, pour découper en tranches.)
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * DÉFINITION DU MASQUE (il n'en existe qu'une — toute divergence de chiffre vient d'ici)
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * 1. RIG DE RÉFÉRENCE figé et déterministe : Humain M, build 0.55, seed 4, pose de repos,
 *    aucune arme ni armure (`REF_APPEARANCE` / `REF_EQUIP`). Même rig que la galerie
 *    `scripts/gen-tenue-views-gallery.mts`. viewBox 120×150, rendu à `RENDER_W` px de large
 *    (`PX_PER_U` px par unité SVG).
 * 2. OS DU SLOT : `SLOT_BONES[slot]` (`src/gameIso/rig/bones.ts`). L'art d'un slot est porté
 *    ENTIÈREMENT par ces os (composeRig.tsx l.184-195) : le slot `bras` = `epauleG`+`epauleD`.
 * 3. VISIBILITÉ RÉELLE : un pixel n'entre dans le masque que si la couleur RGB du rendu
 *    COMPOSÉ y égale exactement celle du rendu des SEULS os du masque. L'occlusion (par le
 *    torse, une cape, une arme) sort donc du masque — on ne mesure que ce qui se voit.
 * 4. CHAIR EXCLUE PAR DÉFAUT. Une tenue n'habille pas la chair de son porteur : elle ne peut
 *    pas lui emprunter son volume. Les os `mainG`/`mainD`/`piedG`/`piedD` (`FLESH_BONES`)
 *    restent HORS masque. `--with-flesh` adjoint au slot sa chair terminale
 *    (`SLOT_FLESH`) — la sortie porte alors la mention `chair=INCLUSE`.
 * 5. ÉROSION PAR DÉFAUT de `ERODE_U` unité SVG (chebyshev, 8-voisins, `ERODE_PX` itérations
 *    d'un pixel). Le cerne n'est pas du volume : un cerne de 0,7 u ne pèse que 0,19 px sur un
 *    token de 40 px, mais il domine les extrêmes de luminance. `--no-erode` le désactive.
 * 6. Chaque nombre rendu porte les trois réglages qui l'ont produit (masque, érosion, chair).
 *
 * MÉTRIQUES, par vue :
 *  - P90 / P10 / P90−P10 de luminance Rec.709 ramenée sur 0..100 (échelle du contrat).
 *  - Part claire : % des pixels du masque au-dessus de la mi-distance entre la valeur de BASE
 *    de la matière dominante (jeton `@vetN`/`@cuir`/… résolu) et sa valeur de LUMIÈRE (`…H`).
 *    Diagnostic le plus robuste : un P90 posé exactement sur la valeur de base = aucune
 *    surface éclairée.
 *  - Composantes connexes (8-voisins) de la figure ENTIÈRE : une masse détachée est un défaut
 *    bloquant. bbox des surnuméraires en unités SVG.
 *  - Séparation slot↔torse : |ΔL| sur les pixels de frontière (médiane et p10). Un p10 à 0
 *    signifie qu'une part de la frontière n'a aucune différence de valeur.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * CONTRAT (ÉNONCÉ UNIQUE — le harnais RÉFUTE, il ne certifie JAMAIS)
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * Une vue mesurable (matière trouvée, masque non vide) est réfutée (`ECHEC`) si sa palette est
 * SAINE (`lLumiere > lBase`) ET que l'une des conditions suivantes tient — CONJONCTION
 * écart∧part-claire, ancrée sur la palette :
 *  - écart P90−P10 < `CONTRAT_ECART_MIN` — pas assez de plage de luminance ;
 *  - part claire   < `CONTRAT_CLAIR_MIN` — aucune surface franchement éclairée ;
 *  - `p90SurBase` (« ancrage ») — le P90 est posé exactement sur la valeur de base, cause
 *    explicite même si `CONTRAT_CLAIR_MIN` la subsume déjà (diagnostic le plus lisible).
 * Palette INVERSÉE (`lLumiere <= lBase`) → `ECHEC palette inversée` à part : le contrat y est
 * inexprimable, c'est un défaut de DONNÉE, pas de rendu — les trois causes ci-dessus ne
 * s'évaluent PAS dans ce cas. Matière introuvable ou masque vide → `NON MESURABLE` : ni succès
 * ni échec, à instruire par un juge, n'affecte PAS l'exit code. Sinon → `NON-REFUTE` — jamais
 * « BON » : le harnais ne voit qu'un histogramme de pixels, jamais le rendu ; le verdict humain
 * vient d'un juge qui a REGARDÉ l'image (#635).
 */
import { inflateSync } from 'node:zlib';
import { Resvg } from '@resvg/resvg-js';
import { resolveRig, type ResolvedBone } from '../../src/gameIso/rig/composeRig';
import { toSvg } from '../../src/gameIso/rig/kinematics';
import { SLOT_BONES, type BoneId, type Slot } from '../../src/gameIso/rig/bones';
import { buildTokenMap } from '../../src/gameIso/rig/palette';
import { DEFS } from '../../src/gameIso/sprites';
import { TENUE_BY_ID, TENUE_PALETTE_BY_ID, SPECIFIC_TENUES, CLASS_TENUE_BY_ID } from '../../src/gameIso/rig/parts/tenues';
import { slugId } from '../../src/data/slug';
import type { Appearance, RigSpeciesId } from '../../src/gameIso/rig/appearance';
import type { View } from '../../src/gameIso/rig/facing';

// ── Rig de référence (figé) ───────────────────────────────────────────────────────────────
const REF_APPEARANCE: Appearance = { species: 'Humain' as RigSpeciesId, sex: 'M', build: 0.55, seed: 4 };
const REF_EQUIP = { weapons: [], armour: [] };
const VB_W = 120, VB_H = 150;
const RENDER_W = 480;
const PX_PER_U = RENDER_W / VB_W;
const RENDER_H = Math.round(VB_H * PX_PER_U);
/** Érosion du masque, en unités SVG. Le cerne d'une part fait ~0,7 u. */
const ERODE_U = 1;
const ERODE_PX = Math.round(ERODE_U * PX_PER_U);
/** Opacité minimale pour qu'un pixel COMPTE dans un masque de mesure (couleur fiable). */
const ALPHA_MIN = 200;
/** Opacité minimale pour la CONNEXITÉ de la figure — un vrai détachement laisse du fond pur. */
const ALPHA_FIG = 8;

/** Seuils du CONTRAT (section CONTRAT ci-dessus) — trou empirique mesuré [8,4 ; 12,0] sur 163
 *  vues à écart ≥ 30, sweep 2026-07-20 (#635) ; ≥ 10 subsume l'ancrage P90=base (P90 sur la
 *  base ⇒ < 10 % des pixels au-dessus du seuil clair). */
const CONTRAT_ECART_MIN = 30;
const CONTRAT_CLAIR_MIN = 10;

/** Os de CHAIR — jamais dans un masque de tenue sans `--with-flesh`. */
const FLESH_BONES: BoneId[] = ['mainG', 'mainD', 'piedG', 'piedD'];
/** Chair TERMINALE adjointe à un slot par `--with-flesh`. */
const SLOT_FLESH: Partial<Record<Slot, BoneId[]>> = {
  bras: ['mainG', 'mainD'],
  jambes: ['piedG', 'piedD'],
};

// ── CLI ───────────────────────────────────────────────────────────────────────────────────
const USAGE = 'usage: npx tsx scripts/qc/mesure-volume.mts (<tenueId> | --all [--ids a,b,c]) [--slot bras] [--views front,profile,back] [--json] [--with-flesh] [--no-erode]';
const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(n);
function opt(n: string): string | undefined {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : undefined;
}
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--slot', '--views', '--ids'].includes(argv[i - 1])));
const tenueArg = positional[0];
const allMode = flag('--all');
const slot = (opt('--slot') ?? 'bras') as Slot;
const views = (opt('--views') ?? 'front,profile,back').split(',').map((v) => v.trim()) as View[];
const asJson = flag('--json');
const withFlesh = flag('--with-flesh');
const erode = !flag('--no-erode');
const idsArg = opt('--ids');

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}
if (tenueArg && allMode) die(`${USAGE}\n--all et <tenueId> sont exclusifs.`);
if (!tenueArg && !allMode) die(USAGE);
if (idsArg && !allMode) die(`${USAGE}\n--ids nécessite --all.`);
if (!SLOT_BONES[slot]) die(`slot inconnu: ${slot} — attendus: ${Object.keys(SLOT_BONES).join(', ')}`);
for (const v of views) if (!['front', 'profile', 'back'].includes(v)) die(`vue inconnue: ${v} — attendues: front, profile, back`);

// `tenueId` est un ID (slugId), jamais un libellé : un lookup par libellé replie silencieusement
// sur la tenue citadins (incident corrigé en a1fcfe6c).
if (!allMode && !TENUE_BY_ID[tenueArg]) {
  const asId = slugId(tenueArg);
  if (TENUE_BY_ID[asId]) die(`« ${tenueArg} » est un LIBELLÉ, pas un id. Relancer avec l'id : ${asId}`);
  if (CLASS_TENUE_BY_ID[asId]) die(`« ${tenueArg} » est un ARCHÉTYPE DE CLASSE (repli), pas une tenue spécifique — le harnais mesure les tenues de \`SPECIFIC_TENUES\`.`);
  const near = SPECIFIC_TENUES.filter((t) => t.id.includes(asId.slice(0, 5)) || asId.includes(t.id.slice(0, 5))).slice(0, 6);
  die(`tenue inconnue: ${tenueArg}` + (near.length ? `\nproches: ${near.map((t) => `${t.id} (${t.label})`).join(', ')}` : `\n${SPECIFIC_TENUES.length} tenues disponibles.`));
}

/** Liste des tenues à mesurer — 1 en mode mono, N en `--all` (bornée par `--ids`). */
let tenueIds: string[];
if (allMode) {
  if (idsArg) {
    tenueIds = idsArg.split(',').map((s) => s.trim()).filter(Boolean);
    for (const id of tenueIds) if (!SPECIFIC_TENUES.some((t) => t.id === id)) die(`id inconnu pour --ids: ${id}`);
  } else {
    tenueIds = SPECIFIC_TENUES.map((t) => t.id);
  }
} else {
  tenueIds = [tenueArg];
}
const tenueLabelOf = (id: string) => SPECIFIC_TENUES.find((t) => t.id === id)?.label ?? id;

const maskBones = new Set<BoneId>([
  ...SLOT_BONES[slot],
  ...(withFlesh ? SLOT_FLESH[slot] ?? [] : []),
]);
const slotIsFlesh = SLOT_BONES[slot].every((b) => FLESH_BONES.includes(b));
if (!withFlesh) for (const b of FLESH_BONES) if (!slotIsFlesh) maskBones.delete(b);

// ── PNG (RGBA 8-bit, sortie resvg) ────────────────────────────────────────────────────────
interface Img { w: number; h: number; data: Buffer }
function decodePng(buf: Buffer): Img {
  let off = 8, w = 0, h = 0;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6) throw new Error(`attendu RGBA 8-bit, reçu depth=${data[8]} color=${data[9]}`);
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? cur[x - 4] : 0, b = prev[x], c = x >= 4 ? prev[x - 4] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = v & 0xff;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { w, h, data: out };
}

/** Luminance Rec.709 ramenée sur 0..100 — l'échelle du contrat (jamais 0..255). */
const lum = (r: number, g: number, b: number) => ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255) * 100;

// ── Rendu ─────────────────────────────────────────────────────────────────────────────────
const boneGroup = (b: ResolvedBone) =>
  `<g transform="${toSvg(b.matrix)}"><g transform="scale(${b.scale[0].toFixed(4)},${b.scale[1].toFixed(4)})">` +
  b.parts.map((p) => (p.mirror ? `<g transform="scale(-1,1)">${p.svg}</g>` : `<g>${p.svg}</g>`)).join('') +
  '</g></g>';

/** Un `<defs>` local (dégradé de chair par instance) est monté sur un os ; il doit rester présent
 *  dans un rendu ISOLÉ, sinon les parts qui le référencent changent de couleur et l'égalité
 *  composé⇄isolé (règle 3 du masque) échoue à tort. */
const defsOnly = (b: ResolvedBone): ResolvedBone => ({ ...b, parts: b.parts.filter((p) => p.svg.trimStart().startsWith('<defs')) });

function renderPng(bones: ResolvedBone[], keep: (id: string) => boolean): Img {
  const body = bones
    .map((b) => (keep(b.id) ? b : defsOnly(b)))
    .filter((b) => b.parts.length > 0)
    .map(boneGroup)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} ${VB_H}" width="${VB_W}" height="${VB_H}"><defs>${DEFS}</defs>${body}</svg>`;
  return decodePng(Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: RENDER_W }, font: { loadSystemFonts: true } }).render().asPng()));
}

// ── Outils masque ─────────────────────────────────────────────────────────────────────────
const N8 = [-1, 0, 1];
function erodeMask(m: Uint8Array, w: number, h: number, iters: number): Uint8Array {
  let cur = m;
  for (let k = 0; k < iters; k++) {
    const next = new Uint8Array(cur.length);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!cur[i]) continue;
      let ok = 1;
      for (const dy of N8) for (const dx of N8) if (!cur[(y + dy) * w + (x + dx)]) ok = 0;
      next[i] = ok;
    }
    cur = next;
  }
  return cur;
}
function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/** Matière dominante du masque : famille de jeton (base + ombre + lumière) qui couvre le plus de
 *  pixels. Compter la seule BASE désigne la mauvaise matière dès qu'une nappe d'ombre en recouvre
 *  la moitié (cas du dos de manche : la base de robe passait sous le cuir du poignet).
 *  Donne le seuil de « part claire » = mi-distance base↔lumière (`…H`). */
function dominantMaterial(tmap: Record<string, string>, counts: Map<string, number>) {
  const fams = [...new Set(Object.keys(tmap).map((k) => k.replace(/(O|H)$/, '')))];
  let best: { fam: string; hits: number } | null = null;
  for (const fam of fams) {
    const hex = tmap[fam]?.toLowerCase();
    if (!hex || !tmap[`${fam}H`]) continue;
    const hits = ['', 'O', 'H'].reduce((s, suf) => s + (counts.get((tmap[fam + suf] ?? '').toLowerCase()) ?? 0), 0);
    if (!best || hits > best.hits) best = { fam, hits };
  }
  if (!best || best.hits === 0) return null;
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  const lBase = lum(...rgb(tmap[best.fam]));
  const lHi = lum(...rgb(tmap[`${best.fam}H`]));
  return { fam: best.fam, lBase, lHi, seuil: (lBase + lHi) / 2 };
}

// ── Verdict (le CONTRAT ci-dessus, en code) ─────────────────────────────────────────────────
type Verdict = 'NON MESURABLE' | 'ECHEC' | 'NON-REFUTE';
function computeVerdict(v: {
  pixels: number; matiere: string | null; lBase: number | null; lLumiere: number | null;
  ecart: number; partClaire: number | null; p90SurBase: boolean;
}): { verdict: Verdict; raisons: string[] } {
  if (v.matiere === null || v.pixels === 0) return { verdict: 'NON MESURABLE', raisons: [] };
  if (v.lLumiere !== null && v.lBase !== null && v.lLumiere <= v.lBase) return { verdict: 'ECHEC', raisons: ['palette inversée'] };
  const raisons: string[] = [];
  if (v.ecart < CONTRAT_ECART_MIN) raisons.push('écart');
  if (v.partClaire !== null && v.partClaire < CONTRAT_CLAIR_MIN) raisons.push('part claire');
  if (v.p90SurBase) raisons.push('ancrage');
  return raisons.length ? { verdict: 'ECHEC', raisons } : { verdict: 'NON-REFUTE', raisons: [] };
}

// ── Mesure ────────────────────────────────────────────────────────────────────────────────
interface ViewReport {
  view: View;
  pixels: number;
  p90: number; p10: number; ecart: number;
  matiere: string | null; lBase: number | null; lLumiere: number | null; seuilClair: number | null; partClaire: number | null;
  p90SurBase: boolean;
  composantes: number;
  surnumeraires: { pixels: number; bbox: [number, number, number, number] }[];
  sepMediane: number | null; sepP10: number | null;
  verdict: Verdict;
  raisons: string[];
}

/** Mesure UNE tenue×vue. Paramétrée par `tenueId`/`tmap` — aucune variable globale, la définition
 *  du masque et les métriques restent identiques mode mono ↔ `--all`. */
function measure(tenueId: string, tmap: Record<string, string>, view: View): ViewReport {
  const bones = resolveRig(REF_APPEARANCE, REF_EQUIP, {}, tenueId, view, [], false);
  const comp = renderPng(bones, () => true);
  const solo = renderPng(bones, (id) => maskBones.has(id as BoneId));
  const torso = renderPng(bones, (id) => id === 'torse');
  const { w, h } = comp;

  const sameAsComposite = (img: Img): Uint8Array => {
    const m = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      if (img.data[o + 3] < ALPHA_MIN || comp.data[o + 3] < ALPHA_MIN) continue;
      if (img.data[o] === comp.data[o] && img.data[o + 1] === comp.data[o + 1] && img.data[o + 2] === comp.data[o + 2]) m[i] = 1;
    }
    return m;
  };
  const rawMask = sameAsComposite(solo);
  const torsoMask = sameAsComposite(torso);
  const mask = erode ? erodeMask(rawMask, w, h, ERODE_PX) : rawMask;

  // Luminances + histogramme de couleurs exactes du masque.
  const ls: number[] = [];
  const counts = new Map<string, number>();
  for (let i = 0; i < w * h; i++) {
    if (!mask[i]) continue;
    const o = i * 4;
    ls.push(lum(comp.data[o], comp.data[o + 1], comp.data[o + 2]));
    const hex = '#' + [comp.data[o], comp.data[o + 1], comp.data[o + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  ls.sort((a, b) => a - b);
  const p90 = quantile(ls, 0.9), p10 = quantile(ls, 0.1);
  const mat = dominantMaterial(tmap, counts);
  const partClaire = mat && ls.length ? (ls.filter((l) => l > mat.seuil).length / ls.length) * 100 : null;

  // Composantes connexes (8-voisins) de la figure ENTIÈRE. Seuil d'alpha BAS (`ALPHA_FIG`, pas
  // `ALPHA_MIN`) : deux masses qui se touchent ne se joignent que par des pixels d'anticrénelage —
  // à 200 le harnais déclarait « détachés » un capuchon et son col qui se recouvrent. Un vrai
  // détachement laisse du fond PUR (alpha 0) entre les masses.
  const fig = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (comp.data[i * 4 + 3] >= ALPHA_FIG) fig[i] = 1;
  const seen = new Uint8Array(w * h);
  const blobs: { n: number; x0: number; y0: number; x1: number; y1: number }[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = y * w + x;
    if (!fig[s] || seen[s]) continue;
    const stack = [s]; seen[s] = 1;
    const b = { n: 0, x0: x, y0: y, x1: x, y1: y };
    while (stack.length) {
      const p = stack.pop()!; b.n++;
      const py = (p / w) | 0, px = p % w;
      if (px < b.x0) b.x0 = px; if (px > b.x1) b.x1 = px;
      if (py < b.y0) b.y0 = py; if (py > b.y1) b.y1 = py;
      for (const dy of N8) for (const dx of N8) {
        const qy = py + dy, qx = px + dx;
        if (qx < 0 || qx >= w || qy < 0 || qy >= h) continue;
        const q = qy * w + qx;
        if (fig[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
      }
    }
    if (b.n > 12) blobs.push(b); // sous ce seuil : anticrénelage isolé, pas une masse
  }
  blobs.sort((a, b) => b.n - a.n);
  const u = (px: number) => +(px / PX_PER_U).toFixed(1);

  // Séparation slot↔torse : |ΔL| sur la frontière (masque NON érodé — la frontière est le bord).
  const deltas: number[] = [];
  if (slot !== 'torse') {
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!rawMask[i]) continue;
      let sum = 0, n = 0;
      for (const dy of N8) for (const dx of N8) {
        const j = (y + dy) * w + (x + dx);
        if (!torsoMask[j]) continue;
        const o = j * 4;
        sum += lum(comp.data[o], comp.data[o + 1], comp.data[o + 2]); n++;
      }
      if (!n) continue;
      const o = i * 4;
      deltas.push(Math.abs(lum(comp.data[o], comp.data[o + 1], comp.data[o + 2]) - sum / n));
    }
  }
  deltas.sort((a, b) => a - b);

  const pixels = ls.length;
  const ecart = +(p90 - p10).toFixed(1);
  const matiere = mat?.fam ?? null;
  const lBase = mat ? +mat.lBase.toFixed(1) : null;
  const lLumiere = mat ? +mat.lHi.toFixed(1) : null;
  const partClaireVal = partClaire === null ? null : +partClaire.toFixed(1);
  const p90SurBase = !!mat && Math.abs(p90 - mat.lBase) < 0.15;
  const { verdict, raisons } = computeVerdict({ pixels, matiere, lBase, lLumiere, ecart, partClaire: partClaireVal, p90SurBase });

  return {
    view,
    pixels,
    p90: +p90.toFixed(1), p10: +p10.toFixed(1), ecart,
    matiere,
    lBase,
    lLumiere,
    seuilClair: mat ? +mat.seuil.toFixed(1) : null,
    partClaire: partClaireVal,
    p90SurBase,
    composantes: blobs.length,
    surnumeraires: blobs.slice(1).map((b) => ({ pixels: b.n, bbox: [u(b.x0), u(b.y0), u(b.x1), u(b.y1)] as [number, number, number, number] })),
    sepMediane: deltas.length ? +quantile(deltas, 0.5).toFixed(1) : null,
    sepP10: deltas.length ? +quantile(deltas, 0.1).toFixed(1) : null,
    verdict,
    raisons,
  };
}

// ── Sortie ────────────────────────────────────────────────────────────────────────────────
/** `-` pour tout champ dégénéré (masque vide → NaN/null) — jamais un `NaN` en sortie. */
const dash = (v: number | null): string | number => (v === null || Number.isNaN(v) ? '-' : v);
const pad = (s: string | number, n: number) => String(s).padStart(n);

/** Compteurs de synthèse `--all` : le compte que les audits suivants doivent faire décroître. */
const tally = { 'NON-REFUTE': 0, ECHEC: 0, 'NON MESURABLE': 0 };
let anyEchec = false;
function trackVerdict(v: ViewReport) {
  tally[v.verdict]++;
  if (v.verdict === 'ECHEC') anyEchec = true;
}

function printViewLine(v: ViewReport, prefix: string) {
  trackVerdict(v);
  const raisonsTxt = v.raisons.length ? ` (${v.raisons.join(', ')})` : '';
  console.log(
    `${prefix}${v.view.padEnd(8)}${pad(dash(v.pixels), 5)} ${pad(dash(v.p90), 6)} ${pad(dash(v.p10), 6)} ${pad(dash(v.ecart), 8)} | ` +
    `${(v.matiere ?? '-').padEnd(8)}${pad(dash(v.lBase), 5)} ${pad(dash(v.lLumiere), 4)} ${pad(dash(v.seuilClair), 6)} ${pad(dash(v.partClaire), 6)} | ` +
    `${pad(v.composantes, 5)} | ${pad(dash(v.sepMediane), 7)} ${pad(dash(v.sepP10), 8)} | ${v.verdict}${raisonsTxt}`,
  );
  for (const s of v.surnumeraires) console.log(`${' '.repeat(prefix.length)}    ⚠ masse détachée: ${s.pixels} px, bbox u[${s.bbox.join(', ')}]`);
}

const HEAD_COLS = 'vue      px      P90    P10  P90-P10 | matiere  base  lum  seuil  clair% | comps | sep med  sep p10 | verdict';

const reglagesCommun = {
  slot,
  masqueOs: [...maskBones].sort(),
  chair: withFlesh ? 'INCLUSE' : 'EXCLUE',
  erosionU: erode ? ERODE_U : 0,
  erosionPx: erode ? ERODE_PX : 0,
  rig: 'Humain M · build 0.55 · seed 4 · sans arme',
  rendu: `${RENDER_W}x${RENDER_H} px (${PX_PER_U} px/u)`,
  echelle: 'luminance Rec.709 sur 0..100',
  contrat: { ecartMin: CONTRAT_ECART_MIN, clairMin: CONTRAT_CLAIR_MIN },
};

if (allMode) {
  const tenues = tenueIds.map((id) => ({ id, label: tenueLabelOf(id), tmap: buildTokenMap(TENUE_PALETTE_BY_ID[id] ?? {}, {}) }));
  if (asJson) {
    const mesures: (ViewReport & { tenueId: string })[] = [];
    for (const t of tenues) for (const v of views) {
      const report = measure(t.id, t.tmap, v);
      trackVerdict(report);
      mesures.push({ tenueId: t.id, ...report });
    }
    const total = mesures.length;
    console.log(JSON.stringify({
      reglages: { ...reglagesCommun, vues: views },
      synthese: { ...tally, total },
      mesures,
    }, null, 1));
  } else {
    const r = reglagesCommun;
    console.log(`sweep --all · ${tenues.length} tenue(s) · slot ${r.slot}`);
    console.log(`  masque   : os [${r.masqueOs.join(', ')}] — visibles dans le composé`);
    console.log(`  chair    : ${r.chair}${withFlesh ? '  ⚠ la mesure INCLUT la chair (mains/pieds nus)' : ''}`);
    console.log(`  érosion  : ${r.erosionU} u SVG (${r.erosionPx} px)${erode ? '' : '  — DÉSACTIVÉE'}`);
    console.log(`  rig      : ${r.rig} · ${r.rendu} · ${r.echelle}`);
    console.log(`  contrat  : écart ≥ ${r.contrat.ecartMin} ET part claire ≥ ${r.contrat.clairMin} % (palette saine) — le harnais RÉFUTE, il ne certifie pas`);
    console.log(`  id                                 ${HEAD_COLS}`);
    for (const t of tenues) {
      for (const view of views) {
        const v = measure(t.id, t.tmap, view);
        printViewLine(v, `  ${t.id.padEnd(35)}`);
      }
    }
    const total = tally['NON-REFUTE'] + tally.ECHEC + tally['NON MESURABLE'];
    console.log(`  verdicts: ${tally['NON-REFUTE']} NON-REFUTE · ${tally.ECHEC} ECHEC · ${tally['NON MESURABLE']} NON MESURABLE (sur ${total} vues)`);
  }
} else {
  const tenueId = tenueArg;
  const tenueLabel = tenueLabelOf(tenueId);
  const tmap = buildTokenMap(TENUE_PALETTE_BY_ID[tenueId] ?? {}, {});
  const rapport = { reglages: { tenueId, tenueLabel, ...reglagesCommun }, vues: views.map((v) => measure(tenueId, tmap, v)) };

  if (asJson) {
    for (const v of rapport.vues) trackVerdict(v);
    console.log(JSON.stringify(rapport, null, 1));
  } else {
    const r = rapport.reglages;
    console.log(`tenue ${r.tenueId} « ${r.tenueLabel} » · slot ${r.slot}`);
    console.log(`  masque   : os [${r.masqueOs.join(', ')}] — visibles dans le composé`);
    console.log(`  chair    : ${r.chair}${withFlesh ? '  ⚠ la mesure INCLUT la chair (mains/pieds nus)' : ''}`);
    console.log(`  érosion  : ${r.erosionU} u SVG (${r.erosionPx} px)${erode ? '' : '  — DÉSACTIVÉE'}`);
    console.log(`  rig      : ${r.rig} · ${r.rendu} · ${r.echelle}`);
    console.log(`  contrat  : écart ≥ ${r.contrat.ecartMin} ET part claire ≥ ${r.contrat.clairMin} % (palette saine) — le harnais RÉFUTE, il ne certifie pas`);
    console.log(`  ${HEAD_COLS}`);
    for (const v of rapport.vues) printViewLine(v, '  ');
  }
}

process.exitCode = anyEchec ? 1 : 0;
