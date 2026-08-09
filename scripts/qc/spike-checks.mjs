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

/** Côté (px) de la fenêtre de mesure de MOTIF — la période d'un appareillage mural (2,6 m de large,
 *  0,7 m de haut, `coursesPeriodM`) tient à l'écran dans quelques dizaines de pixels : plus large, la
 *  fenêtre déborde la surface ; plus étroite, elle rate le joint. */
const FENETRE_MOTIF = 24;
/** Part minimale de la fenêtre qui doit être de la MATIÈRE mesurée (le reste = un bord, un autre
 *  matériau : la mesure ne serait plus celle d'une surface). */
const PURETE_FENETRE = 0.9;

/** MOTIF d'une matière : l'écart-type MÉDIAN de luminance parmi les fenêtres `cote`×`cote` remplies de
 *  cette matière (à `PURETE_FENETRE` près). La MÉDIANE, jamais le maximum : une fenêtre à cheval sur
 *  deux teintes d'un même bois (face, moulure, plinthe — toutes des multiples NEUTRES du même albédo)
 *  rend un écart-type élevé sans qu'aucune surface ne porte de motif ; la médiane, elle, dit ce que
 *  porte la surface COURANTE. Une matière d'APLAT rend 0 quelle que soit sa teinte, un appareillage
 *  texturé rend le contraste de son masque. `fenetres` = 0 → matière introuvable, la mesure ne dit rien. */
export function motifLocal(img, hexAlbedo, cote = FENETRE_MOTIF) {
  const A = albedoLinear(hexAlbedo);
  const matiere = new Uint8Array(img.w * img.h);
  const lum = new Float32Array(img.w * img.h);
  for (let i = 0; i < img.w * img.h; i++) {
    const k = [0, 1, 2].map((c) => srgbToLinear(img.data[i * 4 + c] / 255) / A[c]);
    const hi = Math.max(...k), lo = Math.min(...k);
    matiere[i] = hi <= K_MAX && lo >= K_MIN && hi - lo <= ATTRIBUTION_CLASSE ? 1 : 0;
    lum[i] = (img.data[i * 4] + img.data[i * 4 + 1] + img.data[i * 4 + 2]) / 3;
  }
  const pas = Math.max(1, cote >> 1);
  const requis = PURETE_FENETRE * cote * cote;
  const écarts = [];
  for (let y0 = 0; y0 + cote <= img.h; y0 += pas)
    for (let x0 = 0; x0 + cote <= img.w; x0 += pas) {
      let n = 0, s = 0, s2 = 0;
      for (let y = y0; y < y0 + cote; y++)
        for (let x = x0; x < x0 + cote; x++) {
          const i = y * img.w + x;
          if (!matiere[i]) continue;
          n++;
          s += lum[i];
          s2 += lum[i] * lum[i];
        }
      if (n < requis) continue;
      écarts.push(Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)));
    }
  écarts.sort((a, b) => a - b);
  return {
    ecartType: écarts.length ? écarts[Math.floor(0.5 * (écarts.length - 1))] : 0,
    ecartTypeMax: écarts.length ? écarts[écarts.length - 1] : 0,
    fenetres: écarts.length,
  };
}

/** Écart de canal toléré pour reconnaître un albédo AU PIXEL, en couleur cuite (la planche `unlit` rend
 *  l'albédo tel quel : seuls l'anticrénelage et l'arrondi 8 bits le déplacent). */
const TOLERANCE_TEINTE = 3;
/** Fenêtres minimales pour qu'un pan de toit soit MESURABLE (sous ce compte, l'échantillon ne dit rien). */
const PAN_FENETRES_MIN = 20;

const rgbDe = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** APLAT des pans de toit : parmi les fenêtres `cote`×`cote` dont le pixel CENTRAL est EXACTEMENT une
 *  teinte de pan (`teintes` = [{ id, hex }]), la part de celles qui ne portent qu'UNE seule couleur.
 *  Un pan à assises ne peut pas être uniforme : la mesure dit combien de sa surface est un aplat.
 *
 *  L'attribution passe par la teinte EXACTE, jamais par le rapport `k` de `motifLocal` : sur une teinte
 *  SOMBRE (ardoise `#3d4852`), la fenêtre en `k` de `motifLocal` avale le fond de planche et tout autre
 *  sombre — mesuré 17 414 fenêtres attribuées à l'ardoise sur `vitrine-batiments`, qui n'en porte que
 *  quelques toits. */
