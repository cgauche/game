/**
 * Construit la table de correspondance frenchy.bzh → notre VF (LDB/ADE…).
 *
 * Source : les annexes B/C/D du guide fan « Habitants & Créatures du Vieux-Monde »
 * (frenchy.bzh), qui donnent pour chaque terme un triplet
 *     Traduction Personnelle (frenchy) | Traduction Officielle (Khaos Project) | Nom VO (Cubicle 7)
 *
 * « Khaos Project » = l'éditeur VF officiel = notre LDB. On mappe donc
 *     frenchy ──> officiel ──(normalisation)──> NOTRE label exact dans src/data
 * et, pour les dérives d'édition (officiel ≠ notre label), on bascule sur la VO
 * (pont stable) via VO_OVERRIDES.
 *
 * Sortie :
 *   - scripts/frenchy/term-map.json   (frenchy → {ours, official, vo, status})
 *   - un rapport de trous lisible sur stdout.
 *
 * Usage : node scripts/frenchy/build-term-map.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const DATA = resolve(ROOT, 'src/data');
const PDF_DIR = resolve(
  ROOT,
  'Source/Warhammer - Habitants & Créatures  du Vieux-Monde (Discord) PDF',
);

const APPENDICES = {
  skills: '81 - Annexe B - Compétences (Skills).md',
  talents: '82 - Annexe C - Talents (Talents).md',
  traits: '83 - Annexe D - Traits (Traits).md',
};

/** Clé de comparaison : minuscule, sans accents, œ→oe, sans param « (…) », sans ponctuation.
 *  On coupe à la PREMIÈRE parenthèse (gère aussi les parenthèses non fermées de l'OCR,
 *  ex. « À Distance (Indice) (Portée »). */
function normKey(s) {
  return (s || '')
    .replace(/\(.*$/s, '') // params « (Indice) » « (Cible) » … (et OCR non fermé)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacritiques
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ''); // ponctuation/espaces/#
}

/** Nettoie une cellule de table : retire italiques/gras, coupe au premier <br> (réfs de page). */
function cleanCell(s) {
  if (!s) return '';
  let t = s.split(/<br\s*\/?>/i)[0]; // garde le terme, jette la réf de page/source
  t = t.replace(/[*_]+/g, '').trim();
  return t;
}

/** Dérives d'édition (officiel Khaos ≠ notre label, même concept) : on bascule sur la VO,
 *  pont stable. Clés en VO lisible — re-normalisées en VO_NORM pour matcher normKey(vo). */
const VO_OVERRIDES = {
  // skills
  'Animal Care': 'Soin aux animaux',
  // talents
  'Animal Affinity': 'Affinité avec les animaux',
  'In-Fighter': 'Combattant au contact',
  Contorsionist: 'Contorsionniste',
  Embezzle: 'Escroquer',
  Numismatics: 'Numismate',
  'Combat Aware': 'Vigilance',
  'Lightning Reflexes': 'Réflexes foudroyants',
  'AEthyric Attunement': 'Harmonisation aethyrique',
  Large: 'Massif',
  Small: 'Petit',
  'Crack the Whip': 'Claquer le fouet',
  Ambidextrous: 'Ambidextre',
  Blather: 'Baratiner',
  Orientation: "Sens de l'orientation", // talent (le SKILL « Orientation » matche en direct)
  Sprinter: 'Sprinter',
  'Old Salt': 'Loup de mer',
  'Holy Visions': 'Visions sacrées',
  // traits
  Spellcaster: 'Lanceur de Sorts',
};
/** Indexé par clé VO normalisée pour matcher normKey(vo). */
const VO_NORM = new Map(Object.entries(VO_OVERRIDES).map(([k, v]) => [normKey(k), v]));

function loadOurLabels(file) {
  const arr = JSON.parse(readFileSync(resolve(DATA, file), 'utf8'));
  const byKey = new Map();
  for (const x of arr) byKey.set(normKey(x.label), x.label);
  return byKey;
}

const OURS = {
  skills: loadOurLabels('skills.json'),
  talents: loadOurLabels('talents.json'),
  traits: loadOurLabels('traits.json'),
};

