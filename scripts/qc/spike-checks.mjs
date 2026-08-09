/**
 * QC — GARDES DE PLANCHE du spike WebGL (#1176) : les sondes du juge vision, rejouables sans œil.
 * Lit les PNG déjà capturés (`public/qc/spike/*.png`, écrits par `spike-webgl.mjs`) et échoue (exit 1)
 * dès qu'une planche retombe sous son seuil. Aucune dépendance : le PNG de `toDataURL` est du RGBA
 * 8 bits non entrelacé, décodé ici par `zlib.inflateSync` + défiltrage.
 *
 * MÉTHODE — le rendu éclairé multiplie un albédo de donnée par un scalaire de lumière (les deux sources
 * sont NEUTRES, `sceneMeshes.ts`) : un pixel de matière `A` vaut donc `sRGB(linéaire(A) · k)`, et
 * `k = linéaire(pixel) / linéaire(A)` par canal. Une lumière neutre rend les trois `k` égaux ; la
 * SOMBRE (`k` bas) et l'ÉCLAIRÉE (`k` haut) forment deux classes nettes.
 *
 * `decodePng` est un DOUBLON assumé de `scripts/qc/mesure-volume.mts:175` : ce module tourne en node
 * NU (`node scripts/qc/spike-checks.mjs`, et importé par `spike-webgl.mjs`) quand l'autre est un CLI `tsx`.
 *
 *   node scripts/qc/spike-checks.mjs [dossier]
 */
import { readFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

const DIR = 'public/qc/spike';

/** PNG RGBA 8 bits non entrelacé → { w, h, data }. Doublon de `mesure-volume.mts:175` (cf. en-tête). */
export function decodePng(buf) {
  let off = 8, w = 0, h = 0;
  const idat = [];
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

const srgbToLinear = (u) => (u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4);
const albedoLinear = (hex) => [1, 3, 5].map((i) => srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255));

/** Bornes de `k` retenues : hors d'elles, le pixel n'est pas cette matière sous cette lumière. */
const K_MIN = 0.05;
const K_MAX = 1.6;
/** Fenêtre d'ATTRIBUTION d'un pixel à un albédo, pour les mesures de CLASSE (part d'ombre) : au-delà,
 *  le pixel est une autre matière ou un mélange d'anticrénelage. Mesuré le 2026-08-09 : les aplats
 *  rendus tiennent tous à 0,027 d'écart de canal. */
const ATTRIBUTION_CLASSE = 0.05;
/** Fenêtre d'attribution pour la mesure de TEINTE : LARGE — un verdict de neutralité pris dans une
 *  fenêtre égale à son seuil ne peut que se confirmer lui-même. */
const ATTRIBUTION_TEINTE = 0.25;
/** Écart max(k) − min(k) au-delà duquel la lumière a REPEINT la teinte de l'albédo. */
const NEUTRALITE_MAX = 0.05;
/** Frontière entre classe SOMBRE et classe ÉCLAIRÉE : le milieu des deux classes mesurées sur les
 *  planches du 2026-08-09 (`k` = 0,447 dos au soleil / 0,970 nappe au soleil). */
const K_FRONTIERE = 0.7;
/** Part minimale du cadre pour qu'une matière soit MESURABLE (sinon l'échantillon ne prouve rien). */
const ECHANTILLON_MIN = 0.02;

/** Classement des pixels attribuables à `hexAlbedo` dans la fenêtre `fenetre` : combien, quelle part en
 *  classe sombre, et l'écart de canal de l'APLAT DOMINANT (la couleur attribuée la plus fréquente —
 *  c'est elle qui porte la teinte, un bord anticrénelé ne prouve rien). */
export function classer(img, hexAlbedo, fenetre = ATTRIBUTION_CLASSE) {
  const A = albedoLinear(hexAlbedo);
  let n = 0, ombre = 0;
  const aplats = new Map();
  for (let i = 0; i < img.w * img.h; i++) {
    const k = [0, 1, 2].map((c) => srgbToLinear(img.data[i * 4 + c] / 255) / A[c]);
    const hi = Math.max(...k), lo = Math.min(...k);
    if (hi > K_MAX || lo < K_MIN || hi - lo > fenetre) continue;
    n++;
    if ((k[0] + k[1] + k[2]) / 3 < K_FRONTIERE) ombre++;
    const cle = (img.data[i * 4] << 16) | (img.data[i * 4 + 1] << 8) | img.data[i * 4 + 2];
    aplats.set(cle, (aplats.get(cle) ?? 0) + 1);
  }
  let dominant = null, mieux = 0;
  for (const [cle, cnt] of aplats) if (cnt > mieux) { mieux = cnt; dominant = cle; }
  const kDe = (cle) => [16, 8, 0].map((d, c) => srgbToLinear(((cle >> d) & 0xff) / 255) / A[c]);
  const kDom = dominant === null ? [0, 0, 0] : kDe(dominant);
  return {
    n,
    part: n / (img.w * img.h),
    partOmbre: n ? ombre / n : 0,
    ecartDominant: dominant === null ? Infinity : Math.max(...kDom) - Math.min(...kDom),
    kDominant: (kDom[0] + kDom[1] + kDom[2]) / 3,
    partDominant: n ? mieux / n : 0,
  };
}

/** Nombre de couleurs RVB distinctes d'une image. */
export function couleursUniques(img) {
  const vues = new Set();
  for (let i = 0; i < img.w * img.h; i++) vues.add((img.data[i * 4] << 16) | (img.data[i * 4 + 1] << 8) | img.data[i * 4 + 2]);
  return vues.size;
}

/** Albédos de donnée sur lesquels les gardes s'adossent, tels que `faceColors` les rend :
 *  `#3d6630` = `src/state/terrain/defs/herbe.ts:9` (`swatch`) ; `#6e5940` = `src/data/structureAppearance.json:16,53,121,155`. */
const HERBE = '#3D6630';
const BOIS = '#6E5940';

/** Seuils : chacun porte SA mesure sur les planches FINALES du 2026-08-09 (`public/qc/spike/`). */
const GARDES = [
  {
    planche: 'siege-enceinte-iso-rot2-lit.png',
    titre: `part d'ombre de l'herbe (albédo ${HERBE}) ≥ 5 %`,
    // Mesuré 6,76 % d'ombre sur 25,5 % du cadre le 2026-08-09 (le soleil au sud-ouest à 38° creuse le
    // rempart ; au nord-ouest, 0,2 %).
    mesurer: (img) => {
      const c = classer(img, HERBE);
      if (c.part < ECHANTILLON_MIN) return { ok: false, dit: `herbe introuvable (${(100 * c.part).toFixed(2)} % du cadre)` };
      return { ok: c.partOmbre >= 0.05, dit: `${(100 * c.partOmbre).toFixed(2)} % d'ombre sur ${(100 * c.part).toFixed(1)} % du cadre` };
    },
  },
  {
    planche: 'vitrine-batiments-iso-rot0-lit.png',
    titre: `neutralité chromatique du bois (albédo ${BOIS}) : max(k)−min(k) ≤ ${NEUTRALITE_MAX}`,
    // Mesuré 0,001 le 2026-08-09 sur l'aplat dominant (`#4b3c2a`, 44 % du bois, k 0,452), fenêtre 0,25.
    mesurer: (img) => {
      const c = classer(img, BOIS, ATTRIBUTION_TEINTE);
      if (c.part < ECHANTILLON_MIN) return { ok: false, dit: `bois introuvable (${(100 * c.part).toFixed(2)} % du cadre) — la lumière a poussé l'albédo hors de la fenêtre ${ATTRIBUTION_TEINTE}` };
      return { ok: c.ecartDominant <= NEUTRALITE_MAX, dit: `écart de canal ${c.ecartDominant.toFixed(3)} sur l'aplat dominant (k ${c.kDominant.toFixed(3)}, ${(100 * c.partDominant).toFixed(0)} % des pixels de bois)` };
    },
  },
  {
    planche: 'siege-enceinte-top-lit.png',
    titre: 'la vue du dessus montre plus de 3 couleurs (elle cadre le contenu, pas la douve)',
    // Mesuré 2329 couleurs le 2026-08-09 ; à l'échelle nue `CELL/mpt`, la caméra n'en voyait que 3 (la douve).
    mesurer: (img) => {
      const n = couleursUniques(img);
      return { ok: n > 3, dit: `${n} couleurs uniques` };
    },
  },
];

/** Joue toutes les gardes sur `dir`. Rend `{ ok, lignes }` — aucun `process.exit` ici. */
export function runSpikeChecks(dir = DIR) {
  const lignes = [];
  let ok = true;
  for (const g of GARDES) {
    const chemin = `${dir}/${g.planche}`;
    if (!existsSync(chemin)) {
      ok = false;
      lignes.push(`ÉCHEC  ${g.planche} — planche absente (${chemin})`);
      continue;
    }
    let r;
    try {
      r = g.mesurer(decodePng(readFileSync(chemin)));
    } catch (e) {
      ok = false;
      lignes.push(`ÉCHEC  ${g.planche} — ${g.titre} : illisible (${e.message})`);
      continue;
    }
    if (!r.ok) ok = false;
    lignes.push(`${r.ok ? 'OK    ' : 'ÉCHEC '} ${g.planche} — ${g.titre} : ${r.dit}`);
  }
  return { ok, lignes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ok, lignes } = runSpikeChecks(process.argv[2] ?? DIR);
  for (const l of lignes) console.log(l);
  console.log(ok ? 'GARDES DE PLANCHE : toutes tenues' : 'GARDES DE PLANCHE : au moins une est tombée');
  process.exit(ok ? 0 : 1);
}