export function aplatDePans(img, teintes, cote = FENETRE_MOTIF) {
  const cibles = teintes.map((t) => ({ id: t.id, rgb: rgbDe(t.hex) }));
  const par = new Map();
  for (let y = 0; y + cote <= img.h; y += cote)
    for (let x = 0; x + cote <= img.w; x += cote) {
      const c = ((y + (cote >> 1)) * img.w + (x + (cote >> 1))) * 4;
      const t = cibles.find((t) =>
        Math.abs(img.data[c] - t.rgb[0]) <= TOLERANCE_TEINTE &&
        Math.abs(img.data[c + 1] - t.rgb[1]) <= TOLERANCE_TEINTE &&
        Math.abs(img.data[c + 2] - t.rgb[2]) <= TOLERANCE_TEINTE);
      if (!t) continue;
      const vues = new Set();
      for (let j = 0; j < cote; j++)
        for (let i = 0; i < cote; i++) {
          const p = ((y + j) * img.w + (x + i)) * 4;
          vues.add((img.data[p] << 16) | (img.data[p + 1] << 8) | img.data[p + 2]);
        }
      const e = par.get(t.id) ?? { n: 0, aplat: 0 };
      e.n++;
      if (vues.size === 1) e.aplat++;
      par.set(t.id, e);
    }
  return par;
}

/** Teintes de PAN de toit, lues à la DONNÉE (`src/data/roofMaterials.json`) : les 4 côtés N/E/S/O de
 *  chaque matériau à assises — exactement ce que `faceColors.roofColor` rend en couleur cuite. */
function teintesDePans() {
  const src = new URL('../../src/data/roofMaterials.json', import.meta.url);
  return JSON.parse(readFileSync(src, 'utf8'))
    .filter((m) => m.detail?.courses)
    .flatMap((m) => ['N', 'E', 'S', 'O'].filter((k) => typeof m[k] === 'string').map((k) => ({ id: `${m.id}.${k}`, hex: m[k] })));
}

/** Albédos de donnée sur lesquels les gardes s'adossent, tels que `faceColors` les rend :
 *  `#3d6630` = `src/state/terrain/defs/herbe.ts:9` (`swatch`) ; `#6e5940` et `#6b6f76` =
 *  `src/data/structureAppearance.json` (`mur-en-bois`, `mur-en-pierre`). */
const HERBE = '#3D6630';
const BOIS = '#6E5940';
const PIERRE = '#6B6F76';

/** Écart-type médian de luminance sous lequel une pierre appareillée est un APLAT (elle ne montre pas
 *  son appareillage). Mesuré le 2026-08-09 sur les planches d'AVANT les textures de période : 0,00 sur
 *  513 fenêtres de pierre du siège (et 0,00 sur 760 à l'arène) — l'aplat parfait. Le masque de période
 *  vaut, lui, ~22 d'écart-type à pleine résolution (joint à 0,44 × la teinte sur 14,1 % des pixels,
 *  cf. `periodTexture`) : le seuil laisse 5× de marge à la minification et au filtrage. */
const MOTIF_MIN = 4;

/** Écart-type médian de luminance sous lequel une façade à pans de bois ne MONTRE pas son colombage
 *  (cf. la garde qui le mesure : 5,94 sans colombage, ~14 attendus avec). */
const COLOMBAGE_MIN = 9;

/** Part de fenêtres APLATES au-delà de laquelle un pan de toit ne montre PAS son appareillage. Seuil
 *  DÉRIVÉ du même instrument sur les surfaces qui, elles, portent leur période — toutes à 0 % d'aplat le
 *  2026-08-09 : mur de pierre du siège (105 fenêtres) et de l'arène (220), mur de bois de la vitrine
 *  (240) et de l'arène (115), pans d'ardoise N/E/O de la diligence (41 / 238 / 81). Une surface
 *  appareillée rend donc ZÉRO aplat ; les 10 % laissés ici sont la marge des bords anticrénelés. */