function parseAppendix(path) {
  const text = readFileSync(path, 'utf8');
  const rows = [];
  let roles = null; // {frenchy, official, vo} → index
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('|')) continue;
    let cells = line.split('|').map((c) => c.trim());
    // retire les cellules vides de bord (table commence/finit par |)
    if (cells.length && cells[0] === '') cells.shift();
    if (cells.length && cells[cells.length - 1] === '') cells.pop();
    if (cells.every((c) => /^[-:\s]*$/.test(c))) continue; // séparateur ---
    const joined = cells.join(' ').toLowerCase();
    if (joined.includes('personnelle') || joined.includes('cubicle') || joined.includes('khaos')) {
      // ligne d'en-tête : détermine l'ordre des colonnes (les 2 sens existent)
      roles = {};
      cells.forEach((c, i) => {
        const k = c.toLowerCase();
        if (k.includes('personnelle')) roles.frenchy = i;
        else if (k.includes('khaos') || k.includes('officielle')) roles.official = i;
        else if (k.includes('cubicle') || k.includes('vo')) roles.vo = i;
      });
      continue;
    }
    if (!roles || roles.frenchy == null || roles.official == null || roles.vo == null) continue;
    if (cells.length < 3) continue;
    const frenchy = cleanCell(cells[roles.frenchy]);
    const official = cleanCell(cells[roles.official]);
    const vo = cleanCell(cells[roles.vo]);
    if (!frenchy) continue;
    rows.push({ frenchy, official, vo });
  }
  return rows;
}

const out = { _README: 'GÉNÉRÉ par scripts/frenchy/build-term-map.mjs — frenchy.bzh → notre VF. Ne pas éditer à la main.' };
const gaps = {};

for (const [cat, fname] of Object.entries(APPENDICES)) {
  const rows = parseAppendix(join(PDF_DIR, fname));
  const ours = OURS[cat];
  const map = {};
  const catGaps = [];
  const seen = new Set();
  for (const { frenchy, official, vo } of rows) {
    if (seen.has(frenchy)) continue; // les tables Vf/Vo + Vo/Vf répètent chaque terme
    seen.add(frenchy);
    let oursLabel = null;
    let status;
    const offHit = official ? ours.get(normKey(official)) : undefined;
    const voKey = normKey(vo);
    if (offHit) {
      oursLabel = offHit;
      status = 'ok';
    } else if (VO_NORM.get(voKey) && ours.get(normKey(VO_NORM.get(voKey)))) {
      oursLabel = VO_NORM.get(voKey);
      status = 'drift';
    } else {
      status = official ? 'gap-missing-in-ours' : 'gap-no-official';
      catGaps.push({ frenchy, official, vo, status });
    }
    map[frenchy] = { ours: oursLabel, official: official || null, vo: vo || null, status };
  }
  out[cat] = map;
  gaps[cat] = catGaps;
}

writeFileSync(resolve(__dirname, 'term-map.json'), JSON.stringify(out, null, 2), 'utf8');

// --- rapport ---------------------------------------------------------------
console.log('Table de correspondance frenchy.bzh → notre VF\n');
for (const cat of Object.keys(APPENDICES)) {
  const entries = Object.values(out[cat]);
  const ok = entries.filter((e) => e.status === 'ok').length;
  const drift = entries.filter((e) => e.status === 'drift').length;
  const gMiss = gaps[cat].filter((g) => g.status === 'gap-missing-in-ours').length;
  const gNoOff = gaps[cat].filter((g) => g.status === 'gap-no-official').length;
  console.log(
    `${cat.padEnd(8)} ${entries.length} termes — ok:${ok} drift:${drift} ` +
      `gap(absent de notre data):${gMiss} gap(pas de VF officielle):${gNoOff}`,
  );
}
console.log('\n── TROUS À ARBITRER ──');
for (const cat of Object.keys(APPENDICES)) {
  if (!gaps[cat].length) continue;
  console.log(`\n# ${cat}`);
  for (const g of gaps[cat]) {
    const tag = g.status === 'gap-missing-in-ours' ? 'ABSENT-DATA' : 'PAS-DE-VF   ';
    console.log(`  [${tag}] ${g.frenchy}  →  off:« ${g.official || '—'} »  vo:« ${g.vo || '—'} »`);
  }
}
console.log(`\nÉcrit : scripts/frenchy/term-map.json`);
