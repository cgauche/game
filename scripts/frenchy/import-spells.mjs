/**
 * Importe les SORTS du guide fan frenchy.bzh → SpellData[] taggés source.book = 'frenchy.bzh'.
 *
 * Les casters (Sorcier du Chaos, Shamans, Prophète Gris, Nécromanciens, démons…) listent leurs sorts
 * dans des tables « |Sort (VF)|Sort (VO)|NI|Portée|Cible|Durée|Effet| » (et Bénédictions/Miracles
 * analogues). On extrait ces tables, on écarte les sorts DÉJÀ dans notre spells.json officiel (le nom
 * du caster y résout), et on enregistre le RESTE comme sorts frenchy.bzh (mergés dans `spells` via
 * src/data/index.ts) — pour que les listes de sorts des créatures résolvent.
 *
 * Sortie : src/data/frenchy-spells.json
 * Usage  : node scripts/frenchy/import-spells.mjs            # aperçu stdout
 *          node scripts/frenchy/import-spells.mjs --write     # écrit le .json
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const PDF_DIR = resolve(ROOT, 'Source/Warhammer - Habitants & Créatures  du Vieux-Monde (Discord) PDF');

const normKey = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/[^a-z0-9]+/g, '');
const cells = (line) => { let c = line.split('|').map((x) => x.trim()); if (c[0] === '') c.shift(); if (c[c.length - 1] === '') c.pop(); return c; };
const isSep = (line) => /^\|[-:\s|]+\|?\s*$/.test(line.trim());
const txt = (s) => (s || '').replace(/[*_]+/g, '').replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();
const norm0 = (v) => { const t = txt(v); return t === '' || t === '–' || t === '-' ? null : t; };

const OURS = JSON.parse(readFileSync(resolve(ROOT, 'src/data/spells.json'), 'utf8'));
const OURS_SPELLS = new Set(OURS.map((s) => normKey(s.label)));
// Bénédictions + Miracles officiels sont DANS spells.json (le dataset gods y référence leurs ids).
// Le fan les nomme par l'adjectif nu (« Courage » = « Bénédiction de Courage ») → on indexe aussi le
// libellé SANS préfixe divin + article pour matcher, sinon ils seraient taggés frenchy à tort.
const stripDivine = (s) => s.replace(/^(b[ée]n[ée]diction|invocation|miracle|p[ée]tition)\s+(d['e]\s*)?/i, '').replace(/^(la|le|les|l['])\s*/i, '').trim();
const OURS_DIVINE = new Set(OURS.map((s) => normKey(stripDivine(s.label))));

const SPELL_SEC = /(sorts?|sortil|magie|b[ée]n[ée]diction|miracle|p[ée]tition|incantation)/i;
/** Type de sort déduit du titre de section. */
function typeOf(secTitle) {
  const t = txt(secTitle);
  if (/b[ée]n[ée]diction/i.test(t)) return 'Bénédiction';
  if (/miracle/i.test(t)) return 'Miracle';
  if (/p[ée]tition/i.test(t)) return 'Pétition';
  if (/invocation/i.test(t)) return 'Invocation';
  return t.replace(/^sorts?\s+(de\s+)?/i, '').replace(/^(de\s+)/i, '').replace(/\s*\d+\s*$/, '').trim() || 'Sort';
}

/** Indices de colonnes d'une table de sorts, lus de sa ligne d'en-tête. */
function colMap(headerCells) {
  const m = { label: 0, cn: -1, range: -1, target: -1, duration: -1, desc: -1, vo: -1 };
  headerCells.forEach((c, i) => {
    const k = txt(c).toLowerCase();
    if (/^(sort|b[ée]n[ée]diction|miracle|p[ée]tition|invocation)\b.*\b(vf)?\)?$/.test(k) && m.label === 0 && i === 0) m.label = 0;
    else if (/\bvo\b|cubicle/.test(k)) m.vo = i;
    else if (/^(ni|cn)\b/.test(k)) m.cn = i;
    else if (/port[ée]e/.test(k)) m.range = i;
    else if (/cible/.test(k)) m.target = i;
    else if (/dur[ée]e/.test(k)) m.duration = i;
    else if (/effet|description/.test(k)) m.desc = i;
  });
  if (m.desc < 0) m.desc = headerCells.length - 1; // par défaut : dernière colonne
  return m;
}

const isHeading = (t) => /^#{1,6}\s/.test(t) || /^\*\*[^|*][^|]*\*\*\s*$/.test(t);