const APLAT_PAN_MAX = 0.1;

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
  {
    planche: 'siege-enceinte-iso-rot0-unlit.png',
    titre: `présence de MOTIF sur la pierre appareillée (albédo ${PIERRE}) : écart-type médian ≥ ${MOTIF_MIN}`,
    // La planche est jugée en COULEUR CUITE : sans lumière à démêler, tout écart de luminance dans une
    // fenêtre de pierre vient du MATÉRIAU. La `vitrine-batiments` que le lot visait ne porte aucun mur
    // de pierre (mesuré : 0 fenêtre) — le siège en porte 513, l'arène 760.
    mesurer: (img) => {
      const r = motifLocal(img, PIERRE);
      if (!r.fenetres) return { ok: false, dit: `pierre introuvable (aucune fenêtre pleine de ${PIERRE})` };
      return {
        ok: r.ecartType >= MOTIF_MIN,
        dit: `écart-type médian ${r.ecartType.toFixed(2)} (max ${r.ecartTypeMax.toFixed(2)}) sur ${r.fenetres} fenêtres de pierre`,
      };
    },
  },
  {
    planche: 'vitrine-batiments-iso-rot0-unlit.png',
    titre: `présence de COLOMBAGE sur le bois (albédo ${BOIS}) : écart-type médian ≥ ${COLOMBAGE_MIN}`,
    // MÊME méthode que la garde de motif de la pierre, sur l'albédo de BOIS et la planche qui porte les
    // façades à pans de bois (`mur-en-bois`, `src/data/structureAppearance.json`).
    // ÉTAT MESURÉ le 2026-08-09 sur la planche AVANT toute cuisson de colombage : médiane 5,94
    // (max 17,09) sur 1283 fenêtres de bois — cet écart-là est celui des seuls JOINTS de la texture de
    // période. VALEUR ANALYTIQUE ATTENDUE une fois le colombage cuit : la bimodale bois clair (luminance
    // 87,7) / bois d'ossature (45,3) sur une couverture de ~10 % d'une fenêtre rend
    // 42,4·√(0,1·0,9) ≈ 12,7, qui s'ajoute en VARIANCE au fond de joints : √(5,94² + 12,7²) ≈ 14.
    // Le seuil se pose entre les deux : la garde est donc ROUGE tant que la planche n'a pas été
    // recapturée avec le colombage — c'est SA preuve de morsure.
    mesurer: (img) => {
      const r = motifLocal(img, BOIS);
      if (!r.fenetres) return { ok: false, dit: `bois introuvable (aucune fenêtre pleine de ${BOIS})` };
      return {
        ok: r.ecartType >= COLOMBAGE_MIN,
        dit: `écart-type médian ${r.ecartType.toFixed(2)} (max ${r.ecartTypeMax.toFixed(2)}) sur ${r.fenetres} fenêtres de bois`,
      };
    },
  },
  {
    planche: 'vitrine-batiments-iso-rot0-unlit.png',
    titre: `pans de toit NON-APLAT : au plus ${100 * APLAT_PAN_MAX} % de fenêtres uniformes par pan`,
    // ÉTAT MESURÉ le 2026-08-09 sur la planche capturée AVANT le dé-clampage de `jointFactor` : le pan
    // SUD de chaque matériau est un aplat massif — tuile 85 % (604 fenêtres), ardoise 80 % (201),
    // chaume 54 % (26) —, alors que tous les autres côtés du même matériau sont à 0 %. Cause mesurée :
    // le joint des trois toits est PLUS CLAIR que leur pan sud (rapports de canal 1,04 à 1,21), et un
    // `Math.min(1, …)` l'effaçait. La garde reste donc ROUGE tant que la planche n'a pas été
    // recapturée — c'est SA preuve de morsure.
    mesurer: (img) => {
      const par = aplatDePans(img, teintesDePans());
      const mesurés = [...par].filter(([, e]) => e.n >= PAN_FENETRES_MIN);
      if (!mesurés.length) return { ok: false, dit: 'aucun pan de toit mesurable sur la planche' };
      const pire = mesurés.reduce((a, b) => (b[1].aplat / b[1].n > a[1].aplat / a[1].n ? b : a));
      return {
        ok: mesurés.every(([, e]) => e.aplat / e.n <= APLAT_PAN_MAX),
        dit: `${mesurés.length} pans mesurés, pire ${pire[0]} à ${(100 * pire[1].aplat / pire[1].n).toFixed(0)} % d'aplat sur ${pire[1].n} fenêtres`,
      };
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