function importChapter(file) {
  const lines = readFileSync(join(PDF_DIR, file), 'utf8').split('\n');
  const out = [];
  let curType = null, cols = null, page = 0;
  for (const raw of lines) {
    const t = raw.trim();
    const mp = t.match(/^(\d+)\s+sur\s+630/); if (mp) page = +mp[1];
    if (t.startsWith('|')) {
      if (isSep(t)) continue;
      const c = cells(t);
      // ligne d'en-tête de la table de sorts → fixe le mapping de colonnes
      if (c.some((x) => /^(sort|b[ée]n[ée]diction|miracle|p[ée]tition|invocation)\b/i.test(txt(x))) && c.some((x) => /effet|description|ni|port[ée]e|dur[ée]e/i.test(txt(x)))) {
        cols = colMap(c); if (!curType) curType = 'Sort'; continue;
      }
      if (!curType) continue; // table hors section de sorts
      const cm = cols ?? { label: 0, cn: -1, range: -1, target: -1, duration: -1, desc: c.length - 1 };
      // nom = segments <br> JOINTS (les noms longs s'enroulent : « Marteau<br>de Justice ») mais on
      // s'arrête au 1er segment qui est une RÉF DE SOURCE (« AotE III », « WoM, p.26 », « Dev Diary #10 »).
      const isRef = (x) => /p\.?\s*\d|#\d|^[IVX]+\b|\b(AotE|WoM|DotR|MslR|EiR|EiS|SoC|Lustria|HEPG|THR|PbtT|B&B|DS[LF]F|Dev Diary|Night Parade|Companion|Comp|Starter|Zoo|UiA|LoSaS|SWoC|TEW|Up in Arms)\b/i.test(x);
      const segs = (c[cm.label] || '').split(/<br\s*\/?>/i).map((x) => x.replace(/[*_]+/g, '').trim()).filter(Boolean);
      const nm = [];
      for (const s of segs) { if (isRef(s)) break; nm.push(s); }
      const label = txt(nm.join(' ')).replace(/\s*\([^)]*(?:p\.|AotE|WoM|DotR|Companion)[^)]*\)\s*$/i, '').trim();
      if (!label || label.length < 3 || /^\d+$/.test(label) || /^(sort|nom|vf|vo)\b/i.test(label)) continue;
      out.push({
        label, type: curType,
        cn: cm.cn >= 0 ? norm0(c[cm.cn]) : null,
        range: cm.range >= 0 ? norm0(c[cm.range]) : null,
        target: cm.target >= 0 ? norm0(c[cm.target]) : null,
        duration: cm.duration >= 0 ? norm0(c[cm.duration]) : null,
        desc: cm.desc >= 0 ? norm0(c[cm.desc]) : null,
        page,
      });
      continue;
    }
    // ligne non-table : un titre ferme/ouvre une section de sorts
    if (isHeading(t)) {
      const bare = t.replace(/^#+\s*/, '').replace(/[*_]/g, '').trim();
      if (SPELL_SEC.test(bare) && !/^(magick|langue)/i.test(bare) && !/avantage|inconv[ée]nient|r[èe]gle|apprendre/i.test(bare)) { curType = typeOf(bare); cols = null; }
      else { curType = null; cols = null; }
    }
  }
  return out;
}

const chapters = readdirSync(PDF_DIR).filter((f) => /\.md$/.test(f) && f !== '00 - Index.md')
  .map((f) => ({ f, n: parseInt(f, 10) })).filter((x) => x.n >= 11 && x.n <= 78).sort((a, b) => a.n - b.n).map((x) => x.f);

const byLabel = new Map();
for (const ch of chapters) for (const sp of importChapter(ch)) {
  const k = normKey(sp.label);
  if (OURS_SPELLS.has(k) || OURS_DIVINE.has(normKey(stripDivine(sp.label)))) continue; // officiel (spell OU bénédiction/miracle de culte)
  if (!byLabel.has(k)) byLabel.set(k, sp); // 1re occurrence
}

const spells = [...byLabel.values()].sort((a, b) => a.label.localeCompare(b.label, 'fr')).map((s) => ({
  label: s.label, type: s.type, subType: null, cn: s.cn, range: s.range, target: s.target,
  duration: s.duration, desc: s.desc, source: { book: 'frenchy.bzh', page: s.page },
}));

const args = process.argv.slice(2);
if (args.includes('--write')) {
  writeFileSync(resolve(ROOT, 'src/data/frenchy-spells.json'), JSON.stringify(spells, null, 2), 'utf8');
  console.log(`Écrit src/data/frenchy-spells.json — ${spells.length} sorts frenchy.bzh`);
  const byType = {}; for (const s of spells) byType[s.type] = (byType[s.type] || 0) + 1;
  console.log('par type :', Object.entries(byType).map(([k, v]) => `${v}× ${k}`).join(' | '));
} else {
  console.log(`${spells.length} sorts frenchy.bzh (hors ${OURS_SPELLS.size} officiels)`);
  console.log(spells.slice(0, 12).map((s) => `  ${s.label} [${s.type}] NI${s.cn ?? '?'} — ${(s.desc || '').slice(0, 60)}`).join('\n'));
}
